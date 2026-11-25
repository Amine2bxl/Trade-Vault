import { describe, expect, test } from "bun:test";
import type { AIMessage } from "./types";
import { toGeminiContents } from "./gemini";
import { toAnthropicMessages } from "./anthropic";
import { toOpenAIMessages } from "./openai";
import { GroqProvider, OpenAIProvider, OpenRouterProvider } from "./openai";
import { GeminiProvider } from "./gemini";

const msg: AIMessage = {
  role: "user",
  content: "Read this chart",
  images: [{ mimeType: "image/jpeg", data: "QUJD" }],
};

describe("images jointes", () => {
  test("Gemini : inlineData avant la consigne", () => {
    const [c] = toGeminiContents([{ role: "system", content: "s" }, msg], "gemini-2.5-flash");
    expect(c.parts[0]).toEqual({ inlineData: { mimeType: "image/jpeg", data: "QUJD" } });
    expect(c.parts[1]).toEqual({ text: "Read this chart" });
  });

  test("Anthropic : bloc image base64", () => {
    const [m] = toAnthropicMessages([msg]);
    expect(m.content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "QUJD" } },
      { type: "text", text: "Read this chart" },
    ]);
  });

  test("OpenAI : image_url en data URL", () => {
    const [m] = toOpenAIMessages([msg], "openai") as { content: unknown[] }[];
    expect(m.content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,QUJD" },
    });
  });

  test("sans image, le texte reste une chaîne (rien ne change)", () => {
    const [m] = toAnthropicMessages([{ role: "user", content: "hi" }]);
    expect(m.content).toBe("hi");
  });

  test("seuls les fournisseurs qui lisent les images s'en déclarent capables", () => {
    expect(GeminiProvider.supportsVision).toBe(true);
    expect(OpenAIProvider.supportsVision).toBe(true);
    expect(GroqProvider.supportsVision).toBe(false);
    expect(OpenRouterProvider.supportsVision).toBe(false);
  });
});
