# Slice 4.6: proofreader's desk design + marks on the user's app (plan)

Design source: artifact "Stet page designs" (boards 1 to 5). Branch `slice/4.6-desk-design`.

## Scope

1. Shared look (`src/base.css`, done by hand first): desk tokens (ink, blue, highlighter,
   coral, stamp red, pale), 2px ink borders, hard offset shadows, system font stacks only
   (no web font request: Stet counts what leaves the laptop, and a font fetch muddies that).
2. Landing page (`index.html`, `src/home.css`) to board 1. Keep ids used by `src/home.js`.
3. Check your app (`files/index.html`, `src/files/files.css`) to boards 2 and 3.
   Keep every id `src/files/files.js` uses. No JS change in this part.
4. Option B (board 5): after a review, Stet sends the findings back to the app tab that
   opened it; the bookmark script draws numbered pins and wavy underlines on the matching
   text, plus a small Stet card. Files: `src/scan/bookmarklet.js`, `src/files/files.js`,
   `scripts/check-bookmarklet.mjs`.

## Rules for part 4

- App tab accepts messages only from Stet's origin and only from the window it opened.
- Drawn with `textContent` only, never HTML. All marks live under one root with
  `data-stet-ignore` so a second scan does not read them. "Hide the marks" removes the root.
- Matching by position: the bookmark keeps the elements behind each item it sent; Stet
  returns that position as `at`. Built by `marksFor()` in `src/files/parse.js`.
- Stet sends only: at, number, kind, old text, new text, problem label. Nothing else.
- The page copy says the marks come back to the app tab, where the app's own scripts can
  see them; the marks root carries common session-recorder mask attributes.

## Not in scope

Extension, `/review/` wording, laptop model timeout.

## Gates

`npm run build` green; new gate assertions in `check-bookmarklet` mutation-proved
(remove origin check, use innerHTML, drop data-stet-ignore: each must go red).
Live check in Chrome: example app with `?scan=1`, scan, review, marks appear.
