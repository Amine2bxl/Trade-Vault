import { useCallback, useEffect, useState } from "react";
import { Gift, Plus, Trash2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "../i18n/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import { Button, Input, Select } from "@/shared/ui";
import { PAID_TIERS, TIER_BY_ID, planId, type PaidPlan } from "../utils/pricing";

/**
 * Accès offert — le panneau du propriétaire.
 *
 * Donner le premium à un influenceur, un collègue ou à soi-même sans passer
 * par un paiement. La liste est tenue par adresse e-mail, ce qui permet
 * d'ouvrir l'accès à quelqu'un qui n'a pas encore de compte : il l'aura à son
 * inscription.
 *
 * Le panneau ne s'affiche que pour un administrateur, mais ce n'est PAS ce qui
 * protège : chaque appel est revérifié côté serveur contre `ADMIN_EMAILS`.
 * Masquer un bouton n'a jamais été un contrôle d'accès.
 */

interface Grant {
  email: string;
  plan: string;
  note: string | null;
  granted_by: string | null;
  expires_at: string | null;
  created_at: string;
}

async function api<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const res = await fetch(path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

/** L'utilisateur courant est-il administrateur ? Réponse du serveur, pas du client. */
export function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    void api<{ admin: boolean }>("/api/admin/me", "GET").then((r) => {
      if (active) setAdmin(!!r?.admin);
    });
    return () => {
      active = false;
    };
  }, []);
  return admin;
}

export default function CompAccessSection() {
  const { lang } = useT();
  const fr = lang === "fr";
  const { toast } = useToast();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<PaidPlan>("elite_yearly");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const r = await api<{ grants: Grant[] }>("/api/admin/grants", "GET");
    setGrants(r?.grants ?? []);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@")) {
      toast(fr ? "Adresse e-mail invalide" : "Invalid email address", "error");
      return;
    }
    setBusy(true);
    const r = await api<{ ok: boolean; applied: boolean }>("/api/admin/grants", "POST", {
      email: clean,
      plan,
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (!r?.ok) {
      toast(fr ? "Échec de l'ajout" : "Grant failed", "error");
      return;
    }
    toast(
      r.applied
        ? fr
          ? "Accès activé immédiatement"
          : "Access granted immediately"
        : fr
          ? "Accès enregistré — actif à son inscription"
          : "Saved — applies when they sign up",
      "success",
    );
    setEmail("");
    setNote("");
    void reload();
  };

  const revoke = async (target: string) => {
    setBusy(true);
    await api("/api/admin/grants/revoke", "POST", { email: target });
    setBusy(false);
    void reload();
  };

  return (
    <div className="glass-strong space-y-4 rounded-3xl p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500">
          <Gift className="h-4 w-4 text-white" />
        </span>
        <div className="min-w-0">
          <h2 className="tv-title">{fr ? "Accès offert" : "Complimentary access"}</h2>
          <p className="tv-row-label">
            {fr
              ? "Premium gratuit pour une adresse e-mail, avec ou sans compte existant."
              : "Free premium for an email address, with or without an existing account."}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="influenceur@exemple.com"
          autoComplete="off"
        />
        <Select value={plan} onChange={(e) => setPlan(e.target.value as PaidPlan)}>
          {PAID_TIERS.map((t) => (
            <option key={t} value={planId(t, "yearly")}>
              {TIER_BY_ID[t].name[fr ? "fr" : "en"]}
            </option>
          ))}
        </Select>
        <Button onClick={add} disabled={busy}>
          <Plus className="h-4 w-4" />
          {fr ? "Ajouter" : "Add"}
        </Button>
      </div>

      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={fr ? "Note (facultatif) — ex. « partenariat Instagram »" : "Note (optional)"}
      />

      {grants.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[13px] text-slate-500">
          {fr ? "Aucun accès offert pour l'instant." : "No complimentary access yet."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {grants.map((g) => (
            <div
              key={g.email}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-violet-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-white">{g.email}</div>
                <div className="truncate text-[11px] text-slate-500">
                  {TIER_BY_ID[g.plan.split("_")[0] as "pro"]?.name[fr ? "fr" : "en"] ?? g.plan}
                  {g.note ? ` · ${g.note}` : ""}
                </div>
              </div>
              <button
                onClick={() => revoke(g.email)}
                disabled={busy}
                aria-label={fr ? "Retirer l'accès" : "Revoke access"}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
