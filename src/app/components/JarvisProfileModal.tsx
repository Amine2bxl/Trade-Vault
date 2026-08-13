import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import { Modal, Button, FIELD_BASE } from "@/shared/ui";

interface JarvisProfileModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onSave: (profile: {
    firstName: string;
    style: string;
    weakness: string;
    strength: string;
    goal: string;
  }) => Promise<void>;
  /** Profil existant (édition) — pré-remplit le formulaire. */
  initial?: {
    firstName?: string | null;
    style?: string | null;
    weakness?: string | null;
    strength?: string | null;
    goal?: string | null;
  } | null;
  /** Suggestions depuis les Objectifs / Onboarding (premier enregistrement). */
  suggested?: { style?: string; weakness?: string; goal?: string } | null;
}

const EMPTY = { firstName: "", style: "", weakness: "", strength: "", goal: "" };

const pick = (v: string | null | undefined): string => (v && v.trim() ? v.trim() : "");

export default function JarvisProfileModal({
  open,
  onClose,
  onSaved,
  onSave,
  initial,
  suggested,
}: JarvisProfileModalProps) {
  const { t } = useT();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-remplissage : profil existant d'abord, sinon suggestions des Objectifs.
  useEffect(() => {
    if (open) {
      setForm({
        firstName: pick(initial?.firstName),
        style: pick(initial?.style) || (suggested?.style ?? ""),
        weakness: pick(initial?.weakness) || (suggested?.weakness ?? ""),
        strength: pick(initial?.strength),
        goal: pick(initial?.goal) || (suggested?.goal ?? ""),
      });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const canSave = form.firstName.trim() !== "";
  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onSaved();
    } catch {
      setError(t("jarvisProfile.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const inputClass = cn(FIELD_BASE, "h-11 text-sm");
  const labelClass =
    "block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <Modal open={open} onClose={onClose} className="md:max-w-lg" labelledBy="jarvis-profile-title">
      <div className="relative px-6 pt-6 pb-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="relative shrink-0">
            <div className="absolute -inset-1 rounded-2xl bg-cyan-500/30 blur-md" />
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <h2 id="jarvis-profile-title" className="text-lg font-bold text-white leading-tight">
              {t("jarvisProfile.title")}
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {t("jarvisProfile.subtitle")}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-3.5">
          <div>
            <label className={labelClass}>{t("jarvisProfile.firstName")}</label>
            <input
              autoFocus
              type="text"
              value={form.firstName}
              onChange={set("firstName")}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Trader"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("jarvisProfile.style")}</label>
            <input
              type="text"
              value={form.style}
              onChange={set("style")}
              placeholder="Scalping · Intraday · Swing"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("jarvisProfile.weakness")}</label>
            <input
              type="text"
              value={form.weakness}
              onChange={set("weakness")}
              placeholder={t("jarvisProfile.weaknessPh")}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("jarvisProfile.strength")}</label>
            <input
              type="text"
              value={form.strength}
              onChange={set("strength")}
              placeholder={t("jarvisProfile.strengthPh")}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("jarvisProfile.goal")}</label>
            <input
              type="text"
              value={form.goal}
              onChange={set("goal")}
              placeholder={t("jarvisProfile.goalPh")}
              className={inputClass}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 md:px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <Button
            onClick={handleSave}
            disabled={!canSave || saving}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2",
              canSave && !saving
                ? "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white"
                : "bg-slate-800 text-slate-500 cursor-not-allowed",
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t("jarvisProfile.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
