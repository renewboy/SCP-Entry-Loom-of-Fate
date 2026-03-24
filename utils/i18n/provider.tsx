import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '../../types';
import { translations } from './translations';
import { loadLanguage, saveLanguage } from './persistence';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

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
    const keys = path.split('.');
    let value: any = translations[language];

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key as keyof typeof value];
      } else {
        return path;
      }
    }

    if (typeof value === 'string' && params) {
      return value.replace(/{(\w+)}/g, (_, k) => params[k] !== undefined ? String(params[k]) : `{${k}}`);
    }

    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
