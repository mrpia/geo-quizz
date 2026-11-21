import type { ReactNode } from 'react';
import { AUTHOR_LABEL, AUTHOR_URL, SOURCE_URL, SUPPORT_URL } from '../config/site';
import { releaseNotes } from '../domain/releaseNotes';
import { useI18n } from '../i18n/I18nContext';
import './screens.css';
import './AboutScreen.css';

/** Where the map data comes from (docs/data.md). Not this deployment's, so not in site.ts. */
const NATURAL_EARTH_URL = 'https://www.naturalearthdata.com/';

type Props = {
  /** This build's version (`__APP_VERSION__`, from package.json). */
  version: string;
  onBack: () => void;
};

/** Every link here leaves the app, so it opens a tab and keeps the game where it was. */
const External = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

const LINK = '{link}';

/**
 * A dictionary sentence with its `{link}` replaced by `link`. The sentence is
 * fetched with `{link}` standing for itself, then split there; a translation
 * that loses or repeats the placeholder throws instead of rendering half a
 * sentence.
 */
const WithLink = ({ text, link }: { text: string; link: ReactNode }) => {
  const parts = text.split(LINK);
  if (parts.length !== 2) throw new Error(`AboutScreen: expected one ${LINK} in ${JSON.stringify(text)}`);
  return (
    <>
      {parts[0]}
      {link}
      {parts[1]}
    </>
  );
};

export const AboutScreen = ({ version, onBack }: Props) => {
  const { t, lang } = useI18n();
  const withLink = { link: LINK };

  return (
    <div className="screen about">
      <header className="screen__header about__header">
        <button
          type="button"
          className="screen__round-btn"
          data-testid="about-back"
          aria-label={t('common.backToHomeAria')}
          onClick={onBack}
        >
          🏠
        </button>
        <h2 className="screen__title">{t('about.title')}</h2>
      </header>

      <section className="screen__panel about__identity">
        <p data-testid="about-version">
          <span className="about__app">Geo Quizz</span> {t('about.version', { version })}
        </p>
        <p className="about__muted">
          <WithLink
            text={t('about.credit', withLink)}
            link={<External href={AUTHOR_URL}>{AUTHOR_LABEL}</External>}
          />
        </p>
      </section>

      <section className="screen__panel">
        <h3 className="screen__panel-title">{t('about.supportTitle')}</h3>
        <p>
          <WithLink
            text={t('about.coffee', withLink)}
            link={<External href={SUPPORT_URL}>{t('about.coffeeLink')}</External>}
          />
        </p>
      </section>

      <section className="screen__panel">
        <h3 className="screen__panel-title">{t('about.dataTitle')}</h3>
        <p>{t('about.data')}</p>
        <p>{t('about.dataErase')}</p>
      </section>

      <section className="screen__panel">
        <h3 className="screen__panel-title">{t('about.mapTitle')}</h3>
        <p>
          <WithLink
            text={t('about.map', withLink)}
            link={<External href={NATURAL_EARTH_URL}>{t('about.mapLink')}</External>}
          />
        </p>
      </section>

      <section className="screen__panel">
        <h3 className="screen__panel-title">{t('about.sourceTitle')}</h3>
        <p>
          <WithLink
            text={t('about.source', withLink)}
            link={<External href={SOURCE_URL}>{t('about.sourceLink')}</External>}
          />
        </p>
      </section>

      <section className="screen__panel">
        <h3 className="screen__panel-title">{t('about.whatsNew')}</h3>
        <ul className="about__notes">
          {releaseNotes.map((note) => (
            <li key={note.version}>
              <p className="about__note-head">
                <span className="about__note-version">v{note.version}</span>
                <span className="about__muted">{note.date}</span>
              </p>
              <ul className="about__note-changes">
                {note.changes[lang].map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
