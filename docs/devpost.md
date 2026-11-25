# Devpost draft (slice 5.4)

Copy each section into the matching Devpost field. Numbers marked "from 5.1"
are filled after the final accuracy run. Platform: Web (Chrome).

## Tagline

A design reviewer for agent-built apps: checks every string on your laptop,
pins what is wrong, and hands your coding agent one fix prompt.

## Inspiration

Coding agents now build whole screens, and the text on them is the part
nobody chose: "Unlock seamless invoicing", "Submit", "Click here",
"Error: you entered an invalid amount", leftover "Lorem ipsum". In Indonesia
it is worse: agents translate word by word, so Home becomes "Rumah" (a house)
and Close becomes "Dekat" (nearby). Designers catch this by reading every
screen by hand. We wanted a reviewer that does that reading, keeps the app's
text private, and speaks to the coding agent in a form it can act on.

## What it does

- Reads every label, button, message and placeholder on the current screen,
  with the kind of element each one is.
- Checks each string against a wording guide with Chrome's built-in model
  (Gemini Nano), on the laptop. Plain rules catch leftover text, vague
  buttons and links, and words your guide rules out, without a model call.
- Pins each finding on the screen, with a tick box, a suggested rewrite and a
  label saying it ran on the laptop.
- Turns the ticked findings into one prompt for a coding agent: every line
  names the file, the key, the old text and the new text.
- "Apply to sample" does what the agent would, then Stet reviews again and
  marks each finding resolved or still open.
- The cloud model does two things only: it writes the wording guide from a
  two-line voice brief, and from the count of each kind of problem it writes
  a short cause note and one standing rule for the agent's instruction file
  (AGENTS.md, CLAUDE.md).
- A counter shows what has left the laptop, measured two ways: the calls the
  app recorded, and the model API requests the browser itself saw.
- Works offline for everything that runs on the laptop; cloud steps wait for
  the connection and say so.

## How we built it

- Plain JavaScript and Vite, no framework. Every AI call goes through one
  module, `src/ai.js`, built on Firebase AI Logic (`firebase/ai`) with the
  Gemini Developer API backend.
- Hybrid inference, chosen per task:
  - `ONLY_ON_DEVICE` for anything that reads the app's text: the check of each
    string and the new text in the fix prompt. Structured output on the laptop
    through `responseConstraint`.
  - `ONLY_IN_CLOUD` for the wording guide (from the brief) and the standing
    rule (from counts), with `responseJsonSchema`.
  - `PREFER_ON_DEVICE` and `PREFER_IN_CLOUD` on the setup page that confirms
    both models answer.
  - Where each reply ran is read from the SDK's `inferenceSource`, never
    guessed from the mode.
- Firebase App Check (reCAPTCHA Enterprise on the hosted site, the debug
  provider only in local development, with a build gate that fails if any
  debug code reaches the bundle).
- Firebase Hosting for the public link.
- We measured before building (Phase 0): 150 labelled English strings and 80
  English and Indonesian pairs, run through the laptop model and the cloud
  model. Results (from 5.1): [laptop: problems caught, false alarms, speed]
  [cloud: the same].

## Challenges we ran into

- The laptop model is accurate but slow, about 3 seconds a string. Sending
  several strings per call made it slower and less accurate, so we kept one
  string per call and added plain rules, a cache and a warm-up call instead.
- It ignored the preferred-terms table in the guide, so preferred terms became
  a plain rule read from the guide's table.
- It copied the guide's own examples as rewrites ("Read the refund policy" for
  a link in an invoicing app), so links now carry their destination and
  copied examples are refused.
- The cloud model once listed the owner's own word ("invoice") as a word to
  avoid; words the brief uses are now dropped from that list.

## Accomplishments that we're proud of

- The app's text never leaves the laptop, and the app proves it with a counter
  that does not trust its own bookkeeping.
- Every gate in the build was seen to fail on a deliberate break before we
  trusted it.

## What we learned

A small on-device model is good at judging one string against a short guide
and weak at applying lists and tables; rules do that part better. The cloud
model is best used for the few things that need wider knowledge, and it needs
very little of the user's data to do them.

## What's next for Stet

Live review of a running app on localhost, screenshot review, and more
languages after Indonesian.

## Built with

Firebase AI Logic, Gemini Nano (Chrome built-in AI), Gemini API, Firebase App
Check, Firebase Hosting, JavaScript, Vite.
