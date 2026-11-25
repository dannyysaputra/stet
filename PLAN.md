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
| Speed on the laptop | At least 60 strings a minute |
These bars are my judgment of what makes the product feel trustworthy. They are not a hackathon requirement.

## Phase 1: Core review loop (Wed Nov 25)

By tonight, pressing Review on the built-in sample app pins real findings from the laptop model, with Wi-Fi off.

- [ ] **1.1 Sample app**
  - Build: three deliberately sloppy invoicing screens inside Stet (new invoice, invoice list, settings), in English, with every piece of text addressable.
  - Done when: you can click through the three screens at /sample.

- [ ] **1.2 Collect the text**
  - Build: Stet reads every label, button, message and placeholder on the current screen, with the kind of element each one is.
  - Done when: a list of every string and its kind shows beside the screen.

- [ ] **1.3 Check on the laptop**
  - Build: each string is checked against a fixed starter guide by the laptop model only. It returns a verdict, how serious it is, and a suggested rewrite. Strings are checked one at a time, with progress shown.
  - Done when: with Wi-Fi off, Review finishes on a sample screen and returns findings.
  - OPEN from 0.1: the Wi-Fi-off test was not run yet. The docs do not say whether on-device calls through the SDK need the network (for example for the App Check token). Run it before building 1.3 on top of it. Remember: the tab must already be open, because there is no offline cache yet (planned for 2.5).

- [ ] **1.4 Pins and findings panel**
  - Build: findings pinned on the screen where they appear, a panel listing them with tick boxes, and a label showing each one ran on the laptop.
  - Done when: ticking and unticking works, and the pins match the list.

- [ ] **1.5 The seam (parallel)**
  - Build: the page frame with an "On this laptop" area, a "Sent to the cloud" area, and a counter of what has left the laptop.
  - Done when: the counter is visible and reads zero after a review.

## Phase 2: Cloud parts and the fix loop (Thu Nov 26)

By tonight the whole English loop runs: brief, guide, review, fix prompt, re-check and standing rule.

- [ ] **2.1 Wording guide from a brief**
  - Build: a two-line voice brief goes to the cloud model, which writes the guide: tone rules, preferred terms, and the signs of generated filler. The guide is saved, shown and editable.
  - Done when: a new brief produces a guide, and the next review uses it.

- [ ] **2.2 Fix prompt**
  - Build: the ticked findings become one prompt for a coding agent, with a copy button.
  - Done when: every line of the prompt names the place, the old text and the new text.

- [ ] **2.3 Re-check**
  - Build: an "Apply to sample" button changes the sample app's text the way the agent would. Stet then reviews again and marks each finding resolved or still open.
  - Done when: the resolved count is right after you apply only some of the fixes.

- [ ] **2.4 Pattern and standing rule**
  - Build: the count of each problem kind goes to the cloud model, which returns a short cause note and one rule for the agent's instruction file. Stet shows exactly what will be sent before sending it.
  - Done when: the counter shows that only counts left the laptop, and the rule appears with a copy button.

- [ ] **2.5 Offline behaviour (parallel)**
  - Build: with no connection, the cloud steps wait with a clear message, the laptop steps keep working, and a saved guide is reused.
  - Done when: a full review and fix prompt work with Wi-Fi off, using a saved guide.

## Phase 3: Indonesian check and your own text (Fri Nov 27)

By tonight Stet reviews the text of your own bilingual prototype, and not only the sample.

- [ ] **3.1 Indonesian sample**
  - Build: the sample app gets a language switch and a word-for-word Indonesian version.
  - Done when: switching the language changes every string on all three screens.

- [ ] **3.2 Translation check**
  - Build: each Indonesian string is compared with its English original and its kind of element. The check returns a verdict (wrong sense, word for word, wrong verb form, or mixed formal and informal address), a better translation, and a plain English note on what the bad one says. It runs where Phase 0 decided.
  - Done when: the planted mistakes in the sample, such as "Rumah" and "Dekat", are caught and explained.

- [ ] **3.3 Bring your own text**
  - Build: drop in two language files (English and Indonesian, JSON) or paste a list of strings. The same review and fix prompt run on them, and the fix prompt names each file key.
  - Done when: the language files from one of your own prototypes produce findings and a fix prompt you would send.

- [ ] **3.4 Sealed and Open projects**
  - Build: one project setting. In a Sealed project the text is only ever read by the laptop model. In an Open project the laptop model is tried first and the cloud is used when it is missing.
  - Done when: in a browser without the laptop model, an Open project works through the cloud and a Sealed project explains why it cannot run.

- [ ] **3.5 Ask the cloud for a better rewrite (only if time)**
  - Build: a button on each finding that sends that one string to the cloud for a better rewrite, after showing what will be sent.
  - Done when: the counter shows exactly the strings you sent.

## Phase 4: Ship-ready (Sat Nov 28)

By tonight a stranger can open a link and use Stet, with or without the laptop model.

- [ ] **4.1 Hosting and production App Check**
  - Build: deploy to Firebase Hosting, with App Check using a production provider for the hosted address and the debug provider only on your machine.
  - Done when: the hosted link works in a fresh Chrome profile.

- [ ] **4.2 Remote Config (parallel)**
  - Build: the cloud model name, the daily usage cap for each visitor, and the seriousness threshold all come from Remote Config.
  - Done when: changing the cap in the Firebase console changes the app without a new deploy.

- [ ] **4.3 Saved work**
  - Build: guides, standing rules and counts are saved to Firestore for each visitor. Text from a Sealed project is never saved to the cloud.
  - Done when: a guide survives a reload, and Firestore holds no app text for a Sealed project.

- [ ] **4.4 First run and the no-model path**
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

- [ ] **5.1 Accuracy numbers**
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

- [ ] **6.2 Repo check**
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
| Go ahead with Stet as planned, or simplify | Tue Nov 24 | Open |
| Indonesian check runs on the laptop or in the cloud | Tue Nov 24 | Open |
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
