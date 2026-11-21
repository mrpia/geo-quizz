import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { translate } from './index';
import type { Language, TranslationKey } from './types';

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

type I18n = { lang: Language; t: Translate };

const makeT = (lang: Language): Translate => (key, vars) => translate(lang, key, vars);

// No default language, unlike math-quizz: a screen rendered outside the
// provider is a bug, and a silent fallback would hide it.
const I18nContext = createContext<I18n | null>(null);

export const useI18n = (): I18n => {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error('useI18n: no LanguageProvider above this component');
  return i18n;
};

export const LanguageProvider = ({
  lang,
  children,
}: {
  lang: Language;
  children: ReactNode;
}) => {
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <I18nContext.Provider value={{ lang, t: makeT(lang) }}>{children}</I18nContext.Provider>;
};
