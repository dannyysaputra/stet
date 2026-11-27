// Gate for Stet's own words (slice 4.5). Stet tells people their app's text is
// generic; its own pages must pass the same rules. The laptop model cannot be
// the judge here (on a marketing page it flags most plain copy, measured
// 2026-11-26 and 27), so this gate uses what can be checked exactly:
//   - Stet's own plain rules (src/review/rules.js): leftover text, vague
//     buttons and links, and one name per thing, from the table below;
//   - a list of filler words, taken from the starter wording guide plus the
//     ones marketing pages reach for;
//   - no exclamation marks.
// Text shown as a bad example (inside <s>, or in a drawing marked
// aria-hidden) is left out: it is there to be crossed out.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ruleCheck } from "../src/review/rules.js";

const PAGES = ["index.html", "files/index.html"];

// One name per thing, on every page. "use" is our word; "not" are the others.
export const TERMS = [
  { use: "coding agent", not: ["AI agent", "AI coding agent", "AI assistant"] },
  { use: "piece of text", not: ["string", "texts"] },
  { use: "example app", not: ["sample app", "demo app"] },
  { use: "wording guide", not: ["house rule", "style guide"] },
  { use: "fix message", not: ["fix prompt"] },
];

export const FILLER = [
  "unlock", "seamless", "elevate", "supercharge", "empower", "journey", "next level", "one-stop", "effortless", "harness the power",
  "powerful", "revolutionize", "revolutionary", "cutting-edge", "game-chang", "robust", "leverage", "world-class", "best-in-class",
  "simply", "in one click", "with ease", "magic", "blazing", "delightful", "transform your",
];

const decode = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#10;/g, " ");

/** The pieces of text a visitor reads on a page: [{ kind, text }]. */
export function visibleText(html) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<s>[\s\S]*?<\/s>/gi, " ") // a crossed-out bad example
    .replace(/<div[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/div>/gi, " "); // a drawing
  const pieces = [];
  const take = (kind, re) => {
    for (const m of body.matchAll(re)) {
      const text = decode(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
      if (text) pieces.push({ kind, text });
    }
  };
  take("link", /<a\b[^>]*>([\s\S]*?)<\/a>/gi);
  take("button", /<button\b[^>]*>([\s\S]*?)<\/button>/gi);
  // Everything else, cut where a block ends so each piece is one sentence or label.
  const flat = body.replace(/<\/(p|li|h[1-6]|div|summary|label|figcaption|section|option|span|b)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  for (const line of flat.split("\n")) {
    const text = decode(line).replace(/\s+/g, " ").trim();
    if (text) pieces.push({ kind: "text", text });
  }
  return pieces;
}

/** What is wrong with one page's text: a list of plain sentences. */
export function copyProblems(html) {
  const out = [];
  for (const { kind, text } of visibleText(html)) {
    const f = ruleCheck(text, kind, TERMS);
    if (f) out.push(`${f.problem}: "${text.slice(0, 80)}"${f.note ? ` (${f.note})` : ""}`);
    const low = text.toLowerCase();
    for (const w of FILLER) if (low.includes(w)) out.push(`filler "${w}": "${text.slice(0, 80)}"`);
    if (text.includes("!")) out.push(`exclamation mark: "${text.slice(0, 80)}"`);
  }
  return [...new Set(out)];
}

// Run as a gate (not when a test imports the functions above).
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, "check-copy.mjs")) {
  let failed = 0;
  let total = 0;
  for (const page of PAGES) {
    const html = readFileSync(resolve(import.meta.dirname, "..", page), "utf8");
    total += visibleText(html).length;
    for (const p of copyProblems(html)) {
      failed++;
      console.log(`FAIL ${page}: ${p}`);
    }
  }
  // Controls: the gate must see text at all, and must catch each kind of problem.
  if (total < 60) {
    failed++;
    console.log(`FAIL only ${total} pieces of text were read from ${PAGES.length} pages: the reader is broken`);
  }
  const CONTROLS = [
    ['<p>Unlock seamless invoicing today.</p>', "filler"],
    ['<p>Paste it into your AI agent.</p>', "inconsistent_term"],
    ['<a href="/x">Learn more</a>', "vague_link"],
    ['<button type="button">Submit</button>', "vague_button"],
    ['<p>Lorem ipsum</p>', "leftover_text"],
    ['<p>It works!</p>', "exclamation"],
  ];
  for (const [html, want] of CONTROLS) {
    if (!copyProblems(html).some((p) => p.startsWith(want))) {
      failed++;
      console.log(`FAIL control: ${html} should give a ${want} problem`);
    }
  }
  if (copyProblems('<p>We cross out <s>Unlock seamless synergy!</s> and write a plain line.</p>').length) {
    failed++;
    console.log("FAIL control: a crossed-out bad example should not count");
  }
  if (failed) {
    console.log(`FAIL check-copy: ${failed} failure(s).`);
    process.exit(1);
  }
  console.log(`OK check-copy: ${total} pieces of text on ${PAGES.length} of Stet's own pages pass Stet's rules (no leftover text, vague buttons or links, second names, filler or exclamation marks); 7 controls behave.`);
}
