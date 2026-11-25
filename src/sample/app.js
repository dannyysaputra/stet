// The sample app: three invoicing screens, routed by the URL hash.
// It makes no AI calls. Stet reads its text through the data-s attributes.
import { STRINGS, INVOICES } from "./strings.js";

const lang = "en";
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Changed text, by key. Stet's "Apply to sample" writes it here in place of a
// coding agent editing strings.js; "Reset sample text" clears it. The same key is
// named in src/review/review.js (SAMPLE_TEXT_KEY).
const OVERRIDES_KEY = "lumbung.text";
function overrides() {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

let changed = overrides();
const text = (key) => {
  const s = STRINGS[key];
  if (!s) throw new Error(`Unknown string key: ${key}`);
  return typeof changed[key] === "string" ? changed[key] : s[lang];
};
// A visible string, wrapped so it can be found and replaced.
const t = (key, tag = "span", attrs = "") => `<${tag} data-s="${key}" data-kind="${STRINGS[key].kind}"${attrs ? " " + attrs : ""}>${esc(text(key))}</${tag}>`;
// A placeholder lives in an attribute rather than in the element's text.
const ph = (key) => `data-s="${key}" data-kind="placeholder" data-attr="placeholder" placeholder="${esc(text(key))}"`;
const btn = (key, cls = "") => t(key, "button", `type="button"${cls ? ` class="${cls}"` : ""}`);

const SCREENS = {
  new: () => `
    <h1>${t("new.heading")}</h1>
    <p class="sub">${t("new.subtitle")}</p>
    <div class="field">
      <label for="f-client">${t("new.client.label")}</label>
      <input id="f-client" ${ph("new.client.placeholder")}>
    </div>
    <div class="field">
      <label for="f-email">${t("new.email.label")}</label>
      <input id="f-email" type="email" ${ph("new.email.placeholder")}>
    </div>
    <div class="field">
      <label for="f-due">${t("new.due.label")}</label>
      <input id="f-due" ${ph("new.due.placeholder")}>
    </div>
    <div class="field">
      <label for="f-amount">${t("new.amount.label")}</label>
      <input id="f-amount" class="bad" value="-40" aria-describedby="f-amount-err">
      ${t("new.amount.error", "p", `id="f-amount-err" class="err"`)}
    </div>
    <div class="field items">
      <p class="lbl">${t("new.items.label")}</p>
      ${t("new.items.empty", "p", `class="empty"`)}
      ${btn("new.items.add", "ghost")}
    </div>
    <p>${t("new.preview", "a", `href="#/new"`)}</p>
    <div class="actions">${btn("new.close", "ghost")}${btn("new.save", "ghost")}${btn("new.submit", "solid")}</div>`,

  list: () => `
    <div class="toast" role="status">${t("list.toast")}</div>
    <div class="titlebar">
      <div><h1>${t("list.heading")}</h1><p class="sub">${t("list.subtitle")}</p></div>
      ${btn("list.new", "solid")}
    </div>
    <div class="search"><input aria-label="Search" ${ph("list.search.placeholder")}>${btn("list.search.go", "ghost")}</div>
    <table>
      <thead><tr>${["client", "amount", "due", "status"].map((c) => `<th>${t(`list.col.${c}`)}</th>`).join("")}<th></th></tr></thead>
      <tbody>${INVOICES.map(
        (r) => `<tr><td>${esc(r.client)}</td><td class="num">${esc(r.amount)}</td><td>${esc(r.due)}</td>
          <td>${t(r.status, "span", `class="badge ${r.status.split(".").pop()}"`)}</td>
          <td>${t("list.row.more", "a", `href="#/list"`)}</td></tr>`,
      ).join("")}</tbody>
    </table>
    <div class="actions">${btn("list.next", "ghost")}</div>`,

  settings: () => `
    <h1>${t("set.heading")}</h1>
    <section class="card">
      <label class="switch"><input type="checkbox" checked> ${t("set.reminders.label")}</label>
      ${t("set.reminders.help", "p", `class="help"`)}
    </section>
    <section class="card">
      <div class="field"><label for="f-company">${t("set.company.label")}</label><input id="f-company" ${ph("set.company.placeholder")}></div>
      <div class="field"><label for="f-footer">${t("set.footer.label")}</label><input id="f-footer" ${ph("set.footer.placeholder")}></div>
    </section>
    <section class="card row">
      <div>${t("set.calendar.help", "p", `class="help"`)}</div>
      ${btn("set.calendar.button", "ghost")}
    </section>
    <section class="card row">
      <div>${t("set.twostep.label", "p", `class="lbl"`)}${t("set.twostep.link", "a", `href="#/settings"`)}</div>
      <label class="switch"><input type="checkbox" aria-label="Two-step sign-in"></label>
    </section>
    <div class="actions">${btn("set.save", "solid")}</div>
    <section class="card danger">
      <h2>${t("set.danger.heading")}</h2>
      ${t("set.danger.help", "p", `class="help"`)}
      ${btn("set.danger.button", "warn")}
    </section>`,
};

const NAV = [
  ["new", "nav.home"],
  ["list", "nav.invoices"],
  ["settings", "nav.settings"],
];

function render() {
  changed = overrides();
  const route = location.hash.replace(/^#\//, "") || "new";
  const screen = SCREENS[route] ? route : "new";
  document.getElementById("nav").innerHTML = NAV.map(
    ([r, key]) => `<a href="#/${r}"${r === screen ? ` aria-current="page"` : ""}>${t(key)}</a>`,
  ).join("");
  document.getElementById("screen").innerHTML = SCREENS[screen]();
  document.getElementById("screen").dataset.screen = screen;
  document.title = `Lumbung: ${screen}`;
}

addEventListener("hashchange", render);
render();
