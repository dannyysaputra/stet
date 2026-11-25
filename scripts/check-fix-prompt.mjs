// Gate for src/review/fix-prompt.js. Slice 2.2 is done when every line of the fix
// prompt names the place, the old text and the new text. Fails when a line for a
// finding is missing one of them, when lines are lost or reordered, or when a
// finding without new text is not counted as missing.
import { MISSING, buildFixPrompt } from "../src/review/fix-prompt.js";

const FILE = "src/sample/strings.js";
const items = [
  { key: "new.submit", kind: "button", screen: "new", count: 1, old: "Submit", next: "Send invoice", problem: "Vague button" },
  { key: "list.row.more", kind: "link", screen: "list", count: 4, old: "More", next: "Open invoice", problem: "Vague link" },
  { key: "new.email.label", kind: "label", screen: "new", count: 1, old: 'Say "hi"', next: "  ", problem: "Inconsistent term" },
];

let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`FAIL ${msg}`);
};

const { text, missing } = buildFixPrompt({ app: "Lumbung", file: FILE, items });
const lines = text.split("\n").filter((l) => l.startsWith("- "));
if (lines.length !== items.length) fail(`expected ${items.length} finding lines, got ${lines.length}`);

const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
items.forEach((it, i) => {
  const line = lines[i] ?? "";
  if (!line.includes(FILE)) fail(`line ${i + 1} does not name the file: ${line}`);
  if (!line.includes(q(it.key))) fail(`line ${i + 1} does not name the key ${it.key}: ${line}`);
  if (!line.includes(`${q(it.old)} -> `)) fail(`line ${i + 1} does not give the old text ${it.old}: ${line}`);
  const want = it.next.trim() ? `-> ${q(it.next.trim())}` : `-> ${MISSING}`;
  if (!line.includes(want)) fail(`line ${i + 1} does not give the new text (${want}): ${line}`);
});
if (!lines[1]?.includes("shown 4 times")) fail("a string shown several times does not say so");
if (missing !== 1) fail(`expected 1 line without new text, counted ${missing}`);

if (failed) {
  console.log(text);
  console.log(`FAIL check-fix-prompt: ${failed} failure(s).`);
  process.exit(1);
}
console.log(`OK check-fix-prompt: ${items.length} lines each name file, key, old text and new text; 1 missing counted.`);
