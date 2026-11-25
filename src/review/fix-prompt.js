// Turns the ticked findings into one prompt for a coding agent.
// Pure: no imports, so scripts/check-fix-prompt.mjs can test it in Node.
// Every line names the place (file and key), the old text and the new text.

export const MISSING = "(write the new text here)";

const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;

/**
 * One line for one finding.
 * item: { key, kind, screen, count, old, next, problem }
 */
export function fixLine(item, file) {
  const where = `${file}, key ${q(item.key)} (${item.kind}, screen ${q(item.screen)}${item.count > 1 ? `, shown ${item.count} times` : ""})`;
  const next = item.next?.trim() ? q(item.next.trim()) : MISSING;
  return `- ${where}: ${q(item.old)} -> ${next} (${item.problem})`;
}

/**
 * The whole prompt.
 * spec: { app, file, items: [...] }. Returns { text, missing: number of lines without new text }.
 */
export function buildFixPrompt({ app, file, items }) {
  const lines = items.map((it) => fixLine(it, file));
  const text = [
    `Change the interface text of ${app}. Change only the strings listed below and nothing else.`,
    `Each string is the English value ("en") of the key shown, in ${file}.`,
    "",
    ...lines,
    "",
    "Keep each key as it is. After the change, each key above shows its new text.",
  ].join("\n");
  return { text, missing: lines.filter((l) => l.includes(MISSING)).length };
}
