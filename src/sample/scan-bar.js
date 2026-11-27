// The example app with "?scan=1": a bar that scans this screen with Stet in one
// press, so a visitor sees the whole loop before adding the bookmark. It calls
// the same function the bookmark runs. The bar is marked data-stet-ignore, so
// the scan does not read Stet's own words as the app's text.
import { scanWithStet } from "../scan/bookmarklet.js";

const bar = document.createElement("aside");
bar.className = "stet-bar";
bar.setAttribute("data-stet-ignore", "");
bar.setAttribute("aria-label", "Stet");
bar.innerHTML = `
  <p><b>This is an example app.</b> An AI agent built this screen and left wording mistakes in it. Let Stet find them.</p>
  <button type="button" id="stet-scan">Scan this screen with Stet</button>
  <p class="stet-small">On your own app, the "Scan with Stet" bookmark does exactly this.</p>`;
document.body.append(bar);
bar.querySelector("#stet-scan").addEventListener("click", () => scanWithStet(location.origin));
