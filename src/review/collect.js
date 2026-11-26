// Reads every piece of interface text on the screen the reviewed app is showing.
// The app marks each element with data-s="<key>" and data-kind="<kind>". When the
// text lives in an attribute (a placeholder), data-attr names that attribute.

// Plain names for each element kind, shown in the panel.
export const KIND_NAMES = {
  nav: "navigation",
  heading: "heading",
  subtitle: "subtitle",
  label: "label",
  placeholder: "placeholder",
  button: "button",
  link: "link",
  error: "error message",
  empty: "empty state",
  helper: "helper text",
  column: "column title",
  status: "status",
  toast: "notification",
};

const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();

// The name of a form field, from its <label for> or its aria-label.
function fieldName(doc, input) {
  if (!input) return "";
  const label = input.id ? doc.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
  return clean(label?.textContent || input.getAttribute("aria-label"));
}

// Where a piece of text sits, for text that means little on its own.
function contextFor(doc, el) {
  if (el.dataset.attr === "placeholder") {
    const name = fieldName(doc, el);
    return name ? `Hint inside the empty "${name}" field.` : "";
  }
  if (el.id) {
    const name = fieldName(doc, doc.querySelector(`[aria-describedby~="${CSS.escape(el.id)}"]`));
    if (name) return `Shown under the "${name}" field.`;
  }
  // A link's destination: without it, a better link text can only be guessed.
  const href = el.closest("a[href]")?.getAttribute("href");
  if (href) return `Link to ${href}`;
  // Messages that belong to the label just above them ("No data" under "Line items").
  if (["empty", "helper", "error", "status"].includes(el.dataset.kind)) {
    let prev = el.previousElementSibling;
    for (let hops = 0; prev && hops < 3; hops++, prev = prev.previousElementSibling) {
      const label = prev.matches('[data-kind="label"], [data-kind="heading"]') ? prev : prev.querySelector('[data-kind="label"], [data-kind="heading"]');
      if (label) return `Shown under the "${clean(label.textContent)}" ${label.dataset.kind}.`;
    }
  }
  return "";
}

/** The language of the text on the screen: "id" for Indonesian, otherwise "en". */
export function screenLang(doc) {
  const lang = (doc.getElementById("screen")?.lang || doc.documentElement.lang || "en").toLowerCase();
  return lang.startsWith("id") ? "id" : "en";
}

// Returns one entry per element, in screen order: { key, kind, text, context, lang, original, el }.
// original: the English text an Indonesian string translates (data-en), or "".
export function collectStrings(doc) {
  const lang = screenLang(doc);
  return [...doc.querySelectorAll("[data-s]")].map((el) => {
    const attr = el.dataset.attr;
    return {
      key: el.dataset.s,
      kind: el.dataset.kind || "unknown",
      text: clean(attr ? el.getAttribute(attr) : el.textContent),
      context: contextFor(doc, el),
      lang,
      original: lang === "id" ? clean(el.dataset.en) : "",
      el,
    };
  });
}

// Groups occurrences by key, keeping the order each key first appears in.
// The same text can sit on a screen several times (a "More" link on every row).
export function groupByKey(items) {
  const groups = new Map();
  for (const item of items) {
    const group = groups.get(item.key);
    if (group) group.els.push(item.el);
    else groups.set(item.key, { key: item.key, kind: item.kind, text: item.text, context: item.context, lang: item.lang, original: item.original, els: [item.el] });
  }
  return [...groups.values()];
}
