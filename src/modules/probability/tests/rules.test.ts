import { describe, it, expect } from "bun:test";
import { applyTrade, closeDay, initState, type AccountRules } from "../rules";

const base: AccountRules = { startingBalance: 50_000 };

/** Joue une série de trades dans un seul jour, puis rend l'état. */
function play(rules: AccountRules, pnls: number[]) {
  const s = initState(rules);
  for (const p of pnls) applyTrade(s, p, rules);
  return s;
}

describe("drawdown STATIQUE — le plancher ne bouge jamais", () => {
  const rules: AccountRules = { ...base, maxDrawdown: 2000, drawdownType: "static" };

  it("le plancher est fixé au départ, gagner ne le remonte pas", () => {
    const s = initState(rules);
    expect(s.floor).toBe(48_000);
    applyTrade(s, 5000, rules); // solde 55 000
    expect(s.floor).toBe(48_000); // toujours le même plancher
  });

  it("un compte qui a beaucoup gagné peut redescendre sans échouer", () => {
    // C'est LA différence avec le trailing : ici, +5 000 puis −6 000 laisse le
    // solde à 49 000, au-dessus du plancher de 48 000.
    const s = play(rules, [5000, -6000]);
    expect(s.balance).toBe(49_000);
    expect(s.outcome).toBe("open");
  });

  it("échoue en touchant le plancher", () => {
    const s = play(rules, [-2000]);
    expect(s.outcome).toBe("failed");
    expect(s.failReason).toBe("maxDrawdown");
  });

  it("le plancher est atteint À l'égalité, pas seulement en dessous", () => {
    // Les firmes coupent au contact. Un `<` au lieu d'un `<=` laisserait
    // passer le trade exact qui vide la marge.
    expect(play(rules, [-1999.99]).outcome).toBe("open");
    expect(play(rules, [-2000]).outcome).toBe("failed");
  });
});

describe("trailing INTRADAY — le plancher suit chaque nouveau plus haut", () => {
  const rules: AccountRules = { ...base, maxDrawdown: 2000, drawdownType: "trailing" };

  it("un gain resserre immédiatement la marge", () => {
    const s = initState(rules);
    applyTrade(s, 1000, rules); // plus haut 51 000
    expect(s.floor).toBe(49_000); // le plancher a suivi
  });

  it("rendre un gain intra-journalier PEUT faire échouer", () => {
    // Le piège du trailing : +1 000 puis −2 100 laisse le solde à 48 900,
    // au-dessus du plancher STATIQUE (48 000) mais sous le plancher trailing
    // (49 000). Confondre les deux types donnerait ici le verdict inverse.
    const s = play(rules, [1000, -2100]);
    expect(s.balance).toBe(48_900);
    expect(s.outcome).toBe("failed");
    expect(s.failReason).toBe("maxDrawdown");
  });

  it("le plancher ne descend JAMAIS sous celui du départ", () => {
    // Sinon le plancher suivrait les pertes vers le bas et le compte
    // deviendrait impossible à perdre.
    const s = initState(rules);
    applyTrade(s, -500, rules);
    expect(s.floor).toBe(48_000);
  });

  it("le gel arrête le trailing au seuil configuré", () => {
    const frozen: AccountRules = { ...rules, trailingFreezeAt: 3000 };
    const s = initState(frozen);
    applyTrade(s, 3000, frozen); // solde 53 000, seuil de gel atteint
    expect(s.floor).toBe(51_000); // 53 000 − 2 000, figé
    applyTrade(s, 5000, frozen); // solde 58 000
    expect(s.floor).toBe(51_000); // ne bouge plus : c'est tout l'intérêt
  });
});

describe("trailing EOD — seules les CLÔTURES comptent", () => {
  const rules: AccountRules = { ...base, maxDrawdown: 2000, drawdownType: "trailingEod" };

  it("un pic atteint puis rendu dans la journée ne resserre PAS la marge", () => {
    // La différence avec le trailing intraday, et elle est décisive : le même
    // enchaînement fait échouer en intraday et survivre en EOD.
    const s = initState(rules);
    applyTrade(s, 1000, rules);
    expect(s.floor).toBe(48_000); // aucune clôture encore : plancher initial
    applyTrade(s, -2100, rules);
    expect(s.outcome).toBe("open"); // survit, là où `trailing` échouait
  });

  it("le plancher suit après la clôture de la journée", () => {
    const s = initState(rules);
    applyTrade(s, 1000, rules);
    closeDay(s, rules); // clôture à 51 000
    expect(s.floor).toBe(49_000);
  });
});

describe("perte journalière — distincte du drawdown", () => {
  const rules: AccountRules = { ...base, maxDrawdown: 5000, dailyLossLimit: 1000 };

  it("échoue sur la perte du JOUR, bien avant le drawdown total", () => {
    const s = play(rules, [-600, -500]);
    expect(s.outcome).toBe("failed");
    expect(s.failReason).toBe("dailyLoss"); // et non "maxDrawdown"
  });

  it("le compteur repart à zéro à la clôture", () => {
    const s = initState(rules);
    applyTrade(s, -900, rules);
    closeDay(s, rules);
    applyTrade(s, -900, rules); // même perte, nouveau jour
    expect(s.outcome).toBe("open");
  });

  it("un gain dans la journée compense la perte du jour", () => {
    const s = play(rules, [-900, 500, -500]);
    expect(s.outcome).toBe("open"); // net du jour : −900
  });
});

describe("objectif de profit", () => {
  const rules: AccountRules = { ...base, profitTarget: 3000, maxDrawdown: 2000 };

  it("valide en atteignant la cible", () => {
    const s = play(rules, [3000]);
    expect(s.outcome).toBe("passed");
  });

  it("une règle enfreinte PRIME sur l'objectif atteint", () => {
    // Le trade qui amène à la cible mais viole la perte journalière est un
    // échec. Vérifier l'objectif en premier inverserait le verdict.
    const strict: AccountRules = { ...rules, dailyLossLimit: 500 };
    const s = initState(strict);
    applyTrade(s, -600, strict);
    expect(s.outcome).toBe("failed");
    expect(s.failReason).toBe("dailyLoss");
  });

  it("les jours minimum retiennent la validation", () => {
    const withMin: AccountRules = { ...rules, minTradingDays: 5 };
    const s = play(withMin, [3000]);
    expect(s.outcome).toBe("open"); // cible atteinte, mais trop tôt
  });

  it("valide une fois les jours minimum écoulés", () => {
    const withMin: AccountRules = { ...rules, minTradingDays: 3 };
    const s = initState(withMin);
    applyTrade(s, 1000, withMin);
    closeDay(s, withMin);
    applyTrade(s, 1000, withMin);
    closeDay(s, withMin);
    applyTrade(s, 1000, withMin); // 3e jour, cible atteinte
    expect(s.outcome).toBe("passed");
  });
});

describe("règle de consistance", () => {
  const rules: AccountRules = { ...base, profitTarget: 3000, maxBestDayShare: 0.4 };

  it("échoue quand un seul jour porte trop du profit", () => {
    // 2 500 sur 3 000 = 83 % du profit sur une journée. Les firmes refusent.
    const s = initState(rules);
    applyTrade(s, 500, rules);
    closeDay(s, rules);
    applyTrade(s, 2500, rules);
    expect(s.outcome).toBe("failed");
    expect(s.failReason).toBe("consistency");
  });

  it("valide quand le profit est réparti", () => {
    const s = initState(rules);
    for (let i = 0; i < 4; i++) {
      applyTrade(s, 750, rules); // 25 % chacun
      if (i < 3) closeDay(s, rules);
    }
    expect(s.outcome).toBe("passed");
  });
});

describe("durée maximale", () => {
  it("échoue par dépassement de délai", () => {
    const rules: AccountRules = { ...base, profitTarget: 10_000, maxTradingDays: 2 };
    const s = initState(rules);
    applyTrade(s, 100, rules);
    closeDay(s, rules);
    applyTrade(s, 100, rules);
    closeDay(s, rules);
    expect(s.outcome).toBe("failed");
    expect(s.failReason).toBe("maxTradingDays");
  });
});

describe("règles absentes — ne jamais inventer de contrainte", () => {
  it("sans drawdown configuré, le compte ne peut pas être perdu par drawdown", () => {
    // Supposer une valeur par défaut ferait échouer des trajectoires sur une
    // règle que le trader n'a jamais saisie.
    const s = play({ startingBalance: 50_000 }, [-40_000]);
    expect(s.outcome).toBe("open");
  });

  it("sans objectif, le compte ne valide jamais — c'est un compte personnel", () => {
    const s = play({ startingBalance: 50_000, maxDrawdown: 5000 }, [100_000]);
    expect(s.outcome).toBe("open");
  });

  it("une trajectoire close ignore les trades suivants", () => {
    const rules: AccountRules = { ...base, maxDrawdown: 1000 };
    const s = play(rules, [-1000, 50_000]);
    expect(s.outcome).toBe("failed");
    expect(s.balance).toBe(49_000); // le trade d'après n'a pas été joué
  });
});

describe("suivi du drawdown", () => {
  it("mesure le plus grand recul depuis un plus haut", () => {
    // 50 000 → 52 000 (plus haut) → 50 500 (−1 500) → 51 000 → 50 200.
    // Le recul maximal est mesuré depuis le PLUS HAUT, pas depuis le dernier
    // sommet local : 52 000 − 50 200 = 1 800.
    const s = play({ startingBalance: 50_000 }, [2000, -1500, 500, -800]);
    expect(s.maxDrawdown).toBe(1800);
  });
});
