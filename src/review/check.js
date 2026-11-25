// Checks one piece of interface text: plain rules first, then a verdict already
// reached for the same text, then the laptop model (Laptop only, never the cloud).
import { askJson, laptopModelStatus } from "../ai.js";
import { EN_SCHEMA, enPrompt } from "../english-check.js";
import { copiedExample, parseTerms, ruleCheck } from "./rules.js";
import { currentGuide } from "../guide.js";

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

// Verdicts from the laptop model, by guide, element kind and text, for this page
// session. The same text on another screen reuses the verdict instead of a second
// call; a different guide never reuses a verdict reached under the old one.
const cache = new Map();
const cacheKey = (g) => `${currentGuide().id}\n${g.kind}\n${g.text}`;

export { laptopModelStatus };

let termsFor = { id: null, terms: [] };
const guideTerms = () => {
  const guide = currentGuide();
  if (termsFor.id !== guide.id) termsFor = { id: guide.id, terms: parseTerms(guide.markdown) };
  return termsFor.terms;
};

/**
 * The verdict for one group from collect.js, without calling the model.
 * Returns { finding, source: "rule" | "reused" } or null if the model has to judge it.
 */
export function quickCheck(g) {
  const rule = ruleCheck(g.text, g.kind, guideTerms());
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
  const guide = currentGuide();
  const r = await askJson(
    enPrompt({ app: APP, screen, kind: g.kind, context: g.context, text: g.text }, guide.markdown),
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
  const result = { finding, where: r.where, ms: r.ms, guideId: guide.id };
  // Only a reply the SDK says ran on the laptop is reused.
  if (r.where === "laptop") cache.set(cacheKey(g), result);
  return { ...result, source: "laptop" };
}

// ---------- new text for the fix prompt (slice 2.2) ----------

const REWRITE_SCHEMA = { type: "object", properties: { text: { type: "string" } }, required: ["text"] };

const rewritePrompt = (r, guide) => `You fix one piece of interface text in an app, following this wording guide.

${guide}

App: ${r.app}
Screen: ${r.screen}
Other text on this screen: ${r.others.map((t) => `"${t}"`).join(", ")}
Element: ${r.kind}
Key in the code (a hint about what it is for): ${r.key}
${r.context ? `Context: ${r.context}\n` : ""}Text: "${r.text}"
Problem: ${r.problem}${r.avoid ? `\nDo not write "${r.avoid.text}": ${r.avoid.reason}.` : ""}

Write the new text only, in the app's voice, specific to this screen, and about as short as the original.
The examples in the guide are examples: never copy them. Do not mention buttons, pages or features that are not in the screen's text above.${r.kind === "placeholder" ? "\nThis is hint text inside an empty field: show a realistic example or format of what goes in it, not the field's name." : ""}
Reply with JSON only.`;

const unquote = (s) => String(s ?? "").trim().replace(/^["'“‘]+|["'”’]+$/g, "").trim();

/**
 * Why a candidate new text is not good enough, or null if it is.
 * screenWords: the screen's text, key and context in lower case (for the example check).
 */
export function newTextProblem(g, text, screenWords = "") {
  const t = unquote(text);
  if (!t) return "it is empty";
  if (t.toLowerCase() === g.text.toLowerCase()) return "it is the same as the old text";
  const rule = ruleCheck(t, g.kind, guideTerms());
  if (rule) return `it is still ${PROBLEM_NAMES[rule.problem].toLowerCase()}`;
  if (screenWords && copiedExample(t, currentGuide().markdown, screenWords)) return "it is an example from the guide, not about this screen";
  return null;
}

const rewrites = new Map();

/**
 * New text for one ticked finding. Uses the review's rewrite when it passes the
 * plain rules; otherwise asks the laptop model, and asks once more if that answer
 * fails them too. Returns { text, source: "review" | "laptop" | "reused", problem? }.
 * problem is set when no candidate passed; text is then the last candidate (maybe "").
 */
export async function newTextFor(g, screen, others) {
  const screenWords = [...others, g.key.replace(/[._-]/g, " "), g.context ?? "", screen].join(" ").toLowerCase();
  const problemOf = (t) => newTextProblem(g, t, screenWords);
  const own = unquote(g.result.finding.rewrite);
  if (!problemOf(own)) return { text: own, source: "review" };
  const key = `${currentGuide().id}\n${g.kind}\n${g.text}`;
  if (rewrites.has(key)) return { ...rewrites.get(key), source: "reused" };

  const guide = currentGuide();
  const f = g.result.finding;
  let avoid = own ? { text: own, reason: problemOf(own) } : null;
  let last = { text: own, problem: avoid?.reason ?? "it is empty" };
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await askJson(
      rewritePrompt(
        { app: APP, screen, others, key: g.key, kind: g.kind, context: g.context, text: g.text, problem: `${PROBLEM_NAMES[f.problem] ?? f.problem}. ${f.note ?? ""}`.trim(), avoid },
        guide.markdown,
      ),
      REWRITE_SCHEMA,
      { mode: "ONLY_ON_DEVICE", purpose: "new text for one piece of the app's text" },
    );
    const text = unquote(r.data?.text);
    const problem = problemOf(text);
    if (!problem) {
      const result = { text, where: r.where, ms: r.ms };
      if (r.where === "laptop") rewrites.set(key, result);
      return { ...result, source: "laptop" };
    }
    last = { text, problem };
    avoid = { text, reason: problem };
  }
  return { text: last.text, source: "laptop", problem: last.problem };
}
