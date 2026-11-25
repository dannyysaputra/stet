# Stet

A reviewer for the interface text of apps built by AI coding agents. It checks
text on the laptop with Chrome's built-in model, and uses a cloud model for the
parts that need one. Every AI call goes through Firebase AI Logic.

Status: slice 0.1 (Firebase base and hybrid check). See `PLAN.md`.

## Run it

Needs Node 22+, and Chrome desktop 139 or newer for the laptop model.

```
npm install
npm run dev
```

Then open http://127.0.0.1:5173/check/

## Configure Firebase

Create a file named `.env.local` in this folder. It is ignored by git. Never
commit it.

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

### App Check on your own machine

1. Leave `VITE_APPCHECK_DEBUG_TOKEN` empty and open `/check/`.
2. The browser console prints an App Check debug token.
3. Register it in Firebase console > App Check > Apps > Manage debug tokens.
4. Paste the same token into `.env.local` so it survives reloads, and restart
   `npm run dev`.

The debug provider is only active in `npm run dev`. The hosted build uses
reCAPTCHA Enterprise.

### Chrome setup for the laptop model

1. Update Chrome to 139 or newer (`chrome://settings/help`).
2. Enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and
   restart Chrome.
3. On `/check/`, press "Prepare the laptop model" and wait for the download.

## How AI calls are made

`src/ai.js` is the only module that talks to a model. It wraps Firebase AI
Logic's four hybrid modes and reports where each reply ran:

| Mode | Behaviour |
| --- | --- |
| `ONLY_ON_DEVICE` | Laptop model, or fail |
| `PREFER_ON_DEVICE` | Laptop model if ready, otherwise cloud |
| `PREFER_IN_CLOUD` | Cloud if reachable, otherwise laptop model |
| `ONLY_IN_CLOUD` | Cloud, or fail |

## License

Apache 2.0.
