import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '../../types';
import { translate } from './translations';
import { loadLanguage, saveLanguage } from './persistence';
import { defaultLanguage, getLanguagePack } from './languages';
import type { LanguagePack } from './languages';

interface LanguageContextType {
  language: Language;
  pack: LanguagePack;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  useEffect(() => {
    const initLanguage = async () => {
      const savedLang = await loadLanguage();
      if (savedLang) {
        setLanguageState(savedLang);
      }
    };
    initLanguage();
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    saveLanguage(lang);
  };

  const t = (path: string, params?: Record<string, string | number>) => {
    return translate(language, path, params);
  };

  const pack = getLanguagePack(language);

  return (
    <LanguageContext.Provider value={{ language, pack, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
