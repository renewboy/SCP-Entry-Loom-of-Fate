import { describe, it, expect } from 'vitest';
import { translations } from '../../utils/i18n/translations';

const getValueByPath = (source: Record<string, unknown>, path: string) => {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
};

describe('translations', () => {
  it('中英文均包含关键文案', () => {
    const requiredKeys = [
      'app.switch_lang',
      'start.btn_start',
      'game.input_placeholder',
      'endings.contained.title',
      'modal.title',
      'report.title'
    ];

    requiredKeys.forEach(key => {
      const zhValue = getValueByPath(translations.zh, key);
      const enValue = getValueByPath(translations.en, key);
      expect(typeof zhValue).toBe('string');
      expect(typeof enValue).toBe('string');
    });
  });

  it('启动加载提示包含多条文案', () => {
    const zhLoading = translations.zh.start.loading_msgs;
    const enLoading = translations.en.start.loading_msgs;
    expect(Array.isArray(zhLoading)).toBe(true);
    expect(Array.isArray(enLoading)).toBe(true);
    expect(zhLoading.length).toBeGreaterThan(0);
    expect(enLoading.length).toBeGreaterThan(0);
  });
});
