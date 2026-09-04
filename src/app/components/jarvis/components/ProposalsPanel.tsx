import { useEffect, useState } from "react";
import { Check, X, Lightbulb } from "lucide-react";
import { useT } from "../../../i18n/LanguageContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  acceptProposalById,
  dismissProposal,
  loadPendingProposals,
  type PendingProposal,
} from "../../../store/proposals";

/**
 * Les propositions en attente — la SEULE surface où Jarvis demande quelque
 * chose.
 *
 * ── LES CHIFFRES NE SE SÉPARENT JAMAIS DE LA PROPOSITION ───────────────────
 * `n` et le nombre de comparaisons sont affichés avec la proposition, pas
 * derrière un « voir le détail ». Une proposition tirée de 42 trades en
 * examinant 4 tranches ne dit pas la même chose qu'une proposition tirée de 42
 * trades en en examinant une seule, et le trader doit pouvoir faire cette
 * différence AU MOMENT de décider — pas après.
 *
 * Une proposition dont le motif n'a pas de preuves chiffrées n'est PAS
 * affichée. C'est volontairement radical : afficher « Jarvis suggère… » sans
 * base, c'est demander une décision sur rien.
 *
 * ── DEUX BOUTONS, SYMÉTRIQUES ──────────────────────────────────────────────
 * Accepter et Ignorer ont le même poids visuel. Un « ignorer » discret
 * transformerait la proposition en injonction, et la règle d'oubli de 30 jours
 * ne servirait plus à rien puisque personne ne trouverait le bouton.
 */

export default function ProposalsPanel({ userId }: { userId: string }) {
  const { t, lang } = useT();
  const { toast } = useToast();
  const [proposals, setProposals] = useState<PendingProposal[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadPendingProposals(userId)
      .then((rows) => {
        if (active) setProposals(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  const remove = (id: string) => setProposals((list) => list.filter((p) => p.id !== id));

  const onAccept = async (proposal: PendingProposal) => {
    setBusy(proposal.id);
    const outcome = await acceptProposalById(proposal.id);
    setBusy(null);
    if (!outcome.ok) {
      // Le motif du refus vient du serveur et n'est pas montré tel quel : il est
      // écrit pour un journal, pas pour un trader.
      console.error("[proposals] refused", outcome.reason);
      toast(t("proposal.failed"), "error");
      return;
    }
    remove(proposal.id);
    toast(t("proposal.accepted"), "success");
  };

  const onDismiss = async (proposal: PendingProposal) => {
    setBusy(proposal.id);
    const ok = await dismissProposal(proposal.id);
    setBusy(null);
    if (!ok) {
      toast(t("proposal.failed"), "error");
      return;
    }
    remove(proposal.id);
    toast(t("proposal.dismissed"), "success");
  };

  const visible = proposals.filter((p) => p.evidence && p.text);
  if (visible.length === 0) return null;

  return (
    <section className="mb-6 space-y-3" aria-label={t("proposal.title")}>
      {visible.map((proposal) => (
        <article
          key={proposal.id}
          className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-cyan-400 shrink-0" />
            <h3 className="tv-title">{t("proposal.title")}</h3>
          </div>

          <p className="text-sm text-white/90">{proposal.text}</p>
          <p className="mt-1.5 text-sm text-slate-400">{proposal.rationale}</p>

          {/* La base chiffrée, toujours visible, jamais repliée. */}
          <p className="mt-2 tv-prose text-slate-500">
            {t("proposal.basis")
              .replace("{n}", String(proposal.evidence?.n ?? 0))
              .replace("{c}", String(proposal.evidence?.comparisons ?? 0))}
          </p>
          <p className="mt-0.5 tv-prose text-slate-500">{t("proposal.association")}</p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={busy === proposal.id}
              onClick={() => void onAccept(proposal)}
              className="flex-1 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-cyan-500/25 disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
              {t("proposal.accept")}
            </button>
            <button
              type="button"
              disabled={busy === proposal.id}
              onClick={() => void onDismiss(proposal)}
              className="flex-1 h-9 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
            >
              <X className="w-4 h-4" />
              {t("proposal.dismiss")}
            </button>
          </div>

          <p className="mt-2 tv-row-label">
            {t("proposal.expires").replace(
              "{date}",
              new Date(proposal.expiresAt).toLocaleDateString(lang === "fr" ? "fr-FR" : undefined),
            )}
          </p>
        </article>
      ))}
    </section>
  );
}
