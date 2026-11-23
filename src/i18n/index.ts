import { fr } from './fr';
import { de } from './de';
import { en } from './en';
import type { Area, Country } from '../domain/world';
import type { Language, TranslationKey } from './types';

export type { Language, TranslationKey, Messages } from './types';

export const dictionaries: Record<Language, Record<TranslationKey, string>> = { fr, de, en };

/**
 * The string for `key` in `lang`, with each `{name}` replaced by `vars.name`.
 * Unlike math-quizz, which falls back to French or to the key, this throws on
 * an unknown language or key and on a placeholder without a value: geo-quizz
 * fails loudly rather than show "home.start" or "{seconds}" to a player.
 */
export const translate = (
  lang: Language,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string => {
  const dict = dictionaries[lang];
  if (!dict) throw new Error(`i18n: unknown language ${JSON.stringify(lang)}`);
  const template = dict[key];
  if (template === undefined) throw new Error(`i18n: unknown key ${JSON.stringify(key)}`);
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    if (!vars || !(name in vars)) throw new Error(`i18n: ${key} needs a value for {${name}}`);
    return String(vars[name]);
  });
};

/** A continent's name, or "Oceans" (plan, Phase 7): the tiles on Home. */
export const continentName = (continent: Area, lang: Language): string =>
  translate(lang, `continent.${continent}`);

/** Country names live in the data file, one per language, not in the dictionaries. */
export const countryName = (country: Country, lang: Language): string => {
  const name = country.properties.names[lang];
  if (!name) throw new Error(`i18n: ${country.id} has no ${lang} name`);
  return name;
};

/** A time in seconds with one decimal, in the language's own notation ("2.4", "2,4"). */
export const formatSeconds = (ms: number, lang: Language): string => {
  if (!(Number.isFinite(ms) && ms >= 0)) throw new Error(`formatSeconds: bad time ${ms}`);
  return new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    ms / 1000,
  );
};
