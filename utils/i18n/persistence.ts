import { saveSetting, loadSetting } from '../../services/indexedDBService';
import { Language } from '../../types';

export const loadLanguage = async () => {
  const savedLang = await loadSetting('language');
  if (savedLang && (savedLang === 'en' || savedLang === 'zh')) {
    return savedLang as Language;
  }
  return undefined;
};

export const saveLanguage = (lang: Language) => {
  saveSetting('language', lang);
};
