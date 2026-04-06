export const SUPPORTED_LANGUAGES = ['zh', 'en', 'ja'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export type PromptTextLanguage = 'zh' | 'en';
export type LanguageKeywordScope = 'boot';

export interface LanguagePack<UI = unknown> {
  code: Language;
  ui: UI;
}
