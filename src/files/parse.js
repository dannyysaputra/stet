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

/** A pasted list, one English string per line. Keys are line numbers. */
export function parsePasted(text) {
  return String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((en, i) => ({ key: `line ${i + 1}`, kind: "text", en, id: "" }));
}
