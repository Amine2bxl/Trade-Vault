import { describe, it, expect } from "bun:test";
import {
  validateCandidates,
  parseExtraction,
  extractFromOutput,
  deriveKey,
  EXTRACTED_MAX_CONFIDENCE,
  MAX_EXTRACTED_PER_CONVERSATION,
  type RawCandidate,
} from "../memory-extract";

/**
 * Ces tests portent sur le composant le plus risqué du produit.
 *
 * Un faux souvenir n'est pas un bug ponctuel : il est renvoyé dans CHAQUE
 * prompt suivant, indéfiniment. La majorité des cas ci-dessous vérifient donc
 * qu'un candidat est REFUSÉ — c'est le comportement qui protège le trader.
 */

const ok = (over: Partial<RawCandidate> = {}): RawCandidate => ({
  kind: "decision",
  content: "S'est engagé à arrêter de trader après deux pertes consécutives.",
  ...over,
});

describe("garde-fous — ce qui NE DOIT PAS entrer en mémoire", () => {
  it("refuse toute catégorie hors decision/preference", () => {
    // `fact` et `lesson` seraient le vecteur d'entrée des hallucinations :
    // rien dans le texte ne permet de les vérifier.
    for (const kind of ["fact", "lesson", "profile", "conversation", "invented"]) {
      const r = validateCandidates([ok({ kind })]);
      expect(r.accepted).toHaveLength(0);
      expect(r.rejected[0].reason).toBe("kind_not_extractable");
    }
  });

  it("refuse TOUT chiffre de performance — la règle la plus importante", () => {
    // Ces valeurs ont une source de vérité calculée depuis les trades. Les
    // figer en mémoire créerait un second chiffre qui ne bougerait plus et
    // divergerait — exactement la contradiction que le produit élimine.
    const figures = [
      "Son win rate est de 62 % sur les setups de continuation.",
      "A gagné 1500 € ce mois-ci sur les indices.",
      "Vise un ratio de 3:1 sur chaque entrée en range.",
      "A pris 12 trades cette semaine sur le Nasdaq.",
      "Son gain moyen atteint 2 R sur les cassures.",
    ];
    for (const content of figures) {
      const r = validateCandidates([ok({ content })]);
      expect(r.accepted).toHaveLength(0);
      expect(r.rejected[0].reason).toBe("performance_figure");
    }
  });

  it("refuse les formulations où le modèle avoue extrapoler", () => {
    // Un modèle qui écrit « il semble » signale lui-même une déduction.
    // On le prend au mot plutôt que de mémoriser une supposition.
    for (const content of [
      "Il semble préférer les setups de retournement en séance de Londres.",
      "Préfère probablement éviter les news à fort impact sur indices.",
      "Peut-être qu'il devrait réduire sa taille de position en range.",
    ]) {
      const r = validateCandidates([ok({ kind: "preference", content })]);
      expect(r.accepted).toHaveLength(0);
      expect(r.rejected[0].reason).toBe("hedging");
    }
  });

  it("refuse le trop court et le trop long", () => {
    expect(validateCandidates([ok({ content: "ok" })]).rejected[0].reason).toBe("too_short");
    expect(validateCandidates([ok({ content: "a".repeat(250) })]).rejected[0].reason).toBe(
      "too_long",
    );
  });

  it("IGNORE la clé proposée par le modèle et la re-dérive du contenu", () => {
    // Sinon le modèle pourrait écraser n'importe quel souvenir existant en
    // renvoyant simplement sa clé — le pire scénario de cette fonctionnalité.
    const r = validateCandidates([ok({ key: "trader_profile" })]);
    expect(r.accepted[0].key).not.toBe("trader_profile");
    expect(r.accepted[0].key.startsWith("decision:")).toBe(true);
  });
});

describe("autorité d'un souvenir extrait", () => {
  it("plafonne la confiance SOUS le profil déclaré et la règle acceptée", () => {
    // Une phrase interprétée par un modèle ne doit jamais peser autant qu'un
    // clic de l'utilisateur (confiance 1) ni qu'un profil déclaré (0.9).
    const r = validateCandidates([ok({ importance: 5 })]);
    expect(r.accepted[0].confidence).toBe(EXTRACTED_MAX_CONFIDENCE);
    expect(EXTRACTED_MAX_CONFIDENCE).toBeLessThan(0.9);
  });

  it("plafonne l'importance même si le modèle réclame le maximum", () => {
    expect(validateCandidates([ok({ importance: 5 })]).accepted[0].importance).toBe(4);
  });

  it("marque la source comme `conversation` — la moins fiable, donc purgeable", () => {
    expect(validateCandidates([ok()]).accepted[0].source).toBe("conversation");
  });
});

describe("dé-doublonnage", () => {
  it("deux formulations du même engagement produisent la MÊME clé", () => {
    // L'ordre des mots ne doit pas créer deux souvenirs concurrents.
    const a = deriveKey("decision", "S'est engagé à stopper après deux pertes.");
    const b = deriveKey("decision", "Après deux pertes, s'est engagé à stopper.");
    expect(a).toBe(b);
  });

  it("écarte un doublon dans le même lot", () => {
    const r = validateCandidates([
      ok({ content: "S'est engagé à stopper après deux pertes." }),
      ok({ content: "Après deux pertes, s'est engagé à stopper." }),
    ]);
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected[0].reason).toBe("duplicate_key");
  });

  it("écarte ce que la mémoire connaît déjà", () => {
    const key = deriveKey("decision", ok().content!);
    const r = validateCandidates([ok()], { knownKeys: [key] });
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reason).toBe("already_known");
  });

  it("le plafond s'applique APRÈS dé-doublonnage, pas avant", () => {
    // Sinon trois reformulations d'un même engagement consommeraient tout le
    // budget et écarteraient un souvenir réellement distinct.
    const r = validateCandidates([
      ok({ content: "S'est engagé à stopper après deux pertes." }),
      ok({ content: "Après deux pertes, s'est engagé à stopper." }),
      ok({ kind: "preference", content: "Préfère les setups de cassure en séance de Londres." }),
    ]);
    expect(r.accepted).toHaveLength(2);
  });

  it("respecte le plafond par conversation", () => {
    // Contenus RÉELLEMENT distincts : la normalisation étant agressive (mots de
    // deux lettres écartés, tri alphabétique), des variantes cosmétiques
    // seraient dédupliquées avant même d'atteindre le plafond.
    const many = [
      "S'est engagé à noter chaque entrée avant exécution.",
      "S'est engagé à relire son plan chaque matin.",
      "S'est engagé à couper toute position avant la clôture.",
      "S'est engagé à photographier ses graphiques après séance.",
      "S'est engagé à supprimer les alertes sonores pendant Londres.",
    ].map((content) => ok({ content }));
    const r = validateCandidates(many);
    expect(r.accepted.length).toBe(MAX_EXTRACTED_PER_CONVERSATION);
    expect(r.rejected.some((x) => x.reason === "over_limit")).toBe(true);
  });
});

describe("parsing — tolérant à la forme, jamais bloquant", () => {
  it("récupère un tableau JSON encadré de texte et de balises", () => {
    const out =
      'Voici ce que je retiens :\n```json\n[{"kind":"decision","content":"x"}]\n```\nVoilà.';
    expect(parseExtraction(out)).toHaveLength(1);
  });

  it("rend un tableau vide sur toute sortie inexploitable, SANS lever", () => {
    // Un échec d'extraction ne doit jamais casser la conversation : le trader
    // a demandé une réponse, pas cette fonctionnalité.
    for (const bad of ["", "aucun souvenir", "{ pas un tableau }", "[{cassé"]) {
      expect(() => parseExtraction(bad)).not.toThrow();
      expect(parseExtraction(bad)).toEqual([]);
    }
  });

  it("chemin complet : sortie brute bruitée → candidat validé", () => {
    const out = `[{"kind":"preference","content":"Préfère les setups de cassure en séance de Londres.","importance":9}]`;
    const r = extractFromOutput(out);
    expect(r.accepted).toHaveLength(1);
    expect(r.accepted[0].importance).toBe(4);
    expect(r.accepted[0].confidence).toBe(EXTRACTED_MAX_CONFIDENCE);
  });
});
