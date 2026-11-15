import { afterEach, describe, expect, test } from "bun:test";
import {
  closeAuthForm,
  getLandingModals,
  openAuthForm,
  registerLandingInstance,
  setDemoOpen,
  subscribeLandingModals,
} from "../src/app/public/landing/landingModals";

/**
 * « SE CONNECTER NE S'OUVRE PAS AU CLIC » — le bug de production.
 *
 * Sur `/`, la vitrine est montée trois fois pendant le chargement (rendu
 * serveur, attente du code de l'application, application). Un clic sur
 * « Log in » pendant les premières secondes ouvrait le formulaire dans une
 * instance aussitôt démontée : rien ne s'affichait. L'état des fenêtres de la
 * vitrine vit donc HORS des instances, et survit à leur remplacement.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  closeAuthForm();
  setDemoOpen(false);
});

describe("les fenêtres de la vitrine", () => {
  test("un clic survit au remplacement de l'instance qui l'a reçu", async () => {
    const premiere = registerLandingInstance(20);
    openAuthForm("login");
    // L'application remplace la vitrine : l'ancienne part, la nouvelle arrive.
    premiere();
    const seconde = registerLandingInstance(20);
    await sleep(40);
    expect(getLandingModals().auth).toEqual({ mode: "login", plan: undefined, error: undefined });
    seconde();
  });

  test("se referment quand la vitrine quitte l'écran pour de bon (connexion réussie)", async () => {
    const seule = registerLandingInstance(10);
    openAuthForm("signup", "lifetime");
    setDemoOpen(true);
    seule();
    await sleep(30);
    // Après une déconnexion, la vitrine revient sans formulaire déjà ouvert.
    expect(getLandingModals()).toEqual({ auth: null, demo: false });
  });

  test("préviennent chaque abonné, avec un instantané stable", () => {
    let appels = 0;
    const stop = subscribeLandingModals(() => appels++);
    const avant = getLandingModals();
    expect(getLandingModals()).toBe(avant);
    openAuthForm("login");
    expect(appels).toBe(1);
    expect(getLandingModals()).not.toBe(avant);
    stop();
    closeAuthForm();
    expect(appels).toBe(1);
  });
});
