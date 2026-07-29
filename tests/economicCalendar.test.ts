import { expect, test } from "bun:test";
import { parseForexFactoryFeed } from "../src/modules/economic-calendar/forex-factory";

// Le parser est la seule pièce qui casse quand la source change de forme.
// Il est donc testé sur fixture, sans réseau : ces tests doivent tourner en CI.

const FEED = [
  {
    title: "Non-Farm Employment Change",
    country: "USD",
    date: "2026-08-07T08:30:00-04:00",
    impact: "High",
    forecast: "180K",
    previous: "147K",
  },
  {
    title: "ECB Press Conference",
    country: "EUR",
    date: "2026-08-06T08:45:00-04:00",
    impact: "Medium",
    forecast: "",
    previous: "",
  },
  {
    title: "Bank Holiday",
    country: "GBP",
    date: "2026-08-03T00:00:00-04:00",
    impact: "Holiday",
    forecast: "",
    previous: "",
  },
];

// Le parser trie par date : on sélectionne toujours par identité métier,
// jamais par position, pour que les tests décrivent le contrat et pas l'ordre.
const parse = () => parseForexFactoryFeed(FEED);
const byCurrency = (c: string) => parse().find((e) => e.currency === c)!;

test("normalise les champs et convertit en instant UTC", () => {
  const nfp = byCurrency("USD");
  expect(nfp.title).toBe("Non-Farm Employment Change");
  expect(nfp.currency).toBe("USD");
  expect(nfp.country).toBe("United States");
  expect(nfp.impact).toBe("high");
  expect(nfp.forecast).toBe("180K");
  expect(nfp.previous).toBe("147K");
  // 08:30 à New York (UTC−4 en août) = 12:30 UTC.
  expect(nfp.startsAt).toBe("2026-08-07T12:30:00.000Z");
});

test("les chaînes vides deviennent null et actual reste absent avant publication", () => {
  const ecb = byCurrency("EUR");
  expect(ecb.forecast).toBeNull();
  expect(ecb.previous).toBeNull();
  expect(ecb.actual).toBeNull();
});

test("actual est repris dès que la source le publie", () => {
  const [released] = parseForexFactoryFeed([{ ...FEED[0], actual: "203K" }]);
  expect(released.actual).toBe("203K");
});

test("ne garde que la valeur courante quand la source encode une révision", () => {
  // La source écrit "publié|révisé" sur certaines lignes (ex. adjudications).
  const [event] = parseForexFactoryFeed([
    { ...FEED[0], previous: "3.09|1.0", forecast: "2.8|2.9", actual: "3.1|3.0" },
  ]);
  expect(event.previous).toBe("3.09");
  expect(event.forecast).toBe("2.8");
  expect(event.actual).toBe("3.1");
});

test("détecte les événements sans heure précise", () => {
  expect(byCurrency("GBP").allDay).toBe(true);
  expect(byCurrency("USD").allDay).toBe(false);
});

test("un id stable permet l'upsert répété sans doublon", () => {
  const first = byCurrency("USD");
  // Même événement, valeur réelle publiée entre deux synchros.
  const second = parseForexFactoryFeed([{ ...FEED[0], actual: "203K" }])[0];
  expect(second.id).toBe(first.id);
});

test("trie par date croissante", () => {
  const dates = parse().map((e) => e.startsAt);
  expect([...dates]).toEqual([...dates].sort());
});

test("ignore les entrées illisibles sans perdre les autres", () => {
  const events = parseForexFactoryFeed([
    null,
    "nope",
    { title: "No date", country: "USD" },
    { title: "Bad date", country: "USD", date: "not-a-date" },
    FEED[0],
  ]);
  expect(events).toHaveLength(1);
  expect(events[0].title).toBe("Non-Farm Employment Change");
});

test("ne lève jamais sur une charge inattendue", () => {
  expect(parseForexFactoryFeed(null)).toEqual([]);
  expect(parseForexFactoryFeed({ error: "rate limited" })).toEqual([]);
  expect(parseForexFactoryFeed("Request Denied")).toEqual([]);
});

test("une importance inconnue retombe sur low, jamais sur high", () => {
  const [event] = parseForexFactoryFeed([{ ...FEED[0], impact: "¯\\_(ツ)_/¯" }]);
  expect(event.impact).toBe("low");
});

test("déduplique les événements répétés entre deux semaines", () => {
  expect(parseForexFactoryFeed([FEED[0], FEED[0]])).toHaveLength(1);
});
