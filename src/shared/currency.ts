/**
 * LA DEVISE DE TRADEVAULT — une préférence, une source, un formateur.
 *
 * Avant, `$` était écrit en dur à plus de cent endroits : un trader en euros
 * voyait ses gains en dollars dans le tableau de bord, le journal, les
 * rapports et les PDF. La devise est maintenant une PRÉFÉRENCE du compte
 * utilisateur (`profiles.currency`), choisie à l'onboarding et modifiable dans
 * Réglages, et chaque montant affiché passe par `formatMoney`.
 *
 * ── CE QUE CE MODULE NE FAIT PAS ──────────────────────────────────────────
 * Il ne CONVERTIT rien. Les montants du journal sont saisis dans la devise du
 * trader : les afficher en euros, c'est les étiqueter correctement, pas leur
 * appliquer un taux de change.
 *
 * ── EXTENSIBLE ────────────────────────────────────────────────────────────
 * Ajouter une devise = une ligne dans `CURRENCIES`. Le symbole, sa place et le
 * nombre de décimales (0 pour le yen) viennent d'`Intl.NumberFormat` : aucune
 * règle de mise en forme n'est écrite à la main ici.
 *
 * Module PUR côté logique (aucun React) : importable par le serveur (PDF,
 * e-mails) comme par le navigateur. Le hook React vit en bas du fichier et ne
 * s'appuie que sur `useSyncExternalStore`.
 */
import { useSyncExternalStore } from "react";

export const CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "PLN", name: "Polish Złoty" },
  { code: "INR", name: "Indian Rupee" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "ZAR", name: "South African Rand" },
  { code: "AED", name: "UAE Dirham" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
export const DEFAULT_CURRENCY: CurrencyCode = "USD";

/** Une valeur lue en base ou dans le stockage local, validée — jamais supposée. */
export function parseCurrency(raw: unknown): CurrencyCode {
  return CURRENCIES.some((c) => c.code === raw) ? (raw as CurrencyCode) : DEFAULT_CURRENCY;
}

/* Groupement « 1,234.50 » : la langue de l'app est l'anglais par défaut, et
   un même chiffre ne doit pas changer de ponctuation selon la devise. */
const LOCALE = "en-US";

const formatters = new Map<string, Intl.NumberFormat>();
function nf(currency: CurrencyCode, decimals: number | undefined): Intl.NumberFormat {
  const key = `${currency}:${decimals ?? "auto"}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
      ...(decimals !== undefined
        ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
        : {}),
    });
    formatters.set(key, f);
  }
  return f;
}

/** Décimales naturelles de la devise (2, ou 0 pour le yen). */
export function currencyDecimals(currency: CurrencyCode = getCurrency()): number {
  return nf(currency, undefined).resolvedOptions().maximumFractionDigits ?? 2;
}

/** « $ », « € », « £ », « ¥ », « CHF », « CA$ »… */
export function currencySymbol(currency: CurrencyCode = getCurrency()): string {
  return (
    nf(currency, 0)
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? currency
  );
}

export interface MoneyOptions {
  /** Préfixe `+` sur un montant positif (P&L). */
  signed?: boolean;
  /** Arrondi à l'unité (soldes, objectifs). */
  whole?: boolean;
  /** Forme courte « $1.2k » (axes de graphique, cellules étroites). */
  compact?: boolean;
  /** Devise explicite — sinon la préférence courante. */
  currency?: CurrencyCode;
}

/**
 * LE formateur monétaire. `formatMoney(1234.5)` → « $1,234.50 » ;
 * `{ signed: true }` → « +$1,234.50 » ; en EUR → « €1,234.50 » ;
 * en JPY → « ¥1,235 ».
 */
export function formatMoney(value: number, opts: MoneyOptions = {}): string {
  const currency = opts.currency ?? getCurrency();
  const v = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(v);
  const negative = v < 0 && abs >= 0.005;
  const sign = negative ? "-" : opts.signed && abs >= 0.005 ? "+" : "";

  if (opts.compact && abs >= 1000) {
    const symbol = currencySymbol(currency);
    const k = abs / 1000;
    const body =
      k >= 1000 ? `${(k / 1000).toFixed(1)}M` : `${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
    return `${sign}${symbolSpaced(symbol)}${body}`;
  }
  const decimals = opts.whole || opts.compact ? 0 : undefined;
  return sign + nf(currency, decimals).format(abs);
}

/** « CHF » s'écrit « CHF 1.2k », « $ » s'écrit « $1.2k ». */
function symbolSpaced(symbol: string): string {
  return /^[A-Za-z]{2,}$/.test(symbol) ? `${symbol} ` : symbol;
}

/* ── LA PRÉFÉRENCE COURANTE ─────────────────────────────────────────────────
   État de module, comme le compte actif : chaque formateur la lit sans qu'on
   ait à passer la devise à travers cent composants. `CurrencyProvider` (côté
   app) la charge depuis le profil ; le stockage local la rend disponible dès
   la première image au rechargement. */

const STORAGE_KEY = "tv.currency";
let current: CurrencyCode = DEFAULT_CURRENCY;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  try {
    current = parseCurrency(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    /* stockage indisponible (navigation privée) : la valeur du profil suivra */
  }
}

export function getCurrency(): CurrencyCode {
  return current;
}

export function setCurrency(code: CurrencyCode): void {
  const next = parseCurrency(code);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* best-effort */
    }
  }
  if (next === current) return;
  current = next;
  for (const l of listeners) l();
}

/** Oubli de la préférence locale (déconnexion). */
export function clearCurrencyCache(): void {
  current = DEFAULT_CURRENCY;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* best-effort */
    }
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** La devise courante, qui fait se redessiner le composant quand elle change. */
export function useCurrency(): CurrencyCode {
  return useSyncExternalStore(subscribe, getCurrency, () => DEFAULT_CURRENCY);
}
