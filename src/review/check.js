// Checks one piece of interface text: plain rules first, then a verdict already
// reached for the same text, then the laptop model (Laptop only, never the cloud).
import { askJson, laptopModelStatus } from "../ai.js";
import { EN_SCHEMA, enPrompt, wordingGuide } from "../english-check.js";
import { copiedExample, parseTerms, ruleCheck } from "./rules.js";
import { currentGuide, guideId } from "../guide.js";
import { ID_SCHEMA, idPrompt, idRules } from "../translation-check.js";
import { OPEN, projectMode, textMode } from "../project.js";
import { cloudModel } from "../config.js";

export const APP = "Lumbung, an invoicing app for small businesses";

// The translation check on the laptop, measured on the Phase 0 pairs (2026-11-25,
// before the owner's review of that data): see PLAN.md 0.4 and decision 2.
export const ID_ACCURACY =
  "the laptop model caught every wrong word sense but missed most wrong verb forms, and flagged 22.5% of fine strings in our test; an Open project checks Indonesian in the cloud instead.";

const ID_SEVERITY = { wrong_sense: "high", mixed_register: "medium", word_for_word: "medium", wrong_verb_form: "low" };

export const PROBLEM_NAMES = {
  sounds_generated: "Sounds generated",
  vague_button: "Vague button",
  blames_user: "Blames the user",
  unclear_message: "Unclear message",
  jargon: "Jargon",
  leftover_text: "Leftover text",
  vague_link: "Vague link",
  inconsistent_term: "Inconsistent term",
  wrong_sense: "Wrong sense",
  word_for_word: "Word for word",
  wrong_verb_form: "Wrong verb form",
  mixed_register: "Mixed address",
};

// Verdicts already reached, kept in the browser so they survive a reload (bench
// variant V1, docs/bench/review-speed.md). The key holds everything that goes
// into the prompt except the screen name: the prompt version (a hash of the
// prompt templates and schemas, so changed code never reuses old verdicts), the
// app, the guide, the element kind, the context and the text. Leaving the screen
// out is the 0.5 decision: the same string on another screen reuses its verdict.
// Indonesian verdicts are keyed by their English original and by where they ran:
// the laptop and the cloud differ a lot there (decision 2), so an Open project
// never reuses a laptop verdict.
// The version covers the prompt code, the schemas, and the text the prompts pull
// in (the starter wording guide and the Indonesian rules), so editing any of them
// starts a fresh set of verdicts.
const PROMPT_VERSION = guideId(
  [enPrompt, idPrompt].map(String).join("\n") + JSON.stringify([EN_SCHEMA, ID_SCHEMA]) + wordingGuide + idRules,
);
const STORE = "stet.verdicts";
const STORE_MAX = 500;
const cache = new Map();
const valid = (r) => r && typeof r === "object" && r.finding && (r.finding.verdict === "ok" || r.finding.verdict === "problem");

function readStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
    return saved?.v === PROMPT_VERSION && Array.isArray(saved.entries) ? saved.entries.filter(([k, r]) => typeof k === "string" && valid(r)) : [];
  } catch {
    return []; // nothing saved, or storage blocked: start empty
  }
}
for (const [k, r] of readStore()) cache.set(k, r);

// Saved verdicts are merged with what another page or tab saved meanwhile, the
// most recently used last, and capped; on a full store, half as many are kept.
function save() {
  const merged = new Map(readStore());
  for (const [k, r] of cache) {
    merged.delete(k);
    merged.set(k, r);
  }
  const entries = [...merged].slice(-STORE_MAX);
  for (const n of [entries.length, Math.floor(entries.length / 2)]) {
    try {
      localStorage.setItem(STORE, JSON.stringify({ v: PROMPT_VERSION, entries: entries.slice(-n) }));
      return;
    } catch {
      // full or blocked: try once with fewer, then keep them for this page session only
    }
  }
}
let saving = 0;
function remember(key, result) {
  cache.delete(key); // most recently used goes last, so the cap drops the oldest
  cache.set(key, result);
  if (cache.size > STORE_MAX) cache.delete(cache.keys().next().value);
  clearTimeout(saving);
  saving = setTimeout(save, 300);
}
addEventListener("pagehide", () => {
  clearTimeout(saving);
  save();
});

const idWhere = () => (projectMode() === OPEN ? "cloud" : "laptop");
// JSON keeps the fields apart even when a string contains a newline. The guide id
// is passed in by the caller that built the prompt, never read again later, so a
// guide changed during a review cannot label an old verdict as a new one. Cloud
// verdicts also carry the cloud model's name.
const cacheKey = (g, { app = APP, where = idWhere(), register = "Anda", guideAt = currentGuide().id } = {}) =>
  g.lang === "id"
    ? JSON.stringify([PROMPT_VERSION, "id", where, where === "cloud" ? cloudModel() : "", app, register, g.kind, g.original, g.text])
    : JSON.stringify([PROMPT_VERSION, "en", app, guideAt, g.kind, g.context ?? "", g.text]);

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
 * opts: { app, register } when the text is not the sample's (the /files/ page).
 */
export function quickCheck(g, opts = {}) {
  // The plain rules are written for English; Indonesian text only reuses verdicts.
  const rule = g.lang === "id" ? null : ruleCheck(g.text, g.kind, guideTerms());
  if (rule) return { finding: rule, source: "rule" };
  const hit = cache.get(cacheKey(g, opts));
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

/**
 * Asks the model about one English string: the laptop model in a Sealed project,
 * the laptop model first in an Open one. Callers pass mode "ONLY_ON_DEVICE" unless
 * the user has agreed to a list that shows this text (so nothing falls back to the
 * cloud unseen). Returns { finding, source: "laptop", where, ms }.
 */
export async function modelCheck(g, screen, { app = APP, mode = textMode() } = {}) {
  const guide = currentGuide();
  const r = await askJson(
    enPrompt({ app, screen, kind: g.kind, context: g.context, text: g.text }, guide.markdown),
    EN_SCHEMA,
    { mode, purpose: "one piece of the app's text" },
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
  if (r.where === "laptop") remember(cacheKey(g, { app, guideAt: guide.id }), result);
  return { ...result, source: r.where === "cloud" ? "cloud" : "laptop" };
}

/**
 * The translation check for one Indonesian string against its English original
 * (g.original), with the prompt measured in Phase 0. where: "laptop" (Sealed) or
 * "cloud" (Open, after the user approved sending these strings). The better
 * translation becomes the rewrite, and the plain-English note is kept.
 */
export async function translationCheck(g, screen, { app = APP, register = "Anda", where = "laptop" } = {}) {
  const key = cacheKey(g, { app, register, where }); // built before the call, like the prompt
  const r = await askJson(
    idPrompt({ register, app, screen, kind: g.kind, en: g.original, id_text: g.text }),
    ID_SCHEMA,
    { mode: where === "cloud" ? "ONLY_IN_CLOUD" : "ONLY_ON_DEVICE", purpose: "one Indonesian string and its English original, which you approved" },
  );
  const d = r.data ?? {};
  const problem = d.verdict === "problem" ? d.problem ?? "none" : "none";
  const finding = {
    verdict: d.verdict === "problem" ? "problem" : "ok",
    problem,
    severity: d.verdict === "problem" ? ID_SEVERITY[problem] ?? "medium" : "none",
    rewrite: d.better ?? "",
    note: d.note_en ?? "",
  };
  const result = { finding, where: r.where, ms: r.ms };
  // Kept only when it ran where it was asked to (always, for the Only modes used here).
  if (r.where === where) remember(key, result);
  return { ...result, source: r.where === "cloud" ? "cloud" : "laptop" };
}

// ---------- a better rewrite from the cloud (slice 3.5) ----------
// Only on request, for one string, after the user has seen exactly what is sent:
// cloudRewriteRequest() builds it, cloudRewrite() sends that same text.

/** The exact prompt that would go to the cloud for this one finding. */
export function cloudRewriteRequest(g, screen) {
  const f = g.result.finding;
  return `You fix one piece of interface text in an app${g.lang === "id" ? ", written in Indonesian" : ""}, following this wording guide.

${g.lang === "id" ? "(Indonesian: use the base verb for buttons, the app's chosen address, and the terms Indonesian apps already use.)" : currentGuide().markdown}

Screen: ${screen}
Element: ${g.kind}
${g.original ? `English original: "${g.original}"\n` : ""}Text: "${g.text}"
Problem: ${PROBLEM_NAMES[f.problem] ?? f.problem}.

Write the new text only, specific and about as short as the original. Reply with JSON only.`;
}

/** Sends the request from cloudRewriteRequest() (Cloud only). Returns { text, where, ms }. */
export async function cloudRewrite(g, request) {
  const r = await askJson(request, REWRITE_SCHEMA, { mode: "ONLY_IN_CLOUD", purpose: `one string you chose: "${g.text}"` });
  return { text: unquote(r.data?.text), where: r.where, ms: r.ms };
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
const wordsOf = (g, screen, others) => [...others, g.key.replace(/[._-]/g, " "), g.context ?? "", screen].join(" ").toLowerCase();

/** Whether newTextFor() would have to ask a model for this finding (no usable rewrite yet). */
export function needsNewText(g, screen, others) {
  if (!newTextProblem(g, g.result.finding.rewrite, wordsOf(g, screen, others))) return false;
  return !rewrites.has(`${currentGuide().id}
${g.kind}
${g.text}`);
}

/**
 * New text for one ticked finding. Uses the review's rewrite when it passes the
 * plain rules; otherwise asks the laptop model, and asks once more if that answer
 * fails them too. Returns { text, source: "review" | "laptop" | "reused", problem? }.
 * problem is set when no candidate passed; text is then the last candidate (maybe "").
 */
export async function newTextFor(g, screen, others, { app = APP, mode = textMode() } = {}) {
  const screenWords = wordsOf(g, screen, others);
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
        { app: app || APP, screen, others, key: g.key, kind: g.kind, context: g.context, text: g.text, problem: `${PROBLEM_NAMES[f.problem] ?? f.problem}. ${f.note ?? ""}`.trim(), avoid },
        guide.markdown,
      ),
      REWRITE_SCHEMA,
      { mode, purpose: "new text for one piece of the app's text" },
    );
    const text = unquote(r.data?.text);
    const problem = problemOf(text);
    if (!problem) {
      const result = { text, where: r.where, ms: r.ms };
      if (r.where === "laptop") rewrites.set(key, result);
      return { ...result, source: r.where === "cloud" ? "cloud" : "laptop" };
    }
    last = { text, problem };
    avoid = { text, reason: problem };
  }
  return { text: last.text, source: "laptop", problem: last.problem };
}
