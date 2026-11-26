// The wording guide the laptop model checks against.
// The starter guide is fixed (data/eval/wording-guide.md). From a two-line voice
// brief, the cloud model writes only the parts that depend on the app: tone rules,
// preferred terms and the signs of generated filler. The problem kinds,
// seriousness and "not a problem" sections stay those of the starter guide, so the
// problem names keep matching the review's reply schema.
import { askJson } from "./ai.js";
import { wordingGuide as STARTER } from "./english-check.js";
import { usedInBrief } from "./review/rules.js";

const KEY = "stet.guide";
// Every line of the guide is sent with every laptop check, and the laptop model
// takes about 9,000 tokens in all. Keep the guide well under that.
export const MAX_GUIDE_CHARS = 6000;
export const MAX_BRIEF_CHARS = 300;

const GUIDE_SCHEMA = {
  type: "object",
  properties: {
    voice: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
    terms: {
      type: "array",
      items: {
        type: "object",
        properties: { use: { type: "string" }, not: { type: "array", items: { type: "string" }, maxItems: 4 } },
        required: ["use", "not"],
      },
      maxItems: 8,
    },
    filler: { type: "array", items: { type: "string" }, maxItems: 12 },
  },
  required: ["voice", "terms", "filler"],
};

const briefPrompt = (brief) => `You write part of a wording guide. A small model will use the guide to review the interface text of one app: its buttons, labels, messages and headings.

The app owner's brief, in their words:
${brief}

Write three things for this app only, in plain English:
- voice: 3 to 5 short rules for how the interface should sound. Each rule under 20 words, concrete enough to check one string against.
- terms: up to 8 words the app should use, each with the words it should not use for the same thing. Only include terms the brief implies or that this kind of app needs.
- filler: up to 12 words or short phrases that would sound generated, salesy or empty in this app.

If the brief rules a word out ("never X", "not X"), put it in the "not" list of the word the brief prefers.
Do not invent features the brief does not mention. Reply with JSON only.`;


// A short, stable id for a guide's text, so verdicts reached under one guide are
// never reused under another.
export function guideId(markdown) {
  let h = 5381;
  for (let i = 0; i < markdown.length; i++) h = ((h * 33) ^ markdown.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const fixedPart = () => STARTER.slice(STARTER.indexOf("## Problem kinds"));
const cell = (s) => String(s).replace(/\|/g, "/").replace(/\s+/g, " ").trim();

/** Builds the full guide from the brief and the cloud model's sections. */
export function composeGuide(brief, s) {
  const lines = ["# Wording guide", "", "Written from this brief:", ...brief.split("\n").map((l) => `> ${l}`), "", "## Voice", ""];
  for (const v of s.voice ?? []) lines.push(`- ${cell(v)}`);
  const terms = (s.terms ?? [])
    .map((t) => ({ use: t.use, not: (t.not ?? []).filter((w) => !usedInBrief(w, brief)) }))
    .filter((t) => t.use && t.not.length);
  if (terms.length) {
    lines.push("", "## Preferred terms", "", "| Use | Not |", "| --- | --- |");
    for (const t of terms) lines.push(`| ${cell(t.use)} | ${cell(t.not.join(", "))} |`);
    lines.push("", "Using a \"Not\" word for something the app calls by its \"Use\" word is inconsistent_term.");
  }
  if (s.filler?.length) {
    lines.push("", "## Signs of generated filler in this app", "", (s.filler ?? []).map((f) => `"${cell(f)}"`).join(", ") + ".");
  }
  lines.push("", fixedPart());
  return lines.join("\n");
}

const starter = () => ({ markdown: STARTER, source: "starter", brief: "", at: null, where: null });

/** The guide in use: the saved one, or the starter guide. Always has an id. */
export function loadGuide() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    saved = null;
  }
  let g = saved?.markdown ? saved : starter();
  // A guide written from a brief carries a copy of the starter guide's fixed part
  // (problem kinds, seriousness, not a problem). When the starter changes, the
  // owner's part (voice, terms, filler) is kept and the fixed part is brought up
  // to date. A guide the owner edited by hand is left exactly as it is.
  if (g.source === "brief") {
    const at = g.markdown.indexOf("## Problem kinds");
    if (at >= 0 && g.markdown.slice(at) !== fixedPart()) {
      g = { ...g, markdown: g.markdown.slice(0, at) + fixedPart() };
      save(g);
    }
  }
  return { ...g, id: guideId(g.markdown) };
}

function save(g) {
  try {
    localStorage.setItem(KEY, JSON.stringify(g));
    return true;
  } catch {
    return false; // storage blocked: the guide still works for this page session
  }
}

let current = loadGuide();
export const currentGuide = () => current;

function use(g) {
  const stored = save(g);
  current = { ...g, id: guideId(g.markdown) };
  return { guide: current, stored };
}

/**
 * Sends the brief (and nothing else) to the cloud model and saves the guide it
 * leads to. Returns { guide, stored, where, ms }.
 */
export async function writeGuideFromBrief(brief) {
  const text = brief.trim();
  if (!text) throw new Error("Write the brief first.");
  if (text.split("\n").length > 2 || text.length > MAX_BRIEF_CHARS) throw new Error(`The brief is two lines at most, up to ${MAX_BRIEF_CHARS} characters.`);
  const r = await askJson(briefPrompt(text), GUIDE_SCHEMA, { mode: "ONLY_IN_CLOUD", purpose: "the voice brief" });
  const markdown = composeGuide(text, r.data);
  if (markdown.length > MAX_GUIDE_CHARS) throw new Error(`The written guide is too long for the laptop model (${markdown.length} characters).`);
  return { ...use({ markdown, source: "brief", brief: text, at: new Date().toISOString(), where: r.where }), where: r.where, ms: r.ms };
}

/** Saves the user's own edits to the guide. */
export function saveEditedGuide(markdown) {
  if (!markdown.trim()) throw new Error("The guide is empty.");
  if (markdown.length > MAX_GUIDE_CHARS) throw new Error(`The guide is too long for the laptop model: ${markdown.length} of ${MAX_GUIDE_CHARS} characters.`);
  return use({ ...current, markdown, source: "edited", at: new Date().toISOString() });
}

/** Goes back to the starter guide. */
export function resetGuide() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing saved to remove
  }
  current = { ...starter(), id: guideId(STARTER) };
  return { guide: current, stored: true };
}
