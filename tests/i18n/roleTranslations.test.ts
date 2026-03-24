import { describe, it, expect } from 'vitest';
import { ROLE_TRANSLATIONS } from '../../utils/i18n/roleTranslations';
import { Role } from '../../types';

describe('ROLE_TRANSLATIONS', () => {
  it('覆盖所有内置角色枚举', () => {
    const roles = Object.values(Role);
    roles.forEach(role => {
      expect(typeof ROLE_TRANSLATIONS[role]).toBe('string');
    });
  });
});
