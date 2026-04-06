import { en } from './en';
import { ja } from './ja';
import { zh } from './zh';
import type { Language } from '../languages';

export const translations = {
  zh,
  en,
  ja
} as const;

export const translate = (language: Language, path: string, params?: Record<string, string | number>) => {
  const keys = path.split('.');
  let value: any = translations[language];

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key as keyof typeof value];
    } else {
      return path;
    }
  }

  if (typeof value === 'string' && params) {
    return value.replace(/{(\w+)}/g, (_, k) => params[k] !== undefined ? String(params[k]) : `{${k}}`);
  }

  return value;
};
