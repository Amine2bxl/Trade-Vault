import type { CandidateAction } from "./derive";
import { NO_CAUSAL_LANGUAGE_INSTRUCTION } from "./language";
import { validateProposal, type ValidationResult } from "./proposalSchemas";

/**
 * La MISE EN PHRASE — la seule chose que le modèle a le droit de faire.
 *
 * Tout ce qui précède est déterministe : le moteur a trouvé le motif, `derive`
 * a choisi l'action, la base porte le budget. Il reste deux chaînes de
 * caractères à écrire — le libellé de l'objet et sa justification — et c'est
 * exactement ce qu'un modèle sait faire mieux qu'un gabarit.
 *
 * ── CE QU'IL NE PEUT PAS FAIRE ─────────────────────────────────────────────
 * Décider qu'un motif existe, choisir un seuil, ajouter un chiffre. Le prompt
 * le lui interdit ; `parseWriterOutput` le vérifie. La deuxième garde est celle
 * qui compte : un prompt réduit la fréquence des écarts, il ne les arrête pas.
 *
 * ── LES CHIFFRES SONT FOURNIS, PAS DEMANDÉS ────────────────────────────────
 * Le prompt donne les faits déjà mis en forme. Le modèle n'a aucun calcul à
 * faire, donc aucune occasion de se tromper de dénominateur — et une
 * justification qui contient un nombre absent des faits est refusée.
 */

export interface WriterOutput {
  /** Le libellé de l'objet à créer (règle, item de checklist). */
  text: string;
  /** La justification montrée au trader au moment de décider. */
  rationale: string;
}

/** Les langues dans lesquelles une proposition peut être rédigée. */
export type WriterLanguage = "fr" | "en";

function factLines(action: CandidateAction, language: WriterLanguage): string[] {
  const f = action.rationaleFacts;
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  const fr = language === "fr";
  const lines = [
    fr ? `Motif observé : ${f.kind}` : `Observed pattern: ${f.kind}`,
    fr ? `Taille du groupe (n) : ${f.n}` : `Group size (n): ${f.n}`,
    fr ? `Valeur observée : ${pct(f.value)}` : `Observed value: ${pct(f.value)}`,
  ];
  if (f.baseline !== null) {
    lines.push(fr ? `Référence : ${pct(f.baseline)}` : `Baseline: ${pct(f.baseline)}`);
  }
  if (f.comparisonN !== null) {
    lines.push(
      fr ? `Groupe de comparaison : ${f.comparisonN}` : `Comparison group: ${f.comparisonN}`,
    );
  }
  lines.push(
    fr
      ? `Tranches examinées : ${f.comparisons}`
      : `Slices examined to reach this: ${f.comparisons}`,
  );
  if (f.impactR !== null) {
    lines.push(fr ? `Impact observé : ${f.impactR} R` : `Observed impact: ${f.impactR} R`);
  }
  if (f.clusterId) {
    lines.push(fr ? `Famille d'erreurs : ${f.clusterId}` : `Mistake family: ${f.clusterId}`);
  }
  return lines;
}

/**
 * Le prompt système. La contrainte de causalité vient de `language.ts` — une
 * seule source, pour que le texte de la règle et le contrôle qui l'applique ne
 * puissent pas diverger.
 */
export function writerSystemPrompt(language: WriterLanguage): string {
  const rules =
    language === "fr"
      ? [
          "Tu rédiges DEUX phrases courtes pour une proposition d'assistant de trading.",
          "Tu ne décides de rien : l'action et ses paramètres sont déjà fixés.",
          "N'invente AUCUN chiffre. N'utilise que les faits fournis, tels quels.",
          "Cite toujours la taille d'échantillon (n) dans la justification.",
          "Écris en français, à la deuxième personne, sans emphase ni superlatif.",
        ]
      : [
          "You write TWO short sentences for a trading-assistant proposal.",
          "You decide nothing: the action and its parameters are already fixed.",
          "Invent NO numbers. Use only the facts provided, exactly as given.",
          "Always cite the sample size (n) in the rationale.",
          "Write in English, second person, no emphasis and no superlatives.",
        ];
  return [
    ...rules,
    NO_CAUSAL_LANGUAGE_INSTRUCTION,
    'Réponds UNIQUEMENT en JSON : {"text": "...", "rationale": "..."}',
  ].join(" ");
}

/** Le message utilisateur : l'action à formuler et les faits, rien d'autre. */
export function writerUserPrompt(action: CandidateAction, language: WriterLanguage): string {
  const head =
    language === "fr"
      ? `Action à formuler : ${action.actionType}`
      : `Action to phrase: ${action.actionType}`;
  const params = Object.entries(action.payloadDraft)
    .map(([k, v]) => `${k} = ${String(v)}`)
    .join(", ");
  const paramLine = params
    ? language === "fr"
      ? `Paramètres déjà fixés (ne pas les changer) : ${params}`
      : `Parameters already fixed (do not change them): ${params}`
    : language === "fr"
      ? "Aucun paramètre chiffré."
      : "No numeric parameter.";
  return [head, paramLine, "", ...factLines(action, language)].join("\n");
}

export interface WriterResult {
  ok: boolean;
  reason: string | null;
  /** Le payload complet et validé, prêt à insérer. */
  payload: unknown;
  rationale: string | null;
}

/**
 * Les chiffres autorisés dans une justification : ceux des faits, plus les
 * paramètres déjà fixés. Tout autre nombre est un nombre inventé.
 */
function allowedNumbers(action: CandidateAction): Set<string> {
  const f = action.rationaleFacts;
  const out = new Set<string>();
  const add = (v: number | null) => {
    if (v === null) return;
    out.add(String(v));
    out.add(String(Math.round(v)));
    out.add(String(Math.abs(v)));
  };
  /**
   * Les parts sont fournies en pourcentage dans le prompt : `0.35` y apparaît
   * comme « 35 % ». Seules `value` et `baseline` sont des parts — élargir cette
   * tolérance aux compteurs autoriserait « 200 » dès que `comparisons` vaut 2.
   */
  const addShare = (v: number | null) => {
    if (v === null) return;
    add(v);
    out.add(String(Math.round(v * 100)));
  };
  add(f.n);
  add(f.comparisonN);
  add(f.comparisons);
  addShare(f.value);
  addShare(f.baseline);
  add(f.impactR);
  for (const v of Object.values(action.payloadDraft)) {
    if (typeof v === "number") add(v);
  }
  return out;
}

/**
 * Lit la réponse du modèle et la refuse au moindre écart.
 *
 * QUATRE REFUS : JSON illisible, champs manquants, chiffre absent des faits,
 * et tout ce que `validateProposal` rejette déjà (formulation causale, payload
 * hors schéma, justification trop courte ou trop longue).
 *
 * Le contrôle des chiffres est le seul ajouté ici, et il est nécessaire : une
 * justification qui dit « sur 200 trades » quand n vaut 42 est plus dangereuse
 * qu'une justification maladroite, parce qu'elle est crédible.
 */
export function parseWriterOutput(raw: string, action: CandidateAction): WriterResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(raw));
  } catch {
    return { ok: false, reason: "writer output is not JSON", payload: null, rationale: null };
  }

  const out = parsed as Partial<WriterOutput>;
  if (typeof out.text !== "string" || typeof out.rationale !== "string") {
    return {
      ok: false,
      reason: "writer output missing text or rationale",
      payload: null,
      rationale: null,
    };
  }

  const allowed = allowedNumbers(action);
  for (const found of out.rationale.match(/\d+(?:[.,]\d+)?/g) ?? []) {
    const normalized = found.replace(",", ".");
    if (!allowed.has(normalized) && !allowed.has(String(Number(normalized)))) {
      return {
        ok: false,
        reason: `rationale contains a number absent from the facts: ${found}`,
        payload: null,
        rationale: null,
      };
    }
  }

  const payload = { ...action.payloadDraft, text: out.text.trim() };
  const check: ValidationResult = validateProposal({
    actionType: action.actionType,
    payload,
    rationale: out.rationale.trim(),
  });
  if (!check.ok) return { ok: false, reason: check.reason, payload: null, rationale: null };

  return { ok: true, reason: null, payload: check.value, rationale: out.rationale.trim() };
}

/** Les modèles encadrent souvent leur JSON de ```json … ```. */
function stripFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```[a-zA-Z]*\n?/, "")
    .replace(/```$/, "")
    .trim();
}
