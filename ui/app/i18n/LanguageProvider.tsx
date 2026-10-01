import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { IntlProvider } from 'react-intl';
import { IntlErrorCode } from '@formatjs/intl';
import { catalogs, type Locale, type MessageKey } from './translations';

const STORAGE_KEY = 'sre-in-a-nutshell-locale';

function readInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch {
    // localStorage may be unavailable in some sandboxed contexts
  }
  return 'en';
}

type TranslateParams = Record<string, string | number>;

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence failures — selection still applies for the session
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: TranslateParams) => interpolate(catalogs[locale][key], params),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <IntlProvider
      locale={locale}
      defaultLocale="en"
      messages={catalogs[locale]}
      onError={(err) => {
        // Strato components resolve their own internal message keys through this
        // IntlProvider. Those keys are not in our catalog, so react-intl logs
        // MISSING_TRANSLATION noise. Suppress those; re-throw everything else.
        if (err.code === IntlErrorCode.MISSING_TRANSLATION) return;
        console.error(err);
      }}
    >
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </IntlProvider>
  );
}

export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
