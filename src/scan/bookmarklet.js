// "Scan with Stet" (slice 3.6). This function runs on the user's own page as a
// bookmarklet: it reads the visible interface text and hands it to Stet's
// /files/ page in a new tab by postMessage, addressed only to Stet's origin.
//
// It must stay self-contained (no imports, no outside names): its source text
// becomes the bookmark's link. See bookmarkletHref below.

export function scanWithStet(stet) {
  const MAX = 300;
  const LEN = 300;
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const items = [];
  const seen = new Map();
  const done = new Set();
  let truncated = false;
  // A path segment or element id that looks like a record id or a token
  // ("/invoice/8123", "/reset/9f3a...") is replaced, so it never reaches Stet.
  const idLike = (s) => /\d{3,}/.test(s) || /^[0-9a-f-]{12,}$/i.test(s) || /^[A-Za-z0-9_-]{24,}$/.test(s);
  const scrub = (path) => path.split("/").map((seg) => (idLike(seg) ? ":id" : seg)).join("/");

  const hidden = (el) => {
    if (!el.getClientRects().length) return true;
    const cs = getComputedStyle(el);
    return cs.visibility === "hidden" || cs.display === "none" || !!el.closest('[aria-hidden="true"],[hidden]');
  };
  const cls = (el) => String(el.getAttribute("class") || "");
  const fieldName = (el) => clean((el.labels && el.labels[0] && el.labels[0].innerText) || el.getAttribute("aria-label") || el.getAttribute("name"));
  const where = (el) => {
    const id = el.getAttribute("id") || "";
    return el.tagName.toLowerCase() + (id && !idLike(id) ? "#" + id : "");
  };
  const add = (kind, text, context, el) => {
    text = clean(text);
    // Numbers, dates, amounts and codes are data, not interface text; so is an
    // email address shown as text (a placeholder showing a format is kept).
    if (!text || text.length > LEN || /^[\d\s.,:;/%+\-()$#*]+$/.test(text) || /^[A-Z]{1,3}[\s$]?[\d.,]+$/.test(text)) return;
    if (kind !== "placeholder" && /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text)) return;
    const k = kind + "\n" + text;
    const had = seen.get(k);
    if (had) {
      had.count++;
      return;
    }
    if (items.length >= MAX) {
      truncated = true;
      return;
    }
    const it = { kind, text, context: clean(context).slice(0, 200), where: where(el).slice(0, 80), count: 1 };
    seen.set(k, it);
    items.push(it);
  };
  // Where a link goes, without its query (it can hold ids or tokens). Hash routes
  // ("#/invoices") are kept: in a single-page app they are the destination.
  const linkPath = (a) => {
    try {
      const u = new URL(a.href, location.href);
      if (!/^https?:$/.test(u.protocol)) return "";
      const path = scrub(u.pathname + (u.hash.startsWith("#/") ? u.hash.split("?")[0] : ""));
      return u.origin === location.origin ? path : u.host + path;
    } catch {
      return "";
    }
  };

  const UNIT = "button,a[href],label,legend,h1,h2,h3,h4,h5,h6,th,summary,option,[role=button],[role=link],[role=tab],[role=menuitem],[role=alert],[role=status],[role=columnheader],p,li,dt,dd,figcaption,caption,blockquote";
  const kindOf = (el) => {
    const t = el.tagName;
    const r = el.getAttribute("role");
    if (t === "BUTTON" || r === "button" || r === "menuitem") return "button";
    if (t === "A" || r === "link" || r === "tab") return el.closest("nav,header,[role=navigation],[role=tablist],[role=menubar]") ? "nav" : "link";
    if (/^H[1-6]$/.test(t)) return "heading";
    if (t === "LABEL" || t === "LEGEND") return "label";
    if (t === "TH" || r === "columnheader") return "column";
    if (el.closest("[role=alert]") || /(^|[\s_-])(error|invalid)/i.test(cls(el))) return "error";
    if (el.closest("[role=status]")) return "status";
    return "text";
  };
  const contextOf = (el, kind) => {
    const a = el.closest("a[href]");
    if (a) return linkPath(a) ? "Link to " + linkPath(a) : "";
    if (kind === "error" || kind === "text") {
      const field = el.id && document.querySelector('[aria-describedby~="' + CSS.escape(el.id) + '"]');
      if (field) return 'Shown under the "' + fieldName(field) + '" field.';
    }
    return "";
  };

  // Text on the page, one unit per element: a button, a link, a heading, a paragraph...
  const SKIP = "script,style,noscript,template,code,pre,textarea,select,svg,[contenteditable=''],[contenteditable=true],[aria-hidden=true],[hidden]";
  // The words a reader sees in a unit: icon-font ligatures ("close") sit in
  // aria-hidden spans and are left out.
  const textOf = (unit) => {
    const parts = [];
    const w = document.createTreeWalker(unit, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      const p = t.parentElement;
      if (p && !p.closest(SKIP) && getComputedStyle(p).display !== "none") parts.push(t.nodeValue);
    }
    return parts.join(" ");
  };
  if (!document.body) {
    alert("Stet found no page body to read here.");
    return;
  }
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n && !truncated; n = walk.nextNode()) {
    const parent = n.parentElement;
    if (!parent || !clean(n.nodeValue) || parent.closest(SKIP)) continue;
    const unit = parent.closest(UNIT) || parent;
    if (done.has(unit)) continue;
    done.add(unit);
    if (hidden(unit)) continue;
    const kind = kindOf(unit);
    // Table cells hold the app's data (names, amounts), except a cell that spans
    // the whole row, which is usually an empty state.
    const cell = unit.closest("td");
    if (cell && kind === "text" && !(cell.colSpan > 1)) continue;
    const own = unit.matches(UNIT) ? textOf(unit) : [...unit.childNodes].filter((c) => c.nodeType === 3).map((c) => c.nodeValue).join(" ");
    add(kind, own, contextOf(unit, kind), unit);
  }
  // Text that is not a text node: hints in empty fields, button values, icon-button names.
  for (const f of document.querySelectorAll("input[placeholder],textarea[placeholder]")) {
    if (!hidden(f)) add("placeholder", f.getAttribute("placeholder"), fieldName(f) ? 'Hint inside the empty "' + fieldName(f) + '" field.' : "", f);
  }
  for (const b of document.querySelectorAll("input[type=submit],input[type=button]")) {
    if (!hidden(b)) add("button", b.value, "", b);
  }
  for (const b of document.querySelectorAll("button[aria-label],a[aria-label],[role=button][aria-label]")) {
    if (!hidden(b) && !clean(textOf(b))) add(kindOf(b), b.getAttribute("aria-label"), "Name of an icon-only control, read out by screen readers.", b);
  }

  const payload = {
    type: "stet-scan",
    v: 1,
    page: (location.host + scrub(location.pathname + (location.hash.startsWith("#/") ? location.hash.split("?")[0] : ""))).slice(0, 200),
    title: clean(document.title).slice(0, 120),
    lang: String(document.documentElement.lang || "").slice(0, 10),
    items,
    truncated,
  };
  const tab = window.open(stet + "/files/#scan", "_blank");
  if (!tab) {
    alert("Stet could not open its tab. Allow pop-ups for this page and click the bookmark again.");
    return;
  }
  const onReady = (e) => {
    if (e.source === tab && e.origin === stet && e.data && e.data.type === "stet-ready") {
      tab.postMessage(payload, stet);
      removeEventListener("message", onReady);
    }
  };
  addEventListener("message", onReady);
  setTimeout(() => removeEventListener("message", onReady), 60000);
}

/** The bookmark's link: the function above, called with Stet's own origin. */
export const bookmarkletHref = (origin) => "javascript:" + encodeURIComponent(`(${scanWithStet.toString()})(${JSON.stringify(origin)});void 0`);
