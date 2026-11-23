import { fireEvent, screen, within } from '@testing-library/react';
import { AUTHOR_LABEL, AUTHOR_URL, SOURCE_URL, SUPPORT_URL } from '../config/site';
import { releaseNotes } from '../domain/releaseNotes';
import type { Language } from '../i18n';
import { AboutScreen } from '../screens/AboutScreen';
import { renderWithLanguage } from './renderWithLanguage';

const setup = (lang: Language = 'en') => {
  const onBack = vi.fn();
  renderWithLanguage(<AboutScreen version="9.8.7" onBack={onBack} />, lang);
  return { onBack };
};

/** The panel under the heading `name`. */
const panel = (name: string | RegExp) => {
  const section = screen.getByRole('heading', { name }).closest('section');
  if (!section) throw new Error(`no section for ${String(name)}`);
  return within(section);
};

/** A link that leaves the app opens a tab and gives the page no handle on it. */
const expectNewTab = (link: HTMLElement) => {
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
};

describe('AboutScreen', () => {
  it('names the app and the version it is given', () => {
    setup();
    expect(screen.getByTestId('about-version')).toHaveTextContent('Geo Quizz version 9.8.7');
  });

  it('is titled "Über die App" in German, not a bare "Über"', () => {
    setup('de');
    expect(screen.getByRole('heading', { name: 'Über die App' })).toBeInTheDocument();
  });

  it('credits the author, with the site as the link', () => {
    setup('fr');
    expect(screen.getByText(/Conçu avec 💖 à Zürich, Suisse par/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: AUTHOR_LABEL })).toHaveAttribute('href', AUTHOR_URL);
  });

  it('credits Natural Earth for the map', () => {
    setup();
    const map = panel('Map');
    expect(map.getByText(/Made with/)).toHaveTextContent('Made with Natural Earth.');
    const link = map.getByRole('link', { name: 'Natural Earth' });
    expect(link).toHaveAttribute('href', 'https://www.naturalearthdata.com/');
    expectNewTab(link);
  });

  it('links to the source code, and says why it is open', () => {
    setup();
    const source = panel('Source code');
    expect(source.getByText(/open/)).toBeInTheDocument();
    const link = source.getByRole('link', { name: 'GitHub' });
    expect(link).toHaveAttribute('href', SOURCE_URL);
    expectNewTab(link);
  });

  it('says what is kept on the device, and that answers are not kept at all', () => {
    setup();
    const data = panel('Your data');
    expect(data.getByText(/settings .* stay in this browser/)).toBeInTheDocument();
    expect(data.getByText(/answers and scores are not saved/)).toBeInTheDocument();
    expect(data.getByText(/no account, no tracking/)).toBeInTheDocument();
  });

  it('routes the coffee through the parents, in a panel of its own', () => {
    setup('de');
    const support = panel('Die App unterstützen');
    expect(support.getByText(/sag es deinen Eltern/)).toBeInTheDocument();
    const link = support.getByRole('link', { name: /Kaffee spendieren ☕/ });
    expect(link).toHaveAttribute('href', SUPPORT_URL);
    expectNewTab(link);
  });

  it('lists what is new in each version, in the language of the app', () => {
    setup('de');
    const news = panel('Neuigkeiten');
    for (const note of releaseNotes) {
      expect(news.getByText(`v${note.version}`)).toBeInTheDocument();
      for (const change of note.changes.de) expect(news.getByText(change)).toBeInTheDocument();
    }
    expect(news.queryByText(releaseNotes[0].changes.en[0])).toBeNull();
  });

  it('never shows a {link} placeholder', () => {
    for (const lang of ['fr', 'de', 'en'] as const) {
      const { unmount } = renderWithLanguage(<AboutScreen version="1.0.0" onBack={() => {}} />, lang);
      expect(document.body.textContent).not.toMatch(/\{\w+\}/);
      unmount();
    }
  });

  it('goes back home with 🏠', () => {
    const { onBack } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'back to home' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
