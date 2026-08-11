import { describe, it, expect } from "bun:test";
import { detectWhatIf } from "../intent";

describe("intention « et si… ? » — risque", () => {
  it("reconnaît « moitié moins » en français, accents ou pas", () => {
    expect(detectWhatIf("et si je risquais moitié moins ?")).toEqual({
      kind: "risk",
      value: 0.5,
      id: "risk.half",
    });
    expect(detectWhatIf("et si je risquais moitie moins")).not.toBeNull();
  });

  it("reconnaît l'équivalent anglais", () => {
    expect(detectWhatIf("what if I risk half as much?")?.value).toBe(0.5);
  });

  it("reconnaît le doublement", () => {
    expect(detectWhatIf("et si je doublais mon risque ?")?.value).toBe(2);
    expect(detectWhatIf("what if I risk twice as much")?.value).toBe(2);
  });

  it("lit un pourcentage explicite, dans les deux sens", () => {
    expect(detectWhatIf("et si je risquais 25 % de moins ?")?.value).toBeCloseTo(0.75, 10);
    expect(detectWhatIf("et si je risquais 50 % de plus ?")?.value).toBeCloseTo(1.5, 10);
  });

  it("refuse un facteur que l'historique ne peut pas soutenir", () => {
    // Au-dela de x3, le reechantillonnage extrapole bien plus loin que ce que
    // les trades reels portent : le chiffre serait faussement precis.
    expect(detectWhatIf("et si je risquais 300 % de plus ?")).toBeNull();
  });
});

describe("intention — arrêt journalier", () => {
  it("reconnaît « stop après 2 pertes »", () => {
    expect(detectWhatIf("et si je m'arrête après 2 pertes ?")).toEqual({
      kind: "stopAfterLosses",
      value: 2,
      id: "stop.2",
    });
  });

  it("reconnaît l'équivalent anglais", () => {
    expect(detectWhatIf("what if I stop after 3 losses")?.value).toBe(3);
  });

  it("l'arrêt est reconnu AVANT le risque", () => {
    // Sans cette priorite, « stop apres 2 pertes en risquant moins » se ferait
    // capter par la recherche de nombre du bloc risque.
    const lever = detectWhatIf("si je m'arrête après 2 pertes, mon risque baisse ?");
    expect(lever?.kind).toBe("stopAfterLosses");
  });

  it("refuse un nombre de pertes absurde", () => {
    expect(detectWhatIf("et si je m'arrête après 99 pertes")).toBeNull();
  });
});

describe("ce qu'on refuse de deviner", () => {
  it("une question sans intention de changement", () => {
    // Deviner large est le pire des deux mondes : le trader recevrait un
    // chiffre calcule sur une intention qu'il n'a pas exprimee, et le croirait.
    expect(detectWhatIf("pourquoi je perds le vendredi ?")).toBeNull();
    expect(detectWhatIf("montre-moi mon edge score")).toBeNull();
  });

  it("« moitié » sans mention du risque ne suffit pas", () => {
    expect(detectWhatIf("j'ai gagné la moitié de mes trades")).toBeNull();
  });

  it("une chaîne vide", () => {
    expect(detectWhatIf("")).toBeNull();
  });

  it("ne rend jamais un multiplicateur nul ou négatif", () => {
    const lever = detectWhatIf("et si je risquais 100 % de moins ?");
    expect(lever).toBeNull();
  });
});
