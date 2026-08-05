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
  Download,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { MissedOpportunity } from "../types";
import {
  loadMissedOpportunities,
  upsertMissedOpportunity,
  deleteMissedOpportunity,
  generateId,
  uploadMissedScreenshot,
  deleteScreenshot,
} from "../store";
import { useScreenshotUrls } from "../hooks/useScreenshotUrls";
import { formatShortDate } from "../utils/tradeCalcs";
import { compressImageToFile } from "../utils/image";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import Lightbox from "../components/Lightbox";
import MissedSetupDetailModal from "../components/MissedSetupDetailModal";
import {
  PageHeader,
  Card,
  PageContainer,
  Button,
  EmptyState,
  Modal,
  FIELD_BASE,
} from "@/shared/ui";

function emptyMissed(): MissedOpportunity {
  return {
    id: generateId(),
    date: new Date().toISOString().slice(0, 10),
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
  const { t } = useT();
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
    a.download = `missed-setups-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [items]);

  useEffect(() => {
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
  }, [user?.id, activeId]);

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

  return (
    <PageContainer className="max-w-[1100px]">
      <PageHeader
        className="items-center"
        title={t("missed.title")}
        subtitle={t("missed.subtitle")}
        actions={
          <div className="flex items-center gap-2 shrink-0">
            {items.length > 0 && (
              <Button variant="subtle" size="sm" onClick={exportCsv} title={t("missed.exportCsv")}>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{t("missed.exportCsv")}</span>
              </Button>
            )}
            <Button size="sm" onClick={() => setEditing(emptyMissed())}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t("missed.log")}</span>
              <span className="sm:hidden">{t("missed.logShort")}</span>
            </Button>
          </div>
        }
      />

      {/* Cost of hesitation, up front. Seeing "+18.4 R left on the table" is
          what turns this page from a notebook into an argument. */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2.5 animate-fade-in-up stagger-1">
          <MissedTile
            label={t("missed.totalMissed")}
            value={`+${summary.totalR.toFixed(1)}R`}
            accent
          />
          <MissedTile label={t("missed.logged")} value={String(summary.count)} />
          <MissedTile label={t("missed.avgMissed")} value={`${summary.avgR.toFixed(1)}R`} />
        </div>
      )}

      {loading ? (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass rounded-2xl h-11 animate-pulse" />
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
        <div className="space-y-1.5">
          {items.map((m) => {
            const open = openIds.has(m.id);
            return (
              <div
                key={m.id}
                className={cn(
                  "glass rounded-2xl overflow-hidden border transition-colors",
                  open ? "border-amber-500/20" : "border-transparent",
                )}
              >
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
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 md:px-3.5 text-left hover:bg-white/[0.02] transition cursor-pointer"
                  aria-expanded={open}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-slate-500 transition-transform shrink-0",
                        open && "rotate-180",
                      )}
                    />
                    <span className="text-sm font-bold text-white">{m.symbol || "—"}</span>
                    <span className="text-[10px] text-slate-500">{formatShortDate(m.date)}</span>
                    {m.estimatedR > 0 && (
                      <span className="shrink-0 rounded-lg border border-emerald-500/25 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        +{m.estimatedR.toFixed(1)} {t("missed.rMissed")}
                      </span>
                    )}
                    {m.screenshots && m.screenshots.length > 0 && (
                      <span className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                        {m.screenshots.length} 📷
                      </span>
                    )}
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
                  <div className="px-3 md:px-3.5 pb-3 pt-0.5 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs md:text-sm">
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
 *  so both "list" pages of the product read the same way. */
function MissedTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="text-[11px] md:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-display text-[15px] md:text-base font-extrabold tabular-nums tracking-tight",
          accent ? "text-amber-300" : "text-white",
        )}
      >
        {value}
      </div>
    </div>
  );
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
  const tones: Record<string, string> = {
    red: "text-red-400 border-red-500/15",
    amber: "text-amber-400 border-amber-500/15",
    blue: "text-cyan-400 border-cyan-500/15",
    emerald: "text-emerald-400 border-emerald-500/15",
  };
  return (
    <div className={cn("rounded-lg bg-white/[0.02] border px-2.5 py-2", tones[tone])}>
      <div className="text-[11px] uppercase tracking-wider font-bold mb-0.5 opacity-80">
        {label}
      </div>
      <div className="text-slate-200 text-xs md:text-sm whitespace-pre-wrap">
        {value || <span className="text-slate-600 italic">—</span>}
      </div>
    </div>
  );
}

export function ScreenshotsView({
  paths,
  onRemove,
  size = "sm",
}: {
  paths: string[];
  onRemove?: (p: string) => void;
  size?: "sm" | "lg";
}) {
  const { t } = useT();
  // Batched + cached signed-URL resolution shared with the trade modals.
  const urls = useScreenshotUrls(paths);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const resolvedUrls = paths.map((p) => urls[p]).filter(Boolean);

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
            className={cn(
              "relative group aspect-video overflow-hidden bg-white/[0.04] border border-white/[0.08] hover:border-cyan-500/30 transition-all",
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
                  <span className="absolute bottom-1.5 right-1.5 text-[10px] font-bold text-white/80 bg-black/50 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                    {i + 1}/{paths.length}
                  </span>
                )}
              </button>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
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

function MissedEditor({
  value,
  onClose,
  onSave,
}: {
  value: MissedOpportunity;
  onClose: () => void;
  onSave: (m: MissedOpportunity) => void;
}) {
  const { user } = useAuth();
  const { t } = useT();
  const { toast } = useToast();
  const [m, setM] = useState<MissedOpportunity>(value);
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

  return (
    <Modal
      open
      onClose={onClose}
      className="md:max-w-2xl max-h-[96vh] md:max-h-[92vh] overflow-hidden"
      labelledBy="missed-editor-title"
    >
      {/* Same shell as the Add Trade modal: a 2px accent rule, a 24px-padded
          header row, a scrolling body and a sticky action footer. The two
          popups are now literally the same architecture — only the accent
          colour (amber vs cyan) and the fields differ. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/[0.06]">
        <h2
          id="missed-editor-title"
          className="text-lg font-bold text-white flex items-center gap-2.5"
        >
          <Target className="w-4.5 h-4.5 text-amber-400 shrink-0" />
          {t("missed.modalTitle")}
        </h2>
        <button
          onClick={onClose}
          aria-label={t("common.close")}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-y-auto max-h-[calc(92vh-130px)] px-4 sm:px-6 py-4 space-y-4">
        {/* Grille responsive : 1 colonne sur mobile (jamais empilé/cramé),
            3 sur desktop. La date passe par des bulles de présélection. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DateBubbles
            value={m.date}
            onChange={(v) => set("date", v)}
            label={t("missed.field.date")}
          />
          <FieldInput
            label={t("missed.field.symbol")}
            value={m.symbol}
            onChange={(v) => set("symbol", v.toUpperCase())}
            placeholder="ES"
          />
          <FieldInput
            label={t("missed.field.estR")}
            type="number"
            value={String(m.estimatedR)}
            onChange={(v) => set("estimatedR", Number(v) || 0)}
            step="0.1"
          />
        </div>
        <FieldArea
          label={t("missed.field.why")}
          value={m.reasonNotTaken}
          onChange={(v) => set("reasonNotTaken", v)}
          placeholder={t("missed.field.whyPh")}
        />
        <FieldArea
          label={t("missed.field.what")}
          value={m.whatHappened}
          onChange={(v) => set("whatHappened", v)}
          placeholder={t("missed.field.whatPh")}
        />
        <FieldArea
          label={t("missed.field.lesson")}
          value={m.lessonLearned}
          onChange={(v) => set("lessonLearned", v)}
          placeholder={t("missed.field.lessonPh")}
        />
        <FieldArea
          label={t("missed.field.next")}
          value={m.nextTimePlan}
          onChange={(v) => set("nextTimePlan", v)}
          placeholder={t("missed.field.nextPh")}
        />

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className={cn(EDITOR_LABEL, "mb-0")}>
              {t("missed.field.screenshots")}{" "}
              <span className="text-slate-600">({(m.screenshots ?? []).length}/3)</span>
            </span>
            <span className="text-[10px] text-slate-600">
              {t("missed.field.screenshotsHint")} · {t("common.pasteHint")}
            </span>
          </div>
          <ScreenshotsView paths={m.screenshots ?? []} onRemove={removeShot} />
          {(m.screenshots ?? []).length < 3 && (
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
                className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.05] text-sm text-slate-300 hover:text-white transition disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> {t("missed.uploading")}
                  </>
                ) : (
                  <>
                    <ImagePlus className="w-4 h-4" /> {t("missed.addImage")}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 px-4 sm:px-6 py-3 border-t border-white/[0.06]">
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={() => onSave(m)}
          disabled={uploading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 transition-all"
        >
          <Save className="w-4 h-4" /> {t("common.save")}
        </button>
      </div>
    </Modal>
  );
}

// Both editors share one label style and one field skin (`FIELD_BASE`), so a
// field in Missed Setup is pixel-identical to the same field in Add Trade.
const EDITOR_LABEL =
  "block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className={EDITOR_LABEL}>{label}</span>
      <input
        type={type}
        value={value}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(FIELD_BASE, "h-9 sm:h-11 text-xs sm:text-sm")}
      />
    </label>
  );
}

function FieldArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={EDITOR_LABEL}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className={cn(FIELD_BASE, "py-2.5 resize-y min-h-[56px]")}
      />
    </label>
  );
}

/** Date en BULLES (présélections) + date précise via un picker natif — pas de
 *  case à remplir : un tap suffit pour le cas le plus fréquent. */
function DateBubbles({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useT();
  const iso = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  };
  const presets = [
    { key: "today", label: t("missed.dateToday"), value: iso(0) },
    { key: "yesterday", label: t("missed.dateYesterday"), value: iso(1) },
    { key: "two", label: t("missed.dateTwoDays"), value: iso(2) },
  ];
  return (
    <label className="block">
      <span className={EDITOR_LABEL}>{label}</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.value)}
            className={cn(
              "h-9 px-3 rounded-full border text-xs font-semibold transition-all",
              value === p.value
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                : "bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20",
            )}
          >
            {p.label}
          </button>
        ))}
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            FIELD_BASE,
            "h-9 px-2.5 text-xs sm:text-sm w-auto min-w-[140px] flex-1 sm:flex-none",
          )}
        />
      </div>
    </label>
  );
}
