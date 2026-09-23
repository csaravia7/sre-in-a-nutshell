import React from 'react';
import { useTranslation } from '../i18n/LanguageProvider';

export function LanguageSelector() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div className="lang-toggle-group" aria-label={t('lang.label')}>
      {(['en', 'es'] as const).map((option) => (
        <button
          key={option}
          type="button"
          className={`lang-toggle ${locale === option ? 'active' : ''}`}
          onClick={() => setLocale(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
