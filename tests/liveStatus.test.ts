import { describe, expect, test } from "bun:test";
import { liveStatusMessage, LIVE_STATUS_GRACE_MS } from "../src/app/shell/liveStatusMessage";

/**
 * L'INDICATEUR DE CONNEXION ne parle que quand c'est utile : en ligne, rien ;
 * un simple battement de reconnexion (moins de deux secondes), rien non plus —
 * sinon il clignoterait à chaque retour d'onglet. Et il ne dit « reconnexion »
 * que si le direct a déjà fonctionné : la connexion initiale se fait en silence.
 */
const ctx = (over: Partial<{ everOnline: boolean; browserOnline: boolean }> = {}) => ({
  everOnline: true,
  browserOnline: true,
  ...over,
});

describe("indicateur de connexion", () => {
  test("en ligne : rien", () => {
    expect(liveStatusMessage("online", 0, 60_000, ctx())).toBeNull();
  });

  test("coupure brève : rien", () => {
    expect(
      liveStatusMessage(
        "offline",
        10_000,
        10_000 + LIVE_STATUS_GRACE_MS - 1,
        ctx({ browserOnline: false }),
      ),
    ).toBeNull();
  });

  test("navigateur hors ligne qui dure : le message hors ligne", () => {
    expect(
      liveStatusMessage(
        "offline",
        10_000,
        10_000 + LIVE_STATUS_GRACE_MS + 1,
        ctx({ browserOnline: false }),
      ),
    ).toBe("liveStatus.offline");
  });

  test("réseau présent mais canal tombé : reconnexion, pas « hors ligne »", () => {
    expect(liveStatusMessage("offline", 0, LIVE_STATUS_GRACE_MS + 500, ctx())).toBe(
      "liveStatus.connecting",
    );
    expect(liveStatusMessage("connecting", 0, LIVE_STATUS_GRACE_MS + 500, ctx())).toBe(
      "liveStatus.connecting",
    );
  });

  test("connexion initiale lente : silence", () => {
    expect(
      liveStatusMessage("connecting", 0, LIVE_STATUS_GRACE_MS + 5_000, ctx({ everOnline: false })),
    ).toBeNull();
  });

  test("le délai de grâce est de deux secondes", () => {
    expect(LIVE_STATUS_GRACE_MS).toBe(2_000);
  });
});
