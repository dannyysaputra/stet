// Gate for the "Scan with Stet" bookmarklet (slice 3.6). The bookmark's link is
// the scanner's own source text, so the scanner must run with nothing around it.
// This builds src/scan/bookmarklet.js with Vite's production minifier, takes the
// link the built code makes, and runs it in an empty sandbox with a small fake
// page. Any name from outside the function throws there. It also checks what the
// scan reads, what it leaves out, and that the text goes only to Stet's origin.
//
// Limit: names are only caught on the paths this fake page drives.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { build } from "vite";

let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`FAIL ${msg}`);
};

const root = resolve(import.meta.dirname, "..");
const out = await build({
  root,
  configFile: false,
  logLevel: "silent",
  // The same build as the app's (not library mode), with the exports kept.
  build: { write: false, minify: true, rollupOptions: { input: resolve(root, "src/scan/bookmarklet.js"), preserveEntrySignatures: "strict" } },
});
const code = (Array.isArray(out) ? out[0] : out).output.find((c) => c.type === "chunk").code;
if (code.includes("textOf")) fail("the build was not minified, so this gate would not test the real link");
const dir = mkdtempSync(join(tmpdir(), "stet-bm-"));
const file = join(dir, "bookmarklet.mjs");
writeFileSync(file, code);
const { bookmarkletHref } = await import(pathToFileURL(file).href);
rmSync(dir, { recursive: true, force: true });

const STET = "https://stet.example";
const href = bookmarkletHref(STET);
if (!href.startsWith("javascript:")) fail("the link does not start with javascript:");
const body = decodeURIComponent(href.slice("javascript:".length));

// ---------- a small fake page ----------

function matches(el, selector) {
  return selector.split(",").some((part) => {
    const m = part.trim().match(/^([a-z0-9]*)(?:\[([a-z-]+)(?:=['"]?([^'"\]]*)['"]?)?\])?$/i);
    if (!m) return false;
    const [, tag, attr, value] = m;
    if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    if (!attr) return !!tag;
    const v = el.getAttribute(attr);
    return v !== null && (value === undefined || v === value);
  });
}
class El {
  constructor(tag, attrs = {}, kids = []) {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.childNodes = [];
    this.parentElement = null;
    this.labels = null;
    this.colSpan = 1;
    for (const k of kids) this.append(k);
  }
  append(k) {
    if (typeof k === "string") k = { nodeType: 3, nodeValue: k, parentElement: this };
    else k.parentElement = this;
    this.childNodes.push(k);
  }
  getAttribute(n) {
    return n in this.attrs ? String(this.attrs[n]) : null;
  }
  get id() {
    return this.getAttribute("id") ?? "";
  }
  get href() {
    return new URL(this.getAttribute("href"), page.href).href;
  }
  matches(s) {
    return matches(this, s);
  }
  closest(s) {
    for (let e = this; e; e = e.parentElement) if (e.matches(s)) return e;
    return null;
  }
  getClientRects() {
    return [{}];
  }
  *texts() {
    for (const k of this.childNodes) {
      if (k.nodeType === 3) yield k;
      else yield* k.texts();
    }
  }
  *elements() {
    for (const k of this.childNodes) {
      if (k.nodeType === 3) continue;
      yield k;
      yield* k.elements();
    }
  }
}
const page = { href: "http://localhost:3000/reset/9f3a8c7d6e5f4a3b2c1d0e9f?token=secret#top", host: "localhost:3000", pathname: "/reset/9f3a8c7d6e5f4a3b2c1d0e9f", hash: "#top", origin: "http://localhost:3000" };
const input = new El("input", { id: "email", placeholder: "name@company.com" });
input.labels = [{ innerText: "Email" }];
const docBody = new El("body", {}, [
  new El("nav", {}, [new El("a", { href: "/invoices" }, ["Invoices"])]),
  new El("h1", {}, ["Unlock your journey"]),
  new El("p", {}, ["Signed in as jo@example.com"]),
  new El("a", { href: "/invoice/12345?token=abc" }, ["Click here"]),
  new El("button", { id: "save" }, [new El("span", { "aria-hidden": "true" }, ["close"]), "Submit"]),
  new El("button", { id: "delete-48213" }, ["Delete"]),
  new El("table", {}, [new El("tr", {}, [new El("td", {}, ["Acme Ltd"])])]),
  new El("div", {}, ["No data"]),
  new El("span", {}, ["1,250.00"]),
  new El("p", {}, [String.fromCharCode(0x200b)]), // an "empty" paragraph from a page builder
  new El("p", {}, ["Learn" + String.fromCharCode(0x200b) + " more"]),
  new El("aside", { "data-stet-ignore": "" }, [new El("button", {}, ["Scan this screen with Stet"])]), // Stet's own bar on the example app
  input,
]);
const walker = (rootEl) => {
  const list = [...rootEl.texts()];
  let i = 0;
  return { nextNode: () => list[i++] ?? null };
};
const sent = [];
const listeners = [];
const tab = { postMessage: (data, origin) => sent.push({ data, origin }) };
const sandbox = {
  document: {
    body: docBody,
    title: "Reset password",
    documentElement: { lang: "en" },
    createTreeWalker: (rootEl) => walker(rootEl),
    querySelectorAll: (s) => [...docBody.elements()].filter((e) => e.matches(s)),
    querySelector: () => null,
  },
  location: page,
  NodeFilter: { SHOW_TEXT: 4 },
  CSS: { escape: (s) => s },
  URL,
  getComputedStyle: () => ({ visibility: "visible", display: "block" }),
  addEventListener: (type, fn) => listeners.push(fn),
  removeEventListener: () => {},
  setTimeout: () => 0,
  alert: () => fail("the scan alerted on a normal page"),
};
sandbox.window = { open: (url) => (url === `${STET}/files/#scan` ? tab : fail(`opened ${url}`)) };

try {
  vm.runInNewContext(body, sandbox, { timeout: 2000 });
  for (const fn of listeners) fn({ source: { other: true }, origin: STET, data: { type: "stet-ready" } }); // another window: ignored
  for (const fn of listeners) fn({ source: tab, origin: "https://evil.test", data: { type: "stet-ready" } }); // wrong origin: ignored
  if (sent.length) fail("the scan was sent before Stet's own tab asked for it");
  for (const fn of listeners) fn({ source: tab, origin: STET, data: { type: "stet-ready" } });
} catch (e) {
  fail(`the minified bookmarklet threw in an empty sandbox: ${e.message}`);
}

const msg = sent[0];
if (sent.length !== 1 || msg.origin !== STET) fail(`expected one message to ${STET}, got ${JSON.stringify(sent.map((s) => s.origin))}`);
const items = msg?.data.items ?? [];
const has = (kind, text) => items.find((i) => i.kind === kind && i.text === text);
const want = [
  ["nav", "Invoices"],
  ["heading", "Unlock your journey"],
  ["link", "Click here"],
  ["button", "Submit"],
  ["button", "Delete"],
  ["text", "No data"],
  ["placeholder", "name@company.com"],
];
for (const [kind, text] of want) if (!has(kind, text)) fail(`missing ${kind} "${text}"`);
if (items.some((i) => /\p{Cf}/u.test(i.text) || !i.text.trim())) fail(`an invisible character or empty text was read: ${JSON.stringify(items.map((i) => i.text))}`);
if (!has("text", "Learn more")) fail('"Learn" + zero-width space + " more" should read as "Learn more"');
for (const leak of ["jo@example.com", "Acme Ltd", "1,250.00", "close", "Scan this screen"]) if (items.some((i) => i.text.includes(leak))) fail(`read data that is not interface text: "${leak}"`);
const all = JSON.stringify(msg?.data ?? {});
for (const secret of ["9f3a8c7d6e5f4a3b2c1d0e9f", "12345", "48213", "token", "secret"]) if (all.includes(secret)) fail(`an id or token reached the message: "${secret}"`);
if (has("link", "Click here")?.context !== "Link to /invoice/:id") fail(`link context: ${JSON.stringify(has("link", "Click here")?.context)}`);
if (msg?.data.page !== "localhost:3000/reset/:id") fail(`page: ${msg?.data.page}`);
if (has("button", "Submit")?.where !== "button#save") fail(`button element: ${has("button", "Submit")?.where}`);

if (failed) {
  console.log(`FAIL check-bookmarklet: ${failed} failure(s).`);
  process.exit(1);
}
console.log(`OK check-bookmarklet: the minified link (${href.length} characters) runs with no outside names, reads ${items.length} strings of ${want.length} kinds expected, leaves out data, ids and tokens, and sends only to Stet's tab.`);
