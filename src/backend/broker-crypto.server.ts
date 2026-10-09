/**
 * Chiffrement des jetons broker — AES-256-GCM, clé serveur.
 *
 * Le jeton d'accès Tradovate donne la lecture d'un compte de trading réel. Il
 * n'est JAMAIS écrit en clair : la base ne voit qu'un texte chiffré, et la clé
 * ne vit que dans l'environnement serveur. Une fuite de la base seule ne livre
 * donc rien d'exploitable.
 *
 * ── D'OÙ VIENT LA CLÉ ──
 * 1. `BROKER_CREDENTIALS_KEY` quand l'opérateur l'a posée (≥ 32 caractères) —
 *    format `v1:` ;
 * 2. sinon, une clé DÉRIVÉE (HKDF-SHA256, étiquette dédiée) du secret serveur
 *    `SUPABASE_SERVICE_ROLE_KEY`, déjà présent dans chaque environnement —
 *    format `d1:`. La synchro n'exige donc aucune variable de plus pour
 *    démarrer, et la clé dérivée ne sert qu'à ça : connaître le texte chiffré
 *    et la clé de service ne donne pas plus que la clé de service seule, qui
 *    ouvre déjà toute la base.
 *
 * Le préfixe dit quelle clé a scellé chaque ligne : poser
 * `BROKER_CREDENTIALS_KEY` plus tard ne rend pas illisibles les jetons déjà
 * scellés par la clé dérivée (ils restent lus avec elle), les nouveaux
 * passent sur la clé explicite.
 *
 * Format : `<v1|d1>:<iv base64>:<chiffré+tag base64>`.
 *
 * WebCrypto (`crypto.subtle`) : disponible nativement sur le runtime Node de
 * Vercel comme sous Bun, sans dépendance.
 */

type KeySource = "v1" | "d1";

/** Étiquette HKDF : la clé dérivée ne peut servir à rien d'autre. */
const HKDF_INFO = "tradevault/broker-tokens/v1";

export class BrokerCryptoUnavailable extends Error {
  constructor() {
    super("no broker encryption key: set BROKER_CREDENTIALS_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }
}

const explicitSecret = () => {
  const raw = process.env.BROKER_CREDENTIALS_KEY ?? "";
  return raw.length >= 32 ? raw : null;
};
const derivationSecret = () => {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return raw.length >= 32 ? raw : null;
};

/** Une clé est-elle disponible ? Sans aucune, aucune connexion n'est proposée. */
export function brokerCryptoConfigured(): boolean {
  return !!explicitSecret() || !!derivationSecret();
}

/** La source qu'utilise un NOUVEAU chiffrement. */
function currentSource(): KeySource {
  if (explicitSecret()) return "v1";
  if (derivationSecret()) return "d1";
  throw new BrokerCryptoUnavailable();
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const unb64 = (text: string) => new Uint8Array(Buffer.from(text, "base64"));

const cache = new Map<KeySource, { raw: string; key: CryptoKey }>();

/**
 * La clé AES d'une source.
 *  - `v1` : SHA-256 du secret explicite (n'importe quelle chaîne ≥ 32
 *    caractères donne exactement 256 bits) ;
 *  - `d1` : HKDF-SHA256 du secret de service, sel fixe, étiquette dédiée.
 */
async function key(source: KeySource): Promise<CryptoKey> {
  const raw = source === "v1" ? explicitSecret() : derivationSecret();
  if (!raw) throw new BrokerCryptoUnavailable();
  const hit = cache.get(source);
  if (hit?.raw === raw) return hit.key;
  const enc = new TextEncoder();
  let bits: ArrayBuffer;
  if (source === "v1") {
    bits = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  } else {
    const base = await crypto.subtle.importKey("raw", enc.encode(raw), "HKDF", false, [
      "deriveBits",
    ]);
    bits = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: enc.encode("tradevault"),
        info: enc.encode(HKDF_INFO),
      },
      base,
      256,
    );
  }
  const k = await crypto.subtle.importKey("raw", bits, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  cache.set(source, { raw, key: k });
  return k;
}

export async function encryptSecret(plain: string): Promise<string> {
  const source = currentSource();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(source),
    new TextEncoder().encode(plain),
  );
  return `${source}:${b64(iv)}:${b64(new Uint8Array(ct))}`;
}

export async function decryptSecret(sealed: string): Promise<string> {
  const [source, iv, ct] = sealed.split(":");
  if ((source !== "v1" && source !== "d1") || !iv || !ct) {
    throw new Error("unsupported secret format");
  }
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv) },
    await key(source),
    unb64(ct),
  );
  return new TextDecoder().decode(plain);
}

export async function encryptJson(value: unknown): Promise<string> {
  return encryptSecret(JSON.stringify(value));
}

export async function decryptJson<T>(sealed: string): Promise<T> {
  return JSON.parse(await decryptSecret(sealed)) as T;
}

/** Empreinte d'un `state` OAuth : on garde la preuve, jamais la valeur. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
