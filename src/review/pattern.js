// The pattern step (slice 2.4): only the count of each problem kind goes to the
// cloud model, which returns a short note on the likely cause and one rule for
// the coding agent's instruction file. Pure: no imports, so the gate
// scripts/check-pattern.mjs can prove that nothing but counts gets into the prompt.

export const KINDS = ["sounds_generated", "vague_button", "blames_user", "unclear_message", "jargon", "leftover_text", "vague_link", "inconsistent_term"];

/**
 * Keeps only known problem kinds with whole, positive counts. Anything else
 * (text, keys, made-up kinds) is dropped, so it can never reach the prompt.
 */
export function cleanCounts(counts) {
  const out = {};
  for (const k of KINDS) {
    const n = counts?.[k];
    if (Number.isInteger(n) && n > 0) out[k] = n;
  }
  return out;
}

export const PATTERN_SCHEMA = {
  type: "object",
  properties: {
    cause: { type: "string" },
    rule: { type: "string" },
  },
  required: ["cause", "rule"],
};

export const PATTERN_TEMPLATE = `A coding agent built the screens of an app. A review of the interface text found these problems, counted by kind (no text from the app is included):

{{COUNTS}}

Kinds: sounds_generated = marketing filler; vague_button = button labels that do not say what they do; blames_user = messages that blame the user; unclear_message = messages that do not say what failed or what to do; jargon = developer words; leftover_text = draft text never replaced; vague_link = link text that does not say where it goes; inconsistent_term = one thing called two names.

Reply with JSON only:
- cause: two sentences at most, in plain English, on what the agent most likely does that leads to this pattern.
- rule: one rule for the agent's instruction file (such as AGENTS.md or CLAUDE.md) that would prevent the most common problems. One or two sentences, an instruction the agent can follow while writing interface text, with one short example.`;

/** The exact prompt sent to the cloud: the fixed template plus the cleaned counts. */
export function patternPrompt(counts) {
  const payload = cleanCounts(counts);
  return { payload, prompt: PATTERN_TEMPLATE.replace("{{COUNTS}}", JSON.stringify(payload, null, 2)) };
}
