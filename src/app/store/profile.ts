import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CONFLUENCES } from "../types";
import { getActiveAccountId } from "./accounts";
import { loadTradingPlan } from "../trading/tradingPlan";
import { parseCurrency, type CurrencyCode } from "@/shared/currency";
import { loadProfileRow, updateProfile, MONTHLY_TARGET_EVENT } from "./profileRow";

/* Toutes les lectures du profil dérivent d'UNE ligne en cache, tenue à jour
   en direct par `profileRow.ts` ; toutes les écritures passent par
   `updateProfile`, qui protège la valeur locale de l'écho Realtime. */

// ── Confluences (stored on profile) ──
export async function loadConfluences(userId: string): Promise<string[]> {
  const row = await loadProfileRow(userId);
  const list = row?.confluences as string[] | undefined;
  return list && list.length > 0 ? list : [...DEFAULT_CONFLUENCES];
}

export async function saveConfluences(userId: string, confluences: string[]): Promise<void> {
  await updateProfile(userId, { confluences });
}

// ── Account balance (stored on profile) ──
export async function loadAccountBalance(userId: string): Promise<number> {
  const row = await loadProfileRow(userId);
  const bal = row?.account_balance as number | undefined;
  return typeof bal === "number" ? bal : 25000;
}

export async function saveAccountBalance(userId: string, balance: number): Promise<void> {
  await updateProfile(userId, { account_balance: balance });
}

// ── Starting balance (account equity baseline) ──
// Per active account (falls back to the profile baseline when no account set).
export async function loadStartingBalance(userId: string): Promise<number> {
  const activeId = getActiveAccountId();
  if (activeId) {
    const { data, error } = await supabase
      .from("accounts")
      .select("starting_balance")
      .eq("id", activeId)
      .maybeSingle();
    if (error) throw error;
    const bal = data?.starting_balance as number | undefined;
    if (typeof bal === "number") return bal;
  }
  const row = await loadProfileRow(userId);
  const bal = row?.starting_balance as number | undefined;
  return typeof bal === "number" ? bal : 25000;
}

export async function saveStartingBalance(userId: string, balance: number): Promise<void> {
  const activeId = getActiveAccountId();
  if (activeId) {
    const { error } = await supabase
      .from("accounts")
      .update({ starting_balance: balance })
      .eq("id", activeId)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }
  await updateProfile(userId, { starting_balance: balance });
}

// ── Language ──
export async function loadLanguage(userId: string): Promise<string> {
  const row = await loadProfileRow(userId);
  return (row?.language as string | undefined) || "en";
}

export async function saveLanguage(userId: string, language: string): Promise<void> {
  await updateProfile(userId, { language });
}

// ── Jarvis remembered profile ──
// Captured by the first-open Jarvis card and fed to the coach on every call.
// `completedAt` being NULL is the gate that re-shows the card on next open.
export interface JarvisProfile {
  firstName: string | null;
  style: string | null;
  weakness: string | null;
  strength: string | null;
  goal: string | null;
  completedAt: string | null;
}

interface JarvisProfileRow {
  jarvis_first_name: string | null;
  jarvis_style: string | null;
  jarvis_weakness: string | null;
  jarvis_strength: string | null;
  jarvis_goal: string | null;
  jarvis_completed_at: string | null;
}

const jarvisLocalKey = (userId: string) => `tv:jarvis:profile:${userId}`;

function readJarvisLocal(userId: string): JarvisProfile | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(jarvisLocalKey(userId));
    return raw ? (JSON.parse(raw) as JarvisProfile) : null;
  } catch {
    return null;
  }
}

function writeJarvisLocal(userId: string, p: JarvisProfile): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(jarvisLocalKey(userId), JSON.stringify(p));
  } catch {
    /* best-effort */
  }
}

const EMPTY_JARVIS: JarvisProfile = {
  firstName: null,
  style: null,
  weakness: null,
  strength: null,
  goal: null,
  completedAt: null,
};

/**
 * Repli local : si la migration Supabase (colonnes jarvis_*) n'est pas encore
 * appliquée, le profil est quand même sauvegardé/mémorisé côté client. Le DB
 * reste la source de vérité dès qu'elle répond ; l'utilisateur n'est jamais
 * bloqué ni confronté à une erreur.
 */
export async function loadJarvisProfile(userId: string): Promise<JarvisProfile> {
  const local = readJarvisLocal(userId);
  try {
    const r = ((await loadProfileRow(userId)) ?? {}) as Partial<JarvisProfileRow>;
    const fromDb: JarvisProfile = {
      firstName: r.jarvis_first_name ?? null,
      style: r.jarvis_style ?? null,
      weakness: r.jarvis_weakness ?? null,
      strength: r.jarvis_strength ?? null,
      goal: r.jarvis_goal ?? null,
      completedAt: r.jarvis_completed_at ?? null,
    };
    // DB vide mais profil local présent (migration non appliquée) → repli local.
    if (!fromDb.completedAt && local?.completedAt) return local;
    return fromDb;
  } catch {
    return local ?? { ...EMPTY_JARVIS };
  }
}

export async function saveJarvisProfile(
  userId: string,
  p: Pick<JarvisProfile, "firstName" | "style" | "weakness" | "strength" | "goal">,
): Promise<void> {
  const completed: JarvisProfile = {
    firstName: p.firstName?.trim() || null,
    style: p.style?.trim() || null,
    weakness: p.weakness?.trim() || null,
    strength: p.strength?.trim() || null,
    goal: p.goal?.trim() || null,
    completedAt: new Date().toISOString(),
  };
  // Toujours mémoriser localement : le profil est disponible immédiatement.
  writeJarvisLocal(userId, completed);
  try {
    await updateProfile(userId, {
      jarvis_first_name: completed.firstName,
      jarvis_style: completed.style,
      jarvis_weakness: completed.weakness,
      jarvis_strength: completed.strength,
      jarvis_goal: completed.goal,
      jarvis_completed_at: completed.completedAt,
    });
  } catch (e) {
    // Migration Supabase non appliquée → le profil reste en local, jamais
    // d'erreur bloquante pour l'utilisateur.
    console.error("[jarvis-profile] DB write failed, kept local", e);
  }
}

/**
 * Prefill depuis les données déjà connues (Objectifs / Onboarding) : le profil
 * « mémorisé par Jarvis » est pré-rempli avec ce que TradeVault sait déjà
 * (style, faiblesse déclarée, objectif/plan de trading) — l'utilisateur n'a
 * pas à tout ressaisir.
 */
export async function buildJarvisPrefill(
  userId: string,
): Promise<{ style?: string; weakness?: string; goal?: string }> {
  const [onb, plan] = await Promise.all([
    loadOnboarding(userId).catch(() => null),
    loadTradingPlan(userId).catch(() => null),
  ]);
  return {
    style: onb?.style || undefined,
    weakness: onb?.pain || undefined,
    goal: plan?.mission?.trim() || onb?.goal || undefined,
  };
}

// ── Onboarding (stored on profile) ──
export interface OnboardingData {
  goal: string | null;
  assets: string[];
  style: string | null;
  experience: string | null;
  usesIct: boolean;
  brokers: string[];
  pain: string | null;
  /** Realistic monthly performance target in % (onboarding Q3). */
  monthlyTarget: number | null;
  onboardedAt: string | null;
  skipped: boolean;
}

const EMPTY_ONBOARDING: OnboardingData = {
  goal: null,
  assets: [],
  style: null,
  experience: null,
  usesIct: false,
  brokers: [],
  pain: null,
  monthlyTarget: null,
  onboardedAt: null,
  skipped: false,
};

interface OnboardingRow {
  onboarding_goal: string | null;
  onboarding_assets: string[] | null;
  onboarding_style: string | null;
  onboarding_experience: string | null;
  onboarding_uses_ict: boolean | null;
  onboarding_brokers: string[] | null;
  onboarding_pain: string | null;
  onboarding_monthly_target: number | null;
  onboarded_at: string | null;
  onboarding_skipped: boolean | null;
}

export async function loadOnboarding(userId: string): Promise<OnboardingData> {
  const data = await loadProfileRow(userId);
  if (!data) return { ...EMPTY_ONBOARDING };
  const r = data as unknown as OnboardingRow;
  return {
    goal: r.onboarding_goal ?? null,
    assets: r.onboarding_assets ?? [],
    style: r.onboarding_style ?? null,
    experience: r.onboarding_experience ?? null,
    usesIct: !!r.onboarding_uses_ict,
    brokers: r.onboarding_brokers ?? [],
    pain: r.onboarding_pain ?? null,
    monthlyTarget:
      r.onboarding_monthly_target !== null ? Number(r.onboarding_monthly_target) : null,
    onboardedAt: r.onboarded_at ?? null,
    skipped: !!r.onboarding_skipped,
  };
}

/** Diffusé après un changement de l'objectif mensuel (ici ou sur un autre
 *  appareil) : le copilote du tableau de bord se met à jour sans recharger. */
export { MONTHLY_TARGET_EVENT };

/**
 * L'OBJECTIF MENSUEL, SEUL.
 *
 * Il n'était écrit que par `saveOnboarding`, qui réécrit aussi toutes les
 * réponses et repose `onboarded_at` : le seul moyen de le changer était de
 * refaire l'onboarding. Il se règle désormais depuis le plan de trading et les
 * préférences, sans toucher au reste. `null` = pas d'objectif.
 */
export async function saveMonthlyTarget(userId: string, pct: number | null): Promise<void> {
  const value = pct !== null && Number.isFinite(pct) && pct > 0 ? pct : null;
  await updateProfile(userId, { onboarding_monthly_target: value });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MONTHLY_TARGET_EVENT, { detail: value }));
  }
}

// Persists the collected answers and stamps `onboarded_at` so the flow never
// shows again. `skipped` records that the user bailed with defaults.
//
// PHASE 0 — UNE SEULE source de vérité : l'onboarding alimente AUSSI le profil
// Jarvis (style, faiblesse déclarée, objectif) et pose `jarvis_completed_at`.
// Fini la double collecte : Jarvis connaît le trader dès le jour 1.
//
// La fusion Jarvis est BEST-EFFORT (2e requête en try/catch) : si la migration
// `jarvis_*` n'est pas appliquée, le chemin critique (onboarding_* + gate) ne
// casse jamais — le profil local de Jarvis reste fonctionnel.
export async function saveOnboarding(
  userId: string,
  d: OnboardingData,
  opts: { skipped?: boolean; firstName?: string } = {},
): Promise<void> {
  const now = new Date().toISOString();
  await updateProfile(userId, {
    onboarding_goal: d.goal,
    onboarding_assets: d.assets,
    onboarding_style: d.style,
    onboarding_experience: d.experience,
    onboarding_uses_ict: d.usesIct,
    onboarding_brokers: d.brokers,
    onboarding_pain: d.pain,
    onboarding_monthly_target: d.monthlyTarget,
    onboarding_skipped: opts.skipped ?? false,
    onboarded_at: now,
  });

  // Fusion profil Jarvis — jamais bloquante (migration absente = ignorée).
  void updateProfile(userId, {
    ...(opts.firstName?.trim() ? { jarvis_first_name: opts.firstName.trim() } : {}),
    jarvis_style: d.style || null,
    jarvis_weakness: d.pain || null,
    jarvis_goal: d.goal || null,
    jarvis_completed_at: now,
  }).catch((jarvisError) => {
    console.error("[onboarding] jarvis merge skipped", jarvisError);
  });

  // J+0 welcome email, personalized from the answers just saved. Fire and
  // forget: the server dedupes via email_log, a failure never blocks the app.
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await fetch("/api/emails/welcome", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
    } catch {
      // best-effort — the user experience never depends on the email
    }
  })();
}

// ── Checklist config (Phase 5 — l'app se souvient) ───────────────────────────
// La config de la checklist pré-marché (items, startTime, timeZone) est
// synchronisée en base (profiles.checklist_config jsonb). BEST-EFFORT : si la
// colonne n'existe pas (migration non appliquée), le localStorage continue de
// fonctionner — jamais d'erreur bloquante.
//
// Lecture et écriture passent par `profileRow.ts`, qui construit une requête
// neuve à chaque appel : jamais de `supabase.from("profiles")` évalué au
// chargement du module (il créait le client à l'import — écran 500 en
// navigation privée stricte — et postgrest-js faisait cumuler les filtres
// `id=eq.…` de deux comptes dans le même onglet).

/** `true` si la config est en base. Un échec reste silencieux pour le trader
 *  (le localStorage garde la config) mais DOIT être connu de l'éditeur, qui
 *  renverra sa saisie au retour du réseau au lieu de la perdre. */
export async function saveChecklistConfig(userId: string, config: unknown): Promise<boolean> {
  try {
    await updateProfile(userId, { checklist_config: config });
    return true;
  } catch (e) {
    // Migration absente ou réseau coupé → on garde le localStorage, silencieux.
    console.error("[checklist-config] DB write skipped", e);
    return false;
  }
}

export async function loadChecklistConfig(userId: string): Promise<unknown> {
  try {
    const row = await loadProfileRow(userId);
    return row?.checklist_config ?? null;
  } catch (e) {
    console.error("[checklist-config] DB read skipped", e);
    return null;
  }
}

// ── Devise globale (stockée sur le profil) ──
// `select("*")` : la colonne `currency` est récente — le code déployé avant la
// migration doit continuer de fonctionner (retour à la devise par défaut).
export async function loadCurrency(userId: string): Promise<CurrencyCode> {
  const row = await loadProfileRow(userId);
  return parseCurrency(row?.currency);
}

export async function saveCurrency(userId: string, currency: CurrencyCode): Promise<void> {
  await updateProfile(userId, { currency });
}
