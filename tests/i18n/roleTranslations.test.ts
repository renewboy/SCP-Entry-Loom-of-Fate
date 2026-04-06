import { describe, it, expect } from 'vitest';
import { ROLE_TRANSLATIONS, getRoleTranslation } from '../../utils/i18n/roleTranslations';
import { Role } from '../../types';

describe('ROLE_TRANSLATIONS', () => {
  it('覆盖所有内置角色枚举', () => {
    const roles = Object.values(Role);
    roles.forEach(role => {
      expect(typeof ROLE_TRANSLATIONS[role]?.zh).toBe('string');
      expect(typeof ROLE_TRANSLATIONS[role]?.en).toBe('string');
      expect(typeof ROLE_TRANSLATIONS[role]?.ja).toBe('string');
    });
  });

  it('按语言返回角色显示文本', () => {
    expect(getRoleTranslation(Role.RESEARCHER, 'zh')).toBe('研究员');
    expect(getRoleTranslation(Role.RESEARCHER, 'en')).toBe('Researcher');
    expect(getRoleTranslation(Role.RESEARCHER, 'ja')).toBe('研究員');
  });
});
