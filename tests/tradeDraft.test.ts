import { describe, expect, test } from "bun:test";
import {
  draftOnlyScreenshots,
  restoreDraftScreenshots,
} from "../src/app/features/journal/tradeDraft";
import { readSource } from "./helpers/source";

describe("TradeModal — a draft must preserve every modification", () => {
  test("restores uploaded screenshot references in order after reopening", () => {
    const saved = ["user/one.png", "user/two.jpg"];
    expect(restoreDraftScreenshots(saved, [])).toEqual(saved);
    expect(restoreDraftScreenshots([], ["original.png"])).toEqual([]);
    expect(restoreDraftScreenshots(null, ["original.png"])).toEqual(["original.png"]);
    expect(restoreDraftScreenshots([false, "one.png", 42], [])).toEqual(["one.png"]);
    expect(restoreDraftScreenshots(["1", "2", "3", "4"], [])).toEqual(["1", "2", "3"]);
  });

  test("discarding removes only newly uploaded images, never existing trade images", () => {
    const original = ["user/original.png", "user/kept.png"];
    const draft = ["user/new.png", "user/original.png", "user/other.png"];
    expect(draftOnlyScreenshots(draft, original)).toEqual(["user/new.png", "user/other.png"]);
    expect(draftOnlyScreenshots(["data:image/png;base64,abc"], [])).toEqual([]);
  });

  test("each character or toggle is persisted immediately without requiring symbol/risk", () => {
    const modal = readSource(import.meta.dir, "../src/app/features/journal/TradeModal.tsx");
    const hook = readSource(import.meta.dir, "../src/app/hooks/useDraftAutosave.ts");
    expect(modal).toContain("const draftBody = JSON.stringify(draftState)");
    expect(modal).toContain(
      "() => ({ ...form, __ui: { newConfluence, stopPoints, pointValue, rDraft } })",
    );
    expect(modal).toContain("const dirty = hasInteractedRef.current || draftRestored");
    expect(modal).toContain("immediate: true");
    expect(modal).not.toContain('omit: ["screenshots"]');
    expect(hook).toContain("useLayoutEffect(() =>");
    expect(hook).toContain("if (immediate && key && dirty) save.current()");
  });

  test("photos survive closing; only explicit discard/removal deletes draft files", () => {
    const modal = readSource(import.meta.dir, "../src/app/features/journal/TradeModal.tsx");
    expect(modal).toContain("restoreDraftScreenshots(saved.screenshots, [])");
    expect(modal).toContain(
      "writeJSON(draftKey, { ...pending, ...next, __ui: pending?.__ui })",
    );
    expect(modal).toContain("draftOnlyScreenshots(form.screenshots, trade?.screenshots)");
    expect(modal).not.toContain("sessionUploadsRef");
  });

  test("failed server saves keep the draft for recovery", () => {
    const modal = readSource(import.meta.dir, "../src/app/features/journal/TradeModal.tsx");
    const app = readSource(import.meta.dir, "../src/app/shell/App.tsx");
    expect(modal).toContain("const result = await onSave(");
    expect(modal).toContain("if (result !== false)");
    expect(app).toContain('toast(t("app.saveTradeFailed"), "error");\n        return false;');
  });
});
