/**
 * The About screen promises that the settings are all the app keeps, that
 * they stay in the browser, and that nothing the player does is sent
 * anywhere. This holds the app's own code to that: storage only in the
 * settings store, the network only to download the map. Libraries are not
 * scanned; globe.gl is given no image or URL to load.
 */
const sources = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const appSources = Object.entries(sources).filter(
  ([path]) => !path.startsWith('/src/__tests__/') && path !== '/src/test-setup.ts',
);

const usesOf = (pattern: RegExp) =>
  appSources
    .filter(([, code]) => pattern.test(code))
    .map(([path]) => path)
    .sort();

describe('what the app keeps and sends', () => {
  it('reads the app sources (the guard is looking at something)', () => {
    expect(appSources.length).toBeGreaterThan(20);
  });

  it('stores only through the settings store', () => {
    expect(usesOf(/\blocalStorage\b/)).toEqual(['/src/storage/settingsStore.ts']);
    expect(usesOf(/\b(sessionStorage|indexedDB|caches)\b|document\.cookie/)).toEqual([]);
  });

  it('goes to the network only to download the map', () => {
    expect(usesOf(/\bfetch\(/)).toEqual(['/src/data/loadWorld.ts']);
    expect(usesOf(/\b(XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/)).toEqual([]);
  });
});
