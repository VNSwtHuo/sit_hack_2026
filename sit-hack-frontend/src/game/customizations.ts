// Persists the player's zombie customizations so they carry across the
// single-player and multiplayer game screens.

const FACE_KEY = "zr_zombieFace";
const HEAD_KEY = "zr_headAvatar";

export interface Customizations {
  zombieFace: string | null;
  headAvatar: string | null;
}

export function loadCustomizations(): Customizations {
  try {
    return {
      zombieFace: localStorage.getItem(FACE_KEY),
      headAvatar: localStorage.getItem(HEAD_KEY),
    };
  } catch {
    return { zombieFace: null, headAvatar: null };
  }
}

export function saveZombieFace(value: string | null) {
  try {
    if (value) {
      localStorage.setItem(FACE_KEY, value);
    } else {
      localStorage.removeItem(FACE_KEY);
    }
  } catch {
    // Storage unavailable (private mode / quota) — non-fatal.
  }
}

export function saveHeadAvatar(value: string | null) {
  try {
    if (value) {
      localStorage.setItem(HEAD_KEY, value);
    } else {
      localStorage.removeItem(HEAD_KEY);
    }
  } catch {
    // Storage unavailable — non-fatal.
  }
}
