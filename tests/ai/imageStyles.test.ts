import { describe, expect, it, vi } from 'vitest';
import { getImageStyleDefinition, IMAGE_DRAWING_STYLE_OPTIONS, normalizeImageDrawingStyle } from '../../services/ai/imageStyles';
import { buildImagePrompt } from '../../services/ai/promptUtils';
import { translate } from '../../utils/i18n/translations';
import type { ImageStyleKind } from '../../services/ai/types';

// Supply the data URL that Vite's asset plugin produces in the application build.
vi.mock('../../assets/imageStyles/abstract.webp?inline', async () => {
  const { readFile } = await import('node:fs/promises');
  const pixels = await readFile('assets/imageStyles/abstract.webp');
  return { default: `data:image/webp;base64,${pixels.toString('base64')}` };
});

describe('image style registry', () => {
  it.each<[ImageStyleKind, string]>([
    ['background', 'cold concrete, corroded steel, hairline fractures, faint red reflections'],
    ['entity', 'gaunt humanoid, stained orange jumpsuit, open book replacing the head, thin arms, long curled fingers'],
    ['npc', 'Foundation security operative, short ash-brown hair, stubble, black tactical armor, helmet, riot shield'],
    ['scene', 'dark metal door, scratching marks'],
  ])('applies the %s style template to an unchanged subject description', (kind, description) => {
    const prompt = buildImagePrompt(description, kind, 'gothic-ink', '1:1');
    expect(prompt).toContain(description);
    expect(prompt.split(description)).toHaveLength(2);
    expect(prompt).toContain('scp foundation style');
    expect(prompt).toContain('hand-drawn 2D illustration');
    expect(prompt).toMatch(/clinical|scp foundation record illustration/);
    expect(prompt).toMatch(/cold muted tones|desaturated/);
    expect(prompt).toContain('without invented characters or scenery');
    expect(prompt).not.toMatch(/Hollow Knight|lighthouse|library|kitchen|lateral 2D|side-on|near-black|horizontal (floor|ground)|light motes|colored haze|teal-green|warm amber/);
  });

  it.each([
    ['original', 'original'],
    ['narrative-print', 'narrative-print'],
    ['gothic-ink', 'gothic-ink'],
    ['paper-cut', 'narrative-print'],
    [undefined, 'original'],
    [null, 'original'],
    ['unknown-style', 'original'],
    ['__proto__', 'original'],
    ['toString', 'original'],
    [{}, 'original'],
  ])('normalizes saved value %j to %s', (value, expected) => {
    expect(normalizeImageDrawingStyle(value)).toBe(expected);
  });

  it.each(['zh', 'en', 'ja'] as const)('provides localized names for every selectable style in %s', language => {
    expect(IMAGE_DRAWING_STYLE_OPTIONS.map(option => option.value)).toEqual(['original', 'narrative-print', 'gothic-ink']);
    for (const { labelKey } of IMAGE_DRAWING_STYLE_OPTIONS) {
      expect(translate(language, labelKey)).not.toBe(labelKey);
      expect(translate(language, labelKey)).not.toMatch(/Hollow Knight|空洞骑士|剪纸|切り絵|Paper-cut/);
    }
  });

  it('loads the actual abstract reference only for narrative print', async () => {
    const references = await getImageStyleDefinition('narrative-print').loadReferences();
    expect(references).toHaveLength(1);
    expect(references[0].mimeType).toBe('image/webp');
    expect(atob(references[0].data).slice(0, 4)).toBe('RIFF');
    await expect(getImageStyleDefinition('original').loadReferences()).resolves.toEqual([]);
    await expect(getImageStyleDefinition('gothic-ink').loadReferences()).resolves.toEqual([]);
  });

  it.each(IMAGE_DRAWING_STYLE_OPTIONS)('builds a prompt without optional canvas instructions for $value', ({ value }) => {
    const prompt = buildImagePrompt('a researcher in a red coat', 'npc', value);
    expect(prompt).toContain('a researcher in a red coat');
    expect(prompt).not.toMatch(/undefined|Output a/);
  });
});
