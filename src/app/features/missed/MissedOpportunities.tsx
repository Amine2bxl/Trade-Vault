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
import { useScreenshotUrls, invalidateScreenshot } from "@/app/hooks/useScreenshotUrls";
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
  Card,
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

  return (
    <PageContainer>
      {/* Cost of hesitation, up front. Seeing "+18.4 R left on the table" is
          what turns this page from a notebook into an argument. */}
      {!loading && items.length > 0 && (
        <KpiGrid className="animate-fade-in-up stagger-1 mb-2.5">
          <MissedTile
            label={t("missed.totalMissed")}
            value={`+${summary.totalR.toFixed(1)}R`}
            accent
          />
          <MissedTile label={t("missed.logged")} value={String(summary.count)} />
          <MissedTile label={t("missed.avgMissed")} value={`${summary.avgR.toFixed(1)}R`} />
        </KpiGrid>
      )}

      {loading ? (
        <div className="tv-missed-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="tv-missed-row h-11 animate-pulse" />
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
        /* UNE liste à séparateurs, pas une pile de cartes : même anatomie que
           la boîte de réception, rien d'imbriqué. */
        <div className="tv-missed-list animate-fade-in-up stagger-2">
          {items.map((m) => {
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
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 md:px-3.5 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
                  aria-expanded={open}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-slate-500 transition-transform shrink-0",
                        open && "rotate-180",
                      )}
                    />
                    {/* ══ LE SYMBOLE ET LA DATE POUSSAIENT LES PASTILLES ═══════
                        Les quatre éléments se suivaient dans un même flux : la
                        pastille verte commençait donc APRÈS le symbole et la
                        date, dont la largeur change à chaque ligne (« US30 »
                        contre « GBPJPY », « 3 mars » contre « 12 mars »). Les
                        pastilles zigzaguaient d'une ligne à l'autre — une fois
                        à gauche, une fois à droite — alors qu'elles portent la
                        même information sur toutes les lignes. L'œil ne peut
                        pas comparer une colonne qui n'en est pas une.

                        Le couple symbole + date devient la zone ÉLASTIQUE
                        (`min-w-0 flex-1`) : c'est lui qui absorbe la variation,
                        en tronquant si besoin.

                        ══ ET SUR TÉLÉPHONE, ILS S'EMPILENT ══════════════════
                        Côte à côte sur 390px, la place manquait : le symbole
                        portait `flex-1`, sa base tombait donc à zéro et
                        `truncate` n'affichait plus RIEN, pendant que la date,
                        en `shrink-0`, débordait sous la pastille verte. La
                        ligne montrait « 15/09/26 » à moitié recouvert et plus
                        aucun instrument — c'est-à-dire qu'elle avait perdu ce
                        qui l'identifie.

                        Empilés, les deux tiennent : le symbole garde sa
                        largeur, la date passe dessous. À partir de `sm` on
                        revient sur une ligne, où la place existe. */}
                    <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2">
                      <span className="tv-figure truncate text-[13px] text-white">
                        {m.symbol || "—"}
                      </span>
                      <span className="tv-figure shrink-0 text-[11px] text-slate-500">
                        {formatShortDate(m.date)}
                      </span>
                    </div>
                  </div>

                  {/* ══ LES DEUX PASTILLES, CHACUNE SUR SON AXE ═══════════════
                      Chaque pastille occupe une case de largeur FIXE et s'y
                      aligne à droite : son bord droit tombe donc au même pixel
                      sur toutes les lignes, quelle que soit la longueur du
                      symbole ou de la date — et la case reste réservée même
                      quand la pastille est absente, sinon la ligne suivante
                      viendrait combler le trou.
                      C'est la file indienne demandée : deux colonnes, pas deux
                      éléments qui flottent. */}
                  <div className="flex shrink-0 items-center gap-2">
                    {/* 56px sous `sm`, pas 76 : la pastille y tient désormais en
                        « +2.4R », et les vingt pixels rendus vont au symbole,
                        qui sortait « E… » pour EURUSD. Entre une réserve
                        confortable pour un chiffre court et l'instrument qui
                        identifie la ligne, c'est l'instrument qui gagne. */}
                    <span className="flex w-[56px] justify-end sm:w-[92px]">
                      {m.estimatedR > 0 && (
                        /* « R missed » en toutes lettres ne tient pas dans
                           76px : la pastille sortait « +2.4 R mi… », une
                           troncature au milieu d'un mot de deux syllabes. Sous
                           `sm` on garde le chiffre et l'unité, qui suffisent
                           dans une colonne dont l'en-tête dit déjà « R left on
                           the table ». */
                        <span className="tv-figure truncate rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-400">
                          +{m.estimatedR.toFixed(1)}
                          <span className="sm:hidden">R</span>
                          <span className="hidden sm:inline"> {t("missed.rMissed")}</span>
                        </span>
                      )}
                    </span>
                    <span className="flex w-[44px] justify-end">
                      {m.screenshots && m.screenshots.length > 0 && (
                        /* L'ÉMOJI 📷 EST DEVENU UNE ICÔNE. Un émoji est rendu
                           par la police du système : il changeait de dessin, de
                           taille et de couleur d'une machine à l'autre, au
                           milieu d'une interface qui n'en utilise nulle part
                           ailleurs. */
                        <span className="tv-figure inline-flex items-center gap-1 px-1 py-0.5 text-[11px] text-slate-500">
                          {m.screenshots.length}
                          <Camera className="h-3 w-3" />
                        </span>
                      )}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setViewing(m)}
                      aria-label={t("missed.preview")}
                      title={t("missed.preview")}
                      className="w-10 h-10 -my-2 md:w-8 md:h-8 md:my-0 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-400 hover:bg-amber-500/10"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditing(m)}
                      aria-label={t("common.edit")}
                      title={t("common.edit")}
                      className="w-10 h-10 -my-2 md:w-8 md:h-8 md:my-0 rounded-lg flex items-center justify-center text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      aria-label={t("common.delete")}
                      title={t("common.delete")}
                      className="w-10 h-10 -my-2 md:w-8 md:h-8 md:my-0 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="px-3 md:px-3.5 pb-3 pt-1 animate-fade-in">
                    <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 md:grid-cols-2">
                      <Field label={t("missed.card.why")} value={m.reasonNotTaken} tone="red" />
                      <Field label={t("missed.card.what")} value={m.whatHappened} tone="amber" />
                      <Field label={t("missed.card.lesson")} value={m.lessonLearned} tone="blue" />
                      <Field label={t("missed.card.next")} value={m.nextTimePlan} tone="emerald" />
                    </div>
                    {m.screenshots && m.screenshots.length > 0 && (
                      <div className="mt-3">
                        <ScreenshotsView paths={m.screenshots} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
function MissedTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <Kpi label={label} value={value} tone={accent ? "warn" : "neutral"} />;
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
  const resolvedUrls = paths.map((p) => urls[p]).filter(Boolean);
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
            {urls[p] ? (
              <button
                type="button"
                onClick={() => setLightboxIndex(resolvedUrls.indexOf(urls[p]))}
                className="block w-full h-full"
              >
                <img
                  src={urls[p]}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={() => {
                    invalidateScreenshot(p);
                  }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <span
                    className={cn(
                      "opacity-0 group-hover:opacity-100 transition-opacity text-white font-semibold bg-black/50 rounded-md backdrop-blur-sm",
                      size === "lg" ? "text-xs px-2.5 py-1" : "text-[10px] px-1.5 py-0.5",
                    )}
                  >
                    {t("common.view")}
                  </span>
                </div>
                {size === "lg" && (
                  <span className="tv-num absolute bottom-1.5 right-1.5 text-[10px] font-bold text-white/80 bg-black/50 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                    {i + 1}/{paths.length}
                  </span>
                )}
              </button>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
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
          images={resolvedUrls}
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
