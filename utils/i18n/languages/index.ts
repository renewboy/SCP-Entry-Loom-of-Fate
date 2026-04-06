import { enLanguagePack } from './en';
import { jaLanguagePack } from './ja.ts';
import { zhLanguagePack } from './zh';
import type { Language, LanguagePack } from './types';
export type { Language, PromptTextLanguage, LanguagePack } from './types';
export { SUPPORTED_LANGUAGES } from './types';

export const languagePacks: Record<Language, LanguagePack> = {
  zh: zhLanguagePack,
  en: enLanguagePack,
  ja: jaLanguagePack
};

export const defaultLanguage: Language = 'en';

export const getLanguagePack = (language: Language) => {
  return languagePacks[language] || languagePacks[defaultLanguage];
};

export const isSupportedLanguage = (value: unknown): value is Language => {
  return typeof value === 'string' && value in languagePacks;
};
