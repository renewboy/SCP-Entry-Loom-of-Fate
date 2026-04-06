import { describe, it, expect } from 'vitest';
import { translations } from '../../utils/i18n/translations';

const getValueByPath = (source: Record<string, unknown>, path: string) => {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
};

describe('translations', () => {
  it('中英日文均包含关键文案', () => {
    const zhTranslations = translations.zh as Record<string, unknown>;
    const enTranslations = translations.en as Record<string, unknown>;
    const jaTranslations = translations.ja as Record<string, unknown>;
    const requiredKeys = [
      'start.btn_start',
      'game.input_placeholder',
      'endings.contained.title',
      'modal.title',
      'report.title',
      'ai.session_lost',
      'ai.causal_sync_timeout'
    ];

    requiredKeys.forEach(key => {
      const zhValue = getValueByPath(zhTranslations, key);
      const enValue = getValueByPath(enTranslations, key);
      const jaValue = getValueByPath(jaTranslations, key);
      expect(typeof zhValue).toBe('string');
      expect(typeof enValue).toBe('string');
      expect(typeof jaValue).toBe('string');
    });
  });

  it('启动加载提示包含多条文案', () => {
    const zhLoading = (translations.zh as any).start.loading_msgs as string[];
    const enLoading = (translations.en as any).start.loading_msgs as string[];
    const jaLoading = (translations.ja as any).start.loading_msgs as string[];
    expect(Array.isArray(zhLoading)).toBe(true);
    expect(Array.isArray(enLoading)).toBe(true);
    expect(Array.isArray(jaLoading)).toBe(true);
    expect(zhLoading.length).toBeGreaterThan(0);
    expect(enLoading.length).toBeGreaterThan(0);
    expect(jaLoading.length).toBeGreaterThan(0);
  });
});
