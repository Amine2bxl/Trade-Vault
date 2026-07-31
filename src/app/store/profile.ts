import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CONFLUENCES } from "../types";
import { getActiveAccountId } from "./accounts";

// ── Confluences (stored on profile) ──
export async function loadConfluences(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("confluences")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const list = data?.confluences as string[] | undefined;
  return list && list.length > 0 ? list : [...DEFAULT_CONFLUENCES];
}

export async function saveConfluences(userId: string, confluences: string[]): Promise<void> {
  const { error } = await supabase.from("profiles").update({ confluences }).eq("id", userId);
  if (error) throw error;
}

// ── Account balance (stored on profile) ──
export async function loadAccountBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("profiles")
    .select("account_balance")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const bal = data?.account_balance as number | undefined;
  return typeof bal === "number" ? bal : 25000;
}

export async function saveAccountBalance(userId: string, balance: number): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ account_balance: balance })
    .eq("id", userId);
  if (error) throw error;
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
  const { data, error } = await supabase
    .from("profiles")
    .select("starting_balance")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const bal = data?.starting_balance as number | undefined;
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
  const { error } = await supabase
    .from("profiles")
    .update({ starting_balance: balance })
    .eq("id", userId);
  if (error) throw error;
}

// ── Language ──
export async function loadLanguage(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("language")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.language as string | undefined) || "en";
}

export async function saveLanguage(userId: string, language: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ language }).eq("id", userId);
  if (error) throw error;
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

export async function loadJarvisProfile(userId: string): Promise<JarvisProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "jarvis_first_name, jarvis_style, jarvis_weakness, jarvis_strength, jarvis_goal, jarvis_completed_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const r = (data ?? {}) as JarvisProfileRow;
  return {
    firstName: r.jarvis_first_name ?? null,
    style: r.jarvis_style ?? null,
    weakness: r.jarvis_weakness ?? null,
    strength: r.jarvis_strength ?? null,
    goal: r.jarvis_goal ?? null,
    completedAt: r.jarvis_completed_at ?? null,
  };
}

export async function saveJarvisProfile(
  userId: string,
  p: Pick<JarvisProfile, "firstName" | "style" | "weakness" | "strength" | "goal">,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      jarvis_first_name: p.firstName?.trim() || null,
      jarvis_style: p.style?.trim() || null,
      jarvis_weakness: p.weakness?.trim() || null,
      jarvis_strength: p.strength?.trim() || null,
      jarvis_goal: p.goal?.trim() || null,
      jarvis_completed_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
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
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "onboarding_goal, onboarding_assets, onboarding_style, onboarding_experience, onboarding_uses_ict, onboarding_brokers, onboarding_pain, onboarding_monthly_target, onboarded_at, onboarding_skipped",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...EMPTY_ONBOARDING };
  const r = data as OnboardingRow;
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

// Persists the collected answers and stamps `onboarded_at` so the flow never
// shows again. `skipped` records that the user bailed with defaults.
export async function saveOnboarding(
  userId: string,
  d: OnboardingData,
  opts: { skipped?: boolean } = {},
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_goal: d.goal,
      onboarding_assets: d.assets,
      onboarding_style: d.style,
      onboarding_experience: d.experience,
      onboarding_uses_ict: d.usesIct,
      onboarding_brokers: d.brokers,
      onboarding_pain: d.pain,
      onboarding_monthly_target: d.monthlyTarget,
      onboarding_skipped: opts.skipped ?? false,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;

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
