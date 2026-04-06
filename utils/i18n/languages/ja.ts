import { ja as jaTranslations } from '../translations/ja.ts';
import type { LanguagePack } from './types';

export const jaLanguagePack: LanguagePack<typeof jaTranslations> = {
  code: 'ja',
  ui: jaTranslations
};
