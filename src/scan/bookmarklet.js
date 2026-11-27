// "Scan with Stet" (slice 3.6). This function runs on the user's own page as a
// bookmarklet: it reads the visible interface text and hands it to Stet's
// /files/ page in a new tab by postMessage, addressed only to Stet's origin.
// After the review, that tab may send its findings back: the function then draws
// numbered pins and wavy underlines on the text they are about, in this tab only.
//
// It must stay self-contained (no imports, no outside names): its source text
// becomes the bookmark's link. See bookmarkletHref below.

export function scanWithStet(stet) {
  const MAX = 300;
  const LEN = 300;
  // Invisible format characters (zero-width spaces that page builders leave in
  // empty paragraphs) are not text.
  const clean = (s) => String(s || "").replace(/\p{Cf}/gu, "").replace(/\s+/g, " ").trim();
  const items = [];
  const els = []; // by item position: the elements its text was read from (never sent)
  const seen = new Map(); // kind + text -> item position
  const done = new Set();
  let truncated = false;
  // A path segment or element id that looks like a record id or a token
  // ("/invoice/8123", "/reset/9f3a...") is replaced, so it never reaches Stet.
  const idLike = (s) => /\d{3,}/.test(s) || /^[0-9a-f-]{12,}$/i.test(s) || /^[A-Za-z0-9_-]{24,}$/.test(s);
  const scrub = (path) => path.split("/").map((seg) => (idLike(seg) ? ":id" : seg)).join("/");

  const hidden = (el) => {
    if (!el.getClientRects().length) return true;
    const cs = getComputedStyle(el);
    return cs.visibility === "hidden" || cs.display === "none" || !!el.closest('[aria-hidden="true"],[hidden],[data-stet-ignore]');
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
    if (had !== undefined) {
      items[had].count++;
      els[had].push(el);
      return;
    }
    if (items.length >= MAX) {
      truncated = true;
      return;
    }
    const it = { kind, text, context: clean(context).slice(0, 200), where: where(el).slice(0, 80), count: 1 };
    seen.set(k, items.length);
    items.push(it);
    els.push([el]);
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

  // ---------- marks from the review (option B) ----------
  // Only Stet's own tab, from Stet's origin, is heard, and only once. Every field
  // is checked, and everything is drawn as text (textContent), never as HTML.
  // All of it lives under one root marked data-stet-ignore, so a second scan
  // does not read Stet's words as the app's text.
  const str = (v, max) => typeof v === "string" && v.length <= max;
  const STYLE =
    "[data-stet-mark]{text-decoration:underline wavy #FF5A4F 2px!important;text-underline-offset:5px!important;text-decoration-skip-ink:none!important}" +
    "input[data-stet-mark],textarea[data-stet-mark]{outline:3px solid #FF5A4F!important;outline-offset:2px!important}" +
    "[data-stet-marks]{position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;font:15px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#14142B;text-align:left}" +
    "[data-stet-marks] *{box-sizing:border-box;font-family:inherit;letter-spacing:normal;text-transform:none;margin:0}" +
    "[data-stet-marks] .stet-m-pin{position:absolute;width:28px;height:28px;padding:0;display:flex;align-items:center;justify-content:center;background:#FFE14D;color:#14142B;border:2px solid #14142B;border-radius:50%;font-weight:700;font-size:13px;line-height:1;cursor:pointer;box-shadow:2px 2px 0 #14142B}" +
    "[data-stet-marks] .stet-m-pin[aria-expanded=true]{background:#2F4BFF;color:#FFFFFF}" +
    "[data-stet-marks] [hidden]{display:none!important}" +
    "[data-stet-marks] .stet-m-tip{position:absolute;width:min(300px,calc(100vw - 24px));background:#FFFFFF;color:#14142B;border:2px solid #14142B;border-radius:14px;box-shadow:5px 5px 0 #14142B;padding:12px 14px;display:flex;flex-direction:column;gap:6px}" +
    "[data-stet-marks] .stet-m-label{align-self:flex-start;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;background:#B3261E;color:#FFFFFF;padding:3px 9px;border-radius:6px}" +
    "[data-stet-marks] .stet-m-old{font-size:16px;text-decoration:line-through;text-decoration-color:#FF5A4F;text-decoration-thickness:3px;overflow-wrap:anywhere}" +
    "[data-stet-marks] .stet-m-new{align-self:flex-start;font-size:16px;font-weight:700;background:#FFE14D;padding:0 5px;overflow-wrap:anywhere}" +
    "[data-stet-marks] .stet-m-card{position:fixed;right:16px;bottom:16px;width:min(320px,calc(100vw - 32px));background:#FFFFFF;color:#14142B;border:2px solid #14142B;border-radius:18px;box-shadow:6px 6px 0 #14142B;padding:16px;display:flex;flex-direction:column;gap:10px}" +
    "[data-stet-marks] .stet-m-head{display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;line-height:1.15}" +
    "[data-stet-marks] .stet-m-brand{flex:none;background:#FFE14D;color:#14142B;border:2px solid #14142B;border-radius:8px;padding:0 8px;font-weight:700}" +
    "[data-stet-marks] .stet-m-big{flex:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:#FFE14D;border:2px solid #14142B;border-radius:50%;font-size:22px;transform:rotate(-6deg)}" +
    "[data-stet-marks] .stet-m-small{font-size:13px;color:#4A4A68}" +
    "[data-stet-marks] .stet-m-row{display:flex;flex-wrap:wrap;gap:8px}" +
    "[data-stet-marks] .stet-m-btn{font-weight:700;font-size:14px;line-height:1.2;min-height:44px;padding:9px 12px;background:#FFFFFF;color:#14142B;border:2px solid #14142B;border-radius:10px;cursor:pointer}" +
    "[data-stet-marks] .stet-m-go{background:#2F4BFF;color:#FFFFFF;box-shadow:3px 3px 0 #14142B}" +
    "[data-stet-marks] .stet-m-pin:focus-visible,[data-stet-marks] .stet-m-btn:focus-visible{outline:3px solid #2F4BFF;outline-offset:2px}";
  const make = (tag, cls, text) => {
    const x = document.createElement(tag);
    if (cls) x.className = cls.split(" ").map((c) => "stet-m-" + c).join(" ");
    if (text !== undefined) x.textContent = text;
    return x;
  };
  const draw = (marks) => {
    for (const x of document.querySelectorAll("[data-stet-marks]")) x.remove();
    for (const x of document.querySelectorAll("[data-stet-mark]")) x.removeAttribute("data-stet-mark");
    const root = make("div");
    root.setAttribute("data-stet-ignore", "");
    root.setAttribute("data-stet-marks", "");
    // Common session recorders mask these, so the findings are not uploaded with a replay.
    root.setAttribute("data-private", "");
    root.setAttribute("data-hj-suppress", "");
    root.className = "fs-exclude";
    root.append(make("style", "", STYLE));
    const placed = [];
    const place = () => {
      for (const { pin, el } of placed) {
        const r = el.getBoundingClientRect();
        pin.hidden = !r.width && !r.height;
        // Just left of the text, so the pin does not cover its first letters.
        pin.style.left = Math.max(2, r.left + scrollX - 32) + "px";
        pin.style.top = Math.max(2, r.top + scrollY + Math.min(r.height, 40) / 2 - 13) + "px";
      }
    };
    const tip = make("div", "tip");
    tip.hidden = true;
    tip.id = "stet-m-tip";
    let open = null;
    const show = (pin, m) => {
      if (open) open.setAttribute("aria-expanded", "false");
      if (open === pin) {
        open = null;
        tip.hidden = true;
        return;
      }
      open = pin;
      pin.setAttribute("aria-expanded", "true");
      tip.replaceChildren(make("span", "label", m.label || "Problem"), make("span", "old", m.from), m.to ? make("span", "new", m.to) : make("span", "small", "No new text yet: write it in the fix message."));
      tip.hidden = false;
      const w = Math.min(300, innerWidth - 24);
      tip.style.left = Math.max(scrollX + 8, Math.min(parseFloat(pin.style.left), scrollX + innerWidth - w - 8)) + "px";
      tip.style.top = parseFloat(pin.style.top) + 34 + "px";
    };
    let missing = 0;
    for (const m of marks) {
      const on = els[m.at].filter((el) => el.isConnected !== false);
      if (!on.length) {
        missing++;
        continue;
      }
      for (const el of on) el.setAttribute("data-stet-mark", "");
      const pin = make("button", "pin", String(m.n));
      pin.type = "button";
      pin.setAttribute("aria-label", "Mark " + m.n + ": " + (m.label || "Problem"));
      pin.setAttribute("aria-expanded", "false");
      pin.setAttribute("aria-controls", "stet-m-tip");
      pin.addEventListener("click", () => show(pin, m));
      placed.push({ pin, el: on[0] });
      root.append(pin);
    }
    root.append(tip);
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && open) {
        const was = open;
        show(open);
        was.focus();
      }
    });
    const n = marks.length;
    const card = make("div", "card");
    card.setAttribute("role", "status");
    card.setAttribute("aria-label", "Stet");
    const head = make("div", "head");
    head.append(make("span", "brand", "Stet"));
    if (n) head.append(make("span", "big", String(n)));
    head.append(make("span", "", n ? (n === 1 ? "thing" : "things") + " to fix on this screen" : "Nothing to fix on this screen"));
    const note = make(
      "p",
      "small",
      (n ? "Each mark sits on the text it is about. Click a number to see the fix. " : "") +
        "Stet drew this in this tab only; your app's code is unchanged." +
        (missing ? " " + missing + " of the marks are no longer on this screen." : ""),
    );
    const back = make("button", "btn go", "Back to Stet to copy the fix");
    back.type = "button";
    back.addEventListener("click", () => {
      if (tab.closed) note.textContent = "Stet's tab is closed. Click the bookmark again to scan this screen.";
      else tab.focus();
    });
    const hideBtn = make("button", "btn", "Hide the marks");
    hideBtn.type = "button";
    const hide = () => {
      removeEventListener("resize", place);
      for (const x of document.querySelectorAll("[data-stet-mark]")) x.removeAttribute("data-stet-mark");
      root.remove();
    };
    hideBtn.addEventListener("click", hide);
    const row = make("div", "row");
    row.append(back, hideBtn);
    card.append(head, note, row);
    root.append(card);
    document.body.append(root);
    place();
    addEventListener("resize", place);
  };
  const onMarks = (e) => {
    const d = e.data;
    if (e.source !== tab || e.origin !== stet || !d || d.type !== "stet-marks" || d.v !== 1 || !Array.isArray(d.marks) || d.marks.length > MAX) return;
    removeEventListener("message", onMarks); // one set of marks per scan
    const marks = d.marks
      .filter((m) => m && Number.isInteger(m.at) && m.at >= 0 && m.at < els.length && Number.isInteger(m.n) && m.n > 0 && m.n < 1000 && str(m.kind, 20) && str(m.label, 80) && str(m.from, LEN) && str(m.to ?? "", LEN))
      .map((m) => ({ at: m.at, n: m.n, label: m.label, from: m.from, to: m.to ?? "" }));
    draw(marks);
  };
  addEventListener("message", onMarks);
}

/** The bookmark's link: the function above, called with Stet's own origin. */
export const bookmarkletHref = (origin) => "javascript:" + encodeURIComponent(`(${scanWithStet.toString()})(${JSON.stringify(origin)});void 0`);
