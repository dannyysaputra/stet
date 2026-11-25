// Checks one piece of interface text: plain rules first, then a verdict already
// reached for the same text, then the laptop model (Laptop only, never the cloud).
import { askJson, laptopModelStatus } from "../ai.js";
import { EN_SCHEMA, enPrompt } from "../english-check.js";
import { ruleCheck } from "./rules.js";

export const APP = "Lumbung, an invoicing app for small businesses";

export const PROBLEM_NAMES = {
  sounds_generated: "Sounds generated",
  vague_button: "Vague button",
  blames_user: "Blames the user",
  unclear_message: "Unclear message",
  jargon: "Jargon",
  leftover_text: "Leftover text",
  vague_link: "Vague link",
  inconsistent_term: "Inconsistent term",
};

// Verdicts from the laptop model, by element kind and text, for this page session.
// The same text on another screen reuses the verdict instead of a second call.
const cache = new Map();
const cacheKey = (g) => `${g.kind}\n${g.text}`;

export { laptopModelStatus };

/**
 * The verdict for one group from collect.js, without calling the model.
 * Returns { finding, source: "rule" | "reused" } or null if the model has to judge it.
 */
export function quickCheck(g) {
  const rule = ruleCheck(g.text, g.kind);
  if (rule) return { finding: rule, source: "rule" };
  const hit = cache.get(cacheKey(g));
  if (hit) return { ...hit, source: "reused" };
  return null;
}

/**
 * The first laptop call after the page opens is slow (about 19 s against about 3 s,
 * measured 2026-11-25) while Chrome loads the model. One small call on page load
 * moves that wait to before the user presses Review. Returns { where, ms }.
 */
export async function warmUp() {
  const r = await askJson(enPrompt({ app: APP, screen: "start", kind: "button", text: "Save" }), EN_SCHEMA, { mode: "ONLY_ON_DEVICE", purpose: "a warm-up check" });
  return { where: r.where, ms: r.ms };
}

/** Asks the laptop model. Returns { finding, source: "laptop", where, ms }. Throws on failure. */
export async function modelCheck(g, screen) {
  const r = await askJson(
    enPrompt({ app: APP, screen, kind: g.kind, context: g.context, text: g.text }),
    EN_SCHEMA,
    { mode: "ONLY_ON_DEVICE", purpose: "one piece of the app's text" },
  );
  const d = r.data ?? {};
  const finding = {
    verdict: d.verdict === "problem" ? "problem" : "ok",
    problem: d.problem ?? "none",
    severity: d.severity ?? "none",
    rewrite: d.rewrite ?? "",
  };
  const result = { finding, where: r.where, ms: r.ms };
  // Only a reply the SDK says ran on the laptop is reused.
  if (r.where === "laptop") cache.set(cacheKey(g), result);
  return { ...result, source: "laptop" };
}
