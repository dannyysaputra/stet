// Firebase app + App Check. src/ai.js builds on this; pages read the status fields.
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const missingConfig = ["apiKey", "projectId", "appId"].filter((k) => !firebaseConfig[k]);

// `import.meta.env.DEV` must be written out in full (not through an alias) so the
// bundler removes the debug branches from the hosted build. scripts/check-dist.mjs
// fails the build if any of them survive.
let siteKey = env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
if (import.meta.env.DEV) {
  // With a debug token set, the site key is never used, so a placeholder is fine locally.
  siteKey ||= "local-dev-placeholder";
} else if (!siteKey) {
  // A hosted build without a real key would look protected while sending bad tokens.
  missingConfig.push("reCAPTCHA Enterprise site key");
}

export let firebaseApp = null;
export let appCheckMode = "not started";

if (missingConfig.length === 0) {
  firebaseApp = initializeApp(firebaseConfig);
  let mode = "reCAPTCHA Enterprise";
  if (import.meta.env.DEV) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
    mode = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN ? "debug (saved token)" : "debug (new token, see console)";
  }
  try {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckMode = mode;
  } catch (e) {
    appCheckMode = `failed to start: ${e.message}`;
  }
}
