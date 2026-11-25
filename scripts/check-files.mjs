// Gate for src/files/parse.js (slice 3.3): your own language files must be read
// whole, keyed exactly, paired by key, and given a sensible element kind.
import { flatten, kindFromKey, pairFiles, parsePasted } from "../src/files/parse.js";

let failed = 0;
const fail = (msg) => {
  failed++;
  console.log(`FAIL ${msg}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const en = { nav: { home: "Home" }, checkout: { pay_button: "Pay", title: "Checkout", card: { label: "Card number", placeholder: "1234 5678" } }, count: 3, empty_state: "No orders yet" };
const id = { nav: { home: "Rumah" }, checkout: { pay_button: "Bayar", title: "Pembayaran", card: { label: "Nomor kartu" } }, extra: "Lebih" };

if (!same(flatten(en), { "nav.home": "Home", "checkout.pay_button": "Pay", "checkout.title": "Checkout", "checkout.card.label": "Card number", "checkout.card.placeholder": "1234 5678", empty_state: "No orders yet" }))
  fail(`flatten: ${JSON.stringify(flatten(en))}`);

const KINDS = [
  ["checkout.pay_button", "button"],
  ["checkout.card.placeholder", "placeholder"],
  ["checkout.card.label", "label"],
  ["checkout.title", "heading"],
  ["empty_state", "empty"],
  ["errors.invalid_email", "error"],
  ["nav.home", "nav"],
  ["profile.bio", "text"],
  ["settings.tabs", "nav"],
  ["report.table", "text"], // contains "tab": only the anchored nav pattern keeps it plain text
  ["billing.month", "text"], // contains "th": only the anchored column pattern keeps it plain text
];
for (const [key, want] of KINDS) if (kindFromKey(key) !== want) fail(`kindFromKey("${key}") = ${kindFromKey(key)}, expected ${want}`);

const { items, onlyEn, onlyId } = pairFiles(en, id);
const pay = items.find((i) => i.key === "checkout.pay_button");
if (!pay || pay.en !== "Pay" || pay.id !== "Bayar") fail(`pairing: ${JSON.stringify(pay)}`);
if (!same(onlyEn.sort(), ["checkout.card.placeholder", "empty_state"])) fail(`onlyEn: ${JSON.stringify(onlyEn)}`);
if (!same(onlyId, ["extra"])) fail(`onlyId: ${JSON.stringify(onlyId)}`);
if (items.length !== 7) fail(`expected 7 keys, got ${items.length}`);
if (pairFiles(en, null).onlyEn.length) fail("with no Indonesian file, no key should be reported as missing its Indonesian");

const pasted = parsePasted("  Submit \n\nClick here\n");
if (!same(pasted, [{ key: "line 1", kind: "text", en: "Submit", id: "" }, { key: "line 2", kind: "text", en: "Click here", id: "" }])) fail(`parsePasted: ${JSON.stringify(pasted)}`);

if (failed) {
  console.log(`FAIL check-files: ${failed} failure(s).`);
  process.exit(1);
}
console.log(`OK check-files: flatten, ${KINDS.length} kind guesses, pairing and pasted lists all as expected.`);
