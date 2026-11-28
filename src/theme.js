// Dark mode switch (slice 4.7). With no choice saved the page follows the
// system setting; a click saves the opposite of what is showing now. The saved
// choice is applied before first paint by a short inline script in each page's
// <head>, so this file only wires the button. Storage can be blocked (private
// windows, cleared site data): then the switch still works for this visit.
const KEY = "stet-theme";
const root = document.documentElement;
const system = matchMedia("(prefers-color-scheme: dark)");

const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : system.matches);

function show() {
  for (const b of document.querySelectorAll("[data-theme-switch]")) {
    b.setAttribute("aria-pressed", String(isDark()));
    b.hidden = false;
  }
}

for (const b of document.querySelectorAll("[data-theme-switch]")) {
  b.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* not saved; still switched for this visit */
    }
    show();
  });
}
system.addEventListener("change", show);
show();
