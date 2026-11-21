import { useEffect, useState } from 'react';
import { loadWorld } from './data/loadWorld';
import { CONTINENTS, countriesOf, type World } from './domain/world';

/**
 * Phase 0 placeholder: proves the data loads in a production build. Phase 3 of
 * docs/plan.md replaces it with the screen state machine.
 */
export const App = () => {
  const [world, setWorld] = useState<World | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorld().then(setWorld, (e: unknown) => setError(String(e)));
  }, []);

  return (
    <main className="placeholder">
      <h1>Geo Quizz</h1>
      <p>Work in progress.</p>
      {error && <p role="alert">{error}</p>}
      {world && (
        <ul>
          {CONTINENTS.map((c) => (
            <li key={c}>
              {c}: {countriesOf(world, c).length}
            </li>
          ))}
        </ul>
      )}
      <footer>Made with Natural Earth.</footer>
    </main>
  );
};
