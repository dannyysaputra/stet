// Gate for src/review/rules.js. A rule finding skips the model, so a wrong rule
// is a finding nobody double-checks. Fails when a rule:
//   - flags a Phase 0 test string that is fine (a false alarm), or
//   - flags a problem string with the wrong problem kind, or
//   - misses or wrongly fires on the built-in control cases.
// Note: the rules were written with this data in view, so its hit rate is optimistic.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ruleCheck } from "../src/review/rules.js";

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
console.log(`OK check-rules: ${CONTROL.length} controls pass, 0 false alarms, 0 wrong kinds.`);
