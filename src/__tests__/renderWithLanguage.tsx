import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { LanguageProvider } from '../i18n/I18nContext';
import type { Language } from '../i18n';

/** Renders a screen or component the way the app does, inside its language. */
export const renderWithLanguage = (ui: ReactElement, lang: Language = 'en') => {
  const view = render(<LanguageProvider lang={lang}>{ui}</LanguageProvider>);
  return {
    ...view,
    rerender: (next: ReactElement) => view.rerender(<LanguageProvider lang={lang}>{next}</LanguageProvider>),
  };
};
