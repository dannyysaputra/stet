# Slice 4.7: fixes from the two judge reviews (plan)

Source: two independent reviews of the live site on 2026-11-27 (scores 7/10 and 6.2/10).
Both named the same three problems. Branch `slice/4.7-theme-switch` (also carries the
dark mode switch).

## One rule for all three

The app's text reaches the cloud model only after the user has agreed to a list that
shows that exact text. Every other call that carries the app's text is laptop only
(`ONLY_ON_DEVICE`), so it fails instead of quietly falling back to the cloud.

## Changes

1. No laptop model (`/files/`): the message no longer says "download the model" when the
   status says it cannot be downloaded. A "Check with the cloud model" button unticks
   "Keep my text on this laptop" and starts the check, which shows the list first.
2. Failed checks (`/files/`): counted and shown ("N could not be checked: reason"), never
   "Nothing to fix" while some failed, and a button that checks only the failed pieces
   again. Wording comes from `reviewSummary()` in `src/files/parse.js` so the gate can test it.
3. Approval:
   - `modelCheck` and `newTextFor` take a `mode`. Callers pass laptop only unless the user
     agreed to a list for that step.
   - `/review/`: English text also goes on the approval list when the laptop model is missing.
   - `/files/` "Copy fix": when the laptop model is missing, the pieces that need new text
     and the other text sent with them are listed first; "Skip" leaves them for the user's
     own words.
   - `/review/` new text: laptop only; the per-piece "ask the cloud" button with its preview
     stays the only cloud path.

## Not in scope

Time limit on laptop calls, Content-Security-Policy, favicon, one name for the project
setting, moving the wording guide into `/files/`.

## Gates

`npm run build` green. New `check-files` cases for `reviewSummary` (failed never reads as
clean), mutation-proved. Live check in Chrome with the laptop model present; the
no-laptop-model path is checked by forcing the status in the browser.
