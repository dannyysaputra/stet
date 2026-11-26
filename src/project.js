// The project setting (slice 3.4): Sealed or Open.
// Sealed: the app's text is only ever read by the laptop model (Laptop only).
// Open: the laptop model is tried first, and the cloud is used when it is
// missing (Laptop first). Steps that never carry app text (the brief, the
// counts) are not affected.

const KEY = "stet.project";
export const SEALED = "sealed";
export const OPEN = "open";

export function projectMode() {
  try {
    return localStorage.getItem(KEY) === OPEN ? OPEN : SEALED;
  } catch {
    return SEALED; // storage blocked: the safe choice
  }
}

export function setProjectMode(mode) {
  try {
    localStorage.setItem(KEY, mode === OPEN ? OPEN : SEALED);
    return true;
  } catch {
    return false;
  }
}

/** The Firebase AI Logic mode for any call that carries the app's text. */
export const textMode = () => (projectMode() === OPEN ? "PREFER_ON_DEVICE" : "ONLY_ON_DEVICE");

/**
 * Whether a check of the app's text can run now, and why not.
 * laptopStatus: from LanguageModel.availability() ("available", "downloadable", ...).
 */
export function canCheckText(laptopStatus) {
  if (laptopStatus === "available") return { ok: true };
  if (projectMode() === OPEN) return { ok: true, viaCloud: true };
  return {
    ok: false,
    why: `This project is Sealed: its text is only ever read by the laptop model, and the laptop model is not ready here (status: ${laptopStatus}). Prepare it on the Hybrid check page, or switch the project to Open to use the cloud when the laptop model is missing.`,
  };
}
