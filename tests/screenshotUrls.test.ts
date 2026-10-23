import { afterAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";

/**
 * UNE CAPTURE MISE SUR LE SITE DOIT TOUJOURS SE VOIR.
 *
 * Le défaut d'origine : les liens signés par lot ne valaient qu'une heure,
 * mais le cache les resservait vingt-trois heures — passé la première heure,
 * l'aperçu d'un trade montrait une icône cassée et « Chart 1 ». Et quand
 * l'image échouait, rien ne la re-signait.
 *
 * Ce qui est garanti ici :
 *   • le cache n'est JAMAIS servi au-delà de la validité du lien (marge
 *     comprise) : il est re-signé avant ;
 *   • une image qui échoue quand même est re-signée automatiquement, deux
 *     fois ; ensuite seulement elle est déclarée indisponible (et l'écran
 *     propose « Réessayer ») ;
 *   • un fichier absent du stockage suit le même chemin ;
 *   • deux écrans qui demandent la même capture ne signent qu'une fois.
 */

let signCalls: { paths: string[]; ttl: number }[] = [];
let missing = new Set<string>();
let failNext = false;

mock.module("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrls: (paths: string[], ttl: number) => {
          signCalls.push({ paths, ttl });
          if (failNext) {
            failNext = false;
            return Promise.resolve({ data: null, error: { message: "network down" } });
          }
          return Promise.resolve({
            data: paths.map((p) =>
              missing.has(p)
                ? { path: p, signedUrl: null, error: "Object not found" }
                : { path: p, signedUrl: `https://cdn/${p}?t=${signCalls.length}`, error: null },
            ),
            error: null,
          });
        },
      }),
    },
  },
}));

const shots = await import("../src/app/store/screenshotUrls");

const T0 = new Date("2026-10-19T10:00:00Z").getTime();

beforeEach(() => {
  signCalls = [];
  missing = new Set();
  failNext = false;
  setSystemTime(new Date(T0));
  shots.resetScreenshotCache();
});
afterAll(() => setSystemTime());

describe("signature et cache", () => {
  test("signe une fois, pour la durée prévue, et sert le cache ensuite", async () => {
    expect(shots.pathsToSign(["u/a.png"], T0)).toEqual(["u/a.png"]);
    await shots.signPaths(["u/a.png"]);
    expect(signCalls).toEqual([{ paths: ["u/a.png"], ttl: shots.SIGNED_URL_TTL_S }]);
    expect(shots.cachedScreenshotUrl("u/a.png", T0)).toBe("https://cdn/u/a.png?t=1");
    expect(shots.pathsToSign(["u/a.png"], T0)).toEqual([]);
  });

  test("jamais servi au-delà de la validité du lien : re-signé avant", async () => {
    await shots.signPaths(["u/a.png"]);
    const lifetime = shots.SIGNED_URL_TTL_S * 1000;
    const justBefore = T0 + lifetime - shots.REFRESH_MARGIN_MS - 1;
    const tooLate = T0 + lifetime - shots.REFRESH_MARGIN_MS + 1;
    expect(shots.cachedScreenshotUrl("u/a.png", justBefore)).not.toBeNull();
    expect(shots.cachedScreenshotUrl("u/a.png", tooLate)).toBeNull();
    expect(shots.pathsToSign(["u/a.png"], tooLate)).toEqual(["u/a.png"]);
  });

  test("les anciennes images en ligne (data:) passent telles quelles", () => {
    const data = "data:image/png;base64,AAAA";
    expect(shots.cachedScreenshotUrl(data, T0)).toBe(data);
    expect(shots.pathsToSign([data], T0)).toEqual([]);
  });

  test("deux écrans, une seule signature", async () => {
    const a = shots.signPaths(["u/a.png"]);
    expect(shots.pathsToSign(["u/a.png"], T0)).toEqual([]);
    await a;
    expect(signCalls.length).toBe(1);
  });
});

describe("une image qui échoue", () => {
  test("est re-signée automatiquement, deux fois, puis déclarée indisponible", async () => {
    await shots.signPaths(["u/a.png"]);
    for (let attempt = 1; attempt <= shots.MAX_AUTO_RETRIES; attempt += 1) {
      shots.reportBrokenScreenshot("u/a.png");
      expect(shots.isScreenshotUnavailable("u/a.png")).toBe(false);
      expect(shots.cachedScreenshotUrl("u/a.png", T0)).toBeNull();
      setSystemTime(new Date(T0 + attempt * 10_000));
      expect(shots.pathsToSign(["u/a.png"], Date.now())).toEqual(["u/a.png"]);
      await shots.signPaths(["u/a.png"]);
    }
    shots.reportBrokenScreenshot("u/a.png");
    expect(shots.isScreenshotUnavailable("u/a.png")).toBe(true);
    expect(shots.pathsToSign(["u/a.png"], Date.now() + 60_000)).toEqual([]);
  });

  test("« Réessayer » remet la capture dans le circuit", async () => {
    await shots.signPaths(["u/a.png"]);
    for (let i = 0; i <= shots.MAX_AUTO_RETRIES; i += 1) shots.reportBrokenScreenshot("u/a.png");
    expect(shots.isScreenshotUnavailable("u/a.png")).toBe(true);
    shots.retryScreenshot("u/a.png");
    expect(shots.isScreenshotUnavailable("u/a.png")).toBe(false);
    expect(shots.pathsToSign(["u/a.png"], Date.now())).toEqual(["u/a.png"]);
  });

  test("un fichier absent du stockage suit le même chemin", async () => {
    missing.add("u/gone.png");
    for (let i = 0; i <= shots.MAX_AUTO_RETRIES; i += 1) {
      setSystemTime(new Date(T0 + i * 10_000));
      await shots.signPaths(shots.pathsToSign(["u/gone.png"], Date.now()));
    }
    expect(shots.isScreenshotUnavailable("u/gone.png")).toBe(true);
  });

  test("une coupure réseau pendant la signature ne déclare rien d'indisponible", async () => {
    failNext = true;
    await shots.signPaths(["u/a.png"]);
    expect(shots.isScreenshotUnavailable("u/a.png")).toBe(false);
    setSystemTime(new Date(T0 + 10_000));
    expect(shots.pathsToSign(["u/a.png"], Date.now())).toEqual(["u/a.png"]);
  });

  test("pas de rafale : une nouvelle tentative attend un court délai", async () => {
    await shots.signPaths(["u/a.png"]);
    shots.reportBrokenScreenshot("u/a.png");
    expect(shots.pathsToSign(["u/a.png"], Date.now())).toEqual(["u/a.png"]);
    await shots.signPaths(["u/a.png"]);
    shots.reportBrokenScreenshot("u/a.png");
    // Juste après un premier échec re-signé, on ne re-signe pas en boucle.
    expect(shots.pathsToSign(["u/a.png"], Date.now())).toEqual([]);
    expect(shots.nextRetryAt(["u/a.png"])).toBeGreaterThan(Date.now());
  });
});

describe("abonnement", () => {
  test("les écrans sont prévenus quand une capture change d'état", async () => {
    let calls = 0;
    const off = shots.subscribeScreenshots(() => (calls += 1));
    await shots.signPaths(["u/a.png"]);
    shots.reportBrokenScreenshot("u/a.png");
    expect(calls).toBe(2);
    off();
  });
});
