import { describe, expect, test } from "bun:test";
import { captureFingerprint, sniffImageType } from "./capture.server";

describe("capture serveur", () => {
  test("le type d'image vient des octets, pas du nom", () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImageType(webp)).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  test("empreinte stable : même capture → même clé, sinon autre clé", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 4]);
    const k = captureFingerprint([a], "note", "trade");
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(captureFingerprint([new Uint8Array([1, 2, 3])], " note ", "trade")).toBe(k);
    expect(captureFingerprint([b], "note", "trade")).not.toBe(k);
    expect(captureFingerprint([a], "note", "missed")).not.toBe(k);
    expect(captureFingerprint([a, b], null, "trade")).not.toBe(
      captureFingerprint([b, a], null, "trade"),
    );
  });
});
