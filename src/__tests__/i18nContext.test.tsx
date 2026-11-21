import { render, screen } from '@testing-library/react';
import { LanguageProvider, useI18n } from '../i18n/I18nContext';

const Probe = () => {
  const { lang, t } = useI18n();
  return <div>{`${lang}:${t('home.start')}`}</div>;
};

describe('LanguageProvider / useI18n', () => {
  it('translates into the provided language', () => {
    render(
      <LanguageProvider lang="de">
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByText('de:Starten')).toBeInTheDocument();
  });

  it('throws when no provider is mounted, rather than guessing a language', () => {
    // React logs the error it rethrows; keep the test output clean.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/LanguageProvider/);
    spy.mockRestore();
  });

  it('syncs document.documentElement.lang', () => {
    render(
      <LanguageProvider lang="en">
        <Probe />
      </LanguageProvider>,
    );
    expect(document.documentElement.lang).toBe('en');
  });
});
