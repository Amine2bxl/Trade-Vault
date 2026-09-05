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

/** Le plafond mensuel de conseils. Voir le commentaire au point d'usage. */
const MAX_PAR_MOIS = 10;

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

  /* ── DIX CONSEILS PAR MOIS, PAS UN DE PLUS ────────────────────────────
     Un coach qui propose sans fin n'est pas écouté : chaque conseil qui
     s'ajoute dévalue les précédents, et un trader qui en reçoit trente en
     ignore trente. Le plafond est CIVIL — mois calendaire — et il se compte
     sur la date de CRÉATION, pas sur ce qui reste affiché : refuser un conseil
     ne rend pas un jeton, sinon le plafond ne plafonnerait rien.

     Le compteur est écrit à côté de la liste. Sans lui, la limite serait
     invisible : le trader croirait simplement que Jarvis n'a rien vu ce
     mois-ci. */
  const moisCourant = new Date().toISOString().slice(0, 7);
  const duMois = proposals.filter((p) => p.createdAt.slice(0, 7) === moisCourant);
  const visible = duMois.filter((p) => p.evidence && p.text).slice(0, MAX_PAR_MOIS);
  if (visible.length === 0) return null;

  return (
    <section className="mb-6 space-y-3" aria-label={t("proposal.title")}>
      <div className="flex items-center gap-2">
        <span className="tv-label shrink-0 text-slate-400">{t("proposal.sectionTitle")}</span>
        <span aria-hidden className="rp-rule h-px flex-1" />
        <span className="tv-figure shrink-0 text-[10px] text-slate-600">
          {duMois.length}/{MAX_PAR_MOIS}
        </span>
      </div>
      {visible.map((proposal) => (
        <article
          key={proposal.id}
          className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4"
        >
          {/* Le titre de la carte répétait « Proposition de Jarvis » sur
              chaque carte, sous un titre de section qui le dit déjà. L'icône
              suffit à signer, et la place revient au conseil lui-même. */}
          <div className="flex items-start gap-2.5">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
            <p className="min-w-0 flex-1 text-sm font-semibold text-white">{proposal.text}</p>
          </div>
          <p className="mt-1.5 pl-[26px] text-sm text-slate-400">{proposal.rationale}</p>

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
