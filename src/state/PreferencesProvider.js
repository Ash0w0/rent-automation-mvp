import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n/index';
import { loadPreferences, savePreferences } from '../lib/preferencesStorage';

const FONT_SCALES = [0.9, 1.0, 1.15, 1.3];

const DEFAULT_PREFS = {
  language: 'en',
  fontScale: 1.0,
};

const PreferencesContext = createContext({
  language: 'en',
  fontScale: 1.0,
  setLanguage: () => {},
  setFontScale: () => {},
  fontScaleIndex: 1,
  fontScales: FONT_SCALES,
});

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadPreferences().then((saved) => {
      if (saved) {
        setPrefs((p) => ({ ...p, ...saved }));
        if (saved.language) i18n.changeLanguage(saved.language);
      }
      setReady(true);
    });
  }, []);

  const setLanguage = useCallback((lang) => {
    setPrefs((p) => {
      const next = { ...p, language: lang };
      savePreferences(next);
      i18n.changeLanguage(lang);
      return next;
    });
  }, []);

  const setFontScale = useCallback((scale) => {
    setPrefs((p) => {
      const next = { ...p, fontScale: scale };
      savePreferences(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      language: prefs.language,
      fontScale: prefs.fontScale,
      fontScaleIndex: FONT_SCALES.indexOf(prefs.fontScale),
      fontScales: FONT_SCALES,
      setLanguage,
      setFontScale,
    }),
    [prefs.language, prefs.fontScale, setLanguage, setFontScale],
  );

  if (!ready) return null;

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
