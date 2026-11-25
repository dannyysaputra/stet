import { MODES, ask, prepareLaptopModel, laptopModelStatus } from "./ai.js";
import { appCheckMode, missingConfig } from "./firebase.js";

const PROMPT = 'Rewrite this button label so it says what happens when pressed, on an invoice screen: "Submit". Reply with the new label only.';
const $ = (id) => document.getElementById(id);
const WHERE = { laptop: "Ran on this laptop", cloud: "Ran in the cloud", unknown: "The SDK did not say where it ran" };

$("prompt").textContent = PROMPT;
$("appcheck").textContent = appCheckMode;
$("online").textContent = navigator.onLine ? "online" : "offline";
addEventListener("online", () => ($("online").textContent = "online"));
addEventListener("offline", () => ($("online").textContent = "offline"));

if (missingConfig.length) {
  $("config").hidden = false;
  $("config").textContent = `Firebase is not configured yet. Missing: ${missingConfig.join(", ")}. Create .env.local as described in README.md, then restart the dev server.`;
}

async function refreshStatus() {
  $("status").textContent = await laptopModelStatus();
}
refreshStatus();

$("prepare").addEventListener("click", async () => {
  $("prepare").disabled = true;
  $("progress").textContent = "Starting...";
  try {
    await prepareLaptopModel((f) => ($("progress").textContent = `Downloading: ${Math.round(f * 100)}%`));
    $("progress").textContent = "Ready.";
  } catch (e) {
    $("progress").textContent = `Failed: ${e.message}`;
  }
  $("prepare").disabled = false;
  refreshStatus();
});

$("modes").innerHTML = Object.entries(MODES)
  .map(
    ([key, m]) => `<article class="mode" data-mode="${key}">
      <header><div><h2>${m.label}</h2><p class="dim">${m.note} <code>${key}</code></p></div>
      <button type="button">Run</button></header>
      <p class="where" data-where="idle">Not run yet.</p>
      <pre class="reply"></pre>
    </article>`,
  )
  .join("");

$("modes").addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const card = btn.closest(".mode");
  const where = card.querySelector(".where");
  const reply = card.querySelector(".reply");
  btn.disabled = true;
  where.dataset.where = "idle";
  where.textContent = "Running...";
  reply.textContent = "";
  try {
    // Without this, a laptop-only run would start the model download inside the
    // request, with no progress shown, and block until it finished.
    if (card.dataset.mode === "ONLY_ON_DEVICE" && (await laptopModelStatus()) !== "available") {
      throw new Error('The laptop model is not ready. Press "Prepare the laptop model" first.');
    }
    const r = await ask(PROMPT, { mode: card.dataset.mode });
    where.dataset.where = r.where;
    where.textContent = `${WHERE[r.where]} · ${r.ms} ms`;
    reply.textContent = r.text;
  } catch (err) {
    where.dataset.where = "error";
    where.textContent = "Failed";
    reply.textContent = `${err.name}: ${err.message}`;
  }
  btn.disabled = false;
});
