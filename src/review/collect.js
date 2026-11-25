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

// Returns one entry per element, in screen order: { key, kind, text, el }.
export function collectStrings(doc) {
  return [...doc.querySelectorAll("[data-s]")].map((el) => {
    const attr = el.dataset.attr;
    const raw = attr ? el.getAttribute(attr) : el.textContent;
    return {
      key: el.dataset.s,
      kind: el.dataset.kind || "unknown",
      text: (raw ?? "").replace(/\s+/g, " ").trim(),
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
    else groups.set(item.key, { key: item.key, kind: item.kind, text: item.text, els: [item.el] });
  }
  return [...groups.values()];
}
