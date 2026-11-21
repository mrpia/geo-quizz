import {
  DEFAULT_COUNTRIES_PER_ROUND,
  DEFAULT_SECONDS_PER_QUESTION,
  SETTINGS_BOUNDS,
  defaultSettings,
  sanitizeSettings,
} from '../domain/settings';
import { preferredLanguage } from '../i18n/language';
import { SETTINGS_KEY, loadSettings, saveSettings } from '../storage/settingsStore';

describe('preferredLanguage', () => {
  it('takes the first browser language the app speaks', () => {
    expect(preferredLanguage(['it-CH', 'de-CH', 'fr-CH', 'en'])).toBe('de');
    expect(preferredLanguage(['fr'])).toBe('fr');
    expect(preferredLanguage(['en-GB', 'fr'])).toBe('en');
  });

  it('ignores case', () => {
    expect(preferredLanguage(['FR-ch'])).toBe('fr');
  });

  it('matches the language subtag, not any tag that happens to start with it', () => {
    // fry = West Frisian, den = Slave, enm = Middle English
    expect(preferredLanguage(['fry-NL', 'den', 'enm', 'de'])).toBe('de');
  });

  it('falls back to English', () => {
    expect(preferredLanguage(['it-CH', 'rm'])).toBe('en');
    expect(preferredLanguage([])).toBe('en');
  });
});

describe('defaultSettings', () => {
  it('asks 10 countries with 10 seconds each, in the browser language', () => {
    expect(DEFAULT_SECONDS_PER_QUESTION).toBe(10);
    expect(DEFAULT_COUNTRIES_PER_ROUND).toBe(10);
    expect(defaultSettings(['de-CH'])).toEqual({
      language: 'de',
      secondsPerQuestion: 10,
      countriesPerRound: 10,
    });
  });
});

describe('sanitizeSettings', () => {
  const browser = ['fr-CH'];

  it('keeps valid settings as they are', () => {
    const valid = { language: 'en', secondsPerQuestion: 25, countriesPerRound: 42 };
    expect(sanitizeSettings(valid, browser)).toEqual(valid);
  });

  it.each([undefined, null, 'settings', 42, [], [1, 2, 3]])(
    'returns the defaults for %j',
    (value) => {
      expect(sanitizeSettings(value, browser)).toEqual(defaultSettings(browser));
    },
  );

  it('replaces each bad or missing field with its own default', () => {
    expect(sanitizeSettings({ secondsPerQuestion: 20 }, browser)).toEqual({
      language: 'fr',
      secondsPerQuestion: 20,
      countriesPerRound: 10,
    });
    expect(
      sanitizeSettings(
        { language: 'it', secondsPerQuestion: '20', countriesPerRound: Number.NaN },
        browser,
      ),
    ).toEqual(defaultSettings(browser));
    expect(
      sanitizeSettings({ secondsPerQuestion: Infinity, countriesPerRound: null }, browser),
    ).toEqual(defaultSettings(browser));
  });

  it('clamps numbers to their bounds', () => {
    expect(SETTINGS_BOUNDS).toEqual({
      secondsPerQuestion: { min: 3, max: 60 },
      countriesPerRound: { min: 1, max: 50 },
    });
    expect(
      sanitizeSettings({ secondsPerQuestion: 0, countriesPerRound: -4 }, browser),
    ).toMatchObject({ secondsPerQuestion: 3, countriesPerRound: 1 });
    expect(
      sanitizeSettings({ secondsPerQuestion: 600, countriesPerRound: 242 }, browser),
    ).toMatchObject({ secondsPerQuestion: 60, countriesPerRound: 50 });
  });

  it('rounds numbers to whole seconds and whole countries', () => {
    expect(
      sanitizeSettings({ secondsPerQuestion: 12.5, countriesPerRound: 7.4 }, browser),
    ).toMatchObject({ secondsPerQuestion: 13, countriesPerRound: 7 });
    expect(
      sanitizeSettings({ secondsPerQuestion: 2.6, countriesPerRound: 50.4 }, browser),
    ).toMatchObject({ secondsPerQuestion: 3, countriesPerRound: 50 });
  });

  it('drops fields it does not know', () => {
    expect(sanitizeSettings({ ...defaultSettings(browser), theme: 'dark' }, browser)).toEqual(
      defaultSettings(browser),
    );
  });
});

describe('settingsStore', () => {
  const browser = ['de-DE'];

  it('reads the defaults when nothing is stored', () => {
    expect(loadSettings(browser)).toEqual(defaultSettings(browser));
  });

  it('round-trips settings through localStorage', () => {
    const settings = { language: 'fr', secondsPerQuestion: 7, countriesPerRound: 20 } as const;
    saveSettings(settings, browser);
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')).toEqual(settings);
    expect(loadSettings(browser)).toEqual(settings);
  });

  it('uses the key geoquizz:settings', () => {
    expect(SETTINGS_KEY).toBe('geoquizz:settings');
  });

  it('sanitizes what it reads', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ secondsPerQuestion: 999 }));
    expect(loadSettings(browser)).toEqual({ ...defaultSettings(browser), secondsPerQuestion: 60 });
  });

  it('reads the defaults from damaged JSON', () => {
    localStorage.setItem(SETTINGS_KEY, '{not json');
    expect(loadSettings(browser)).toEqual(defaultSettings(browser));
  });

  it('sanitizes what it writes', () => {
    saveSettings({ language: 'en', secondsPerQuestion: 1.2, countriesPerRound: 99 }, browser);
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')).toEqual({
      language: 'en',
      secondsPerQuestion: 3,
      countriesPerRound: 50,
    });
  });

  it("falls back to the browser's languages", () => {
    expect(loadSettings().language).toBe(preferredLanguage(navigator.languages));
  });
});
