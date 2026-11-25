// Gate for src/review/rules.js. A rule finding skips the model, so a wrong rule
// is a finding nobody double-checks. Fails when a rule:
//   - flags a Phase 0 test string that is fine (a false alarm), or
//   - flags a problem string with the wrong problem kind, or
//   - misses or wrongly fires on the built-in control cases.
// Note: the rules were written with this data in view, so its hit rate is optimistic.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTerms, ruleCheck, usedInBrief } from "../src/review/rules.js";

const rows = JSON.parse(readFileSync(resolve(import.meta.dirname, "../data/eval/en-strings.json"), "utf8"));

const CONTROL = [
  ["Lorem ipsum", "placeholder", "leftover_text"],
  ["[Insert company name]", "placeholder", "leftover_text"],
  ["TODO: real copy", "subtitle", "leftover_text"],
  ["Submit", "button", "vague_button"],
  ["Do it", "button", "vague_button"],
  ["Click here", "link", "vague_link"],
  ["More", "link", "vague_link"],
  ["Save draft", "button", null],
  ["Go", "label", null],
  ["Placeholder text for search", "helper", null],
  ["Name the invoice", "placeholder", null],
];

let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`FAIL ${msg}`);
};

for (const [text, kind, want] of CONTROL) {
  const got = ruleCheck(text, kind)?.problem ?? null;
  if (got !== want) fail(`control "${text}" (${kind}): expected ${want}, got ${got}`);
}

// Preferred terms, in the table format src/guide.js writes.
const TABLE = "## Preferred terms\n\n| Use | Not |\n| --- | --- |\n| client | customer, buyer |\n| sign in | log in |\n\nAfter the table.";
const terms = parseTerms(TABLE);
if (JSON.stringify(terms) !== JSON.stringify([{ use: "client", not: ["customer", "buyer"] }, { use: "sign in", not: ["log in"] }])) fail(`parseTerms read ${JSON.stringify(terms)}`);
const starterGuide = readFileSync(resolve(import.meta.dirname, "../data/eval/wording-guide.md"), "utf8");
if (parseTerms(starterGuide).length) fail("parseTerms found terms in the starter guide, which has none");
const TERM_CONTROL = [
  ["Customer email", "label", "Client email"],
  ["Email all customers", "button", "Email all clients"],
  ["Log in to pay", "button", "Sign in to pay"],
  ["Client", "label", null],
  // Contains "log in" across a word ("catalo-g in-dex"): only word boundaries keep it clean.
  ["Catalog index", "helper", null],
  ["Abuyers club", "label", null],
];
for (const [text, kind, want] of TERM_CONTROL) {
  const f = ruleCheck(text, kind, terms);
  const got = f ? (f.problem === "inconsistent_term" ? f.rewrite : `${f.problem}`) : null;
  if (got !== want) fail(`term control "${text}": expected ${want}, got ${got}`);
}

// The owner's own words never become "not" words (src/guide.js drops them).
const BRIEF = "Invoicing for small shops; owners bill their clients between other jobs. We always say client, never customer.\nCalm, plain and a little warm. Never salesy.";
const BRIEF_CONTROL = [
  ["invoice", true], // "Invoicing"
  ["bill", true],
  ["shops", true],
  ["customer", false], // ruled out by "never customer"
  ["buyer", false],
  ["charge", false],
];
for (const [word, want] of BRIEF_CONTROL) {
  if (usedInBrief(word, BRIEF) !== want) fail(`usedInBrief("${word}") should be ${want}`);
}

let hits = 0;
let rightKind = 0;
const byType = {};
for (const r of rows) {
  const f = ruleCheck(r.text, r.kind);
  if (!f) continue;
  hits++;
  if (r.expect === "ok") fail(`false alarm on ${r.id} "${r.text}" (${r.kind}): ${f.problem}`);
  else if (f.problem !== r.type) fail(`wrong kind on ${r.id} "${r.text}": expected ${r.type}, got ${f.problem}`);
  else {
    rightKind++;
    byType[r.type] = (byType[r.type] ?? 0) + 1;
  }
}

const problems = rows.filter((r) => r.expect === "problem").length;
console.log(`rules: ${hits} of ${rows.length} test strings caught without a model call (${rightKind} of ${problems} problems, right kind). By kind: ${JSON.stringify(byType)}`);
if (failed) {
  console.log(`FAIL check-rules: ${failed} failure(s).`);
  process.exit(1);
}
console.log(`OK check-rules: ${CONTROL.length} controls, ${TERM_CONTROL.length} term controls and ${BRIEF_CONTROL.length} brief controls pass, 0 false alarms, 0 wrong kinds.`);
