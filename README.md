# Stet

A design reviewer for the interface text of apps built by AI coding agents.

Agent-built screens are full of text nobody chose: "Unlock seamless invoicing",
"Submit", "Click here", "Error: you entered an invalid amount", "Lorem ipsum",
and Indonesian translated word by word ("Rumah" for Home, "Dekat" for Close).
Stet reads every string on a screen, checks it on the laptop with Chrome's
built-in model, pins what is wrong, and turns the fixes you tick into one
prompt for your coding agent. A cloud model does only the parts that need it:
it writes your wording guide from a two-line brief, and from the count of each
kind of problem it writes one standing rule for the agent's instruction file.
Your app's text stays on the laptop, and a counter shows what has left it.

Every AI call goes through Firebase AI Logic (`firebase/ai`), with its hybrid
inference modes.

## What it does

| Step | Where it runs | What leaves the laptop |
| --- | --- | --- |
| Collect every label, button, message and placeholder on the screen | Laptop, no model | Nothing |
| Plain rules: leftover text, vague buttons and links, your preferred terms | Laptop, no model | Nothing |
| Check each remaining string against the wording guide | Laptop model (`ONLY_ON_DEVICE`) | Nothing |
| New text for the fix prompt | Laptop model (`ONLY_ON_DEVICE`) | Nothing |
| Fix prompt, apply to the sample, re-check | Laptop | Nothing |
| Wording guide from your two-line brief | Cloud model (`ONLY_IN_CLOUD`) | The brief only |
| Cause note and standing rule | Cloud model (`ONLY_IN_CLOUD`) | The count of each problem kind only |

The top bar counts what has left the laptop two ways: the calls `src/ai.js`
records, and the requests the browser itself saw to a cloud model API. If the
browser saw more than was recorded, a warning shows.

## Run it

Needs Node 22+, and Chrome desktop 139 or newer for the laptop model.

```
npm install
npm run dev
```

Then open http://127.0.0.1:5173/ and pick a page:

- `/review/`: the review, with the sample app on the left.
- `/sample/`: the sample app on its own (three deliberately sloppy invoicing screens).
- `/check/`: confirm the laptop model and the cloud model both answer, in all four modes.
- `/eval/`: the accuracy test on the Phase 0 test data.

`npm run build` runs the gates first (see "Checks" below) and then builds to `dist/`.

## Configure Firebase

Create a file named `.env.local` in this folder. It is ignored by git. Never
commit it. With the Firebase CLI signed in, `npm run setup:env` writes the
web app's config into it without printing any values.

```
# Firebase console > Project settings > Your apps > Web app
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Only needed for the hosted build
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=

# Local development only, see below
VITE_APPCHECK_DEBUG_TOKEN=

# Optional. Empty means the SDK's default cloud model
VITE_CLOUD_MODEL=
```

In the Firebase console, enable Firebase AI Logic with the Gemini Developer API.

### App Check on your own machine

1. Leave `VITE_APPCHECK_DEBUG_TOKEN` empty and open `/check/`.
2. The browser console prints an App Check debug token.
3. Register it in Firebase console > App Check > Apps > Manage debug tokens.
4. Paste the same token into `.env.local` so it survives reloads, and restart
   `npm run dev`.

The debug provider is only active in `npm run dev`; `scripts/check-dist.mjs`
fails the build if any of it reaches the bundle. The hosted build uses
reCAPTCHA Enterprise.

### Chrome setup for the laptop model

1. Update Chrome to 139 or newer (`chrome://settings/help`).
2. Enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and
   restart Chrome.
3. On `/check/`, press "Prepare the laptop model" and wait for the download.
   Chrome needs about 22 GB of free disk space to keep the model.

## How AI calls are made

`src/ai.js` is the only module that talks to a model. It wraps Firebase AI
Logic's four hybrid modes and reports where each reply ran, from the SDK's
`inferenceSource` (never guessed from the mode):

| Mode | Behaviour | Used for |
| --- | --- | --- |
| `ONLY_ON_DEVICE` | Laptop model, or fail | Every check of your app's text and every new text in the fix prompt |
| `PREFER_ON_DEVICE` | Laptop model if ready, otherwise cloud | `/check/` |
| `PREFER_IN_CLOUD` | Cloud if reachable, otherwise laptop model | `/check/` |
| `ONLY_IN_CLOUD` | Cloud, or fail | The wording guide from your brief, and the standing rule from the counts |

Calls on the same model run one after another: the SDK opens a new on-device
session per call and closes the previous one.

## Checks

`npm run build` stops on any of these:

- `scripts/check-rules.mjs`: the plain rules flag no fine string in the Phase 0
  test data and give the right kind; the preferred-terms table, the brief
  filter and the copied-example check pass their cases.
- `scripts/check-fix-prompt.mjs`: every line of the fix prompt names the file,
  key, old text and new text, and the prompt reads back exactly.
- `scripts/check-pattern.mjs`: only clean counts can reach the cloud prompt for
  the standing rule, and no sample text does.
- `scripts/check-dist.mjs`: no development-only App Check code in the bundle.

Each gate was seen to fail on a deliberate break before it was trusted.
`npm run eval:data` checks the Phase 0 test data itself.

## License

Apache 2.0. See `LICENSE`.
