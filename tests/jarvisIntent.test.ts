import { describe, expect, test } from "bun:test";
import { classifyQuestion } from "../src/app/features/jarvis/intent";

describe("la pré-réponse de Jarvis suit la question", () => {
  const cases: [string, string][] = [
    ["Pourquoi j'ai perdu sur mon dernier trade ?", "trade"],
    ["Qu'est-ce que j'ai noté hier ?", "day"],
    ["Quel est mon win rate ce mois ?", "performance"],
    ["Je risque trop par trade ?", "risk"],
    ["Comment arrêter le revenge trading ?", "psychology"],
    ["Est-ce que je vais passer mon challenge prop ?", "goal"],
    ["C'est quoi un order block ?", "general"],
  ];
  for (const [q, intent] of cases) {
    test(`${q} → ${intent}`, () => {
      expect(classifyQuestion(q)).toBe(intent as ReturnType<typeof classifyQuestion>);
    });
  }
});
