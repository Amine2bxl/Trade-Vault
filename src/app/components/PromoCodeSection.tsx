import { useCallback, useEffect, useState } from "react";
import { Tag, Plus, Trash2, ShieldCheck, Users, Power, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "../i18n/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import { Button, Input, Select } from "@/shared/ui";
import { PAID_TIERS, TIER_BY_ID, planId, type PaidPlan } from "../utils/pricing";

/**
 * Codes promo — le panneau du propriétaire.
 *
 * Un code, deux usages, dans le même enregistrement :
 *   • `ownerEmail`    — l'influenceur : son code lui ouvre l'accès PERMANENT,
 *                       sans carte ni Stripe (source `promo` en base).
 *   • `discountPercent` — sa communauté : -N% encaissés via un coupon Stripe
 *                       réel, récurrent.
 * Un code sans titulaire ni réduction est un code d'invitation : accès
 * permanent pour quiconque le possède, dans la limite de `maxUses`.
 *
 * Comme pour « Accès offert », ce panneau n'apparaît que pour un
 * administrateur (`ADMIN_EMAILS`), mais n'est PAS le contrôle d'accès : chaque
 * appel est revérifié côté serveur.
 */

interface PromoCode {
  code: string;
  plan: PaidPlan;
  owner_email: string | null;
  discount_percent: number | null;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
  note: string | null;
  created_at: string;
}

interface Redemption {
  code: string;
  user_id: string;
  email: string;
  plan: string;
  kind: "owner" | "free" | "discount";
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

export default function PromoCodeSection() {
  const { lang } = useT();
  const fr = lang === "fr";
  const { toast } = useToast();
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [plan, setPlan] = useState<PaidPlan>("pro_yearly");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [discount, setDiscount] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const r = await api<{ promos: PromoCode[] }>("/api/admin/promos", "GET");
    setPromos(r?.promos ?? []);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadRedemptions = useCallback(async () => {
    const r = await api<{ redemptions: Redemption[] }>("/api/admin/promos/redemptions", "GET");
    setRedemptions(r?.redemptions ?? []);
  }, []);

  const toggle = async (target: PromoCode) => {
    setBusy(true);
    await api("/api/admin/promos/set-active", "POST", {
      code: target.code,
      active: !target.active,
    });
    setBusy(false);
    void reload();
  };

  const remove = async (target: PromoCode) => {
    setBusy(true);
    await api("/api/admin/promos/delete", "POST", { code: target.code });
    setBusy(false);
    if (open === target.code) setOpen(null);
    void reload();
  };

  const showRedemptions = async (target: PromoCode) => {
    if (open === target.code) {
      setOpen(null);
      return;
    }
    setOpen(target.code);
    await loadRedemptions();
  };

  const revoke = async (r: Redemption) => {
    setBusy(true);
    await api("/api/admin/promos/revoke", "POST", { code: r.code, email: r.email });
    setBusy(false);
    toast(fr ? "Accès retiré" : "Access revoked");
    void loadRedemptions();
  };

  const add = async () => {
    const clean = code.trim().toUpperCase();
    if (!clean) {
      toast(fr ? "Code invalide" : "Invalid code", "error");
      return;
    }
    setBusy(true);
    const r = await api<{ ok: boolean }>("/api/admin/promos", "POST", {
      code: clean,
      plan,
      ownerEmail: ownerEmail.trim().toLowerCase() || undefined,
      discountPercent: discount === "" ? undefined : Number(discount),
      maxUses: maxUses === "" ? undefined : Number(maxUses),
      expiresAt: expires || undefined,
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (!r?.ok) {
      toast(fr ? "Échec de la création" : "Create failed", "error");
      return;
    }
    toast(fr ? "Code créé" : "Code created");
    setCode("");
    setOwnerEmail("");
    setDiscount("");
    setMaxUses("");
    setExpires("");
    setNote("");
    void reload();
  };

  const kindLabel = (p: PromoCode) => {
    const parts: string[] = [];
    if (p.owner_email) parts.push(parts.length ? "· titulaire" : "titulaire");
    if (p.discount_percent) parts.push(`-${p.discount_percent}%`);
    if (!p.owner_email && !p.discount_percent) parts.push(fr ? "invite" : "invite");
    return parts.join(" ");
  };

  return (
    <div className="glass-strong space-y-4 rounded-3xl p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500">
          <Tag className="h-4 w-4 text-white" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white">{fr ? "Codes promo" : "Promo codes"}</h2>
          <p className="text-[11px] text-slate-500">
            {fr
              ? "Un code = accès permanent pour un influenceur + réduction pour sa communauté."
              : "One code = lifetime access for an influencer + a discount for their community."}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="CODE_EXEMPLE"
          autoComplete="off"
          className="uppercase"
        />
        <Select value={plan} onChange={(e) => setPlan(e.target.value as PaidPlan)}>
          {PAID_TIERS.map((t) => (
            <option key={t} value={planId(t, "yearly")}>
              {TIER_BY_ID[t].name[fr ? "fr" : "en"]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          placeholder={fr ? "E-mail du titulaire (influenceur)" : "Owner email (influencer)"}
          autoComplete="off"
        />
        <Input
          type="number"
          min={1}
          max={100}
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          placeholder={fr ? "Réduction communauté, %" : "Community discount, %"}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          type="number"
          min={1}
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          placeholder={fr ? "Usages max (vide = ∞)" : "Max uses (blank = ∞)"}
        />
        <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        <Button onClick={add} disabled={busy}>
          <Plus className="h-4 w-4" />
          {fr ? "Créer" : "Create"}
        </Button>
      </div>

      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={fr ? "Note (facultatif) — ex. « partenariat Thomas »" : "Note (optional)"}
      />

      {promos.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[13px] text-slate-500">
          {fr ? "Aucun code promo pour l'instant." : "No promo codes yet."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {promos.map((p) => (
            <div
              key={p.code}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-[13px] font-bold text-white">
                      {p.code}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        p.active
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-white/[0.05] text-slate-500"
                      }`}
                    >
                      {p.active ? (fr ? "Actif" : "Active") : fr ? "Désactivé" : "Paused"}
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    {TIER_BY_ID[p.plan.split("_")[0] as "pro"]?.name[fr ? "fr" : "en"]}
                    {p.discount_percent ? ` · ${kindLabel(p)}` : kindLabel(p)}
                    {p.max_uses
                      ? ` · ${p.uses_count}/${p.max_uses}`
                      : ` · ${p.uses_count} ${fr ? "usages" : "uses"}`}
                    {p.expires_at
                      ? ` · ${fr ? "expire" : "expires"} ${new Date(p.expires_at).toLocaleDateString()}`
                      : ""}
                    {p.note ? ` · ${p.note}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => showRedemptions(p)}
                  disabled={busy}
                  aria-label={fr ? "Utilisations" : "Redemptions"}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-50"
                >
                  <Users className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggle(p)}
                  disabled={busy}
                  aria-label={
                    p.active ? (fr ? "Désactiver" : "Pause") : fr ? "Activer" : "Activate"
                  }
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition disabled:opacity-50 ${
                    p.active
                      ? "text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
                      : "text-emerald-400 hover:bg-emerald-500/10"
                  }`}
                >
                  <Power className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(p)}
                  disabled={busy}
                  aria-label={fr ? "Supprimer" : "Delete"}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {open === p.code && (
                <div className="mt-2.5 space-y-1.5 border-t border-white/[0.05] pt-2.5">
                  <div className="tv-label flex items-center gap-1.5 px-1 text-slate-500">
                    <ChevronDown className="h-3 w-3" />
                    {fr ? "Utilisations" : "Redemptions"}
                  </div>
                  {redemptions.filter((r) => r.code === p.code).length === 0 ? (
                    <p className="px-1 text-[12px] text-slate-600">
                      {fr ? "Aucune pour l'instant." : "None yet."}
                    </p>
                  ) : (
                    redemptions
                      .filter((r) => r.code === p.code)
                      .map((r) => (
                        <div
                          key={r.user_id}
                          className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5"
                        >
                          <span className="min-w-0 flex-1 truncate text-[12px] text-slate-300">
                            {r.email}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              r.kind === "owner"
                                ? "bg-amber-400/10 text-amber-300"
                                : "bg-white/[0.05] text-slate-400"
                            }`}
                          >
                            {r.kind === "owner"
                              ? "Influenceur"
                              : r.kind === "free"
                                ? "Invite"
                                : `-${p.discount_percent ?? 0}%`}
                          </span>
                          <span className="tv-figure text-[10px] text-slate-600">
                            {new Date(r.created_at).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => revoke(r)}
                            disabled={busy}
                            aria-label={fr ? "Retirer l'accès" : "Revoke access"}
                            className="grid h-6 w-6 shrink-0 place-items-center rounded text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
