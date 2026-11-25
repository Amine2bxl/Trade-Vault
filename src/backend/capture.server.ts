import { createHash } from "node:crypto";
import { CAPTURE_VERSION } from "@/domain/capture";
import type { AIImage } from "@/modules/ai-provider";

/* Utilitaires serveur du moteur de capture (Node) — hors du paquet client. */

/** Le type réel d'une image, lu dans ses premiers octets — jamais dans son nom. */
export function sniffImageType(bytes: Uint8Array): AIImage["mimeType"] | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

/** L'empreinte d'une analyse : mêmes images, même note, même version → même résultat. */
export function captureFingerprint(
  images: Uint8Array[],
  note: string | null,
  target: string,
): string {
  const h = createHash("sha256");
  h.update(`v${CAPTURE_VERSION}|${target}|`);
  for (const img of images) h.update(createHash("sha256").update(img).digest("hex"));
  h.update(`|${note?.trim() ?? ""}`);
  return h.digest("hex");
}
