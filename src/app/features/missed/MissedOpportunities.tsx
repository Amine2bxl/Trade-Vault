import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Plus,
  Target,
  Trash2,
  Pencil,
  Eye,
  X,
  Save,
  ImagePlus,
  Loader2,
  ChevronDown,
  Camera,
  Download,
  ArrowLeft,
  ArrowRight,
} from "@/shared/ui/icons";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAccounts } from "@/app/contexts/AccountContext";
import { MissedOpportunity } from "@/app/types";
import {
  loadMissedOpportunities,
  upsertMissedOpportunity,
  deleteMissedOpportunity,
  generateId,
  uploadMissedScreenshot,
  deleteScreenshot,
} from "@/app/store";
import { useScreenshotUrls } from "@/app/hooks/useScreenshotUrls";
import { ScreenshotImage } from "@/app/components/ScreenshotImage";
import { formatShortDate } from "@/domain/tradeCalcs";
import { compressImageToFile } from "@/app/utils/image";
import { cn } from "@/shared/ui/cn";
import { useT } from "@/app/i18n/LanguageContext";
import { useToast } from "@/app/contexts/ToastContext";
import { useConfirm } from "@/app/contexts/ConfirmContext";
import Lightbox from "@/app/components/Lightbox";
import MissedSetupDetailModal from "./MissedSetupDetailModal";
import { useRealtimeTable } from "@/app/hooks/useRealtimeTable";
import { usePreviewMode } from "@/app/features/billing/PremiumGate";
import { previewMissed } from "@/app/utils/previewTrades";
import {
  PageContainer,
  Button,
  EmptyState,
  Modal,
  Textarea,
  Input,
  DateField,
  Kpi,
  KpiGrid,
  FormSection,
  FormLabel,
} from "@/shared/ui";
import { intlLocale } from "@/app/i18n/locale";
import { useDraftAutosave } from "@/app/hooks/useDraftAutosave";
import { nsKey, readJSON, removeKey } from "@/app/utils/persistence";
import { usePageActions } from "@/app/contexts/PageActionsContext";
import { todayLocalDate } from "@/shared/calendar-date";

function emptyMissed(): MissedOpportunity {
  return {
    id: generateId(),
    date: todayLocalDate(),
    symbol: "",
    reasonNotTaken: "",
    whatHappened: "",
    lessonLearned: "",
    nextTimePlan: "",
    estimatedR: 0,
    screenshots: [],
  };
}

export default function MissedOpportunities() {
  const { user } = useAuth();
  const { activeId } = useAccounts();
  const { t, lang } = useT();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<MissedOpportunity[]>([]);
  const [editing, setEditing] = useState<MissedOpportunity | null>(null);
  const [viewing, setViewing] = useState<MissedOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggleOpen = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exportCsv = useCallback(() => {
    if (items.length === 0) return;
    const headers = [
      "Date",
      "Symbol",
      "Estimated R",
      "Reason Not Taken",
      "What Happened",
      "Lesson Learned",
      "Next Time Plan",
      "Screenshots",
    ];
    const escape = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = items.map((m) =>
      [
        m.date,
        m.symbol,
        m.estimatedR,
        m.reasonNotTaken,
        m.whatHappened,
        m.lessonLearned,
        m.nextTimePlan,
        (m.screenshots ?? []).length,
      ]
        .map(escape)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `missed-setups-${todayLocalDate()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [items]);

  // Derrière le mur d'aperçu : jeu d'exemple, aucune requête. Un état vide ne
  // vend pas une page dont l'intérêt est précisément d'être remplie.
  const preview = usePreviewMode();

  const reload = useCallback(() => {
    if (!user) return;
    loadMissedOpportunities(user.id)
      .then(setItems)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (preview) {
      setItems(previewMissed(lang === "fr"));
      setLoading(false);
      return;
    }
    if (!user) return;
    let active = true;
    loadMissedOpportunities(user.id)
      .then((d) => {
        if (active) setItems(d);
      })
      .catch((e) => console.error(e))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, activeId, preview, lang]);

  // Live entre appareils : un setup manqué ajouté sur le téléphone apparaît
  // ici sans rafraîchir.
  useRealtimeTable("missed_opportunities", user?.id, reload);

  const handleSave = useCallback(
    async (m: MissedOpportunity) => {
      if (!user) return;
      try {
        const clean: MissedOpportunity = { ...m, screenshots: m.screenshots ?? [] };
        await upsertMissedOpportunity(user.id, clean);
        setItems((prev) => {
          const exists = prev.find((x) => x.id === clean.id);
          return exists ? prev.map((x) => (x.id === clean.id ? clean : x)) : [clean, ...prev];
        });
        setEditing(null);
      } catch (e) {
        console.error(e);
        toast(t("missed.saveFailed"), "error");
      }
    },
    [user, t, toast],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!user) return;
      if (!(await confirm(t("missed.confirmDelete"), { danger: true }))) return;
      const target = items.find((x) => x.id === id);
      // Best-effort cleanup of orphaned screenshots in storage
      if (target?.screenshots?.length) {
        await Promise.all(target.screenshots.map((p) => deleteScreenshot(p).catch(() => {})));
      }
      await deleteMissedOpportunity(user.id, id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    },
    [user, t, items, confirm],
  );

  // The whole point of the page in three numbers: how much edge was skipped.
  // Derived from the loaded rows — no extra query, no extra state.
  const summary = useMemo(() => {
    const totalR = items.reduce((sum, m) => sum + (m.estimatedR || 0), 0);
    return { totalR, count: items.length, avgR: items.length ? totalR / items.length : 0 };
  }, [items]);

  const headerActions = useMemo(
    () => (
      <div className="flex items-center gap-2 shrink-0">
        {items.length > 0 && (
          <Button variant="subtle" size="sm" onClick={exportCsv} title={t("missed.exportCsv")}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t("missed.exportCsv")}</span>
          </Button>
        )}
        {/* `accent` et non le vert plein : cette page a sa propre action, elle
            n'a pas à emprunter le bloc vert du tableau de bord. Même forme et
            même poids que « exporter » juste à côté, la teinte de l'accent en
            plus — elle se fond dans la famille sans se perdre. */}
        <Button variant="accent" size="sm" onClick={() => setEditing(emptyMissed())}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t("missed.log")}</span>
          <span className="sm:hidden">{t("missed.logShort")}</span>
        </Button>
      </div>
    ),

    [items.length, exportCsv, t],
  );
  usePageActions(headerActions);

  /* LE FLUX, GROUPÉ PAR MOIS — comme les opérations d'un relevé Revolut. Les
     lignes arrivent triées de la base, mais une date modifiée à l'édition
     casserait l'ordre : on retrie une copie, sans toucher à l'état. */
  const groups = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale(lang), { month: "long", year: "numeric" });
    const out: { key: string; label: string; totalR: number; items: MissedOpportunity[] }[] = [];
    for (const m of [...items].sort((a, b) => b.date.localeCompare(a.date))) {
      const key = (m.date || "").slice(0, 7);
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        const [y, mo] = key.split("-").map(Number);
        g = {
          key,
          label: y && mo ? fmt.format(new Date(y, mo - 1, 1)) : "—",
          totalR: 0,
          items: [],
        };
        out.push(g);
      }
      g.items.push(m);
      g.totalR += m.estimatedR || 0;
    }
    return out;
  }, [items, lang]);

  /* Les six derniers mois calendaires, mois courant compris : le R laissé sur
     la table, mois par mois. Calculé ici, depuis les lignes chargées — aucune
     requête. La date métier vient de `todayLocalDate()`, jamais de l'UTC. */
  const months = useMemo(() => {
    const [ty, tm] = todayLocalDate().split("-").map(Number);
    const fmt = new Intl.DateTimeFormat(intlLocale(lang), { month: "short" });
    const out: { key: string; label: string; r: number; n: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ty, tm - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push({ key, label: fmt.format(d), r: 0, n: 0 });
    }
    for (const m of items) {
      const slot = out.find((x) => x.key === (m.date || "").slice(0, 7));
      if (slot) {
        slot.r += m.estimatedR || 0;
        slot.n += 1;
      }
    }
    return out;
  }, [items, lang]);
  const maxMonthR = Math.max(0, ...months.map((x) => x.r));

  return (
    <PageContainer>
      {loading ? (
        <div className="tv-missed-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="tv-missed-row h-16 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Target className="w-7 h-7" />}
          title={t("missed.empty.title")}
          description={t("missed.empty.sub")}
          action={
            <Button size="sm" onClick={() => setEditing(emptyMissed())}>
              <Plus className="w-4 h-4" /> {t("missed.log")}
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
          {/* ── LA SYNTHÈSE : le coût de l'hésitation, en chiffre héros ──────
              « +13.7 R laissés sur la table » est ce qui fait de cette page un
              argument et non un carnet. Dessous, le même chiffre mois par mois,
              puis les deux cases qui le contextualisent (n et moyenne). */}
          <aside className="animate-fade-in-up space-y-3">
            <section className="tv-missed-hero">
              <p className="tv-set-hero-eyebrow">{t("missed.totalMissed")}</p>
              <div className="tv-missed-hero-figure">
                +{summary.totalR.toFixed(1)}
                <span>R</span>
              </div>
              <div className="tv-missed-bars" role="list" aria-label={t("missed.byMonth")}>
                {months.map((mo, i) => (
                  <div
                    key={mo.key}
                    role="listitem"
                    className="tv-missed-bar-col"
                    title={`${mo.label} · +${mo.r.toFixed(1)}R · ${mo.n}`}
                  >
                    <span className="tv-missed-bar-value">
                      {mo.r > 0 ? `+${mo.r.toFixed(1)}` : ""}
                    </span>
                    <span className="tv-missed-bar-track">
                      <span
                        className="tv-missed-bar"
                        data-on={i === months.length - 1}
                        style={{
                          height:
                            maxMonthR > 0 && mo.r > 0
                              ? `${Math.max(6, (mo.r / maxMonthR) * 100)}%`
                              : "0%",
                        }}
                      />
                    </span>
                    <span className="tv-missed-bar-label">{mo.label}</span>
                  </div>
                ))}
              </div>
            </section>
            <KpiGrid cols={2}>
              <MissedTile label={t("missed.logged")} value={String(summary.count)} />
              <MissedTile label={t("missed.avgMissed")} value={`${summary.avgR.toFixed(1)}R`} />
            </KpiGrid>
          </aside>

          {/* ── LE FLUX : un mois, une liste groupée ─────────────────────────
              Même anatomie que les réglages : plaque à grand rayon, rangées
              séparées par un filet rentré, rien d'imbriqué. */}
          <div className="animate-fade-in-up stagger-2 min-w-0 space-y-6">
            {groups.map((g) => (
              <section key={g.key} className="space-y-2.5">
                <div className="tv-missed-month">
                  <span className="truncate">{g.label}</span>
                  <span className="tv-figure shrink-0">
                    {g.items.length} · +{g.totalR.toFixed(1)}R
                  </span>
                </div>
                <div className="tv-missed-list">
                  {g.items.map((m) => {
                    const open = openIds.has(m.id);
                    return (
                      <div key={m.id} className="tv-missed-row" data-open={open}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleOpen(m.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleOpen(m.id);
                            }
                          }}
                          className="tv-missed-head"
                          aria-expanded={open}
                        >
                          {/* Le disque de l'instrument, à la place du logo
                              d'un marchand dans un relevé. */}
                          <span className="tv-missed-disc" aria-hidden>
                            {(m.symbol || "?").slice(0, 2)}
                          </span>
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {/* Le couple symbole + date (+ la raison, en clair)
                                est la zone ÉLASTIQUE : c'est elle qui absorbe
                                la variation de longueur et tronque — jamais les
                                colonnes de droite. */}
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="tv-figure tv-missed-sym truncate">
                                {m.symbol || "—"}
                              </span>
                              <span className="tv-missed-sub truncate">
                                {formatShortDate(m.date)}
                                {m.reasonNotTaken ? ` · ${m.reasonNotTaken}` : ""}
                              </span>
                            </div>
                          </div>

                          {/* ══ DEUX COLONNES, CHACUNE SUR SON AXE ═══════════
                              Chaque valeur occupe une case de largeur FIXE et
                              s'y aligne à droite : son bord droit tombe au même
                              pixel sur toutes les lignes, et la case reste
                              réservée même quand la valeur est absente. */}
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="flex w-[64px] justify-end sm:w-[80px]">
                              {m.estimatedR > 0 && (
                                <span className="tv-missed-r">
                                  +{m.estimatedR.toFixed(1)}
                                  <span className="tv-missed-r-unit">R</span>
                                </span>
                              )}
                            </span>
                            <span className="flex w-[36px] justify-end">
                              {m.screenshots && m.screenshots.length > 0 && (
                                <span className="tv-figure inline-flex items-center gap-1 text-[11px] text-slate-500">
                                  {m.screenshots.length}
                                  <Camera className="h-3 w-3" />
                                </span>
                              )}
                            </span>
                          </div>
                          <div
                            className="tv-missed-actions hidden shrink-0 items-center gap-0.5 sm:flex"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => setViewing(m)}
                              aria-label={t("missed.preview")}
                              title={t("missed.preview")}
                              className="tv-missed-act"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditing(m)}
                              aria-label={t("common.edit")}
                              title={t("common.edit")}
                              className="tv-missed-act"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(m.id)}
                              aria-label={t("common.delete")}
                              title={t("common.delete")}
                              className="tv-missed-act"
                              data-danger
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-slate-500 transition-transform",
                              open && "rotate-180",
                            )}
                            aria-hidden
                          />
                        </div>
                        {open && (
                          <div className="tv-missed-detail animate-fade-in">
                            <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 md:grid-cols-2">
                              <Field
                                label={t("missed.card.why")}
                                value={m.reasonNotTaken}
                                tone="red"
                              />
                              <Field
                                label={t("missed.card.what")}
                                value={m.whatHappened}
                                tone="amber"
                              />
                              <Field
                                label={t("missed.card.lesson")}
                                value={m.lessonLearned}
                                tone="blue"
                              />
                              <Field
                                label={t("missed.card.next")}
                                value={m.nextTimePlan}
                                tone="emerald"
                              />
                            </div>
                            {m.screenshots && m.screenshots.length > 0 && (
                              <div className="mt-4">
                                <ScreenshotsView paths={m.screenshots} />
                              </div>
                            )}
                            {/* Sur téléphone, les actions vivent ici, à pleine
                                taille tactile : la ligne garde sa place pour
                                l'instrument et le R. */}
                            <div className="mt-4 flex flex-wrap gap-2 sm:hidden">
                              <Button variant="subtle" size="sm" onClick={() => setViewing(m)}>
                                <Eye className="h-3.5 w-3.5" />
                                {t("missed.preview")}
                              </Button>
                              <Button variant="subtle" size="sm" onClick={() => setEditing(m)}>
                                <Pencil className="h-3.5 w-3.5" />
                                {t("common.edit")}
                              </Button>
                              <Button variant="danger" size="sm" onClick={() => handleDelete(m.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                                {t("common.delete")}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {viewing && <MissedSetupDetailModal missed={viewing} onClose={() => setViewing(null)} />}

      {editing && (
        <MissedEditor value={editing} onClose={() => setEditing(null)} onSave={handleSave} />
      )}
    </PageContainer>
  );
}

/** Three flat tiles above the list — same visual weight as the Journal summary
 *  so both "list" pages of the product read the same way.
 *
 *  Elles redessinaient la case à la main : même plaque, même liseré, même
 *  rembourrage que `.tv-kpi`, écrits une deuxième fois. C'est `Kpi` — donc les
 *  deux pages de liste ne se ressemblent plus par coïncidence, elles portent
 *  la même primitive. */
function MissedTile({ label, value }: { label: string; value: string }) {
  return <Kpi label={label} value={value} />;
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "red" | "amber" | "blue" | "emerald";
}) {
  // La couleur de la catégorie tient dans une pastille, pas dans un cadre :
  // la fiche dépliée reste à plat, sans boîte dans la boîte.
  const dots: Record<string, string> = {
    red: "var(--tv-chart-red)",
    amber: "var(--tv-warning)",
    blue: "var(--tv-highlight)",
    emerald: "var(--tv-chart-green)",
  };
  return (
    <div className="min-w-0">
      <div className="tv-label mb-0.5 flex items-center gap-1.5 text-slate-400">
        <span className="tv-trade-req" style={{ background: dots[tone] }} aria-hidden />
        {label}
      </div>
      <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-200">
        {value || <span className="text-slate-600">—</span>}
      </div>
    </div>
  );
}

export function ScreenshotsView({
  paths,
  onRemove,
  onReorder,
  size = "sm",
}: {
  paths: string[];
  onRemove?: (p: string) => void;
  /** Fourni = les captures deviennent réordonnables (glisser-déposer + flèches). */
  onReorder?: (from: number, to: number) => void;
  size?: "sm" | "lg";
}) {
  const { t } = useT();
  // Batched + cached signed-URL resolution shared with the trade modals.
  const urls = useScreenshotUrls(paths);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const dragIndex = useRef<number | null>(null);

  return (
    <>
      <div
        className={cn(
          "grid gap-2",
          size === "lg" ? "grid-cols-2 sm:grid-cols-3 gap-3" : "grid-cols-3",
        )}
      >
        {paths.map((p, i) => (
          <div
            key={p}
            draggable={!!onReorder}
            onDragStart={() => {
              dragIndex.current = i;
            }}
            onDragOver={(e) => {
              if (onReorder) e.preventDefault();
            }}
            onDrop={(e) => {
              if (!onReorder) return;
              e.preventDefault();
              if (dragIndex.current !== null) onReorder(dragIndex.current, i);
              dragIndex.current = null;
            }}
            onDragEnd={() => {
              dragIndex.current = null;
            }}
            className={cn(
              "relative group aspect-video overflow-hidden bg-white/[0.04] border border-white/[0.08] hover:border-cyan-500/30 transition",
              onReorder && "cursor-grab active:cursor-grabbing",
              size === "lg" ? "rounded-2xl shadow-lg shadow-black/20" : "rounded-xl",
            )}
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="block w-full h-full"
            >
              <ScreenshotImage
                path={p}
                url={urls[p] ?? ""}
                alt=""
                boxClassName="w-full h-full"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <span
                  className={cn(
                    "opacity-0 group-hover:opacity-100 transition-opacity text-white font-semibold bg-black/60 rounded-md",
                    size === "lg" ? "text-xs px-2.5 py-1" : "text-[10px] px-1.5 py-0.5",
                  )}
                >
                  {t("common.view")}
                </span>
              </div>
              {size === "lg" && (
                <span className="tv-num absolute bottom-1.5 right-1.5 text-[10px] font-bold text-white/80 bg-black/60 px-1.5 py-0.5 rounded-md">
                  {i + 1}/{paths.length}
                </span>
              )}
            </button>
            {onReorder && paths.length > 1 && (
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => onReorder(i, i - 1)}
                  aria-label={t("trade.moveScreenshotLeft")}
                  className="flex-1 py-1 grid place-items-center text-white disabled:opacity-25"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={i === paths.length - 1}
                  onClick={() => onReorder(i, i + 1)}
                  aria-label={t("trade.moveScreenshotRight")}
                  className="flex-1 py-1 grid place-items-center text-white disabled:opacity-25"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(p)}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 hover:bg-red-500/80 text-white flex items-center justify-center backdrop-blur"
                aria-label={t("common.remove")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {lightboxIndex !== null && (
        <Lightbox
          paths={paths}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </>
  );
}

export function MissedEditor({
  value,
  onClose,
  onSave,
}: {
  value: MissedOpportunity;
  onClose: () => void;
  onSave: (m: MissedOpportunity) => void;
}) {
  const { user } = useAuth();
  const { t, lang } = useT();
  const { toast } = useToast();
  // Même filet que la popup de trade : ce qui est écrit ici survit à un clic
  // à côté, à une coupure ou à un onglet fermé.
  const draftKey = nsKey(user?.id, `draft.missed.${value.id}`);
  const [m, setM] = useState<MissedOpportunity>(() => {
    const pending = readJSON<Partial<MissedOpportunity> | null>(draftKey, null);
    return pending ? { ...value, ...pending, screenshots: value.screenshots ?? [] } : value;
  });
  const savedRef = useRef(false);
  const initial = useRef<string | null>(null);
  const body = useMemo(() => {
    const { screenshots: _omit, ...rest } = m;
    void _omit;
    return JSON.stringify(rest);
  }, [m]);
  if (initial.current === null) initial.current = body;
  const dirty = body !== initial.current;

  useDraftAutosave(draftKey, m, {
    dirty,
    omit: ["screenshots"],
    guard: () => !savedRef.current,
  });

  const reorderShots = useCallback((from: number, to: number) => {
    setM((prev) => {
      const shots = [...(prev.screenshots ?? [])];
      if (to < 0 || to >= shots.length || from === to) return prev;
      const [moved] = shots.splice(from, 1);
      shots.splice(to, 0, moved);
      return { ...prev, screenshots: shots };
    });
  }, []);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof MissedOpportunity>(k: K, v: MissedOpportunity[K]) =>
    setM((p) => ({ ...p, [k]: v }));

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || !user) return;
      const current = m.screenshots ?? [];
      const slots = 3 - current.length;
      if (slots <= 0) {
        toast(t("missed.maxImages"), "info");
        return;
      }
      const picks = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, slots);
      if (picks.length === 0) return;
      setUploading(true);
      try {
        const uploaded: string[] = [];
        for (const f of picks) {
          // Compress client-side first: high-DPI PNGs routinely exceed the 8 MB
          // storage limit and would fail. JPEG output stays well under it.
          const compressed = await compressImageToFile(f);
          const path = await uploadMissedScreenshot(user.id, compressed);
          uploaded.push(path);
        }
        setM((prev) => ({ ...prev, screenshots: [...(prev.screenshots ?? []), ...uploaded] }));
      } catch (e) {
        console.error(e);
        toast(t("missed.uploadFailed"), "error");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [user, m.screenshots, t, toast],
  );

  const removeShot = useCallback((path: string) => {
    setM((prev) => ({ ...prev, screenshots: (prev.screenshots ?? []).filter((p) => p !== path) }));
    deleteScreenshot(path).catch(() => {});
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = Array.from(items)
        .filter((it) => it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter((f): f is File => !!f);
      if (files.length === 0) return;
      e.preventDefault();
      handleFiles(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [handleFiles]);

  /* Les mêmes repères que la saisie d'un trade : sections numérotées qui se
     cochent, pastilles de couleur reprises de la fiche (rouge « pourquoi »,
     ambre « ce qui s'est passé », menthe « leçon », vert « la prochaine
     fois »), chiffres dans la police du calendrier. */
  const r = Number(m.estimatedR) || 0;
  const tone = r > 0 ? "up" : r < 0 ? "down" : "flat";
  const setupDone = m.symbol.trim() !== "" && !!m.date;
  const storyDone = m.reasonNotTaken.trim() !== "" && m.whatHappened.trim() !== "";
  const lessonDone = m.lessonLearned.trim() !== "" && m.nextTimePlan.trim() !== "";
  const shots = m.screenshots ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      // Une saisie en cours ne se referme pas sur un clic à côté.
      closeOnBackdrop={!dirty}
      className="tv-trade-modal tv-compact-form relative flex max-h-[min(92dvh,760px)] flex-col overflow-hidden md:max-w-2xl"
      labelledBy="missed-editor-title"
    >
      <div className="tv-trade-stripe" data-tone={tone} aria-hidden />
      <header className="flex shrink-0 items-center gap-2.5 border-b border-[var(--tv-border)] px-4 py-2.5 sm:px-5">
        <span className="tv-trade-pill tv-missed-pill">
          <Target className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="missed-editor-title" className="tv-title leading-tight">
            {t("missed.modalTitle")}
          </h2>
          <p className="tv-row-label truncate">
            {m.symbol ? `${m.symbol} · ` : ""}
            {t("missed.editorHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="tv-trade-form min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
        {/* 1 — LE SETUP */}
        <FormSection n={1} title={t("missed.secSetup")} done={setupDone}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <FormLabel ok={!!m.date}>{t("missed.field.date")}</FormLabel>
              <DateField
                value={m.date}
                onChange={(v) => set("date", v)}
                locale={intlLocale(lang)}
                todayLabel={t("common.today")}
                aria-label={t("missed.field.date")}
              />
            </div>
            <label className="block min-w-0">
              <FormLabel ok={m.symbol.trim() !== ""}>{t("missed.field.symbol")}</FormLabel>
              <Input
                value={m.symbol}
                onChange={(e) => set("symbol", e.target.value.toUpperCase())}
                placeholder="ES"
                className="tv-figure"
              />
            </label>
            <label className="block min-w-0">
              <FormLabel>{t("missed.field.estR")}</FormLabel>
              <Input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={String(m.estimatedR)}
                onChange={(e) => set("estimatedR", Number(e.target.value) || 0)}
                className="tv-figure tv-trade-pnl-input"
                data-tone={tone}
              />
            </label>
          </div>
        </FormSection>

        {/* 2 — CE QUI S'EST PASSÉ */}
        <FormSection n={2} title={t("missed.secStory")} done={storyDone}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="block min-w-0">
              <FormLabel dot="var(--tv-chart-red)">{t("missed.field.why")}</FormLabel>
              <Textarea
                value={m.reasonNotTaken}
                onChange={(e) => set("reasonNotTaken", e.target.value)}
                placeholder={t("missed.field.whyPh")}
                rows={2}
              />
            </label>
            <label className="block min-w-0">
              <FormLabel dot="var(--tv-warning)">{t("missed.field.what")}</FormLabel>
              <Textarea
                value={m.whatHappened}
                onChange={(e) => set("whatHappened", e.target.value)}
                placeholder={t("missed.field.whatPh")}
                rows={2}
              />
            </label>
          </div>
        </FormSection>

        {/* 3 — LA LEÇON */}
        <FormSection n={3} title={t("missed.secLesson")} done={lessonDone}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="block min-w-0">
              <FormLabel dot="var(--tv-highlight)">{t("missed.field.lesson")}</FormLabel>
              <Textarea
                value={m.lessonLearned}
                onChange={(e) => set("lessonLearned", e.target.value)}
                placeholder={t("missed.field.lessonPh")}
                rows={2}
              />
            </label>
            <label className="block min-w-0">
              <FormLabel dot="var(--tv-chart-green)">{t("missed.field.next")}</FormLabel>
              <Textarea
                value={m.nextTimePlan}
                onChange={(e) => set("nextTimePlan", e.target.value)}
                placeholder={t("missed.field.nextPh")}
                rows={2}
              />
            </label>
          </div>
        </FormSection>

        {/* 4 — CAPTURES */}
        <FormSection n={4} title={t("missed.field.screenshots")} done={shots.length > 0}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="tv-figure text-[11px] text-slate-500">{shots.length}/3</span>
            <span className="text-[11px] text-slate-500">
              {t("missed.field.screenshotsHint")}
              <span className="hidden sm:inline"> · {t("common.pasteHint")}</span>
            </span>
          </div>
          {shots.length > 0 && (
            <ScreenshotsView paths={shots} onRemove={removeShot} onReorder={reorderShots} />
          )}
          {shots.length < 3 && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="tv-trade-drop h-11 w-full flex-row gap-2 text-[12px] disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("missed.uploading")}
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-4 w-4" /> {t("missed.addImage")}
                  </>
                )}
              </button>
            </>
          )}
        </FormSection>
      </div>
      <footer className="flex shrink-0 items-center gap-2 border-t border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-[12px] text-slate-500">
          {m.symbol ? (
            <>
              <span className="tv-figure shrink-0 text-white">{m.symbol}</span>
              <span className="tv-figure tv-trade-recap-pnl shrink-0 text-[14px]" data-tone={tone}>
                {r > 0 ? "+" : ""}
                {r.toFixed(1)}R
              </span>
            </>
          ) : (
            <span className="truncate">{t("missed.fillRequired")}</span>
          )}
        </div>
        <Button variant="ghost" onClick={onClose} className="shrink-0">
          {t("common.cancel")}
        </Button>
        <Button
          variant="entry"
          onClick={() => {
            // Enregistré : le brouillon a fait son office.
            savedRef.current = true;
            removeKey(draftKey);
            onSave(m);
          }}
          disabled={uploading || !setupDone}
          className="shrink-0"
        >
          <Save className="h-4 w-4" /> {t("common.save")}
        </Button>
      </footer>
    </Modal>
  );
}
