import { en as enTranslations } from '../translations/en';
import type { LanguagePack } from './types';

export const enLanguagePack: LanguagePack<typeof enTranslations> = {
  code: 'en',
  ui: enTranslations
};
