import { describe, it, expect } from "bun:test";
import { generateId } from "../src/app/store/ids";
import { storagePathsOf } from "../src/app/store/storage";

describe("store helpers", () => {
  it("generateId returns a unique string", () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(5);
  });

  it("storagePathsOf filters out data: URLs", () => {
    const result = storagePathsOf(["data:image/png;base64,abc", "https://example.com/file.png"]);
    expect(result).toEqual(["https://example.com/file.png"]);
  });

  it("storagePathsOf returns empty for null", () => {
    expect(storagePathsOf(null)).toEqual([]);
  });

  it("storagePathsOf returns empty for undefined", () => {
    expect(storagePathsOf(undefined)).toEqual([]);
  });
});
