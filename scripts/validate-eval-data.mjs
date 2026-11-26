// Checks the Phase 0 test data and exports the Indonesian pairs as a spreadsheet.
//   npm run eval:data
// Exits 1 if any check fails. Writes data/eval/id-pairs.csv (UTF-8 with BOM,
// so Excel and Google Sheets show Indonesian characters correctly).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "data", "eval");
const load = (name) => JSON.parse(readFileSync(join(dir, name), "utf8"));
const errors = [];
const fail = (msg) => errors.push(msg);

function check(rows, spec) {
  const { name, total, okCount, types, required, textField } = spec;
  if (rows.length !== total) fail(`${name}: ${rows.length} rows, expected ${total}`);
  const ids = new Set();
  const texts = new Set();
  for (const r of rows) {
    if (ids.has(r.id)) fail(`${name}: duplicate id ${r.id}`);
    ids.add(r.id);
    for (const f of required) if (r[f] === undefined || r[f] === "") fail(`${name} ${r.id}: missing ${f}`);
    if (r.expect === "problem") {
      if (!types[r.type]) fail(`${name} ${r.id}: unknown type ${r.type}`);
      if (!["high", "medium", "low"].includes(r.severity)) fail(`${name} ${r.id}: bad severity ${r.severity}`);
      const fix = r.rewrite ?? r.better;
      if (!fix) fail(`${name} ${r.id}: problem row has no fix`);
      if (fix === r[textField]) fail(`${name} ${r.id}: fix is identical to the text`);
    } else if (r.expect === "ok") {
      if (r.type !== null || r.severity !== null) fail(`${name} ${r.id}: ok row must have null type and severity`);
    } else fail(`${name} ${r.id}: expect must be ok or problem`);
    const key = `${r.app}|${r.kind}|${r[textField]}`;
    if (texts.has(key)) fail(`${name} ${r.id}: duplicate text in the same app and kind`);
    texts.add(key);
  }
  const counts = {};
  for (const r of rows) counts[r.expect === "ok" ? "ok" : r.type] = (counts[r.expect === "ok" ? "ok" : r.type] ?? 0) + 1;
  if ((counts.ok ?? 0) !== okCount) fail(`${name}: ${counts.ok ?? 0} ok rows, expected ${okCount}`);
  for (const [t, n] of Object.entries(types)) if ((counts[t] ?? 0) !== n) fail(`${name}: ${counts[t] ?? 0} ${t} rows, expected ${n}`);
  return counts;
}

const en = load("en-strings.json");
const enCounts = check(en, {
  name: "en-strings",
  total: 150,
  okCount: 60,
  textField: "text",
  required: ["id", "app", "screen", "kind", "text", "expect"],
  types: { sounds_generated: 20, vague_button: 12, blames_user: 10, unclear_message: 12, jargon: 12, leftover_text: 8, vague_link: 6, inconsistent_term: 10 },
});

const id = load("id-pairs.json");
const idCounts = check(id, {
  name: "id-pairs",
  total: 80,
  okCount: 40,
  textField: "id_text",
  required: ["id", "app", "screen", "kind", "en", "id_text", "register", "expect"],
  types: { wrong_sense: 10, word_for_word: 12, wrong_verb_form: 10, mixed_register: 8 },
});
for (const r of id) {
  if (!["Anda", "kamu"].includes(r.register)) fail(`id-pairs ${r.id}: register must be Anda or kamu`);
  if (r.expect === "problem" && !r.note_en) fail(`id-pairs ${r.id}: problem row has no English note`);
}

// The checks themselves must be able to fail: a broken row has to be caught.
const before = errors.length;
check([{ id: "x1", app: "a", screen: "s", kind: "button", text: "Submit", expect: "problem", type: "nope", severity: "high", rewrite: "Submit" }], {
  name: "control", total: 1, okCount: 0, textField: "text", required: ["id"], types: {},
});
const controlCaught = errors.length - before;
errors.splice(before);
if (controlCaught < 2) fail(`validator control: a deliberately broken row raised ${controlCaught} error(s), expected at least 2`);

if (errors.length) {
  for (const e of errors) console.error(`FAIL ${e}`);
  process.exit(1);
}

const cell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const cols = ["id", "app", "screen", "kind", "register", "en", "id_text", "expect", "type", "severity", "better", "note_en", "your_verdict", "your_better", "your_note"];
const csv = [cols.join(","), ...id.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
writeFileSync(join(dir, "id-pairs.csv"), "﻿" + csv + "\r\n", "utf8");

console.log("OK en-strings:", JSON.stringify(enCounts));
console.log("OK id-pairs:", JSON.stringify(idCounts));
console.log(`OK validator control caught ${controlCaught} error(s) in a broken row.`);
console.log("OK wrote data/eval/id-pairs.csv for review (empty your_* columns are for you).");
