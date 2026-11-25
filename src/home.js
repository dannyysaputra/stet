// The first screen (slice 4.4): explains the laptop model, shows its state, lets
// the visitor download it with progress, and says what happens without it.
// The download starts only from the button: browsers require a click for it.
import { laptopModelStatus, prepareLaptopModel } from "./ai.js";

const state = document.getElementById("model-state");
const btn = document.getElementById("prepare");
const bar = document.getElementById("prepare-progress");

const TEXT = {
  available: "Ready. Reviews run on this laptop.",
  downloadable: "Not downloaded yet. It is a one-time download of a few GB; Chrome keeps it for every site that uses it.",
  downloading: "Chrome is downloading it. You can start with an Open project meanwhile.",
  unavailable: "This computer cannot run it (Chrome reports it unavailable). Use an Open project: the cloud model checks your text after you approve it.",
  unsupported: "This browser has no built-in model. Use Chrome desktop 139 or newer, or an Open project.",
};

async function show() {
  const s = await laptopModelStatus();
  state.textContent = TEXT[s] ?? `Status: ${s}.`;
  state.dataset.status = s;
  btn.hidden = !(s === "downloadable" || s === "downloading");
  return s;
}

btn.addEventListener("click", async () => {
  btn.disabled = true;
  bar.hidden = false;
  state.textContent = "Downloading the laptop model...";
  try {
    await prepareLaptopModel((fraction) => {
      bar.value = fraction;
      state.textContent = `Downloading the laptop model: ${Math.round(fraction * 100)}%`;
    });
    await show();
  } catch (e) {
    state.textContent = `The download did not finish: ${e.message ?? e}`;
  } finally {
    btn.disabled = false;
    bar.hidden = true;
  }
});

show();
