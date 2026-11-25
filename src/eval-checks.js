// Phase 0 accuracy test: prompts, schemas and scoring for the three checks.
// Every model call goes through src/ai.js.
import { askJson } from "./ai.js";
import enStrings from "../data/eval/en-strings.json";
import idPairs from "../data/eval/id-pairs.json";
import wordingGuide from "../data/eval/wording-guide.md?raw";
import idRules from "../data/eval/id-rules.md?raw";

const EN_TYPES = ["sounds_generated", "vague_button", "blames_user", "unclear_message", "jargon", "leftover_text", "vague_link", "inconsistent_term"];
const ID_TYPES = ["wrong_sense", "word_for_word", "wrong_verb_form", "mixed_register"];

const EN_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["ok", "problem"] },
    problem: { type: "string", enum: [...EN_TYPES, "none"] },
    severity: { type: "string", enum: ["high", "medium", "low", "none"] },
    rewrite: { type: "string" },
  },
  required: ["verdict", "problem", "severity", "rewrite"],
};

const ID_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["ok", "problem"] },
    problem: { type: "string", enum: [...ID_TYPES, "none"] },
    better: { type: "string" },
    note_en: { type: "string" },
  },
  required: ["verdict", "problem", "better", "note_en"],
};

const READ_SCHEMA = {
  type: "object",
  properties: { texts: { type: "array", items: { type: "string" } } },
  required: ["texts"],
};

const enPrompt = (r) => `You review the interface text of an app, one piece at a time, against this wording guide.

${wordingGuide}

Judge this one piece of text.
App: ${r.app}
Screen: ${r.screen}
Element: ${r.kind}
${r.context ? `Context: ${r.context}\n` : ""}Text: "${r.text}"

Reply with JSON only. If the text is fine, use verdict "ok", problem "none", severity "none" and rewrite "". Otherwise give the single best-matching problem kind, its seriousness, and a rewrite that follows the guide.`;

const idPrompt = (r) => `You review Indonesian interface text against its English original, using these rules.

${idRules}

App address: the app speaks to the user as "${r.register}".
App: ${r.app}
Screen: ${r.screen}
Element: ${r.kind}
English: "${r.en}"
Indonesian: "${r.id_text}"

Reply with JSON only. If the Indonesian is fine, use verdict "ok", problem "none", better "" and note_en "". Otherwise give the single best-matching problem kind, a better Indonesian version, and one short sentence in plain English on what the bad version says or does wrong.`;

// Several strings in one call: the guide is sent once per batch instead of once per string.
// One required key per item (item1, item2, ...) rather than an array: with an array
// the laptop model stopped early and dropped the later items (first batch run, 73 of 150 missing).
const enBatchSchema = (count) => {
  const keys = Array.from({ length: count }, (_, i) => `item${i + 1}`);
  return { type: "object", properties: Object.fromEntries(keys.map((k) => [k, EN_SCHEMA])), required: keys };
};

const enBatchPrompt = (rows) => `You review the interface text of an app against this wording guide.

${wordingGuide}

Judge each numbered piece of text on its own.

${rows
  .map((r, i) => `item${i + 1}. App: ${r.app} | Screen: ${r.screen} | Element: ${r.kind}${r.context ? ` | Context: ${r.context}` : ""}\n   Text: "${r.text}"`)
  .join("\n")}

Reply with JSON only, with one key per item (${rows.map((_, i) => `item${i + 1}`).join(", ")}). If a text is fine, use verdict "ok", problem "none", severity "none" and rewrite "". Otherwise give the single best-matching problem kind, its seriousness, and a rewrite that follows the guide.`;

// A fixed shuffle, so each batch mixes kinds the way a real screen does and runs repeat exactly.
function seededShuffle(rows, seed = 20261125) {
  const out = [...rows];
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const READ_PROMPT =`This is a screenshot of an app screen. List every piece of interface text you can see, exactly as written, one item per label, button, heading, message or placeholder. Do not add text that is not visible. Reply with JSON only.`;

// ---------- screen reading: synthetic screenshots drawn from the English strings ----------

const norm = (s) => s.toLowerCase().replace(/[“”"']/g, "").replace(/\s+/g, " ").replace(/[.…]+$/, "").trim();

function screens() {
  const groups = new Map();
  for (const r of enStrings) {
    const k = `${r.app} / ${r.screen}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return [...groups.entries()]
    .filter(([, rows]) => rows.length >= 4)
    .map(([name, rows]) => ({ name, rows: rows.slice(0, 8) }));
}

function drawScreen(rows) {
  const W = 720;
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  c.width = W;
  c.height = 90 + rows.length * 62;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, c.height);
  let y = 50;
  for (const r of rows) {
    if (r.kind === "heading") {
      g.font = "bold 26px Segoe UI, Arial, sans-serif";
      g.fillStyle = "#111827";
      g.fillText(r.text, 32, y);
    } else if (r.kind === "button") {
      g.font = "600 17px Segoe UI, Arial, sans-serif";
      const w = g.measureText(r.text).width + 36;
      g.fillStyle = "#1f5fe0";
      g.fillRect(32, y - 26, w, 38);
      g.fillStyle = "#ffffff";
      g.fillText(r.text, 50, y - 1);
    } else if (r.kind === "placeholder") {
      g.strokeStyle = "#9ca3af";
      g.strokeRect(32, y - 26, 420, 38);
      g.font = "16px Segoe UI, Arial, sans-serif";
      g.fillStyle = "#6b7280";
      g.fillText(r.text, 44, y - 1);
    } else if (r.kind === "link") {
      g.font = "16px Segoe UI, Arial, sans-serif";
      g.fillStyle = "#1f5fe0";
      g.fillText(r.text, 32, y);
      g.fillRect(32, y + 3, g.measureText(r.text).width, 1);
    } else {
      g.font = r.kind === "label" ? "600 15px Segoe UI, Arial, sans-serif" : "16px Segoe UI, Arial, sans-serif";
      g.fillStyle = r.kind === "error" ? "#b91c1c" : "#374151";
      g.fillText(r.text, 32, y);
    }
    y += 62;
  }
  return c.toDataURL("image/png").split(",")[1];
}

// ---------- the three checks ----------

export const CHECKS = {
  english: {
    label: "English check",
    items: () => enStrings,
    run: (r, mode) => askJson(enPrompt(r), EN_SCHEMA, { mode }),
    score(r, d) {
      const flagged = d.verdict === "problem";
      return { expect: r.expect, type: r.type, flagged, typeMatch: flagged && d.problem === r.type, got: d };
    },
  },
  englishbatch: {
    label: "English check, 5 per call",
    metricsAs: "english",
    batchSize: 5,
    items: () => seededShuffle(enStrings),
    async runBatch(rows, mode) {
      const r = await askJson(enBatchPrompt(rows), enBatchSchema(rows.length), { mode });
      return { ...r, perItem: rows.map((_, i) => r.data[`item${i + 1}`] ?? null) };
    },
    score(r, d) {
      const flagged = d.verdict === "problem";
      return { expect: r.expect, type: r.type, flagged, typeMatch: flagged && d.problem === r.type, got: d };
    },
  },
  translation: {
    label: "Translation check",
    items: () => idPairs,
    run: (r, mode) => askJson(idPrompt(r), ID_SCHEMA, { mode }),
    score(r, d) {
      const flagged = d.verdict === "problem";
      return { expect: r.expect, type: r.type, flagged, typeMatch: flagged && d.problem === r.type, got: d };
    },
  },
  reading: {
    label: "Screen reading",
    items: () => screens().map((s, i) => ({ id: `screen${String(i + 1).padStart(2, "0")}`, name: s.name, rows: s.rows })),
    run: (s, mode) => askJson(READ_PROMPT, READ_SCHEMA, { mode, image: { mimeType: "image/png", data: drawScreen(s.rows) } }),
    score(s, d) {
      const want = s.rows.map((r) => norm(r.text));
      const got = (d.texts ?? []).map(norm);
      const found = want.filter((w) => got.includes(w)).length;
      const extra = got.filter((x) => !want.includes(x)).length;
      return { expected: want.length, found, extra, got: d.texts ?? [] };
    },
  },
};

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

/** Summary metrics for one finished run. Definitions are written into the result. */
export function summarize(checkKey, results, wallMs) {
  const metricsKey = CHECKS[checkKey]?.metricsAs ?? checkKey;
  const ok = results.filter((x) => !x.error);
  const errors = results.length - ok.length;
  const where = {};
  for (const x of results) where[x.where ?? "error"] = (where[x.where ?? "error"] ?? 0) + 1;
  const speed = { itemsPerMinute: wallMs ? Math.round((results.length / (wallMs / 60000)) * 10) / 10 : null, medianMs: median(ok.map((x) => x.ms)) };

  if (checkKey === "reading") {
    const expected = ok.reduce((a, x) => a + x.score.expected, 0);
    const found = ok.reduce((a, x) => a + x.score.found, 0);
    const extra = ok.reduce((a, x) => a + x.score.extra, 0);
    return {
      definitions: { textFound: "visible strings returned exactly (case, quotes and final full stop ignored) / strings drawn", extraText: "returned strings that were not drawn" },
      textFoundPct: pct(found, expected),
      extraText: extra,
      screens: results.length,
      errors,
      where,
      speed,
    };
  }

  const problems = results.filter((x) => x.item.expect === "problem");
  const goods = results.filter((x) => x.item.expect === "ok");
  const flagged = (xs) => xs.filter((x) => x.score?.flagged).length;
  const typeOk = (xs) => xs.filter((x) => x.score?.typeMatch).length;
  const byType = {};
  for (const x of problems) {
    const t = x.item.type;
    byType[t] ??= { n: 0, flagged: 0, typeMatch: 0 };
    byType[t].n++;
    if (x.score?.flagged) byType[t].flagged++;
    if (x.score?.typeMatch) byType[t].typeMatch++;
  }
  const filler = problems.filter((x) => x.item.type === "sounds_generated");
  return {
    definitions: {
      problemsCaughtPct: "problem items the model flagged as a problem / all problem items (errors count as missed)",
      problemKindRightPct: "problem items flagged with the right problem kind / all problem items",
      falseAlarmPct: "good items the model flagged as a problem / all good items (errors not counted as alarms)",
      ...(metricsKey === "english" ? { fillerCaughtPct: "generated-filler items flagged as a problem / all generated-filler items" } : {}),
    },
    problemsCaughtPct: pct(flagged(problems), problems.length),
    problemKindRightPct: pct(typeOk(problems), problems.length),
    falseAlarmPct: pct(flagged(goods), goods.length),
    ...(metricsKey === "english" ? { fillerCaughtPct: pct(flagged(filler), filler.length) } : {}),
    byType,
    items: results.length,
    errors,
    where,
    speed,
  };
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
