import { isLanguage, preferredLanguage, type Language } from '../i18n/language';
import { CONTINENTS, type Continent } from './world';

export type Settings = {
  language: Language;
  secondsPerQuestion: number;
  countriesPerRound: number;
  /** The continent last played, preselected on the Home screen. */
  continent: Continent;
};

export const DEFAULT_SECONDS_PER_QUESTION = 10;
export const DEFAULT_COUNTRIES_PER_ROUND = 10;
export const DEFAULT_CONTINENT: Continent = 'europe';

const isContinent = (value: unknown): value is Continent =>
  typeof value === 'string' && (CONTINENTS as readonly string[]).includes(value);

export const SETTINGS_BOUNDS = {
  secondsPerQuestion: { min: 3, max: 60 },
  countriesPerRound: { min: 1, max: 50 },
} as const;

/**
 * The language is the browser's (see `preferredLanguage`), passed in so this
 * module never reads `navigator` and stays testable as plain data.
 */
export const defaultSettings = (browserLanguages: readonly string[]): Settings => ({
  language: preferredLanguage(browserLanguages),
  secondsPerQuestion: DEFAULT_SECONDS_PER_QUESTION,
  countriesPerRound: DEFAULT_COUNTRIES_PER_ROUND,
  continent: DEFAULT_CONTINENT,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Clamped, then rounded: the bounds are whole numbers, so the result stays inside. */
const readWhole = (
  value: unknown,
  bounds: { min: number; max: number },
  fallback: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(Math.min(bounds.max, Math.max(bounds.min, value)))
    : fallback;

/**
 * Valid settings from anything: a stored value someone edited by hand, a value
 * from an older version, or garbage. Each bad or missing field falls back to
 * its own default, so one broken field does not reset the others. The one
 * gate for settings, both read and written (as in math-quizz).
 */
export const sanitizeSettings = (
  value: unknown,
  browserLanguages: readonly string[],
): Settings => {
  const raw = isRecord(value) ? value : {};
  const defaults = defaultSettings(browserLanguages);
  return {
    language: isLanguage(raw.language) ? raw.language : defaults.language,
    secondsPerQuestion: readWhole(
      raw.secondsPerQuestion,
      SETTINGS_BOUNDS.secondsPerQuestion,
      defaults.secondsPerQuestion,
    ),
    countriesPerRound: readWhole(
      raw.countriesPerRound,
      SETTINGS_BOUNDS.countriesPerRound,
      defaults.countriesPerRound,
    ),
    continent: isContinent(raw.continent) ? raw.continent : defaults.continent,
  };
};
