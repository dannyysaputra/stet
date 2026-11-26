# Review speed: benchmark ledger

Goal (2026-11-26): a review of one sample screen finishes fast enough for real
use and for the demo video, without changing what Stet finds. Run with the ECC
benchmark-optimization-loop method: frozen setup, one hypothesis per variant,
every run recorded.

## Frozen setup

- Operation: press "Review this screen" on /review/, sample screen "new"
  (20 strings), English, Sealed project, the wording guide saved in the browser
  (guide id 1y3c5tt), laptop model warmed up by the page.
- Primary metric: wall time from the press to "Done" (`window.__lastReview`),
  lower is better. It is what a user waits for.
- Scenarios: A, the first review after the page loads; B, a review after a
  reload when the same text was reviewed before (a repeat visit, or the demo
  after a rehearsal).
- Targets (proposed 2026-11-26): A under 45 s, B under 10 s.
- Hard constraints: no verdict is reused across a different prompt, guide,
  element kind, context or text; the measured Phase 0 prompts are unchanged
  unless an eval rerun shows caught >= 80% and false alarms <= 2%; the counter
  stays 0.
- Noise: two fresh baseline runs differ in 2 of 20 verdicts (new.heading:
  sounds_generated vs jargon; new.close: ok vs vague_button). A fresh check is
  not deterministic, so "same verdicts" is judged against a stored run, not
  against another fresh run.
- Budget: at most 3 variants, about an hour, no cloud spend.
- Environment: the owner's Chrome with Gemini Nano, dev server, one laptop.

## Bench runner

Paste into the console of /review/ right after a reload, then read
`window.__bench` when `done` is true:

```js
window.__bench = { done: false };
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const w = document.getElementById("app").contentWindow;
  for (let i = 0; i < 50 && !w.document.getElementById("lang"); i++) await sleep(100);
  if (w.document.documentElement.lang !== "en") { w.document.getElementById("lang").click(); await sleep(300); }
  w.location.hash = "#/new"; await sleep(500);
  for (let i = 0; i < 90 && !window.__warm; i++) await sleep(1000);
  window.__lastReview = null;
  const t0 = performance.now();
  document.getElementById("review").click();
  for (let i = 0; i < 1800 && !window.__lastReview; i++) await sleep(100);
  const L = window.__lastReview;
  window.__bench = { done: true, wallMs: Math.round(performance.now() - t0), counts: L.counts, guideId: L.guideId,
    modelMs: L.groups.filter(g => g.result?.source === "laptop").map(g => g.result.ms),
    verdicts: Object.fromEntries(L.groups.map(g => [g.key, g.result ? `${g.result.finding.verdict}/${g.result.finding.problem}` : "error"])) };
})();
```

## Runs

| Run | Code | Scenario | Wall time | Model calls | Rule / reused | Verdicts | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | 0487d7e (baseline) | A | 44.9 s | 16 (2.5 to 3.3 s each) | 4 / 0 | reference | baseline |
| A2 | 0487d7e (baseline) | A, and B without persistence | 46.3 s | 16 (2.5 to 3.5 s each) | 4 / 0 | 18 of 20 as A1 (noise) | baseline |

| V1-A | V1 first cut | A (store emptied) | 49.6 s | 16 | 4 / 0 | (first run of V1) | as expected: no change for A |
| V1-B | V1 first cut | B | 0.107 s | 0 | 4 / 16 | 20 of 20 as V1-A | B target met |
| V1-C | V1 first cut | guide edited (one comment line added) | 54.3 s | 16 | 4 / 0 | none reused | invalidation works |
| V1-A2 | V1 after review fixes | A (new prompt version, store not used) | 49.5 s | 16 | 4 / 0 | (reference for B2) | |
| V1-B2 | V1 after review fixes | B | 0.109 s | 0 | 4 / 16 | 20 of 20 as V1-A2 | **accepted** |
| V1-D | V1 after review fixes | B with one saved entry set to null and one malformed entry added, opened in a second tab | | 1 ("Home", re-checked) | 4 / 15 | malformed entries ignored, 0 errors | validation works |
| probe | V1 | one call, same string, guide 3,476 vs 450 characters (3 each) | 3.0 to 3.9 s vs 1.5 to 1.9 s | | | | prompt processing is about 45% of each call |

Gap: almost all of the time is model calls (16 x about 2.8 s). Scenario B was
4.6 times over its target because nothing was reused after a reload.

### V1: verdicts kept across reloads (accepted)

Hypothesis: a repeat review waits only because verdicts are lost on reload.
Change: src/review/check.js keeps verdicts in localStorage ("stet.verdicts"),
keyed by JSON of: a hash of the prompt code, schemas, starter wording guide and
Indonesian rules; the app; the guide id captured when the prompt was built; the
element kind; the context; the text (Indonesian keys: where it ran, the cloud
model for cloud verdicts, the register, the English original). The screen name
is left out on purpose (the 0.5 decision). Entries are validated on load,
merged with what other pages saved, kept most-recently-used last and capped at
500, and flushed on pagehide.

An independent review (ECC code-reviewer agent, given the diff and the rule
"never reuse a verdict when a prompt input differs") found seven issues in the
first cut. All seven were fixed before V1-A2:
1. The Indonesian rules text was not in the version hash.
2. The guide id was read after the model call, so an edit during a review could label an old verdict as new.
3. The cap dropped entries by insertion order, and two pages overwrote each other.
4. A reload within 300 ms lost the last verdict, and a full store saved nothing.
5. Malformed saved entries could be reused.
6. Newlines in strings could make two keys collide.
7. Cloud verdicts did not carry the model name.

Result: B from 46.3 s to 0.11 s with identical verdicts; A unchanged (45 to 54 s
across runs, run-to-run noise); counter 0 throughout.

### V2: a shorter starter guide (rejected)

Hypothesis: the guide costs about 1.4 s of each 3 s call (probe), so a guide a
third shorter takes scenario A to roughly 38 to 42 s.

Change: data/eval/wording-guide.md compacted from 2,784 to 1,947 characters,
same rules. src/guide.js gained a migration: a guide written from a brief gets
its fixed part (from "## Problem kinds") replaced by the current starter's, and
keeps the owner's voice, terms and filler. A hand-edited guide is left alone.

| Run | Code | Scenario | Wall time | Model calls | Problems on "new" | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| V2-eval | V2 guide | English laptop eval, 150 items | median 3.4 s per call | 150 | caught 94.4%, false alarms 1.7%, 0 errors | passes the frozen limits |
| V2-A1 | V2 guide | A | 108.2 s | 16 (3.5 to 9.7 s each) | 11 | laptop was slow at the time, not comparable |
| V2-B1 | V2 guide | B | 0.102 s | 0 | 11 | |
| V2-A2 | V2 guide | A | 88.3 s | 16 (4.0 to 7.4 s each) | 10 | laptop still slow |
| ctrl-A | old guide, restored by the migration (guide id back to 1y3c5tt) | A, right after V2-A2 | 51.6 s | 16 (2.8 to 4.2 s each) | 8, exactly the planted ones | same-conditions control |
| V2-A3 | V2 guide | A, right after ctrl-A | 47.1 s | 16 (2.5 to 3.3 s each) | 13 | **rejected** |

Result: about 9% faster than the control run next to it, which is inside the
run-to-run spread of scenario A (45 to 54 s). It added five false alarms on the
sample screen: "Home" (vague_link), "Choose a client" (inconsistent_term),
"Add line item", "Save draft" and "Close" (vague_button). The control run found
exactly the eight planted problems. The eval did not catch this because it
checks against the starter guide, not a guide written from a brief. Lesson: a
guide change needs the review-page check as well as the eval.

Kept: the migration in src/guide.js. It moved the saved brief guide to the V2
fixed part and back to the original byte for byte (guide id 1y3c5tt again), so
a future starter change reaches guides written from a brief. The V2 eval result
is kept in data/eval/results/archive/ as the record of the rejected variant.

Stopped at the best measured admissible variant, V1.

## Rollback

Revert the V1 commit. Saved verdicts under "stet.verdicts" are then ignored;
clearing site data removes them.
