// Reads your own text for review (slice 3.3): two language files (English and
// Indonesian JSON, flat or nested) or a pasted list. Pure: no imports, so
// scripts/check-files.mjs can test it in Node.

/** Flattens nested JSON into { "a.b.c": "text" }. Non-string leaves are skipped. */
export function flatten(obj, prefix = "", out = {}) {
  if (obj === null || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") flatten(v, key, out);
  }
  return out;
}

// The kind of element, guessed from the words in the key ("checkout.pay_button").
// Segments are read from the end of the key; the first one that matches wins.
const KIND_WORDS = [
  ["placeholder", /placeholder|hint/],
  ["button", /button|btn|cta|action|submit/],
  ["link", /link|href/],
  ["error", /error|err|invalid/],
  ["empty", /empty|no_?data|none_?yet/],
  ["toast", /toast|snackbar|notice|success/],
  ["helper", /help|helper|tip|caption/],
  ["subtitle", /subtitle|description|desc|intro|tagline/],
  ["heading", /title|heading|header|headline/],
  ["label", /label|lbl|field/],
  ["column", /^(column|col|th)s?$/],
  ["status", /status|badge|state/],
  ["nav", /^(nav|menu|tabs?)$/],
];

export function kindFromKey(key) {
  const parts = String(key).toLowerCase().split(/[.\-/]/).reverse();
  for (const part of parts) {
    for (const [kind, re] of KIND_WORDS) if (re.test(part)) return kind;
  }
  return "text";
}

/**
 * Pairs an English file with an Indonesian one (either may be missing).
 * Returns { items: [{ key, kind, en, id }], onlyEn: [keys], onlyId: [keys] }.
 */
export function pairFiles(enJson, idJson) {
  const en = flatten(enJson ?? {});
  const id = flatten(idJson ?? {});
  const keys = [...new Set([...Object.keys(en), ...Object.keys(id)])];
  const items = keys.map((key) => ({ key, kind: kindFromKey(key), en: en[key] ?? "", id: id[key] ?? "" }));
  return {
    items,
    onlyEn: idJson ? keys.filter((k) => en[k] !== undefined && id[k] === undefined) : [],
    onlyId: keys.filter((k) => id[k] !== undefined && en[k] === undefined),
  };
}

// What the "Scan with Stet" bookmarklet may send (slice 3.6). Any page can open
// Stet and post a message, so the message is checked, never trusted.
export const SCAN_KINDS = ["button", "link", "nav", "heading", "label", "placeholder", "column", "error", "status", "text"];
export const SCAN_MAX = 300;
// One line of plain text: the real scanner already collapses white space, so a
// newline or control character can only come from a crafted message, where it
// could forge extra lines in the fix prompt the user pastes into their agent.
const str = (v, max) => (typeof v === "string" && v.length <= max ? v.replace(/[\u0000-\u001f\u007f-\u009f\s]+/g, " ").trim() : null);

/**
 * Checks a message from the bookmarklet. Returns { page, title, lang, items:
 * [{ key, kind, en, id, context, count, at }], dropped, truncated } or null when it
 * is not a scan at all. Items beyond SCAN_MAX or with a bad field are dropped and
 * counted; a list far longer than that is not read at all. "at" is the item's
 * position in the message (not in the result), so marks sent back to the page
 * point at the elements the bookmarklet remembered for that position.
 */
export function acceptScan(data) {
  if (!data || typeof data !== "object" || data.type !== "stet-scan" || data.v !== 1 || !Array.isArray(data.items)) return null;
  if (data.items.length > SCAN_MAX * 2) return null;
  const page = str(data.page, 200);
  if (!page) return null;
  const items = [];
  let dropped = 0;
  for (const [at, it] of data.items.entries()) {
    const text = str(it?.text, 300);
    const ok = text && SCAN_KINDS.includes(it.kind) && str(it.context ?? "", 200) !== null && str(it.where ?? "", 80) !== null && items.length < SCAN_MAX;
    if (!ok) {
      dropped++;
      continue;
    }
    const count = Number.isInteger(it.count) && it.count > 0 ? Math.min(it.count, 999) : 1;
    items.push({ key: str(it.where ?? "", 80) || it.kind, kind: it.kind, en: text, id: "", context: str(it.context ?? "", 200), count, at });
  }
  return { page, title: str(data.title ?? "", 120) ?? "", lang: str(data.lang ?? "", 10) ?? "", items, dropped, truncated: data.truncated === true };
}

/**
 * The marks Stet sends back to the app tab after reviewing a scanned screen.
 * `found` is the findings in Stet's list order: [{ at, kind, text, label, rewrite }].
 * Only what a mark needs leaves Stet: number, position, kind, problem name, old and new text.
 */
export function marksFor(found) {
  return found
    .map((g, i) => ({ at: g.at, n: i + 1, kind: String(g.kind ?? ""), label: String(g.label ?? "Problem").slice(0, 80), from: String(g.text ?? "").slice(0, 300), to: String(g.rewrite ?? "").slice(0, 300) }))
    .filter((m) => Number.isInteger(m.at));
}

/**
 * The words shown when a review ends. A piece of text whose check failed was not
 * checked, so a review with failures never reads as clean.
 * Returns { progress, heading, none } (none: the line shown when the list is empty).
 */
export function reviewSummary({ total, found, failed, firstError = "", where = "in this text" }) {
  const pieces = (n) => `${n} piece${n === 1 ? "" : "s"} of text`;
  const progress = failed ? `Checked ${total - failed} of ${total}. ${pieces(failed)} could not be checked${firstError ? `: ${firstError}` : ""}.` : `Checked ${total} of ${total}`;
  const things = `${found} thing${found === 1 ? "" : "s"} to fix ${where}`;
  const heading = failed ? `3. ${found ? `${things}, ` : ""}${pieces(failed)} not checked` : found ? `3. ${things}` : `3. Nothing to fix ${where}`;
  const none = failed ? `${pieces(failed)} could not be checked.` : "Nothing to fix.";
  return { progress, heading, none };
}

/** A pasted list, one English string per line. Keys are line numbers. */
export function parsePasted(text) {
  return String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((en, i) => ({ key: `line ${i + 1}`, kind: "text", en, id: "" }));
}
