import { useEffect, useState } from "react";
import { User, Brain, SlidersHorizontal, Pencil, Trash2, X } from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";
import { useAuth } from "../../../contexts/AuthContext";
import {
  loadJarvisProfile,
  saveJarvisProfile,
  buildJarvisPrefill,
  type JarvisProfile,
} from "../../../store";
import { forget, loadMemory, type MemoryEntry } from "@/modules/ai/memory";
import {
  readAutoSpeak,
  readResponseLang,
  JARVIS_PROFILE_EVENT,
  writeAutoSpeak,
  writeResponseLang,
  type JarvisResponseLang,
} from "../prefs";
import JarvisProfileModal from "../../JarvisProfileModal";
import type { JarvisWorkspaceProps } from "../workspaces";

/**
 * SettingsWorkspace — les réglages de Jarvis, et CHACUN agit.
 *
 * ══ CE QUI NE MARCHAIT PAS ══
 *
 *   • LA « MÉMOIRE » AFFICHÉE N'ÉTAIT PAS CELLE DE JARVIS. Le bloc lisait un
 *     compteur de session de l'ancien Accueil (dernier motif montré, nombre
 *     d'ouvertures) ; « Réinitialiser » remettait ce compteur à zéro. La vraie
 *     mémoire — `ai_memory`, ce que Jarvis relit avant de répondre — n'était
 *     ni visible ni effaçable. Elle l'est maintenant, souvenir par souvenir.
 *   • LE PROFIL MODIFIÉ N'ATTEIGNAIT PAS LA CONVERSATION. La fenêtre et la page
 *     chargent le profil une fois ; après une modification ici, Jarvis
 *     continuait avec l'ancien. L'enregistrement le diffuse désormais
 *     (`tv:jarvis-profile`), et les deux l'écoutent.
 */

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
  const [autoSpeak, setAutoSpeak] = useState(() => readAutoSpeak());
  const [memory, setMemory] = useState<MemoryEntry[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadMemory(userId, ["profile", "fact", "lesson", "decision", "preference"], 60)
      .then((m) => {
        if (active) setMemory(m);
      })
      .catch(() => {
        if (active) setMemory([]);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const onSavedProfile = () => {
    setEditProfile(false);
    if (!userId) return;
    void loadJarvisProfile(userId)
      .then((p) => {
        setProfile(p);
        window.dispatchEvent(new CustomEvent(JARVIS_PROFILE_EVENT, { detail: p }));
      })
      .catch(() => {});
  };

  const forgetOne = (id: string) => {
    if (!userId) return;
    setMemory((m) => (m ? m.filter((e) => e.id !== id) : m));
    void forget(userId, id).catch(() => {});
  };

  const forgetAll = () => {
    if (!userId || !memory?.length) return;
    if (!window.confirm(t("jarvisSettings.memoryResetConfirm"))) return;
    const ids = memory.map((e) => e.id);
    setMemory([]);
    void Promise.all(ids.map((id) => forget(userId, id))).catch(() => {});
  };

  return (
    <div className="jarvis-settings flex-1 min-h-0 overflow-y-auto px-4 py-5 md:px-8 md:py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* ── Profil ── */}
        <section className="jarvis-card">
          <header className="jarvis-card-head">
            <span className="jarvis-card-icon">
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="tv-title">{t("jarvisSettings.profileTitle")}</h3>
              <p className="tv-prose text-slate-500">{t("jarvisSettings.profileSubtitle")}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditProfile(true);
                if (userId) {
                  void buildJarvisPrefill(userId)
                    .then(setPrefill)
                    .catch(() => {});
                }
              }}
              className="btn-ghost btn-sm shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" /> {t("jarvisSettings.edit")}
            </button>
          </header>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                [t("jarvisProfile.firstName"), profile?.firstName],
                [t("jarvisProfile.style"), profile?.style],
                [t("jarvisProfile.weakness"), profile?.weakness],
                [t("jarvisProfile.strength"), profile?.strength],
                [t("jarvisProfile.goal"), profile?.goal],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="jarvis-field">
                <div className="tv-row-label">{label}</div>
                <div className="truncate text-sm text-slate-200">{value || "—"}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Préférences ── */}
        <section className="jarvis-card">
          <header className="jarvis-card-head">
            <span className="jarvis-card-icon">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <h3 className="tv-title">{t("jarvisSettings.prefTitle")}</h3>
          </header>

          <label className="jarvis-pref">
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-slate-200">
                {t("jarvisSettings.responseLang")}
              </span>
            </span>
            <select
              value={respLang}
              onChange={(e) => {
                const v = e.target.value as JarvisResponseLang;
                setRespLang(v);
                writeResponseLang(v);
              }}
              className="jarvis-select"
            >
              <option value="auto">{t("jarvisSettings.langAuto")}</option>
              <option value="fr">{t("jarvisSettings.langFr")}</option>
              <option value="en">{t("jarvisSettings.langEn")}</option>
            </select>
          </label>

          <label className="jarvis-pref">
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-slate-200">{t("jarvisSettings.autoSpeak")}</span>
              <span className="tv-row-label">{t("jarvisSettings.autoSpeakHint")}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={autoSpeak}
              onClick={() => {
                const next = !autoSpeak;
                setAutoSpeak(next);
                writeAutoSpeak(next);
              }}
              className="jarvis-switch"
            >
              <span className="jarvis-switch-knob" />
            </button>
          </label>
        </section>

        {/* ── Mémoire : ce que Jarvis relit avant de répondre ── */}
        <section className="jarvis-card">
          <header className="jarvis-card-head">
            <span className="jarvis-card-icon">
              <Brain className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="tv-title">{t("jarvisSettings.memoryTitle")}</h3>
              <p className="tv-prose text-slate-500">{t("jarvisSettings.memorySubtitle")}</p>
            </div>
            {memory && memory.length > 0 && (
              <button type="button" onClick={forgetAll} className="jarvis-danger shrink-0">
                <Trash2 className="h-3.5 w-3.5" /> {t("jarvisSettings.memoryReset")}
              </button>
            )}
          </header>

          {memory === null ? (
            <div className="h-12 animate-pulse rounded-xl bg-white/[0.03]" />
          ) : memory.length === 0 ? (
            <p className="tv-prose text-slate-500">{t("jarvisSettings.memoryEmpty")}</p>
          ) : (
            <ul className="space-y-1.5">
              {memory.map((m) => (
                <li key={m.id} className="jarvis-memory">
                  <span className="jarvis-memory-kind">{t(`jarvisSettings.kind.${m.kind}`)}</span>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-slate-300">
                    {m.content}
                  </span>
                  <button
                    type="button"
                    onClick={() => forgetOne(m.id)}
                    aria-label={t("jarvisSettings.memoryForget")}
                    title={t("jarvisSettings.memoryForget")}
                    className="tv-jarvis-icon-btn shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
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
