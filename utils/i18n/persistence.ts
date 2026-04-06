import { saveSetting, loadSetting } from '../../services/indexedDBService';
import { Language } from '../../types';
import { isSupportedLanguage } from './languages';

export const loadLanguage = async () => {
  const savedLang = await loadSetting('language');
  if (isSupportedLanguage(savedLang)) {
    return savedLang as Language;
  }
  return undefined;
};

export const saveLanguage = (lang: Language) => {
  saveSetting('language', lang);
};
