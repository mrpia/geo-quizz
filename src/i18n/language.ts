/**
 * The UI languages, which are also the languages the build writes a country
 * name in (`tools/build-data.mjs` → `LANGUAGES`). Add one in both places.
 */
export const LANGUAGES = ['fr', 'de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
