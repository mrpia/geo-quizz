import { sanitizeSettings, type Settings } from '../domain/settings';

export const SETTINGS_KEY = 'geoquizz:settings';

const parseOrNull = (raw: string | null): unknown => {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Storage is trusted no more than any other input: whatever is there goes
 * through `sanitizeSettings`, so a hand-edited or damaged value reads as
 * valid settings instead of breaking the app.
 */
export const loadSettings = (
  browserLanguages: readonly string[] = navigator.languages,
): Settings => sanitizeSettings(parseOrNull(localStorage.getItem(SETTINGS_KEY)), browserLanguages);

/** Writes the sanitized settings and returns them, so the caller holds what was stored. */
export const saveSettings = (
  settings: Settings,
  browserLanguages: readonly string[] = navigator.languages,
): Settings => {
  const clean = sanitizeSettings(settings, browserLanguages);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(clean));
  return clean;
};
