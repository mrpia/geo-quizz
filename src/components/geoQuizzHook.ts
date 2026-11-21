import type { View } from '../domain/view';

/**
 * What the e2e specs reach through `window.__geoQuizz` (plan, Phase 2 item
 * 7). GlobeView installs it while a globe exists, in production builds too:
 * the specs run against `vite preview`. Types only, so `tsconfig.e2e.json`
 * can include it without React or CSS.
 */
export type GeoQuizzHook = {
  /**
   * Where a country's anchor is in the viewport, in CSS pixels: what
   * Playwright's `page.mouse.click(x, y)` takes. Null when the anchor is on
   * the far side of the globe. Throws for an id the data does not have.
   */
  screenPoint(id: string): { x: number; y: number } | null;
  /** The camera's `pointOfView` and its vertical field of view in degrees. */
  camera(): View & { fov: number };
};

declare global {
  interface Window {
    __geoQuizz?: GeoQuizzHook;
  }
}
