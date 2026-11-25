// The translation check: prompt, problem kinds and reply schema for Indonesian
// text judged against its English original. Shared by the Phase 0 accuracy test
// (src/eval-checks.js) and the review (src/review/check.js), so the review uses
// exactly the prompt that was measured.
import idRules from "../data/eval/id-rules.md?raw";

export const ID_TYPES = ["wrong_sense", "word_for_word", "wrong_verb_form", "mixed_register"];

export const ID_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["ok", "problem"] },
    problem: { type: "string", enum: [...ID_TYPES, "none"] },
    better: { type: "string" },
    note_en: { type: "string" },
  },
  required: ["verdict", "problem", "better", "note_en"],
};

export { idRules };

/** r: { register, app, screen, kind, en, id_text } */
export const idPrompt = (r) => `You review Indonesian interface text against its English original, using these rules.

${idRules}

App address: the app speaks to the user as "${r.register}".
App: ${r.app}
Screen: ${r.screen}
Element: ${r.kind}
English: "${r.en}"
Indonesian: "${r.id_text}"

Reply with JSON only. If the Indonesian is fine, use verdict "ok", problem "none", better "" and note_en "". Otherwise give the single best-matching problem kind, a better Indonesian version, and one short sentence in plain English on what the bad version says or does wrong.`;
