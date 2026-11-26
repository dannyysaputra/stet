// The one module every AI call in Stet goes through.
// Rule: all inference uses Firebase AI Logic. Nothing else in the app may
// import "firebase/ai" or call the browser's LanguageModel to generate text.
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { firebaseApp, missingConfig } from "./firebase.js";
import { recordSent } from "./seam.js";
import { CapReached, cloudModel, cloudUsedToday, countCloudUse, dailyCloudCap } from "./config.js";

export const MODES = {
  ONLY_ON_DEVICE: { mode: InferenceMode.ONLY_ON_DEVICE, label: "Laptop only", note: "Runs on the laptop model, or fails." },
  PREFER_ON_DEVICE: { mode: InferenceMode.PREFER_ON_DEVICE, label: "Laptop first", note: "Laptop model if it is ready, otherwise the cloud." },
  PREFER_IN_CLOUD: { mode: InferenceMode.PREFER_IN_CLOUD, label: "Cloud first", note: "Cloud if it is reachable, otherwise the laptop model." },
  ONLY_IN_CLOUD: { mode: InferenceMode.ONLY_IN_CLOUD, label: "Cloud only", note: "Runs in the cloud, or fails." },
};

// The SDK requires a model name whenever inCloudParams is given. It comes from
// Remote Config (src/config.js); the default is the SDK's own for hybrid use.
const TEXT = { type: "text", languages: ["en"] };

const ai = firebaseApp ? getAI(firebaseApp, { backend: new GoogleAIBackend() }) : null;
const models = new Map();
const queues = new Map();

function modelFor(modeKey, { schema, image } = {}) {
  if (!ai) throw new Error(`Firebase is not configured. Missing: ${missingConfig.join(", ")}. See README.md.`);
  if (!MODES[modeKey]) throw new Error(`Unknown mode: ${modeKey}`);
  const model = cloudModel();
  const key = `${modeKey}|${model}|${schema ? JSON.stringify(schema) : "-"}|${image ? "image" : "text"}`;
  if (!models.has(key)) {
    models.set(
      key,
      getGenerativeModel(ai, {
        mode: MODES[modeKey].mode,
        inCloudParams: {
          model,
          ...(schema ? { generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0 } } : {}),
        },
        onDeviceParams: {
          createOptions: { expectedInputs: image ? [TEXT, { type: "image" }] : [TEXT], expectedOutputs: [TEXT] },
          ...(schema ? { promptOptions: { responseConstraint: schema } } : {}),
        },
      }),
    );
  }
  return { key, model: models.get(key) };
}

// The SDK creates a new on-device session for every call and destroys the
// previous one, so two overlapping calls on one model break each other.
// Calls on the same model therefore run one after another.
function enqueue(key, job) {
  const run = (queues.get(key) ?? Promise.resolve()).then(job, job);
  queues.set(key, run.catch(() => {}));
  return run;
}

// Where a reply ran, as the SDK reports it. Never guessed from the mode:
// if the SDK gives no source, the answer is "unknown".
function whereItRan(response) {
  const src = String(response.inferenceSource ?? "").toLowerCase();
  if (src === "on_device") return "laptop";
  if (src === "in_cloud") return "cloud";
  return "unknown";
}

/**
 * Send one prompt. Returns { text, where: "laptop" | "cloud" | "unknown", ms, mode }.
 * options.schema: a JSON schema; the reply is then constrained to it on both sides.
 * options.image: { mimeType: "image/png" | "image/jpeg", data: base64 } sent with the prompt.
 * options.purpose: a short plain name for what the prompt carries, shown in the seam.
 * Every call that did not run on the laptop is recorded in src/seam.js, and so is
 * every failed call in a mode that could have reached the cloud.
 */
export async function ask(prompt, { mode = "PREFER_ON_DEVICE", schema, image, purpose = "a prompt" } = {}) {
  // The daily cloud cap (Remote Config), checked before any call that may reach the cloud.
  const mayUseCloud = mode === "ONLY_IN_CLOUD" || mode === "PREFER_IN_CLOUD" || (mode === "PREFER_ON_DEVICE" && (await laptopModelStatus()) !== "available");
  if (mayUseCloud && cloudUsedToday() >= dailyCloudCap()) throw new CapReached(dailyCloudCap());
  const { key, model } = modelFor(mode, { schema, image });
  const request = image ? [prompt, { inlineData: { mimeType: image.mimeType, data: image.data } }] : prompt;
  const sent = (where) => recordSent({ purpose, chars: prompt.length, image: Boolean(image), where, mode });
  return enqueue(key, async () => {
    const started = performance.now();
    let result;
    try {
      result = await model.generateContent(request);
    } catch (e) {
      if (mode !== "ONLY_ON_DEVICE") {
        sent("failed, may have reached the cloud");
        if (mayUseCloud) countCloudUse();
      }
      throw e;
    }
    const ms = Math.round(performance.now() - started);
    const where = whereItRan(result.response);
    if (where !== "laptop") {
      sent(where);
      countCloudUse();
    }
    return { text: result.response.text(), where, ms, mode };
  });
}

/** Like ask(), with a JSON schema; returns { data, text, where, ms, mode }. Throws if the reply is not JSON. */
export async function askJson(prompt, schema, options = {}) {
  const r = await ask(prompt, { ...options, schema });
  const cleaned = r.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try {
    return { ...r, data: JSON.parse(cleaned) };
  } catch {
    const err = new Error(`The model did not return JSON: ${r.text.slice(0, 120)}`);
    err.where = r.where;
    err.ms = r.ms;
    throw err;
  }
}

/** Start (or confirm) the laptop model download. Call from a click. onProgress gets 0..1. */
export async function prepareLaptopModel(onProgress) {
  await modelFor("ONLY_ON_DEVICE").model.initializeDeviceModel((fraction) => onProgress?.(fraction));
}

/** Read-only status of Chrome's built-in model. This does not generate anything. */
export async function laptopModelStatus() {
  if (!("LanguageModel" in self)) return "unsupported";
  try {
    return await self.LanguageModel.availability({ expectedInputs: [TEXT], expectedOutputs: [TEXT] });
  } catch {
    return "unsupported";
  }
}
