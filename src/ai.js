// The one module every AI call in Stet goes through.
// Rule: all inference uses Firebase AI Logic. Nothing else in the app may
// import "firebase/ai" or call the browser's LanguageModel to generate text.
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { firebaseApp, missingConfig } from "./firebase.js";

export const MODES = {
  ONLY_ON_DEVICE: { mode: InferenceMode.ONLY_ON_DEVICE, label: "Laptop only", note: "Runs on the laptop model, or fails." },
  PREFER_ON_DEVICE: { mode: InferenceMode.PREFER_ON_DEVICE, label: "Laptop first", note: "Laptop model if it is ready, otherwise the cloud." },
  PREFER_IN_CLOUD: { mode: InferenceMode.PREFER_IN_CLOUD, label: "Cloud first", note: "Cloud if it is reachable, otherwise the laptop model." },
  ONLY_IN_CLOUD: { mode: InferenceMode.ONLY_IN_CLOUD, label: "Cloud only", note: "Runs in the cloud, or fails." },
};

const cloudModel = import.meta.env.VITE_CLOUD_MODEL || undefined;
const ai = firebaseApp ? getAI(firebaseApp, { backend: new GoogleAIBackend() }) : null;
const models = new Map();

function modelFor(modeKey) {
  if (!ai) throw new Error(`Firebase is not configured. Missing: ${missingConfig.join(", ")}. See README.md.`);
  if (!MODES[modeKey]) throw new Error(`Unknown mode: ${modeKey}`);
  if (!models.has(modeKey)) {
    models.set(
      modeKey,
      getGenerativeModel(ai, {
        mode: MODES[modeKey].mode,
        ...(cloudModel ? { inCloudParams: { model: cloudModel } } : {}),
        onDeviceParams: {
          createOptions: {
            expectedInputs: [{ type: "text", languages: ["en"] }],
            expectedOutputs: [{ type: "text", languages: ["en"] }],
          },
        },
      }),
    );
  }
  return models.get(modeKey);
}

// Where a reply ran, as the SDK reports it. Never guessed from the mode:
// if the SDK gives no source, the answer is "unknown".
function whereItRan(response) {
  const src = String(response.inferenceSource ?? "").toLowerCase();
  if (src === "on_device") return "laptop";
  if (src === "in_cloud") return "cloud";
  return "unknown";
}

/** Send one prompt. Returns { text, where: "laptop" | "cloud" | "unknown", ms, mode }. */
export async function ask(prompt, { mode = "PREFER_ON_DEVICE" } = {}) {
  const model = modelFor(mode);
  const started = performance.now();
  const result = await model.generateContent(prompt);
  const ms = Math.round(performance.now() - started);
  return { text: result.response.text(), where: whereItRan(result.response), ms, mode };
}

/** Start (or confirm) the laptop model download. Call from a click. onProgress gets 0..1. */
export async function prepareLaptopModel(onProgress) {
  await modelFor("ONLY_ON_DEVICE").initializeDeviceModel((fraction) => onProgress?.(fraction));
}

/** Read-only status of Chrome's built-in model. This does not generate anything. */
export async function laptopModelStatus() {
  if (!("LanguageModel" in self)) return "unsupported";
  try {
    return await self.LanguageModel.availability({
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });
  } catch {
    return "unsupported";
  }
}
