import pkg from '../../package.json';
import changelog from '../../CHANGELOG.md?raw';
import { releaseNotes } from '../domain/releaseNotes';
import { LANGUAGES } from '../i18n/language';

const semver = (v: string) => v.split('.').map(Number);
const newer = (a: string, b: string) => {
  const [pa, pb] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i];
  return false;
};

/**
 * A release moves three things together: package.json's version, a
 * CHANGELOG.md section, and the player-facing note in src/domain/releaseNotes.ts.
 */
describe('releaseNotes', () => {
  it('starts with the version in package.json', () => {
    expect(releaseNotes[0].version).toBe(pkg.version);
  });

  it('has a CHANGELOG.md section for that version', () => {
    expect(changelog).toContain(`## [${pkg.version}]`);
  });

  it('lists the versions newest first, each once', () => {
    for (let i = 1; i < releaseNotes.length; i++) {
      expect(newer(releaseNotes[i - 1].version, releaseNotes[i].version), releaseNotes[i].version).toBe(true);
    }
  });

  it('gives every version a date and notes in every language', () => {
    for (const note of releaseNotes) {
      expect(note.date, note.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const lang of LANGUAGES) {
        expect(note.changes[lang].length, `${note.version} ${lang}`).toBeGreaterThan(0);
        for (const change of note.changes[lang]) expect(change.trim(), `${note.version} ${lang}`).not.toBe('');
      }
    }
  });

  it('says as much in every language', () => {
    for (const note of releaseNotes) {
      const counts = LANGUAGES.map((lang) => note.changes[lang].length);
      expect(new Set(counts).size, note.version).toBe(1);
    }
  });
});
