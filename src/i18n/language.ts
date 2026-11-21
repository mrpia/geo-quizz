/**
 * The UI languages, which are also the languages the build writes a country
 * name in (`tools/build-data.mjs` → `LANGUAGES`). Add one in both places.
 */
export const LANGUAGES = ['fr', 'de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);

/** Each language in its own name, for the language toggle. Never translated. */
export const NATIVE_LANGUAGE_NAMES: Record<Language, string> = {
  fr: 'Français',
  de: 'Deutsch',
  en: 'English',
};

/**
 * The first of the browser's languages (`navigator.languages`, most preferred
 * first) that the app speaks, else English. Compares the primary language
 * subtag, so `de-CH` is German but `den` (Slave) is not.
 */
export const preferredLanguage = (browserLanguages: readonly string[]): Language => {
  for (const tag of browserLanguages) {
    const primary = tag.split('-')[0].toLowerCase();
    if (isLanguage(primary)) return primary;
  }
  return 'en';
};
