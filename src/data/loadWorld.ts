// `?url`, not a JSON import: the file is 761 KiB, and as a URL Vite emits it as
// its own content-hashed asset (cacheable for a year, parsed with the fast
// JSON.parse path) instead of inlining it into the JavaScript bundle.
import worldUrl from './world.json?url';
import { parseWorld, type World, type WorldTopology } from '../domain/world';

export const loadWorld = async (): Promise<World> => {
  const response = await fetch(worldUrl);
  if (!response.ok) throw new Error(`world data: HTTP ${response.status}`);
  return parseWorld((await response.json()) as WorldTopology);
};
