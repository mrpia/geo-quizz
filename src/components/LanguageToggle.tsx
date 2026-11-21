import { LANGUAGES, NATIVE_LANGUAGE_NAMES, type Language } from '../i18n/language';
import { useI18n } from '../i18n/I18nContext';
import './LanguageToggle.css';

type Props = {
  value: Language;
  onChange: (next: Language) => void;
};

/** FR / DE / EN, each named in its own language (as in math-quizz). */
export const LanguageToggle = ({ value, onChange }: Props) => {
  const { t } = useI18n();
  return (
    <div className="language-toggle" role="radiogroup" aria-label={t('settings.language')}>
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={value === code}
          className="language-toggle__option"
          data-testid={`language-${code}`}
          onClick={() => onChange(code)}
        >
          <span className="language-toggle__badge" aria-hidden="true">
            {code.toUpperCase()}
          </span>
          {NATIVE_LANGUAGE_NAMES[code]}
        </button>
      ))}
    </div>
  );
};
