# Stet build plan: phases and slices

Source: the Stet build plan doc, copied 2026-11-25.

## Goal and guardrails

Stet must be submitted by Tue Dec 1, 05:00 WIB. The working target is Mon Nov 30, 20:00 WIB, which leaves nine hours of margin.
Stet is a reviewer for the interface text of apps built by AI coding agents. It checks every piece of text on the laptop, catches generated filler and word-for-word Indonesian, and hands back one fix prompt for the agent.

### Rules for every slice

These come from the official rules and the FAQ. A slice that breaks one is not done.
- Every AI call goes through Firebase AI Logic. No other AI API, and no scripted or mocked answers in the shipped app.
- The laptop model and the cloud model are both used, and the app shows which one ran.
- App Check is on. No keys, secrets or debug tokens in the repo.
- The repo is public with an Apache 2.0 license and run instructions.
- The app works in English, is free to use, and stays online until judging ends, around Dec 17 WIB.
- Only made-up or public text appears in the repo, the demo and the video.

### How to read a slice

A slice is one thin piece that works end to end and ends in something you can click. Tick it when its "Done when" line is true.
- (you) marks work only you can do.
- (parallel) marks a slice a second agent can build at the same time as the slice before it, because the two touch different files.

### One prompt for any slice

Save this plan in the repo as PLAN.md. Then send this to Claude Code, changing only the slice name.

```
Read PLAN.md in this repo. Build slice <number and name> only.

Rules:
- Follow the "Rules for every slice" section of PLAN.md.
- Follow the Firebase docs rather than memory for all SDK APIs:
  https://firebase.google.com/docs/ai-logic/hybrid/web/get-started
- Do not start any other slice, and do not refactor code this slice does not need.
- If the slice needs something I must do by hand, list it and wait.

When the slice's "Done when" line is true, run it in my Chrome, then report:
what you built, how to see it, what you could not verify, and one commit message.
Then tick the slice in PLAN.md.
```

## Plan at a glance

Seven phases, one per day. Each phase ends with something that works and a test that says whether to move on.
| Phase | Day (WIB) | Ends with | Exit test |
| --- | --- | --- | --- |
| 0. Prove it | Tue Nov 24 | A go or no-go on Stet | The laptop model meets the accuracy bars in English, and we know where the Indonesian check runs |
| 1. Core review loop | Wed Nov 25 | The sample app reviewed on the laptop | Press Review with Wi-Fi off and see pinned findings |
| 2. Cloud parts and fix loop | Thu Nov 26 | The whole loop in English | Brief, guide, review, fix prompt, re-check and standing rule all run |
| 3. Indonesian and your own text | Fri Nov 27 | Stet working on your own prototype's text | Your own language files produce findings and a usable fix prompt |
| 4. Ship-ready | Sat Nov 28 | A link anyone can open | It works in a fresh Chrome profile, with and without the laptop model |
| 5. Proof and story | Sun Nov 29 | Video and write-up finished | Video under 3 minutes is uploaded, and the README has measured numbers |
| 6. Submit | Mon Nov 30 | Submitted on Devpost | Submission confirmed by 20:00 WIB |
If a phase misses its exit test by the end of its day, use the cut order below before borrowing time from the next phase.

## Phase 0: Prove it (Tue Nov 24)

Today decides whether Stet goes ahead and where the Indonesian check runs. The detailed prompts for 0.1 and for 0.2 to 0.4 are in our chat; use those here in place of the short prompt above.

- [x] **0.1 Firebase base and hybrid check**
  - Result (2026-11-25): all four modes answered on the owner's Chrome. Laptop 0.5 to 0.8 s, cloud 1.2 to 1.9 s, one at a time. Cloud-first fell back to the laptop when App Check rejected the cloud call.
  - Build: the Firebase project, the app shell in ./stet, App Check in debug mode, one module that every AI call goes through, and a /check page with a Run button for each of the four modes.
  - Done when: /check shows one reply from the laptop model and one from the cloud model, each labelled with where it ran.
  - (you) Create the Firebase project, turn on AI Logic, register the debug token, and join the hackathon on Devpost.

- [x] **0.2 Test data**
  - Result (2026-11-25): data/eval/en-strings.json (150: 60 ok, 90 problems in 8 kinds, 20 of them generated filler), data/eval/id-pairs.json (80: 40 ok, 40 problems in 4 kinds), wording-guide.md, id-rules.md, and id-pairs.csv for review. `npm run eval:data` checks counts and schema and rewrites the CSV.
  - Build: 150 English interface strings with correct answers, 80 English and Indonesian pairs with correct answers, a wording guide, and the Indonesian rules.
  - Done when: the files exist and the pairs are also exported as a spreadsheet.

- [ ] **0.3 Check the Indonesian answers (you)**
  - Do: read the 80 pairs and correct every answer you disagree with.
  - Done when: you trust each "correct" translation in the file.

- [ ] **0.4 Run the accuracy test**
  - Build: an /eval page that runs the English check, the translation check and screen reading, on the laptop and in the cloud, and writes a results file.
  - Done when: the results file shows accuracy, false alarms and speed for each check.
  - Status (2026-11-25): English and screen reading measured; translation waits for 0.3. Files in data/eval/results/ (earlier runs in results/archive/). One run per mode so far.

    | Check | Laptop | Cloud | Bar |
    | --- | --- | --- | --- |
    | English problems caught | 81.1% | 98.9% | at least 80% |
    | False alarms on good English | 1.7% | 0% | at most 10% |
    | Generated filler caught | 95% | 100% | at least 70% |
    | Right problem kind | 72.2% | 96.7% | none |
    | Median time per string | 2.9 s | 1.5 s | none |
    | Laptop speed | 20 strings a minute | not comparable (spaced for quota) | at least 60 |
    | Screen text read from a screenshot | 98.5% | 98.5% | none |

  - Repeat run (laptop, one string per call): 80.0% caught, 0% false alarms, 95% filler, 19.7 strings a minute. Only 4 of 150 verdicts changed between the two runs, so the numbers are stable.
  - Batching test (5 strings per call):

    | English, 5 per call | Laptop | Cloud |
    | --- | --- | --- |
    | Problems caught | 70% | 93.3% |
    | False alarms | 10% | 0% |
    | Speed | 14.9 strings a minute | 61.3 strings a minute (with quota spacing) |
    | Failed or truncated replies | 5 of 150 | 5 of 150 (one 500 "high demand" batch) |

    With an array schema the laptop model dropped later items (73 of 150 missing); with one required key per item it answered all but became slower and less accurate than one string per call. Batching helps the cloud (5 times fewer requests) and does not help the laptop.
  - Method notes: the "placeholder" problem kind was renamed "leftover_text" after the first run, because it collided with the "placeholder" element kind and caused 5 of 8 false alarms. That fix was made after seeing results on this same data, so the numbers are slightly optimistic. Cloud runs are spaced 4.5 s apart because the free Gemini tier returned 429 quota errors at 77 requests a minute.

- [ ] **0.5 Go or no-go (you and Claude)**
  - Decide: go ahead as planned or simplify, and run the Indonesian check on the laptop or in the cloud.
  - Done when: both decisions are written in the decisions table under Risks.

### Bars for the go or no-go

| Check | Bar |
| --- | --- |
| English problems judged correctly | At least 80% |
| False alarms on good English text | At most 10% |
| Generated filler caught | At least 70% |
| Indonesian translations judged correctly | At least 75% |
| False alarms on good translations | At most 15% |
| Speed on the laptop | ~~At least 60 strings a minute~~ Changed 2026-11-25: one screen of about 15 strings checked in under 60 seconds, with pins appearing as each string is checked |
These bars are my judgment of what makes the product feel trustworthy. They are not a hackathon requirement.

## Phase 1: Core review loop (Wed Nov 25)

By tonight, pressing Review on the built-in sample app pins real findings from the laptop model, with Wi-Fi off.

- [x] **1.1 Sample app**
  - Result (2026-11-25): /sample/ with #/new, #/list and #/settings. All text lives in src/sample/strings.js; every element carries data-s (key) and data-kind. 20, 22 and 18 text elements per screen (56 unique keys), none empty. No AI calls in the sample.
  - Build: three deliberately sloppy invoicing screens inside Stet (new invoice, invoice list, settings), in English, with every piece of text addressable.
  - Done when: you can click through the three screens at /sample.

- [x] **1.2 Collect the text**
  - Result (2026-11-25): /review/ shows the sample app in a frame with a panel beside it. src/review/collect.js reads every [data-s] element (placeholders from the attribute named by data-attr) and groups repeats by key; the panel lists kind, text, key and a repeat count, re-reads on every screen change, and outlines the matching elements when a row is pointed at. Checked in Chrome against src/sample/strings.js: new 20 of 20, list 22 pieces in 18 rows (Paid x2, More x4), settings 18 of 18; same order as the screen, 0 text and 0 kind mismatches. Negative check: removing data-attr from a placeholder makes its text empty, which the comparison flags.
  - Build: Stet reads every label, button, message and placeholder on the current screen, with the kind of element each one is.
  - Done when: a list of every string and its kind shows beside the screen.

- [ ] **1.3 Check on the laptop** (built; the Wi-Fi-off "done when" is still open)
  - Result (2026-11-25, online, laptop model already loaded): Review on /review/ runs plain rules (src/review/rules.js), then verdicts reused by element kind and text, then the laptop model in Laptop only mode, one string at a time with progress. It uses the exact Phase 0 English prompt and schema, now shared in src/english-check.js (checked identical to the committed version). Times: new 47 s for 20 strings (17 on the laptop), list 32 s for 18 (12 on the laptop, 3 reused, 3 by rule), settings 39 s for 18. Every model reply reported on_device; 0 errors.
  - Found as intended: filler headings and subtitles, "Instantiate", "Persist", "Toggle boolean", the blaming error, "No data", all leftover text and vague buttons and links. Missed: "Customer email" next to "Client", and "Bill footer" (inconsistent terms need the whole screen, not one string). False alarms: "Danger zone" and the delete warning on settings. One rewrite kept "seamlessly". These go to the tick boxes in 1.4.
  - Rule findings carry no rewrite yet; 2.2 (fix prompt) must ask for one.
  - First laptop call after Chrome loads the model took 19 s against about 3 s after that, so the page now makes one small laptop call on load. Measured again in the 1.4 run: that call took 18.3 s on page open, before Review was pressed, and the review after it ran at about 3 s per string.
  - Gate: scripts/check-rules.mjs runs the rules over the 150 Phase 0 English strings before every build: 23 of 90 problems caught with the right kind, 0 false alarms, 11 control cases. Mutation-proved: an over-broad rule (/\bsave\b/) turned it red with 4 failures, including false alarms on "Save changes" and a save error message; restored, green. The rules were written with this data in view, so the hit rate is optimistic.
  - Build: each string is checked against a fixed starter guide by the laptop model only. It returns a verdict, how serious it is, and a suggested rewrite. Strings are checked one at a time, with progress shown.
  - From the 0.5 decision: before the model, plain rules catch the obvious cases (leftover text such as "Lorem ipsum" or "TODO", and a fixed list of vague button labels) without a model call, and a string already checked on another screen reuses its verdict. Pins appear as each string is checked. Target: one screen of about 15 strings in under 60 seconds.
  - Done when: with Wi-Fi off, Review finishes on a sample screen and returns findings.
  - OPEN from 0.1: the Wi-Fi-off test was not run yet. The docs do not say whether on-device calls through the SDK need the network (for example for the App Check token). Run it before building 1.3 on top of it. Remember: the tab must already be open, because there is no offline cache yet (planned for 2.5).

- [x] **1.4 Pins and findings panel**
  - Result (2026-11-25): /review/ shows numbered pins over the app (a layer above the frame; the app's own page is not changed) and a Findings list with tick boxes, numbered in screen order, every finding ticked when it arrives. Each finding shows the problem, seriousness, text, kind, a rewrite or note, and where it ran ("On this laptop: plain rule", "same text checked earlier" or the model time). Unticked findings show a dashed pin. Clicking a pin focuses its finding; pointing at a finding outlines its elements. The full text list from 1.2 moved into a folded "All text" section.
  - Checked in Chrome on the list screen (48 s, 6 findings, 9 pins because "More" appears 4 times): pin count equals the occurrences of the listed findings, every pin number and tick state equals its row's, before and after unticking and reticking (count read "6, 5 ticked" then "6, 6 ticked"), and every visible pin sits on its element's top-left corner (0 px off). With the frame shortened to force scrolling, pins 1 to 4 show at the top and 5, 5, 5, 5, 6 at the bottom, always inside the frame.
  - Laptop variance: the toast "Success! Your amazing changes..." was flagged in the 1.3 run and passed in this one.
  - Build: findings pinned on the screen where they appear, a panel listing them with tick boxes, and a label showing each one ran on the laptop.
  - Done when: ticking and unticking works, and the pins match the list.

- [x] **1.5 The seam (parallel)**
  - Result (2026-11-25): /review/ has a top bar with "Left this laptop: N" and a panel split into "On this laptop" (the review) and "Sent to the cloud" (each prompt that left, with time, purpose and size). src/seam.js counts two ways: src/ai.js records every call the SDK did not report as on-device (and every failed call in a mode that could reach the cloud), and a PerformanceObserver records every request the page made to another host, independently of src/ai.js. N is the larger of the recorded calls and the model API requests the browser saw; if the browser saw more, a warning shows.
  - Checked in Chrome: after warm-up and a full review of the settings screen (49 s, 15 laptop calls), the counter read 0, with 0 recorded and 0 model API requests seen. Positive control: one Cloud only call through src/ai.js made it 1 (1 recorded, 1 seen, listed in "Sent to the cloud"). Independence check: one empty request to the model API host that bypassed src/ai.js made it 2 and showed the warning.
  - Seen on the way, for the offline question: during the laptop review the page made no App Check token request. The only outside requests were www.google.com x2 and www.gstatic.com x1 at page load, most likely the reCAPTCHA script App Check loads, which an offline cold start would lack (2.5).
  - Build: the page frame with an "On this laptop" area, a "Sent to the cloud" area, and a counter of what has left the laptop.
  - Done when: the counter is visible and reads zero after a review.

## Phase 2: Cloud parts and the fix loop (Thu Nov 26)

By tonight the whole English loop runs: brief, guide, review, fix prompt, re-check and standing rule.

- [x] **2.1 Wording guide from a brief**
  - Result (2026-11-25): a "Wording guide" box on /review/. The two-line brief goes to the cloud (Cloud only) and nothing else does; the seam lists it as "the voice brief". The cloud model returns only the parts that depend on the app (3 to 5 voice rules, up to 8 preferred terms, up to 12 filler phrases, as JSON); src/guide.js puts them in front of the starter guide's fixed sections (problem kinds, seriousness, not a problem), so problem names still match the review schema. The guide is saved in the browser, shown in an editable box with a size limit of 6,000 characters (it is sent with every laptop check), and can go back to the starter guide. Laptop verdicts are cached per guide, and changing the guide clears the findings on screen.
  - Preferred terms are a plain rule, read from the guide's "| Use | Not |" table, because the laptop model ignored them: under a guide saying client, never customer, "Customer email" still passed. As a rule it is caught with the rewrite "Client email".
  - The cloud model listed the owner's own word as one to avoid ("bill, not invoice" for an invoicing brief), which flagged "Invoices". Words the brief uses (and their forms, "invoice" for "Invoicing") are now dropped from the "not" lists, except words the brief rules out ("never customer"). A first prompt fix ("never list the brief's words") made the cloud drop "customer" too; it was replaced.
  - Checked in Chrome, new screen: under the brief guide, "Customer email" caught by rule (44.7 s for 20 strings, every result carrying the new guide's id, which differs from the starter's); after deleting the "bill" row by hand, "Invoices" no longer flagged and the guide id changed (56.7 s). After the two fixes, the same brief gave "client: customer, consumer, buyer" and "bill: charge" (one cloud run, 2.1 s). The guide survives a reload; "Back to the starter guide" clears it.
  - Gate: check-rules now also checks the term table reader, 6 term cases and 6 brief cases. Mutation-proved twice: without word boundaries "Catalog index" became "Catasign index" (red); without the "never X" exception "customer" counted as the owner's word (red); restored, green.
  - Build: a two-line voice brief goes to the cloud model, which writes the guide: tone rules, preferred terms, and the signs of generated filler. The guide is saved, shown and editable.
  - Done when: a new brief produces a guide, and the next review uses it.

- [x] **2.2 Fix prompt**
  - Result (2026-11-25): "Make fix prompt" under the findings turns the ticked findings into one prompt with a Copy button; the prompt can be edited before copying and follows tick changes. One line per finding: `- src/sample/strings.js, key "new.submit" (button, screen "new"): "Submit" -> "Send invoice" (Vague button)`. Findings without new text (plain-rule findings) get one from the laptop model, with the guide, the other text on the screen and the key as hints. Every candidate new text (the review's or the rewrite's) is checked against the plain rules and refused if it is empty, unchanged, still breaks a rule, or is one of the guide's examples with no word from the screen; then the laptop model is asked once more. A line that still has no good text shows "(write the new text here)" and the status says so.
  - The laptop model copied the guide's example "Read the refund policy" for "Click here" three runs in a row, and invented an "Add client" button for "No data". Fixed by giving links their destination and messages the label above them as context (src/review/collect.js; the review prompt gets them too), and by refusing copied examples.
  - Checked in Chrome on the new screen with the brief guide: 8 lines, each parsed back to file, key, old and new text; the old text and kind of every line match src/sample/strings.js, the keys match the ticked findings in order, 0 missing; 3 new texts written on the laptop in 10.0 s. Unticking one finding made it 7 lines, reticking 8. Copy with a real click reported "Copied." (clipboard content not read back).
  - Final new texts: "Create invoice", "Invoice clients easily and streamline your business.", "Client email", "email address", "Invalid amount. Please enter a numerical value.", "No line items added yet. Add a line item to bill your client.", "Go to invoice creation", "Send invoice". Weak spots left for the user to edit: "Invalid amount" still sounds like blame, and the link text guesses its purpose.
  - Speed: the review of the 20-string new screen took 56 to 68 s in these runs, at or over the 60 s bar.
  - Gates: scripts/check-fix-prompt.mjs (every line names file, key, old and new text; lines kept in order; missing counted). Mutation-proved: dropping the old text turned it red (3 failures); restored, green. check-rules gained 5 example cases; mutation-proved (copiedExample always true: red, 2 failures; restored, green).
  - Build: the ticked findings become one prompt for a coding agent, with a copy button.
  - Done when: every line of the prompt names the place, the old text and the new text.

- [x] **2.3 Re-check**
  - Result (2026-11-25): "Apply to sample" reads the fix prompt as it stands in the box (edits included) with parseFixPrompt, the way an agent would follow it, and changes the sample's text. The sample keeps changed text by key in its own browser storage ("lumbung.text"), standing in for an edited src/sample/strings.js; "Reset sample text" clears it. A line whose old text is not what the app shows is not applied and is listed. The sample reloads, Stet reviews the screen again (unchanged text reuses its verdicts, so only changed text goes to the laptop model), and each earlier finding is marked Resolved (the text changed and the new text has no finding) or Still open (not changed, or the new text is still a problem), with a count of new findings on text that was fine before.
  - Checked in Chrome on the new screen: 9 findings, one unticked, 8 lines in the prompt, one line's old text deliberately broken, so 7 applied. The app showed the new text for exactly those 7 keys and the original text for the rest. Stet reported 6 of 9 resolved and 3 still open (the broken line, "not applied"; the subtitle, whose new text was still filler; the unticked link), and the count computed independently from the second review was also 6. The re-check took 27 s (12 verdicts reused, 7 laptop calls). Reset put all 20 strings back to src/sample/strings.js.
  - Gate: check-fix-prompt now also checks the round trip (build the prompt, read it back: same keys, old and new text, quotes included; a line without new text and a stray line skipped). Mutation-proved: without unescaping quotes it went red; restored, green.
  - Build: an "Apply to sample" button changes the sample app's text the way the agent would. Stet then reviews again and marks each finding resolved or still open.
  - Done when: the resolved count is right after you apply only some of the fixes.

- [x] **2.4 Pattern and standing rule**
  - Result (2026-11-25): a "Pattern and standing rule" part in the "Sent to the cloud" area. It shows the counts per problem kind from the latest first review of each screen (re-checks are not counted) and, folded, the exact prompt to be sent: a fixed template plus those counts (src/review/pattern.js, which keeps only known kinds with whole positive counts). "Send these counts to the cloud" (Cloud only) returns a two-sentence cause and one rule for AGENTS.md or CLAUDE.md, shown in an editable box with a Copy button.
  - Checked in Chrome after a review of the list screen (58 s): the prompt shown equals the prompt sent; the ledger lists "problem counts only, 1,030 characters", the prompt's length; the counter reads 1 with 1 model API request seen. A scan of the sent prompt for every sample string matched only "Failed", which is the template's own phrase "what failed", not app text. Cloud reply in 11.4 s; rule: "Write specific, action-oriented interface text that clearly states what a button does, where a link goes, or what a message means, avoiding all marketing filler or placeholders. Example: Use 'Save Profile' instead of 'Click Here'."
  - Gate: scripts/check-pattern.mjs (dirty counts with text, strings, fractions, negatives and made-up kinds keep only the 2 clean entries; the prompt is exactly template plus payload; none of the sample's 35 strings of 8 or more characters appears; the leak scan catches a planted string). Mutation-proved: letting any value through turned it red; restored, green.
  - Build: the count of each problem kind goes to the cloud model, which returns a short cause note and one rule for the agent's instruction file. Stet shows exactly what will be sent before sending it.
  - Done when: the counter shows that only counts left the laptop, and the rule appears with a copy button.

- [ ] **2.5 Offline behaviour (parallel)** (built; the Wi-Fi-off "done when" runs with the 1.3 test)
  - Result (2026-11-25): the top bar shows "Online" or "Offline: laptop steps still work". A cloud step pressed with no connection (write the guide, send the counts) says it will be sent when the connection is back, disables its button so it queues once, and goes out on the browser's "online" event. Cloud errors from a lost connection read "the cloud could not be reached". The saved guide is read from the browser, so it is reused offline. The hosted build registers public/sw.js (not in development): same-origin GET requests go to the network first and fall back to the kept copy; requests to Google are never cached.
  - Checked: in the owner's Chrome, with the browser's online state set to offline, pressing "Write the guide" sent nothing (ledger 0) and showed the waiting message; on "online" it sent the brief by itself (ledger 1, guide written in 3.5 s). A first attempt failed because the waiting step used the click event's target, which is gone by then; fixed. Service worker, in a separate isolated Chrome on the production build (vite preview): after one online visit, with the preview server stopped and the network emulated offline, /review/ reloaded with the sample and its 20 strings, while an uncached address failed. A first offline check was not valid (network emulation does not cover the service worker, which still reached the server) and was redone with the server stopped.
  - Build: with no connection, the cloud steps wait with a clear message, the laptop steps keep working, and a saved guide is reused.
  - Done when: a full review and fix prompt work with Wi-Fi off, using a saved guide.

## Phase 3: Indonesian check and your own text (Fri Nov 27)

By tonight Stet reviews the text of your own bilingual prototype, and not only the sample.

- [x] **3.1 Indonesian sample**
  - Result (2026-11-25): src/sample/strings.js has an Indonesian version of all 56 keys, in the "Anda" register, with 13 planted mistakes listed in ID_PLANTED (5 wrong sense, such as "Rumah" and "Dekat"; 4 word for word; 2 wrong verb form; 2 mixed address). The sample has a language switch (kept across reloads); each element carries its English original in data-en. Changed text is kept per language. Checked in Chrome: on all three screens, in both languages, every one of the 60 elements shows its strings.js text, every data-en matches, and the review panel follows the switch.
  - Build: the sample app gets a language switch and a word-for-word Indonesian version.
  - Done when: switching the language changes every string on all three screens.

- [x] **3.2 Translation check**
  - Result (2026-11-25): on an Indonesian screen, Review runs the Phase 0 translation prompt (moved to src/translation-check.js, checked identical) on each string with its English original. Where it runs follows decision 2: Sealed project on the laptop, with the measured caveat in the progress line; Open project in the cloud, after a list of every Indonesian string and its English original is shown and approved. Findings show the better translation and the plain-English note; the better translation goes into the fix prompt, which then names the Indonesian value.
  - Checked in Chrome on the Indonesian new screen (7 planted mistakes): Sealed, laptop: 5 of 7 caught (4 with the right kind), "Rumah" -> "Beranda" and "Dekat" -> "Tutup" with notes ("Rumah means house..."), 3 false alarms, 124 s, counter 0. Open, cloud: the approval list showed 20 pairs and nothing had left before approval; then 7 of 7 caught with the right kind, 1 false alarm ("Klik di sini"), 1 call failed and was reported as not checked, 90 s, counter 20 (the 20 approved pairs).
  - A first Open run would have reused the laptop's verdicts from the cache; Indonesian verdicts are now cached by where they ran.
  - Build: each Indonesian string is compared with its English original and its kind of element. The check returns a verdict (wrong sense, word for word, wrong verb form, or mixed formal and informal address), a better translation, and a plain English note on what the bad one says. It runs where Phase 0 decided.
  - Done when: the planted mistakes in the sample, such as "Rumah" and "Dekat", are caught and explained.

- [ ] **3.3 Bring your own text** (built; waiting for the language files of one of your own prototypes)
  - Result (2026-11-25): /files/ takes an English and an optional Indonesian language file (JSON, flat or nested) or a pasted list. src/files/parse.js flattens keys ("checkout.card.label"), pairs the two files by key, reports keys missing on either side, and guesses the element kind from the key's words. The same checks run (English check and plain rules; the translation check where decision 2 says), with tick boxes and a fix prompt in which every line names its own file and key.
  - Checked in Chrome with two small made-up files (6 keys, 11 checks, Sealed): 9 findings in 55 s, counter 0, and a fix prompt with lines such as `en.json, key "checkout.pay_button" (button): "Submit" -> "Pay now"` and `id.json, key "nav.home" (nav): "Rumah" -> "Beranda"`. The laptop flagged three fine Indonesian strings ("Pembayaran", "Bayar", "Nomor kartu"), in line with its measured false alarms.
  - Gate: scripts/check-files.mjs (flattening, pairing, missing keys, 11 kind guesses, pasted lists). Mutation-proved: an unanchored nav pattern made "report.table" a nav item (red); restored, green. A first control ("contact") could never fail and was replaced.
  - Build: drop in two language files (English and Indonesian, JSON) or paste a list of strings. The same review and fix prompt run on them, and the fix prompt names each file key.
  - Done when: the language files from one of your own prototypes produce findings and a fix prompt you would send.

- [x] **3.4 Sealed and Open projects**
  - Result (2026-11-25): a Sealed/Open setting on /review/ and /files/ (src/project.js, kept in the browser, Sealed by default). Sealed: checks of the app's text use Laptop only, and without the laptop model Stet explains why it cannot run. Open: Laptop first, so the cloud is used when the laptop model is missing; before any app text goes to the cloud, the exact list is shown and must be approved.
  - Checked in Chrome on /files/ with the browser's laptop model made to report "unavailable" and a pasted list of 3 strings: Sealed refused with the explanation and sent nothing; Open showed the 3 strings for approval with nothing sent, then checked all 3 in the cloud (each reported in_cloud) and the counter read 3.
  - Build: one project setting. In a Sealed project the text is only ever read by the laptop model. In an Open project the laptop model is tried first and the cloud is used when it is missing.
  - Done when: in a browser without the laptop model, an Open project works through the cloud and a Sealed project explains why it cannot run.

- [x] **3.5 Ask the cloud for a better rewrite (only if time)**
  - Result (2026-11-25): each finding on /review/ has "Ask the cloud for a better rewrite". In a Sealed project it explains that the text never goes to the cloud. In an Open project it first shows the exact prompt (only that one string from the app, with its kind, screen and problem, and the guide), and sends it on a second press (Cloud only). The ledger names the string. "Make fix prompt" keeps a rewrite that came from the cloud.
  - Checked in Chrome on the new screen: Sealed showed the explanation and sent nothing; Open showed a 3,274-character prompt containing "Click here", the ledger then listed `one string you chose: "Click here", 3,274 characters. Ran: cloud.`, the counter read 1, and the new text was "View invoice" (2.0 s). A note from a Sealed press stayed in place after switching to Open; switching the setting now clears it (checked by reading the handler, not yet re-run live).
  - Build: a button on each finding that sends that one string to the cloud for a better rewrite, after showing what will be sent.
  - Done when: the counter shows exactly the strings you sent.

- [ ] **3.6 Scan a running app (owner's choice, 2026-11-26)**
  - Why: language files are hard to find for someone who builds with a coding agent, and often there are none because the text sits in the code. The owner expected "open my app, scan it".
  - Build: a "Scan with Stet" bookmarklet on /files/. The user drags it to the bookmarks bar once, opens their own app (localhost or deployed) on any screen and clicks it. It reads the visible interface text with each element's kind (button, link, nav, heading, label, placeholder, column title, error, status, text) and a little context (the field a placeholder belongs to, a link's path), skips data that is not interface text (numbers, table cells, typed values, code), and opens Stet's /files/ in a new tab. The text travels by postMessage straight to that tab, only to Stet's own origin; it is not sent anywhere else and not put in the address. Stet checks the message (shape, kinds, at most 300 strings of at most 300 characters) and loads it; nothing runs until Review is pressed, and Sealed/Open apply as for files. The fix prompt names the page and element and tells the agent to find each string in the code.
  - Limits: findings are a list, not pins on the user's app; the screen must be open in its own tab (an in-editor preview frame is not read); a site with a strict security policy can block bookmarklets; English only for now (an Indonesian page is refused with a pointer to language files).
  - Gate: scripts/check-files.mjs gains the message check (accepted, rejected, capped) and the page form of the fix prompt round trip. Mutation-proved.
  - Done when: in Chrome, the bookmarklet clicked on the sample's "new" screen loads its text into /files/ and the review finds the eight planted problems; then the same on one of the owner's own apps.
  - Result (2026-11-26): src/scan/bookmarklet.js (the scanner, self-contained so its source becomes the link), acceptScan in src/files/parse.js, the page form of the fix prompt (buildFixPrompt source "page"), the button and steps on /files/, and the home card. Checked in Chrome by clicking the bookmark's own link on the sample's "new" screen: 22 strings arrived (the 20 sample strings plus the "Lumbung" brand and the "Bahasa Indonesia" switch, both real text on that screen), with kinds and context (placeholders name their field, links keep hash routes, the error names its field); Sealed review: 22 checked in 65 s, exactly the 8 planted problems, 0 false alarms, counter 0; the fix prompt lines read like `page 127.0.0.1:5173/sample/, key "label" (label): "Customer email" -> "Client email"` (made before the page name kept its hash route; a later scan showed the page as 127.0.0.1:5173/sample/#/new). Also checked: the minified production link (vite preview), and a cross-origin run (app on port 5173, Stet on 4173). Found and fixed on the way: text inside aria-hidden spans (icon-font words) was read, a javascript: link's code became its context, and hash routes were dropped from link and page names.
  - Gate: 4 mutations (no kind check, no cap, no version check, page head off) each turned the gates red; restored, green.
  - Independent review (ECC security-reviewer agent, given the code, not the conclusions) and what changed: a crafted message could forge lines in the fix prompt through line breaks (acceptScan now flattens white space and control characters, and the fix prompt escapes backslashes and line breaks); a page could pass itself off as another by its title (the address the browser vouches for is now shown beside it, and the app name is filled in only when they match); messages could keep arriving, mid-review too (one scan per tab, none while a review runs, a list over 600 is not read); record ids and tokens in paths and element ids reached Stet (now replaced by ":id" or left out); an email shown as text was read (left out, except in a placeholder); a page cut at 300 strings said nothing (it says so now); the Open approval list now names the app name, screen name and notes that go with each string. New gate scripts/check-bookmarklet.mjs builds the bookmarklet with Vite's production minifier and runs the link in an empty sandbox with a small fake page. 9 more mutations (an outside name, no path scrub, no email filter, no id filter, no origin check, line breaks kept in acceptScan, no length refusal, line breaks or backslashes kept in the fix prompt) each turned a gate red; restored, green. The first id-filter mutation passed until the fake page got an id that looks like a record id.
  - Not changed (found by the review, older than this slice): in an Open project, a check can reach the cloud without approval if the laptop model disappears in the middle of a run, and "Make fix prompt" in an Open project without the laptop model sends up to 25 other strings as context. Also: an app that sends Cross-Origin-Opener-Policy, or blocks javascript: links with a strict security policy, cannot use the bookmarklet.
  - After the review fixes (2026-11-26): re-run in Chrome on the development server, 22 strings, the 8 planted problems, counter 0. Then deployed (by the owner) and checked on the hosted site: the live /files/, home page and files bundle match dist byte for byte, /eval/ answers 404, and the bookmark points to https://stet-hybrid-ai-2026.web.app. The real path, the sample app on localhost scanned into the hosted Stet: 22 strings arrived, Sealed review on the laptop in 87.9 s (the model's first run on that origin), 7 of the 8 planted problems, counter 0. Missed: "Customer email". Cause, not in the scan: the guide written from the brief on the hosted site lists client / "consumer, buyer" but not "customer", because the brief itself says "owners bill customers" and usedInBrief drops any word the brief uses, so the term rule never fires. The local guide happened to keep "customer" (it was written from a different brief, "...never customer"). Fixed the same day: src/review/rules.js namedInBrief/keepNotWord keep a "not" word when the brief names the app's word ("We call them clients", "we always say client", "call it a bill"); a word the brief only uses is still dropped ("invoice" when "bill" is only a verb). Gate: 7 renaming controls in check-rules; 3 mutations (no naming check, no "call them", always keep) each turned it red; restored, green. Checked with the cloud model on the development server, same brief: the guide now reads client / "customer, buyer, consumer", and the term rule turns "Customer email" into "Client email". A guide already saved in a browser keeps its old terms until it is written again from the brief. Deployed by the owner; all 19 live files match dist byte for byte. On the hosted site, the guide written again from the same brief reads client / "customer, buyer, consumer", and the sample app on localhost scanned into the hosted Stet gave, Sealed on the laptop in 60.1 s, exactly the 8 planted problems ("Customer email" by the term rule), 0 false alarms, counter 0.
  - Still to do: the owner's own app.

## Phase 4: Ship-ready (Sat Nov 28)

By tonight a stranger can open a link and use Stet, with or without the laptop model.

- [ ] **4.1 Hosting and production App Check** (deployed; the fresh-profile check is yours)
  - Prepared (2026-11-25): firebase.json (public dir dist, no-cache for HTML and the service worker, long cache for hashed assets). Found and fixed before any deploy: src/firebase.js aliased import.meta.env, which put the whole env object, the debug token's variable included, into the production bundle; check-dist now fails on that (red on the old file, green on the fix). The bundle had only been in the local, git-ignored dist/.
  - Result (2026-11-26): reCAPTCHA Enterprise API enabled (no billing needed); one score key "Stet web" for stet-hybrid-ai-2026.web.app and .firebaseapp.com only (localhost uses the debug token); registered for the web app in App Check, read back (token lifetime 1 hour). App Check enforcement for Firebase AI Logic was already on and was not changed. The site key went into .env.local without passing through the chat, and is in exactly one bundle file. Deployed with firebase deploy --only hosting; the live review page, home page and ai bundle match dist byte for byte. On https://stet-hybrid-ai-2026.web.app/review/ in the owner's Chrome: the laptop model loaded (2.8 s), "Write the guide in the cloud" ran in the cloud in 2.6 s with enforcement on, the counter showed 1, and the browser held an App Check token valid for about an hour.
  - Still to do: open the link in a fresh Chrome profile.
  - /eval/ was in the first deploy (anyone could start its 150 cloud calls); since 2026-11-26 it is left out of the hosted build (vite.config.js) and served by the development server only. The home page links to the accuracy results in the README instead.
  - Build: deploy to Firebase Hosting, with App Check using a production provider for the hosted address and the debug provider only on your machine.
  - Done when: the hosted link works in a fresh Chrome profile.

- [ ] **4.2 Remote Config (parallel)** (built; the console step is yours)
  - Result (2026-11-25): src/config.js reads cloud_model, daily_cloud_cap and min_severity from Firebase Remote Config, with defaults in the code (gemini-3.5-flash-lite, 60, low) so Stet works before a template exists and offline. src/ai.js takes the cloud model name from it and checks the cap before any call that may reach the cloud; the count is kept per browser per day. Over the cap, cloud steps say "Today's cloud limit for this browser is reached (60 calls). Laptop steps keep working; the cloud steps are back tomorrow." Findings less serious than min_severity are not shown.
  - Checked in Chrome: the fetch succeeded with no template published (values = defaults); with the day's count set past the cap, "Write the guide" showed the message and nothing was sent (ledger 0, 0 model API requests).
  - Limit: the cap is counted in the browser, so it slows ordinary visitors but is not a hard limit; App Check and the project's quota are.
  - Published (2026-11-25, owner's yes): remoteconfig.template.json via `firebase deploy --only remoteconfig`; read back from the project: cloud_model = gemini-3.5-flash-lite, daily_cloud_cap = 60, min_severity = low.
  - Still to do (you, in the Firebase console): change daily_cloud_cap and confirm the app follows without a deploy (within a minute in development, an hour on the hosted build).
  - Build: the cloud model name, the daily usage cap for each visitor, and the seriousness threshold all come from Remote Config.
  - Done when: changing the cap in the Firebase console changes the app without a new deploy.

- [ ] **4.3 Saved work** CUT (owner's decision, 2026-11-25, as the cut order allows): guides, the project setting and the daily count persist in the browser; Firestore would add a database, sign-in and rules to set up and protect for little demo value.
  - Build: guides, standing rules and counts are saved to Firestore for each visitor. Text from a Sealed project is never saved to the cloud.
  - Done when: a guide survives a reload, and Firestore holds no app text for a Sealed project.

- [x] **4.4 First run and the no-model path** (the usage-cap message came with 4.2)
  - Result (2026-11-25): the first page explains the laptop model in two sentences, shows its state in plain words (ready, not downloaded, downloading, unavailable, unsupported), offers "Download the laptop model" with a progress bar when Chrome can download it (only from the button: browsers require a click), says what happens without it (Open projects use the cloud after approval; Sealed projects wait), and leads to "Review the sample app" or "Review your own text".
  - Checked in Chrome: from opening the first page to the first findings pinned on the sample (4 pins from the plain rules) took 10.8 s, including the test script's own delays; the laptop model's findings follow over about a minute.
  - Build: a first screen that explains the laptop model, shows the download with progress, and says what happens without it. Add the message shown when the usage cap is reached.
  - Done when: a first-time visitor gets from the landing screen to findings on the sample in under a minute.

- [ ] **4.5 Design pass (you)**
  - Do: type, spacing, pins, panel, and the empty, loading and error states, in light and dark.
  - Done when: no screen looks like a default template.

- [ ] **4.6 Three to five people try it (you)**
  - Do: send the link to designers and builders. Collect one sentence from each and note what confused them.
  - Done when: at least three people have used it and the top confusion is fixed.

## Phase 5: Proof and story (Sun Nov 29)

By tonight the video is uploaded and the repo explains itself. Judges may score from the video and the description alone, so this phase gets a full day.

- [x] **5.1 Accuracy numbers**
  - Result (2026-11-25): the README has an "Accuracy and speed" table (English laptop and cloud, 5-per-call, Indonesian laptop and cloud, screenshot reading) and the method in five lines, from the saved runs in data/eval/results/. The prompts in those runs are the app's prompts (checked identical when they moved to the shared modules), so the English runs were not repeated. The Indonesian rows are marked provisional until the pairs are reviewed (0.3); after that review, run Translation again on /eval/ and update the two rows.
  - Build: run the Phase 0 test again on the final prompts and put the results in the README, with the method in five lines.
  - Done when: the README shows accuracy, false alarms and speed for the laptop model and the cloud model.

- [ ] **5.2 README and repo**
  - Build: what Stet is, how each of the four modes is used and why, which Firebase products it uses, run instructions, and Chrome setup steps checked in a fresh profile.
  - Done when: someone who has never seen the project can run it from the README, and the license shows in the repo's About section.

- [ ] **5.3 Video (you)**
  - Do: record under 3 minutes, in English or with subtitles, with no other companies' logos on screen. Upload it early, because processing can take hours.
  - Done when: the video is public on YouTube and plays to the end.

- [ ] **5.4 Devpost text (parallel)**
  - Build: the description, covering how Firebase AI Logic is used, the features, and who it helps. Add screenshots and the links.
  - Done when: the draft is saved on Devpost with Web (Chrome) selected as the platform.

- [ ] **5.5 First LinkedIn post (you, optional)**
  - Do: a short clip of the Indonesian check and one question for designers.
  - Done when: it is posted, with the link in the first comment.

### Video outline

| Time | What the viewer sees |
| --- | --- |
| 0:00 to 0:25 | Who it is for and the problem: agent-built screens full of filler and word-for-word Indonesian |
| 0:25 to 1:15 | Wi-Fi off. Review runs on the laptop and findings are pinned |
| 1:15 to 1:50 | Switch to Indonesian. "Dekat" is caught and explained in English |
| 1:50 to 2:25 | Fix prompt, re-check, and the standing rule from the cloud |
| 2:25 to 3:00 | The same app without the laptop model, how each mode is used, and the measured numbers |

## Phase 6: Submit (Mon Nov 30)

Submit by 20:00 WIB. Commits made after the deadline are not judged.

- [ ] **6.1 Clean-machine test**
  - Do: in a fresh Chrome profile, open the hosted link, review the sample, review your own files, and repeat with Wi-Fi off.
  - Done when: every step works without touching the code.

- [ ] **6.2 Repo check** (public repo up; license shows once the PR is merged)
  - Done (2026-11-25, owner's yes): public repo https://github.com/dannyysaputra/stet. main was created from the first commit (f846e8b) and everything else is in PR #1 from slice/0.1-hybrid-check (22 commits, mergeable). The history was scanned again just before the push (23 commits, 1.7 MB, 0 hits, input size asserted). GitHub does not show the license yet because main has only the first commit; LICENSE arrives with the PR.
  - Pre-check (2026-11-25): a scan of the whole local history (21 commits, 82 files, 1.7 MB of patches, run through `rtk proxy git` after a first run read compressed output and scanned 0 commits) found 0 Google API keys, 0 env assignments with values, 0 UUID-like tokens, 0 private keys, 0 service-account files, and no .env file ever committed; its positive controls passed. LICENSE (Apache 2.0) is in the repo. No git remote is set.
  - Do: confirm the repo is public, the license shows, no secret is in the history, and the last commit is in.
  - Done when: a search of the repo for keys and tokens finds nothing.

- [ ] **6.3 Submit on Devpost (you)**
  - Do: add the video link, repo link and hosted link, then submit.
  - Done when: the submission shows as submitted on your Devpost page.

- [ ] **6.4 Keep it alive**
  - Do: leave the usage cap on and open the link once a day until judging ends, around Dec 17 WIB.
  - Done when: judging is over.

## Cut order and stretch slices

When a phase runs late, cut from the top of this list first.
- 3.5, the better rewrite from the cloud.
- 4.3, saving work to Firestore. Keep the guide in the browser only.
- Sample screens two and three. Keep the new invoice screen.
- The paste option in 3.3. Keep language files.
- The Indonesian check on the laptop. Run it in the cloud, on text you approve.
Never cut these: the on-laptop check, the wording guide from the cloud, the pattern and standing rule, the fix prompt, hosting, App Check, and the video. Without them the entry no longer shows both models doing real work.

### Stretch slices

Start these only if Phase 3 ends on time.

- [ ] **S1 Live review of a running app**
  - Build: one line of script the coding agent adds to your app during development, so Stet reads the running screen on localhost directly.
  - Done when: Stet pins findings on one of your own prototypes while it runs.

- [ ] **S2 Screenshot review**
  - Build: drop in a screenshot and the laptop model reads the text from the image.
  - Done when: a screenshot of the sample screen yields the same findings as the live review.

- [ ] **S3 Share card**
  - Build: a quick review page for visitors and an image of the report sized for a LinkedIn post.
  - Done when: a visitor can review pasted text and download the image on a phone.

## Risks and decision points

The two biggest unknowns are settled tonight, in Phase 0.
| Risk | When we find out | If it goes wrong |
| --- | --- | --- |
| The laptop model misjudges English strings | Phase 0 | Fewer problem kinds, examples in the guide, and a second checking pass |
| The laptop model is weak at Indonesian | Phase 0 | The translation check runs in the cloud, on text you approve |
| Suggested rewrites come out generic | Phase 1 | Slice 3.5 moves up to Phase 2 |
| Disk space drops and Chrome removes the laptop model | Any day | Keep well above 22 GB free, and record the video to another drive |
| Free cloud limits are hit during testing or judging | Phase 4 | The usage cap from Remote Config, and saved guides are reused |
| A judge's Chrome has no laptop model | Phase 4 | Open projects run through the cloud, and the first screen says so |
| Another entry looks similar | Unknown | Lead with the Indonesian check and the fix loop for coding agents |

### Decisions

| Decision | Made on | Answer |
| --- | --- | --- |
| Go ahead with Stet as planned, or simplify | Wed Nov 25 | Go. The laptop model passes the English accuracy bars one string per call (80 to 81% caught, 0 to 1.7% false alarms, 95% filler) but reaches only about 20 strings a minute, and batching made it worse. So: keep the laptop check one string per call, replace the speed bar with "one screen of about 15 strings in under 60 seconds", add plain rules and a cache in 1.3, and use 5-per-call cloud batches only for Open projects or as a fallback. |
| Indonesian check runs on the laptop or in the cloud | Wed Nov 25 (provisional: the owner's review of the pairs, 0.3, is still to come) | Cloud for Open projects, on strings the user approves; laptop for Sealed projects, with a caveat. Translation test on the 80 unreviewed pairs: laptop 65% caught, 45% right kind, 22.5% false alarms, 5.5 s median (it caught all 10 wrong-sense cases but 1 of 10 wrong verb forms); cloud 100% caught, 97.5% right kind, 0% false alarms, 3.1 s. Results in data/eval/results/translation-*-2026-11-25*. |
| Final name, after checking nobody else uses it | Sat Nov 28 | Open |

## Submission checklist

Every line must be true before slice 6.3.
- Every AI call goes through Firebase AI Logic
- The laptop model and the cloud model are both used, in the app and in the video
- App Check is on, and no key or token is in the repo
- The repo is public, with an Apache 2.0 license showing in its About section
- The README has run instructions
- The hosted link works in a fresh Chrome profile
- The video is public on YouTube, under 3 minutes, in English or subtitled, with no other companies' logos
- The Devpost text covers how Firebase AI Logic is used, the features, and who it helps
- Web (Chrome) is selected as the platform
- The app works in English, is free, and will stay online through judging
- Only made-up or public text appears in the repo, the demo and the video
- Submitted before Tue Dec 1, 05:00 WIB
