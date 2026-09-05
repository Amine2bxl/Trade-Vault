import { useEffect, useState } from "react";
import { Settings, User, Brain, Languages, Pencil, Trash2 } from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import {
  loadJarvisProfile,
  saveJarvisProfile,
  buildJarvisPrefill,
  type JarvisProfile,
} from "../../../store";
import { sessionJarvisMemory } from "../insights/memory";
import type { JarvisMemory } from "../insights/types";
import { readResponseLang, writeResponseLang, type JarvisResponseLang } from "../prefs";
import JarvisProfileModal from "../../JarvisProfileModal";
import type { JarvisWorkspaceProps } from "../workspaces";

/**
 * SettingsWorkspace — Configuration de Jarvis.
 *
 * Orchestration uniquement : réutilise les services existants (profil Jarvis,
 * mémoire, préférences). Aucune logique métier, aucun accès direct au backend.
 */

const DEFAULT_MEMORY: JarvisMemory = {
  lastShownDate: "",
  lastPattern: null,
  lastPriority: null,
  ignoredPatterns: [],
  seenCount: 0,
};

export default function SettingsWorkspace({ context }: JarvisWorkspaceProps) {
  const { t } = useT();
  const { user } = useAuth();
  const userId = user?.id ?? context.userId;

  const [profile, setProfile] = useState<JarvisProfile | null>(context.profile ?? null);
  const [editProfile, setEditProfile] = useState(false);
  const [prefill, setPrefill] = useState<{
    style?: string;
    weakness?: string;
    goal?: string;
  } | null>(null);
  const [respLang, setRespLang] = useState<JarvisResponseLang>(() => readResponseLang());
  const [memory, setMemory] = useState<JarvisMemory | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void sessionJarvisMemory()
      .read()
      .then((m) => {
        if (active) setMemory(m);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  const onSavedProfile = () => {
    setEditProfile(false);
    if (userId) {
      void loadJarvisProfile(userId)
        .then(setProfile)
        .catch(() => {});
    }
  };

  const resetMemory = () => {
    void sessionJarvisMemory()
      .write(DEFAULT_MEMORY)
      .then(() => setMemory(DEFAULT_MEMORY));
  };

  const section = "rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 md:p-5 space-y-3";

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4 md:py-5 max-w-3xl">
      <div className="tv-label flex items-center gap-2 text-cyan-400/80 mb-4">
        <Settings className="w-3.5 h-3.5" /> {t("jarvisSettings.title")}
      </div>

      {/* ── Profil mémorisé ── */}
      <div className={section}>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-400" />
          <h3 className="tv-title">{t("jarvisSettings.profileTitle")}</h3>
        </div>
        <p className="tv-prose text-slate-500">{t("jarvisSettings.profileSubtitle")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(
            [
              [t("jarvisProfile.firstName"), profile?.firstName],
              [t("jarvisProfile.style"), profile?.style],
              [t("jarvisProfile.weakness"), profile?.weakness],
              [t("jarvisProfile.strength"), profile?.strength],
              [t("jarvisProfile.goal"), profile?.goal],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2"
            >
              <div className="text-[10px] text-slate-500 font-semibold">{label}</div>
              <div className="text-sm text-slate-200 truncate">{value || "—"}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            setEditProfile(true);
            if (userId) {
              void buildJarvisPrefill(userId)
                .then(setPrefill)
                .catch(() => {});
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-300 text-xs font-bold hover:bg-cyan-500/20 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" /> {t("jarvisSettings.edit")}
        </button>
      </div>

      {/* ── Préférences ── */}
      <div className={section + " mt-4"}>
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-cyan-400" />
          <h3 className="tv-title">{t("jarvisSettings.prefTitle")}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 shrink-0">
            {t("jarvisSettings.responseLang")}
          </span>
          <select
            value={respLang}
            onChange={(e) => {
              const v = e.target.value as JarvisResponseLang;
              setRespLang(v);
              writeResponseLang(v);
            }}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/40 cursor-pointer"
          >
            <option value="auto">{t("jarvisSettings.langAuto")}</option>
            <option value="fr">{t("jarvisSettings.langFr")}</option>
            <option value="en">{t("jarvisSettings.langEn")}</option>
          </select>
        </div>
      </div>

      {/* ── Mémoire Jarvis ── */}
      <div className={section + " mt-4"}>
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-cyan-400" />
          <h3 className="tv-title">{t("jarvisSettings.memoryTitle")}</h3>
        </div>
        <p className="tv-prose text-slate-500">{t("jarvisSettings.memorySubtitle")}</p>
        {memory && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-xs text-slate-400 space-y-1">
            <div>
              {t("jarvisSettings.memoryPattern")}{" "}
              <span className="text-slate-200">{memory.lastPattern ?? "—"}</span>
            </div>
            <div>
              {t("jarvisSettings.memorySeen")}{" "}
              <span className="tv-figure text-slate-200">{memory.seenCount}</span>
            </div>
            <div>
              {t("jarvisSettings.memoryIgnored")}{" "}
              <span className="text-slate-200">
                {memory.ignoredPatterns.length > 0 ? memory.ignoredPatterns.join(", ") : "—"}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={resetMemory}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/25 bg-red-500/10 text-red-300 text-xs font-bold hover:bg-red-500/20 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> {t("jarvisSettings.memoryReset")}
        </button>
      </div>

      {editProfile && (
        <JarvisProfileModal
          open
          onClose={() => setEditProfile(false)}
          initial={profile}
          suggested={prefill}
          onSave={async (p) => {
            if (!userId) return;
            await saveJarvisProfile(userId, p);
          }}
          onSaved={onSavedProfile}
        />
      )}
    </div>
  );
}
