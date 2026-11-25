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

/** Returns a finding for text the rules catch, or null if the model has to judge it. */
export function ruleCheck(text, kind) {
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
  return null;
}
