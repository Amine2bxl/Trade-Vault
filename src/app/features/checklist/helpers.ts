/* Helpers purs de la checklist — extrait de Checklist.tsx (Phase D). */
import {
  type ChkConfig,
  defaultConfigFor,
  localTimeZone,
  migrateConfig,
} from "./checklistDefaults";

/* ══ Helpers ══ */
export const pad = (n: number) => String(n).padStart(2, "0");

export function getTimeInZone(date: Date, timeZone: string) {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      hour12: false,
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const map: Record<string, string> = {};
    fmt.formatToParts(date).forEach((p) => {
      map[p.type] = p.value;
    });
    return { hour: +map.hour, minute: +map.minute };
  } catch {
    const d = new Date(date.toLocaleString("en-US", { timeZone }));
    return { hour: d.getHours(), minute: d.getMinutes() };
  }
}
export function parseTimeToMinutes(v: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v || "");
  return m ? +m[1] * 60 + +m[2] : 0;
}
export function isWindowOpen(cfg: ChkConfig, date = new Date()) {
  const parts = getTimeInZone(date, cfg.timeZone);
  return parts.hour * 60 + parts.minute >= parseTimeToMinutes(cfg.startTime);
}
export function getTimeZoneOptions(): string[] {
  let zones: string[] = [];
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    if (typeof intl.supportedValuesOf === "function") zones = intl.supportedValuesOf("timeZone");
  } catch {
    /* fall through */
  }
  if (!zones.length) {
    zones = [
      "UTC",
      "Europe/Paris",
      "Europe/London",
      "America/New_York",
      "America/Los_Angeles",
      "Asia/Tokyo",
      "Asia/Dubai",
      "Australia/Sydney",
    ];
  }
  const local = localTimeZone();
  if (!zones.includes(local)) zones.unshift(local);
  return [...new Set(zones)].sort();
}

/* Merge stored config with defaults so new fields never break old saves */
export function hydrateConfig(raw: string | null, lang: string): ChkConfig {
  const def = defaultConfigFor(lang);
  if (!raw) return def;
  try {
    const p = JSON.parse(raw) as Partial<ChkConfig>;
    return migrateConfig(
      {
        ...def,
        ...p,
        // Une liste enregistrée sans version date d'avant les questions
        // d'entrée : la version des défauts ne doit pas la masquer. Sans liste
        // enregistrée, ce sont les défauts — déjà à jour.
        gateV: Array.isArray(p.items) ? p.gateV : def.gateV,
        fomo: Array.isArray(p.fomo) && p.fomo.length === 4 ? p.fomo : def.fomo,
      },
      lang,
    );
  } catch {
    return def;
  }
}
