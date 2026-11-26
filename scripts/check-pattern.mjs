// Gate for src/review/pattern.js (slice 2.4): only counts may leave the laptop.
// Fails when anything but known problem kinds with whole positive counts gets
// into the payload, when the prompt is anything but the fixed template plus that
// payload, or when any interface text of the sample app appears in the prompt.
import { PATTERN_TEMPLATE, patternPrompt } from "../src/review/pattern.js";
import { STRINGS } from "../src/sample/strings.js";

let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`FAIL ${msg}`);
};

const dirty = {
  sounds_generated: 3,
  vague_button: 2,
  jargon: "4",
  leftover_text: 1.5,
  blames_user: -1,
  unclear_message: 0,
  text: "Unlock seamless invoicing and elevate your workflow!",
  "Click here": 1,
};
const { payload, prompt } = patternPrompt(dirty);
if (JSON.stringify(payload) !== JSON.stringify({ sounds_generated: 3, vague_button: 2 })) fail(`payload kept more than clean counts: ${JSON.stringify(payload)}`);
if (prompt !== PATTERN_TEMPLATE.replace("{{COUNTS}}", JSON.stringify(payload, null, 2))) fail("the prompt is not the fixed template plus the payload");

// No interface text from the sample may appear in the prompt.
const texts = Object.values(STRINGS).map((s) => s.en).filter((t) => t.length >= 8);
const leaks = (p) => texts.filter((t) => p.toLowerCase().includes(t.toLowerCase()));
if (leaks(prompt).length) fail(`app text in the prompt: ${leaks(prompt).join(" | ")}`);
// Positive control: the leak scan must see a string that is there.
if (leaks(prompt + "\nUnlock seamless invoicing and elevate your workflow!").length !== 1) fail("the leak scan missed a planted string");

if (failed) {
  console.log(`FAIL check-pattern: ${failed} failure(s).`);
  process.exit(1);
}
console.log(`OK check-pattern: payload keeps only counts (2 of 8 dirty entries), prompt is template plus payload, 0 of ${texts.length} app strings in it, leak scan control caught.`);
