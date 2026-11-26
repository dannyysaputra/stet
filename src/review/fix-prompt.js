// Turns the ticked findings into one prompt for a coding agent.
// Pure: no imports, so scripts/check-fix-prompt.mjs can test it in Node.
// Every line names the place (file and key), the old text and the new text.

export const MISSING = "(write the new text here)";

const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;

/**
 * One line for one finding.
 * item: { key, kind, screen?, count, old, next, problem, file?, lang? }
 * item.file overrides the prompt's file (language files name their own).
 */
export function fixLine(item, file) {
  const where = `${item.file || file}, key ${q(item.key)} (${item.kind}${item.screen ? `, screen ${q(item.screen)}` : ""}${item.count > 1 ? `, shown ${item.count} times` : ""})`;
  const next = item.next?.trim() ? q(item.next.trim()) : MISSING;
  return `- ${where}: ${q(item.old)} -> ${next} (${item.problem})`;
}

const unq = (s) => s.replace(/\\"/g, '"');
const LINE = /^- (.+?), key "((?:[^"\\]|\\.)*)" \([^)]*\): "((?:[^"\\]|\\.)*)" -> (?:"((?:[^"\\]|\\.)*)"|\(write the new text here\))/;

/**
 * Reads a fix prompt back into changes, the way an agent would follow it.
 * Returns { changes: [{ file, key, old, next }], skipped: [{ line, reason }] }.
 * A line without new text is skipped, and so is any other line that is not a change.
 */
export function parseFixPrompt(text) {
  const changes = [];
  const skipped = [];
  for (const line of String(text).split("\n")) {
    if (!line.startsWith("- ")) continue;
    const m = line.match(LINE);
    if (!m) skipped.push({ line, reason: "not a change line" });
    else if (m[4] === undefined) skipped.push({ line, reason: "no new text" });
    else changes.push({ file: m[1], key: unq(m[2]), old: unq(m[3]), next: unq(m[4]) });
  }
  return { changes, skipped };
}

/**
 * The whole prompt.
 * spec: { app, file, items: [...] }. Returns { text, missing: number of lines without new text }.
 */
export function buildFixPrompt({ app, file, items, lang = "en" }) {
  const lines = items.map((it) => fixLine(it, file));
  const oneFile = items.every((it) => !it.file || it.file === file);
  const text = [
    `Change the interface text of ${app}. Change only the strings listed below and nothing else.`,
    oneFile
      ? `Each string is the ${lang === "id" ? "Indonesian" : "English"} value ("${lang}") of the key shown, in ${file}.`
      : "Each line names the file and the key; change that key's value in that file.",
    "",
    ...lines,
    "",
    "Keep each key as it is. After the change, each key above shows its new text.",
  ].join("\n");
  return { text, missing: lines.filter((l) => l.includes(MISSING)).length };
}
