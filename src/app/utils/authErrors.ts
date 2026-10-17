/**
 * LES ERREURS D'AUTHENTIFICATION, EN MOTS DU TRADER — module PUR.
 *
 * ── LE BUG QU'IL FERME ────────────────────────────────────────────────────
 *
 * La modale affichait le message BRUT de Supabase : « Invalid login
 * credentials », « User already registered », et, réseau coupé, « Failed to
 * fetch ». En anglais pour un visiteur de `/fr`, technique pour tout le monde,
 * au moment exact où l'on demande au visiteur de nous faire confiance. Les
 * gardes du contexte (« Please fill in all fields »…) étaient, elles aussi,
 * des phrases anglaises en dur.
 *
 * Le contexte rend maintenant un CODE stable, et chaque surface le traduit
 * dans son propre dictionnaire. Un message Supabase inconnu tombe sur
 * `generic` : jamais une phrase d'API à l'écran.
 */

export type AuthErrorCode =
  | "missing_fields"
  | "invalid_email"
  | "weak_password"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_exists"
  | "rate_limited"
  | "network"
  | "oauth_failed"
  | "link_expired"
  | "same_password"
  | "generic";

const CODES = new Set<AuthErrorCode>([
  "missing_fields",
  "invalid_email",
  "weak_password",
  "invalid_credentials",
  "email_not_confirmed",
  "user_exists",
  "rate_limited",
  "network",
  "oauth_failed",
  "link_expired",
  "same_password",
  "generic",
]);

/** Reconnaît une erreur Supabase (code `AuthApiError` ou message) — ou un code déjà classé. */
export function classifyAuthError(err: unknown): AuthErrorCode {
  if (typeof err === "string" && CODES.has(err as AuthErrorCode)) return err as AuthErrorCode;
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
  const status =
    err && typeof err === "object" && "status" in err
      ? Number((err as { status: unknown }).status)
      : 0;
  const msg = (
    typeof err === "string" ? err : err instanceof Error ? err.message : String(err ?? "")
  ).toLowerCase();

  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "invalid_credentials";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "email_not_confirmed";
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    msg.includes("already registered") ||
    msg.includes("already been registered")
  ) {
    return "user_exists";
  }
  if (code === "same_password" || msg.includes("different from the old password")) {
    return "same_password";
  }
  if (code === "weak_password" || msg.includes("password should be")) return "weak_password";
  if (code === "email_address_invalid" || msg.includes("invalid format")) return "invalid_email";
  if (
    code === "otp_expired" ||
    code === "flow_state_expired" ||
    code === "flow_state_not_found" ||
    msg.includes("expired") ||
    msg.includes("auth session missing")
  ) {
    return "link_expired";
  }
  if (
    status === 429 ||
    code.startsWith("over_") ||
    msg.includes("rate limit") ||
    msg.includes("too many")
  ) {
    return "rate_limited";
  }
  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    (err &&
      typeof err === "object" &&
      (err as { name?: string }).name === "AuthRetryableFetchError")
  ) {
    return "network";
  }
  return "generic";
}

/**
 * L'erreur que Google (ou Supabase) renvoie DANS L'ADRESSE au retour d'un
 * OAuth raté — `?error=access_denied&error_description=…`, dans la requête ou
 * dans le fragment selon le flux. `null` quand l'adresse n'en porte pas.
 */
export function oauthErrorFromUrl(search: string, hash: string): AuthErrorCode | null {
  for (const part of [search, hash.replace(/^#/, "?")]) {
    const p = new URLSearchParams(part);
    const error = p.get("error");
    const code = p.get("error_code");
    if (!error && !code) continue;
    if (code === "otp_expired") return "link_expired";
    return "oauth_failed";
  }
  return null;
}
