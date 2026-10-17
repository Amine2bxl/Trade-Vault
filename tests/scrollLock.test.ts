import { expect, test } from "bun:test";
import { acquireBodyScrollLock } from "../src/shared/ui/scrollLock";

test("les panneaux imbriqués partagent un verrou, quel que soit leur ordre de fermeture", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const style = { overflow: "auto" };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { body: { style } } });
  const releases: (() => void)[] = [];
  try {
    const parent = acquireBodyScrollLock();
    releases.push(parent);
    const child = acquireBodyScrollLock();
    releases.push(child);
    expect(style.overflow).toBe("hidden");
    parent();
    expect(style.overflow).toBe("hidden");
    child();
    expect(style.overflow).toBe("auto");
    child();
    expect(style.overflow).toBe("auto");
    style.overflow = "hidden";
    const other = acquireBodyScrollLock();
    releases.push(other);
    other();
    expect(style.overflow).toBe("hidden");
  } finally {
    releases.forEach((release) => release());
    if (descriptor) Object.defineProperty(globalThis, "document", descriptor);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
