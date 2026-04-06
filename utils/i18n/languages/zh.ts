import { zh as zhTranslations } from '../translations/zh';
import type { LanguagePack } from './types';

export const zhLanguagePack: LanguagePack<typeof zhTranslations> = {
  code: 'zh',
  ui: zhTranslations
};
