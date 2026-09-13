import { describe, expect, test } from "bun:test";
import {
  accountsOf,
  environmentOf,
  environmentOfType,
  isEnvironmentChange,
} from "../src/app/replay/environment";
import type { Account, AccountType } from "../src/app/store";

/**
 * LES DEUX MONDES NE SE MÉLANGENT PAS.
 *
 * Un backtest rangé parmi des trades réels fausse tout ce qu'on en tire :
 * win rate, espérance, drawdown. Le cloisonnement est structurel — chaque
 * trade porte son `account_id`, et les pages lisent par compte actif — mais
 * il repose sur une question : « ce compte, de quel monde est-il ? ». C'est
 * cette question-là qu'on verrouille ici.
 */

function account(type: AccountType, id: string = type): Account {
  return {
    id,
    name: id,
    type,
    startingBalance: 100_000,
    currency: "USD",
    color: "#000000",
    isDefault: false,
    calibrationScale: 1,
    originalBalance: 100_000,
    calibratedAt: null,
  };
}

describe("l'environnement d'un compte", () => {
  test("SEUL le type `replay` appartient au rejeu", () => {
    expect(environmentOfType("replay")).toBe("replay");
    for (const type of ["personal", "prop", "demo", "live"] as const) {
      expect(environmentOfType(type)).toBe("live");
    }
  });

  test("l'absence de compte n'invente pas un rejeu", () => {
    // Le défaut doit être le monde RÉEL : afficher « rejeu » sur un écran qui
    // ne sait pas encore quel compte est actif ferait douter de vrais chiffres.
    expect(environmentOf(null)).toBe("live");
    expect(environmentOf(undefined)).toBe("live");
  });
});

describe("le partitionnement des comptes", () => {
  const accounts = [
    account("personal", "perso"),
    account("replay", "bt-1"),
    account("prop", "topstep"),
    account("replay", "bt-2"),
    account("demo", "demo"),
  ];

  test("chaque compte tombe dans un monde et un seul", () => {
    const live = accountsOf(accounts, "live");
    const replay = accountsOf(accounts, "replay");
    expect(live.length + replay.length).toBe(accounts.length);
    const ids = new Set([...live, ...replay].map((a) => a.id));
    expect(ids.size).toBe(accounts.length);
    for (const a of live) expect(a.type).not.toBe("replay");
    for (const a of replay) expect(a.type).toBe("replay");
  });

  test("l'ordre d'origine est préservé dans chaque monde", () => {
    expect(accountsOf(accounts, "live").map((a) => a.id)).toEqual(["perso", "topstep", "demo"]);
    expect(accountsOf(accounts, "replay").map((a) => a.id)).toEqual(["bt-1", "bt-2"]);
  });

  test("une liste vide rend deux listes vides, pas une erreur", () => {
    expect(accountsOf([], "live")).toEqual([]);
    expect(accountsOf([], "replay")).toEqual([]);
  });
});

describe("le franchissement", () => {
  test("changer de compte DANS un monde n'est pas un franchissement", () => {
    // Un voile plein écran entre deux comptes prop firm serait du théâtre, et
    // il ralentirait un geste qu'on fait dix fois par jour.
    expect(isEnvironmentChange(account("prop", "a"), account("personal", "b"))).toBe(false);
    expect(isEnvironmentChange(account("replay", "a"), account("replay", "b"))).toBe(false);
  });

  test("passer du réel au rejeu, et l'inverse, en est un", () => {
    expect(isEnvironmentChange(account("prop"), account("replay"))).toBe(true);
    expect(isEnvironmentChange(account("replay"), account("prop"))).toBe(true);
  });

  test("sans les deux bouts, on ne conclut rien", () => {
    // Au premier rendu il n'y a pas encore de compte précédent : annoncer un
    // franchissement jouerait la séquence au chargement de l'application.
    expect(isEnvironmentChange(null, account("replay"))).toBe(false);
    expect(isEnvironmentChange(account("replay"), null)).toBe(false);
  });
});
