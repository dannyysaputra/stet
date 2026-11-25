// Plain rules that catch the obvious cases without a model call (decision 0.5).
// Each rule follows a row of the starter wording guide. Pure: no imports, so
// scripts/check-rules.mjs can run it against the Phase 0 test data in Node.
// A rule returns a finding in the same shape as the model's reply, or null.

const norm = (s) => s.toLowerCase().replace(/[.!…:]+$/, "").replace(/\s+/g, " ").trim();

// Draft or developer text that was never replaced (guide: leftover_text).
const LEFTOVER = [
  /\blorem ipsum\b/i,
  /\b(TODO|FIXME|TBD|XXX)\b/,
  /\[\s*insert\b[^\]]*\]/i,
  /\{\{[^}]*\}\}/,
  /\bgoes here\b/i,
  /^placeholder( text)?$/i,
  /^(button|label|title|text|heading)( text)?$/i,
  /^(undefined|null|nan)$/i,
  /\bundefined\b/,
];

// Button labels that do not say what happens (guide: vague_button).
const VAGUE_BUTTONS = new Set(["submit", "ok", "okay", "yes", "go", "confirm", "proceed", "continue", "finish", "do it", "click", "click here"]);

// Link text that does not say where it goes (guide: vague_link).
const VAGUE_LINKS = new Set(["click here", "here", "read more", "learn more", "more", "link", "this link", "see more"]);

// ---------- preferred terms (guide: inconsistent_term) ----------
// A guide written from a brief has a "| Use | Not |" table. The laptop model does
// not apply it reliably to one string at a time (measured 2026-11-25: "Customer
// email" passed under a guide saying client, never customer), so it is a rule.

/** Reads the preferred-terms table from a guide's text. Returns [{ use, not: [] }]. */
export function parseTerms(markdown) {
  const terms = [];
  const at = String(markdown ?? "").search(/^\|\s*Use\s*\|\s*Not\s*\|/im);
  if (at < 0) return terms;
  for (const line of markdown.slice(at).split("\n").slice(2)) {
    const m = line.match(/^\|([^|]*)\|([^|]*)\|\s*$/);
    if (!m) break;
    const use = m[1].trim();
    const not = m[2].split(",").map((w) => w.trim()).filter((w) => w && w.toLowerCase() !== use.toLowerCase());
    if (use && not.length) terms.push({ use, not });
  }
  return terms;
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * True if the owner uses this word in their brief, so it must not be a "not" word
 * (measured 2026-11-25: for an invoicing brief the cloud model listed "invoice" as
 * a word not to use). Word forms count: "invoice" matches "Invoicing". Words the
 * brief rules out ("never customer", "not buyer", "instead of user") do not count.
 */
export function usedInBrief(word, brief) {
  const stem = String(word).toLowerCase().trim().replace(/(es|e|s)$/, "");
  if (stem.length < 3) return false;
  const own = String(brief).replace(/\b(never|not|no|avoid|instead of|rather than)\s+(say|use|call\s+them|call)?\s*["']?[\w-]+/gi, " ");
  return new RegExp(`\\b${escRe(stem)}`, "i").test(own);
}
// Keep the case of the replaced word: "Customer" -> "Client", "customers" -> "clients".
function matchCase(word, like) {
  if (like === like.toUpperCase() && like.length > 1) return word.toUpperCase();
  if (like[0] === like[0].toUpperCase()) return word[0].toUpperCase() + word.slice(1);
  return word;
}

function termCheck(t, terms) {
  for (const { use, not } of terms) {
    for (const bad of not) {
      const re = new RegExp(`\\b(${escRe(bad)})(s?)\\b`, "gi");
      if (!re.test(t)) continue;
      const rewrite = t.replace(re, (_, w, s) => matchCase(use, w) + s);
      return { verdict: "problem", problem: "inconsistent_term", severity: "medium", rewrite, note: `The app calls this "${use}", not "${bad}".` };
    }
  }
  return null;
}

/**
 * Returns a finding for text the rules catch, or null if the model has to judge it.
 * terms: from parseTerms() on the guide in use (none for the starter guide).
 */
export function ruleCheck(text, kind, terms = []) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  if (LEFTOVER.some((re) => re.test(t))) {
    return { verdict: "problem", problem: "leftover_text", severity: "high", rewrite: "", note: "Draft text that was never replaced." };
  }
  const n = norm(t);
  if (kind === "button" && VAGUE_BUTTONS.has(n)) {
    return { verdict: "problem", problem: "vague_button", severity: "medium", rewrite: "", note: "The button does not say what it does." };
  }
  if (kind === "link" && VAGUE_LINKS.has(n)) {
    return { verdict: "problem", problem: "vague_link", severity: "medium", rewrite: "", note: "The link does not say where it goes." };
  }
  return termCheck(t, terms);
}
