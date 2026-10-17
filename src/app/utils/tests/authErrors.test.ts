import { describe, it, expect } from "bun:test";
import { classifyAuthError, oauthErrorFromUrl } from "../authErrors";

/**
 * Le visiteur ne doit JAMAIS lire une phrase d'API (« Invalid login
 * credentials », « Failed to fetch ») : chaque panne connue a son code, et
 * toute panne inconnue tombe sur `generic`.
 */
describe("classifyAuthError", () => {
  it("reconnaît les erreurs Supabase par leur code", () => {
    expect(classifyAuthError({ code: "invalid_credentials", message: "x" })).toBe(
      "invalid_credentials",
    );
    expect(classifyAuthError({ code: "user_already_exists" })).toBe("user_exists");
    expect(classifyAuthError({ code: "email_not_confirmed" })).toBe("email_not_confirmed");
    expect(classifyAuthError({ code: "over_email_send_rate_limit" })).toBe("rate_limited");
    expect(classifyAuthError({ code: "weak_password" })).toBe("weak_password");
    expect(classifyAuthError({ code: "otp_expired" })).toBe("link_expired");
    expect(classifyAuthError({ code: "same_password" })).toBe("same_password");
  });

  it("reconnaît les anciens messages, sans code", () => {
    expect(classifyAuthError(new Error("Invalid login credentials"))).toBe("invalid_credentials");
    expect(classifyAuthError(new Error("User already registered"))).toBe("user_exists");
    expect(classifyAuthError({ status: 429, message: "x" })).toBe("rate_limited");
  });

  it("un réseau coupé est une panne réseau, pas « Failed to fetch »", () => {
    expect(classifyAuthError(new TypeError("Failed to fetch"))).toBe("network");
    expect(classifyAuthError(new TypeError("Load failed"))).toBe("network");
    expect(classifyAuthError({ name: "AuthRetryableFetchError", message: "{}" })).toBe("network");
  });

  it("un code déjà classé passe tel quel", () => {
    expect(classifyAuthError("missing_fields")).toBe("missing_fields");
    expect(classifyAuthError("oauth_failed")).toBe("oauth_failed");
  });

  it("l'inconnu ne s'affiche jamais brut", () => {
    expect(classifyAuthError(new Error("Database error saving new user"))).toBe("generic");
    expect(classifyAuthError(undefined)).toBe("generic");
  });
});

describe("oauthErrorFromUrl", () => {
  it("lit l'erreur dans la requête ou dans le fragment", () => {
    expect(oauthErrorFromUrl("?error=access_denied&error_description=x", "")).toBe("oauth_failed");
    expect(oauthErrorFromUrl("", "#error=access_denied&error_code=otp_expired")).toBe(
      "link_expired",
    );
  });

  it("une adresse saine ne porte aucune erreur", () => {
    expect(oauthErrorFromUrl("?code=abc", "")).toBeNull();
    expect(oauthErrorFromUrl("", "#access_token=x")).toBeNull();
  });
});
