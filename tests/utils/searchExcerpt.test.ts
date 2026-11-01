import { describe, expect, it } from 'vitest';
import { parseSearchExcerpt } from '../../utils/searchExcerpt';

describe('parseSearchExcerpt', () => {
  it('去掉 Markdown 标记，保留结构', () => {
    const raw = '**SCP-3004** (titled ***Imago***, written by *kinch*) is an article.\n\n---\n\n### 1. Classification\n* **Item #:** SCP-3004\n- **Object Class:** Keter';
    expect(parseSearchExcerpt(raw)).toEqual([
      { kind: 'text', text: 'SCP-3004 (titled Imago, written by kinch) is an article.' },
      { kind: 'heading', text: '1. Classification' },
      { kind: 'item', text: 'Item #: SCP-3004' },
      { kind: 'item', text: 'Object Class: Keter' },
    ]);
  });

  it('把行内公式换成符号', () => {
    expect(parseSearchExcerpt('Neutralized $\\rightarrow$ Keter')[0].text).toBe('Neutralized → Keter');
    expect(parseSearchExcerpt('a $\\frac{1}{2}$ b')[0].text).toBe('a b');
  });

  it('链接只留文字，引用标记和网址去掉', () => {
    expect(parseSearchExcerpt('See [the wiki](https://x.y/z) [1, 2] and https://a.b/c now')[0].text).toBe('See the wiki and now');
  });

  it('不动单词中间的下划线', () => {
    expect(parseSearchExcerpt('node_operations_center')[0].text).toBe('node_operations_center');
  });

  it('表格变成一行，分隔行跳过', () => {
    expect(parseSearchExcerpt('| a | b |\n|---|---|\n| c | d |')).toEqual([
      { kind: 'text', text: 'a · b' },
      { kind: 'text', text: 'c · d' },
    ]);
  });

  it('超长时在句子结尾截断，不留孤立的标题', () => {
    const blocks = parseSearchExcerpt('First sentence here. Second sentence goes on and on.\n## Next', 30);
    expect(blocks).toEqual([{ kind: 'text', text: 'First sentence here.' }]);
  });

  it('中文同样在句号处截断', () => {
    expect(parseSearchExcerpt('第一句话到这里结束。第二句话很长很长很长很长很长。', 15)[0].text).toBe('第一句话到这里结束。');
  });
});
