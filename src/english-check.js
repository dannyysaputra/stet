// The English check: prompt, problem kinds and reply schema.
// Shared by the Phase 0 accuracy test (src/eval-checks.js) and the review page
// (src/review/check.js), so the review uses exactly the prompt that was measured.
import wordingGuide from "../data/eval/wording-guide.md?raw";

export const EN_TYPES = ["sounds_generated", "vague_button", "blames_user", "unclear_message", "jargon", "leftover_text", "vague_link", "inconsistent_term"];

export const EN_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["ok", "problem"] },
    problem: { type: "string", enum: [...EN_TYPES, "none"] },
    severity: { type: "string", enum: ["high", "medium", "low", "none"] },
    rewrite: { type: "string" },
  },
  required: ["verdict", "problem", "severity", "rewrite"],
};

export { wordingGuide };

/** r: { app, screen, kind, context?, text }. guide: the wording guide in use (the starter guide by default). */
export const enPrompt = (r, guide = wordingGuide) => `You review the interface text of an app, one piece at a time, against this wording guide.

${guide}

Judge this one piece of text.
App: ${r.app}
Screen: ${r.screen}
Element: ${r.kind}
${r.context ? `Context: ${r.context}\n` : ""}Text: "${r.text}"

Reply with JSON only. If the text is fine, use verdict "ok", problem "none", severity "none" and rewrite "". Otherwise give the single best-matching problem kind, its seriousness, and a rewrite that follows the guide.`;
