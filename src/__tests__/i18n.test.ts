import raw from '../data/world.json?raw';
import { CONTINENTS, parseWorld, type Country, type WorldTopology } from '../domain/world';
import { continentName, countryName, dictionaries, formatSeconds, translate } from '../i18n';
import { fr } from '../i18n/fr';
import { LANGUAGES, NATIVE_LANGUAGE_NAMES } from '../i18n/language';

const world = parseWorld(JSON.parse(raw) as WorldTopology);

const placeholders = (template: string) => [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translate', () => {
  it('returns the string for the requested language', () => {
    expect(translate('fr', 'home.start')).toBe('Lancer');
    expect(translate('de', 'home.start')).toBe('Starten');
    expect(translate('en', 'home.start')).toBe('Start');
  });

  it('interpolates placeholders', () => {
    expect(translate('en', 'home.summary', { count: 10, seconds: 8 })).toBe(
      '10 countries · 8 s each',
    );
    expect(translate('de', 'game.wrong', { country: 'Schweiz' })).toBe(
      'Du hast Schweiz angetippt',
    );
  });

  it('ignores variables the string does not use', () => {
    expect(translate('en', 'home.summaryOne', { count: 1, seconds: 5 })).toBe('1 country · 5 s');
  });

  it('throws on a placeholder without a value instead of showing "{seconds}"', () => {
    expect(() => translate('en', 'home.summary', { count: 10 })).toThrow(/seconds/);
    expect(() => translate('en', 'home.summary')).toThrow(/count/);
  });

  it('throws on an unknown key instead of showing the key', () => {
    // @ts-expect-error unknown key on purpose
    expect(() => translate('en', 'does.not.exist')).toThrow(/does\.not\.exist/);
  });

  it('throws on an unknown language', () => {
    // @ts-expect-error unknown language on purpose
    expect(() => translate('it', 'home.start')).toThrow(/it/);
  });
});

describe('dictionaries', () => {
  it('de and en have exactly the same keys as fr', () => {
    const frKeys = Object.keys(fr).sort();
    expect(Object.keys(dictionaries.de).sort()).toEqual(frKeys);
    expect(Object.keys(dictionaries.en).sort()).toEqual(frKeys);
  });

  it('exists for every app language and nothing else', () => {
    expect(Object.keys(dictionaries).sort()).toEqual([...LANGUAGES].sort());
  });

  it('has no empty string', () => {
    for (const lang of LANGUAGES) {
      for (const [key, value] of Object.entries(dictionaries[lang])) {
        expect(value.trim(), `${lang}.${key}`).not.toBe('');
      }
    }
  });

  it('uses the same placeholders in every language', () => {
    for (const [key, template] of Object.entries(fr)) {
      for (const lang of LANGUAGES) {
        const translated = dictionaries[lang][key as keyof typeof fr];
        expect(placeholders(translated), `${lang}.${key}`).toEqual(placeholders(template));
      }
    }
  });

  it('names each language in its own language', () => {
    expect(NATIVE_LANGUAGE_NAMES).toEqual({ fr: 'Français', de: 'Deutsch', en: 'English' });
  });
});

describe('continentName', () => {
  it('names the six continents in every language', () => {
    expect(CONTINENTS.map((c) => continentName(c, 'fr'))).toEqual([
      'Europe',
      'Afrique',
      'Asie',
      'Amérique du Nord',
      'Amérique du Sud',
      'Océanie',
    ]);
    expect(CONTINENTS.map((c) => continentName(c, 'de'))).toEqual([
      'Europa',
      'Afrika',
      'Asien',
      'Nordamerika',
      'Südamerika',
      'Ozeanien',
    ]);
    expect(CONTINENTS.map((c) => continentName(c, 'en'))).toEqual([
      'Europe',
      'Africa',
      'Asia',
      'North America',
      'South America',
      'Oceania',
    ]);
  });
});

describe('countryName', () => {
  it('takes the name from the data file, not the dictionaries', () => {
    const che = world.byId.get('CHE');
    if (!che) throw new Error('CHE missing from the data');
    expect(countryName(che, 'fr')).toBe('Suisse');
    expect(countryName(che, 'de')).toBe('Schweiz');
    expect(countryName(che, 'en')).toBe('Switzerland');
  });

  it('throws on a missing name instead of rendering an empty label', () => {
    const che = world.byId.get('CHE') as Country;
    const nameless = {
      ...che,
      properties: { ...che.properties, names: { ...che.properties.names, de: '' } },
    };
    expect(() => countryName(nameless, 'de')).toThrow(/CHE/);
  });
});

describe('formatSeconds', () => {
  it('shows tenths of a second in each language', () => {
    expect(formatSeconds(2440, 'en')).toBe('2.4');
    expect(formatSeconds(2440, 'fr')).toBe('2,4');
    expect(formatSeconds(2440, 'de')).toBe('2,4');
  });

  it('keeps the tenth on whole seconds, so the column lines up', () => {
    expect(formatSeconds(10_000, 'en')).toBe('10.0');
    expect(formatSeconds(0, 'fr')).toBe('0,0');
  });

  it('throws on a time that is not a time', () => {
    for (const ms of [-1, Number.NaN, Infinity]) expect(() => formatSeconds(ms, 'en')).toThrow(/time/);
  });
});
