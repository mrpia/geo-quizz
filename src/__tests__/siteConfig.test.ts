import { AUTHOR_LABEL, AUTHOR_URL, SITE_URL, SOURCE_URL, SUPPORT_URL } from '../config/site';

/**
 * The repository is public and forkable. Every URL that ties this build to
 * one deployment and one author lives in src/config/site.ts, so a fork
 * retargets the app by editing that file alone (as in math-quizz).
 */
describe('site config', () => {
  it('serves at geo-quizz.mrpia.ch, from the mrpia/geo-quizz repository', () => {
    expect(SITE_URL).toBe('https://geo-quizz.mrpia.ch');
    expect(SOURCE_URL).toBe('https://github.com/mrpia/geo-quizz');
  });

  it('derives the author link label from the URL, so the two cannot drift', () => {
    expect(AUTHOR_LABEL).toBe(new URL(AUTHOR_URL).host);
  });

  it('holds absolute https URLs with no trailing slash', () => {
    for (const url of [SITE_URL, AUTHOR_URL, SOURCE_URL, SUPPORT_URL]) {
      expect(url).toMatch(/^https:\/\//);
      expect(url).not.toMatch(/\/$/);
    }
  });
});

describe('no identity hard-coded outside src/config/site.ts', () => {
  const sources = import.meta.glob('/src/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  // Hosts for the sites that are this author's; the repository whole, since
  // github.com alone belongs to every project there.
  const needles = [...[SITE_URL, AUTHOR_URL, SUPPORT_URL].map((u) => new URL(u).host), SOURCE_URL];

  it('reads the app sources (the guard is looking at something)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
  });

  it('finds none of the hosts or the repository anywhere else', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => path !== '/src/config/site.ts' && !path.startsWith('/src/__tests__/'))
      .flatMap(([path, code]) => needles.filter((n) => code.includes(n)).map((n) => `${path} → ${n}`));
    expect(offenders).toEqual([]);
  });
});
