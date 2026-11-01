import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { translations } from '../../utils/i18n/translations';

const ROOT = path.resolve(__dirname, '../..');
const SCREENS = [
  'components/start',
  'components/StartScreen.tsx',
  'components/ParticleText.tsx',
  'components/entityProfile',
  'components/tactical',
  'components/editor',
  'components/TacticalPreview.tsx',
  'components/EntityProfileAugmentation.tsx',
  'components/LegacyArchiveDrawer.tsx',
  'components/postGameReport/worldLine/LegacySelection.tsx',
  'components/game/stage/NetworkNode.tsx',
  'components/game/stage/NetworkGraph.tsx',
  'components/game/stage/NetworkLegend.tsx',
  'components/game/stage/SiteNetwork.tsx',
  'components/game/stage/StageEntryDoor.tsx',
  'hooks/storyEditor/useStoryEditorModals.tsx',
];
const COPY_ATTRIBUTES = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label']);
/** Single letters are map marks and key hints, not copy. (Beta) stays the same in every language */
const isCopy = (raw: string) => /[A-Za-z぀-ヿ一-鿿]{2,}/.test(raw.replace(/&\w+;/g, '').replace('(Beta)', ''));

const filesIn = (target: string): string[] => {
  const full = path.join(ROOT, target);
  if (fs.statSync(full).isFile()) return [full];
  return fs.readdirSync(full).filter(name => name.endsWith('.tsx')).map(name => path.join(full, name));
};

const hardcodedIn = (file: string) => {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && isCopy(node.text)) found.push(node.text.trim());
    if (ts.isJsxAttribute(node) && COPY_ATTRIBUTES.has(node.name.getText()) && node.initializer && ts.isStringLiteral(node.initializer) && isCopy(node.initializer.text)) {
      found.push(`${node.name.getText()}="${node.initializer.text}"`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found.map(text => `${path.relative(ROOT, file)}: ${text}`);
};

const keysOf = (value: unknown, prefix = ''): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key));
};

describe('界面文案走 i18n', () => {
  it('这些界面的 JSX 里没有写死的文案', () => {
    expect(SCREENS.flatMap(filesIn).flatMap(hardcodedIn)).toEqual([]);
  });

  it.each(['entity_profile', 'map_editor', 'story_editor', 'editor_assistant', 'legacy'])('%s 的文案中英日都有', section => {
    const zh = keysOf((translations.zh as Record<string, unknown>)[section]).sort();
    expect(keysOf((translations.en as Record<string, unknown>)[section]).sort()).toEqual(zh);
    expect(keysOf((translations.ja as Record<string, unknown>)[section]).sort()).toEqual(zh);
  });
});
