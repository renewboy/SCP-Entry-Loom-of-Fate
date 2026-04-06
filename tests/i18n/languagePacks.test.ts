import { describe, expect, it } from 'vitest';
import {
  isSupportedLanguage,
  languagePacks,
  translate,
  translations
} from '../../utils/i18n';

describe('language packs', () => {
  it('注册中英日语言包', () => {
    expect(languagePacks.zh.code).toBe('zh');
    expect(languagePacks.en.code).toBe('en');
    expect(languagePacks.ja.code).toBe('ja');
  });

  it('prompt 语言名直接定义在 translations 层', () => {
    expect(translate('zh', 'i18n.prompt_language_labels.zh')).toBe('中文');
    expect(translate('zh', 'i18n.prompt_language_labels.en')).toBe('Chinese');
    expect(translate('en', 'i18n.prompt_language_labels.zh')).toBe('英文');
    expect(translate('en', 'i18n.prompt_language_labels.en')).toBe('English');
    expect(translate('ja', 'i18n.prompt_language_labels.zh')).toBe('日语');
    expect(translate('ja', 'i18n.prompt_language_labels.en')).toBe('Japanese');
  });

  it('locale、语言名与 boot 关键词直接定义在 translations 层', () => {
    expect(translate('zh', 'i18n.locale')).toBe('zh-CN');
    expect(translate('en', 'i18n.locale')).toBe('en-US');
    expect(translate('ja', 'i18n.locale')).toBe('ja-JP');
    expect(translate('zh', 'i18n.languages.ja')).toBe('日语');
    expect(translate('en', 'i18n.languages.ja')).toBe('Japanese');
    expect(translate('ja', 'i18n.languages.ja')).toBe('日本語');
    expect((translations.zh.i18n.boot_keywords as string[])).toContain('命运织机');
    expect((translations.en.i18n.boot_keywords as string[])).toContain('Loom of Fate');
    expect((translations.ja.i18n.boot_keywords as string[])).toContain('運命の織機');
  });

  it('支持的语言由注册表决定', () => {
    expect(isSupportedLanguage('zh')).toBe(true);
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('ja')).toBe(true);
    expect(translate('zh', 'i18n.language_label')).toBe('中文');
    expect(translate('ja', 'i18n.language_label')).toBe('日本語');
  });
});
