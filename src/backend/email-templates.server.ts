// Lifecycle email templates — self-contained HTML (inline styles only, email
// clients strip <style> support unevenly). Dark charte identical to the
// landing: #060d16 background, cyan #22d3ee accents, white headings.
//
// Every builder returns { subject, html }. Copy is French — the product's
// voice — and personalized from the onboarding profile where it exists.

export interface OnboardingProfile {
  name: string;
  goal?: string | null;
  style?: string | null;
  experience?: string | null;
  usesIct?: boolean;
  assets?: string[];
  pain?: string | null;
}

const ACCENT = "#22d3ee";
const BG = "#060d16";
const CARD = "#0b1727";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#cbd5e1";
const MUTED = "#64748b";

function layout(inner: string, siteUrl: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding-bottom:28px;text-align:center;">
          <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">Trade<span style="color:${ACCENT};">Vault</span></span>
        </td></tr>
        <tr><td style="background:${CARD};border:1px solid ${BORDER};border-radius:16px;padding:36px 32px;">
          ${inner}
        </td></tr>
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:11px;color:${MUTED};line-height:1.6;">
            TradeVault — ton journal de trading premium.<br>
            <a href="${siteUrl}" style="color:${MUTED};">${siteUrl.replace(/^https?:\/\//, "")}</a>
            &nbsp;·&nbsp;
            <a href="${siteUrl}/privacy" style="color:${MUTED};">Confidentialité</a>
            &nbsp;·&nbsp;
            <a href="${siteUrl}/terms" style="color:${MUTED};">CGU</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function cta(label: string, url: string, primary = true): string {
  return primary
    ? `<a href="${url}" style="display:inline-block;background:linear-gradient(90deg,#06b6d4,#14b8a6);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:12px;">${label} →</a>`
    : `<a href="${url}" style="display:inline-block;background:rgba(255,255,255,0.05);border:1px solid ${BORDER};color:${TEXT};font-size:14px;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:12px;">${label}</a>`;
}

const GOAL_LABELS: Record<string, string> = {
  consistency: "devenir régulier et discipliné",
  funded: "décrocher un compte financé",
  income: "vivre du trading",
  learn: "progresser et comprendre tes erreurs",
};

const STYLE_LABELS: Record<string, string> = {
  scalping: "scalping",
  daytrading: "day trading",
  swing: "swing trading",
  position: "position trading",
};

// ── Mail 1 · Bienvenue (J+0) ─────────────────────────────────────────────────
export function welcomeEmail(p: OnboardingProfile, siteUrl: string) {
  const firstName = p.name.split(" ")[0] || "trader";
  const goal = p.goal ? (GOAL_LABELS[p.goal] ?? p.goal) : null;
  const style = p.style ? (STYLE_LABELS[p.style] ?? p.style) : null;
  const assets = p.assets?.length ? p.assets.slice(0, 3).join(", ") : null;

  const personalized = [
    goal ? `ton objectif — <strong style="color:#ffffff;">${goal}</strong>` : null,
    style ? `ton style <strong style="color:#ffffff;">${style}</strong>` : null,
    p.usesIct ? `ta méthodologie <strong style="color:#ffffff;">ICT / Smart Money</strong>` : null,
    assets ? `tes marchés (<strong style="color:#ffffff;">${assets}</strong>)` : null,
  ].filter(Boolean);

  const persLine = personalized.length
    ? `On a construit ta checklist sur-mesure à partir de ${personalized.join(", ")}.`
    : `On t'a préparé une checklist de trading prête à personnaliser en 2 minutes.`;

  const painLine = p.pain
    ? `<p style="margin:0 0 20px;font-size:14px;color:${TEXT};line-height:1.7;">Tu nous as dit que ton plus gros blocage, c'est <strong style="color:#ffffff;">${p.pain}</strong>. C'est exactement là que le journal fait la différence : chaque trade loggé te montre le pattern, noir sur blanc.</p>`
    : "";

  const inner = `
    <h1 style="margin:0 0 8px;font-size:22px;color:#ffffff;">Bienvenue à bord, ${firstName} 👋</h1>
    <p style="margin:0 0 20px;font-size:14px;color:${TEXT};line-height:1.7;">
      Ton coffre est ouvert. ${persLine}
    </p>
    ${painLine}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.2);border-radius:12px;padding:18px 20px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${ACCENT};">Tes 3 premières étapes</p>
        <p style="margin:0;font-size:14px;color:${TEXT};line-height:2;">
          ✅ &nbsp;Découvre ta <strong style="color:#ffffff;">checklist personnalisée</strong><br>
          📓 &nbsp;Logge ton premier trade (45 secondes chrono)<br>
          📊 &nbsp;Regarde tes stats se construire en temps réel
        </p>
      </td></tr>
    </table>
    <p style="margin:0 0 28px;font-size:13px;color:${MUTED};">
      Tu as <strong style="color:${ACCENT};">14 jours d'accès Pro complet</strong>, sans carte bancaire. Profite.
    </p>
    <div style="text-align:center;">${cta("Découvrir ma checklist", siteUrl)}</div>`;

  return {
    subject: `${firstName}, ta checklist sur-mesure t'attend 🎯`,
    html: layout(inner, siteUrl),
  };
}

// ── Mail 2 · Fin d'essai dans 48h (J+12) ─────────────────────────────────────
export function trialEndingEmail(p: OnboardingProfile, siteUrl: string) {
  const firstName = p.name.split(" ")[0] || "trader";
  const inner = `
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#fbbf24;">⏳ Plus que 48 heures</p>
    <h1 style="margin:0 0 8px;font-size:22px;color:#ffffff;">Ton essai Pro se termine dans 2 jours, ${firstName}</h1>
    <p style="margin:0 0 20px;font-size:14px;color:${TEXT};line-height:1.7;">
      Après ça, ton compte repasse en gratuit. Tes trades restent, mais voilà ce que tu perds :
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.18);border-radius:12px;padding:18px 20px;">
        <p style="margin:0;font-size:14px;color:${TEXT};line-height:2.1;">
          📈 &nbsp;<strong style="color:#ffffff;">Statistiques avancées</strong> — R-multiple, edge par setup, heatmaps horaires<br>
          🗂 &nbsp;<strong style="color:#ffffff;">Multi-comptes</strong> — prop firms, démo et réel séparés proprement<br>
          🎯 &nbsp;<strong style="color:#ffffff;">Objectifs 6 mois</strong> — ton plan de progression suivi semaine par semaine
        </p>
      </td></tr>
    </table>
    <p style="margin:0 0 28px;font-size:14px;color:${TEXT};line-height:1.7;">
      Garde ton élan : passe en Pro maintenant, tu ne seras <strong style="color:#ffffff;">débité qu'à la fin de ton essai</strong>. Annulable en 1 clic.
    </p>
    <div style="text-align:center;">
      ${cta("Garder mon accès Pro", `${siteUrl}/?upgrade=1`)}
      <div style="height:12px;"></div>
      ${cta("Voir les tarifs", `${siteUrl}/#pricing`, false)}
    </div>`;

  return {
    subject: `⏳ ${firstName}, ton accès Pro expire dans 48h`,
    html: layout(inner, siteUrl),
  };
}

// ── Mail 3 · Relance -20% (J+17) ─────────────────────────────────────────────
export function winbackEmail(p: OnboardingProfile, siteUrl: string) {
  const firstName = p.name.split(" ")[0] || "trader";
  const inner = `
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${ACCENT};">Offre exclusive — réservée à ton compte</p>
    <h1 style="margin:0 0 8px;font-size:22px;color:#ffffff;">-20% sur ton abonnement Pro, ${firstName}</h1>
    <p style="margin:0 0 20px;font-size:14px;color:${TEXT};line-height:1.7;">
      Ton essai est terminé, mais ton journal n'a pas dit son dernier mot.
      Pour te remettre en selle, voici <strong style="color:#ffffff;">-20% sur ton premier abonnement</strong>, mensuel ou annuel :
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td align="center" style="background:rgba(34,211,238,0.08);border:2px dashed rgba(34,211,238,0.4);border-radius:12px;padding:20px;">
        <p style="margin:0 0 4px;font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">Ton code promo</p>
        <p style="margin:0;font-size:28px;font-weight:800;letter-spacing:4px;color:${ACCENT};">VAULT20</p>
      </td></tr>
    </table>
    <p style="margin:0 0 28px;font-size:14px;color:${TEXT};line-height:1.7;">
      Valable par carte (Apple Pay / Google Pay inclus) <strong style="color:#ffffff;">ou en crypto</strong> — USDT, USDC, BTC, ETH sur réseaux à frais réduits.
    </p>
    <div style="text-align:center;">
      ${cta("Payer par carte — -20%", `${siteUrl}/?upgrade=1&promo=VAULT20`)}
      <div style="height:12px;"></div>
      ${cta("Payer en crypto", `${siteUrl}/?upgrade=crypto&promo=VAULT20`, false)}
    </div>`;

  return {
    subject: `🎁 -20% pour reprendre ton journal, ${firstName} (code VAULT20)`,
    html: layout(inner, siteUrl),
  };
}
