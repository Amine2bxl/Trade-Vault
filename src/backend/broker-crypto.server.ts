/**
 * Chiffrement des secrets broker — AES-256-GCM, clé serveur.
 *
 * Les identifiants Tradovate (login, mot de passe, clé API) et les jetons
 * d'accès donnent la main sur des comptes de trading réels. Ils ne sont
 * JAMAIS écrits en clair : la base ne voit qu'un texte chiffré, et la clé vit
 * uniquement dans l'environnement serveur (`BROKER_CREDENTIALS_KEY`). Une
 * fuite de la base seule ne livre donc rien d'exploitable.
 *
 * Format : `v1:<iv base64>:<chiffré+tag base64>`. Le préfixe de version
 * permettra une rotation de clé sans ambiguïté sur les lignes existantes.
 *
 * WebCrypto (`crypto.subtle`) : disponible nativement sur le runtime Node de
 * Vercel comme sous Bun, sans dépendance.
 */

const VERSION = "v1";

export class BrokerCryptoUnavailable extends Error {
  constructor() {
    super("BROKER_CREDENTIALS_KEY is not configured");
  }
}

/** La clé est-elle configurée ? Sans elle, aucune connexion n'est proposée. */
export function brokerCryptoConfigured(): boolean {
  return (process.env.BROKER_CREDENTIALS_KEY ?? "").length >= 32;
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const unb64 = (text: string) => new Uint8Array(Buffer.from(text, "base64"));

let cachedKey: { raw: string; key: CryptoKey } | null = null;

/**
 * La clé AES dérivée du secret d'environnement. Le secret peut être n'importe
 * quelle chaîne d'au moins 32 caractères : on en prend le SHA-256, ce qui
 * donne toujours exactement 256 bits sans imposer un format à l'opérateur.
 */
async function key(): Promise<CryptoKey> {
  const raw = process.env.BROKER_CREDENTIALS_KEY ?? "";
  if (raw.length < 32) throw new BrokerCryptoUnavailable();
  if (cachedKey?.raw === raw) return cachedKey.key;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const k = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  cachedKey = { raw, key: k };
  return k;
}

export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(),
    new TextEncoder().encode(plain),
  );
  return `${VERSION}:${b64(iv)}:${b64(new Uint8Array(ct))}`;
}

export async function decryptSecret(sealed: string): Promise<string> {
  const [version, iv, ct] = sealed.split(":");
  if (version !== VERSION || !iv || !ct) throw new Error("unsupported secret format");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv) },
    await key(),
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
