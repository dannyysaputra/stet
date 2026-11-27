# Onboarding plan (slice 4.5, 2026-11-27)

Why: the owner tried Stet and was lost ("if I am confused, what about a user?").
The features work; the way in does not. Deadline: submit Mon Nov 30, 20:00 WIB.

Confidence: high for A to D (plain HTML, CSS and small changes to existing
pages), medium for the "test your bookmark" step (browser behaviour to check
live). Risk tier: MED (new page content, changed labels; no data, no cloud
spend beyond what a visitor chooses).

## What stays the same

The checks, prompts, measured accuracy, Sealed/Open behaviour, the counter and
every gate. This slice changes words, layout and the order of steps only.

## A. Landing page (index.html)

One page, in this order:

1. Hero: one sentence on what Stet does, one main button "Check my app", one
   quiet link "Try it on an example first". Small line: runs in desktop Chrome,
   your text stays on your laptop.
2. Problem: what agent-built screens get wrong, with 4 real before/after pairs
   from the sample ("Submit" to "Create invoice", "Click here", "Lorem ipsum",
   "Error: you entered an invalid amount.").
3. Solution: three plain claims, each with its proof: checked on your laptop
   (counter stays 0), one prompt for your agent, a cloud model only for the
   guide and the standing rule.
4. How to use it: 3 steps with a picture each (add the bookmark, click it on
   your app, copy the fix to your agent).
5. Honest limits: made for app interface text; marketing pages give many false
   alarms; about 3 s a string; desktop Chrome only.
6. The laptop model state and download button (today's box 1), moved below the
   steps and shown only when action is needed.
7. Footer: code, accuracy results, hybrid check (for judges), sample app.

## B. "Try it on an example first" without a bookmark

The link opens the sample screen with a visible "Scan this screen" button that
runs the same scan code as the bookmark and opens /files/ with the text. A
visitor sees the whole loop in one click, before installing anything.

## C. Bookmark help (on /files/)

- A short looping picture of dragging the button to the bookmarks bar.
- Clicking the button on the page (instead of dragging) explains what to do.
- "Test your bookmark": a link to the sample screen; clicking the bookmark
  there proves it works.
- If the scan cannot run (pop-up blocked, page blocks bookmarklets), say what
  to do next, and offer "paste the text instead".

## D. Plain words and fewer steps (on /files/ and /review/)

- "Sealed / Open" becomes one tick box: "Keep my text on this laptop
  (recommended)". Unticked = today's Open, with the same approval list.
- Wording guide and brief move under "Advanced".
- Results start with a summary line ("7 things to fix on this screen"), then
  one main button "Copy fix for my AI agent" (writes the new texts and copies
  the prompt in one press). The prompt stays visible and editable below.
- While checking: "Checking 9 of 22 on your laptop, about 40 s left".
- /check/ is linked from the footer only.

## E. Not in this slice

A Chrome extension (store review takes days; unpacked install is harder than a
bookmark). Goes in "What's next". Pins on the user's own app.

## Order and checks

1. D (labels and one-button fix) on /files/, because the scan lands there.
2. B (example without a bookmark).
3. A (landing page).
4. C (bookmark help).

After each: `npm run build` (all gates), then the real flow in Chrome on the
sample screen: 8 planted problems, counter 0, the copied prompt reads back with
`parseFixPrompt`. A gate that names the old labels is updated and
mutation-proved again. The Sealed/Open behaviour is re-checked with the laptop
model made unavailable (Sealed refuses, Open asks approval first).

## Done when

A person who has never seen Stet gets from the landing page to a copied fix
prompt for the example in under two minutes without help, and the owner says
the page is no longer confusing.
