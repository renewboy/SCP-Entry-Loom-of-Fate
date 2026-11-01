import { describe, expect, it } from 'vitest';
import { applySearchProgress, displayDesignation } from '../../components/start/WeaveWait';

describe('applySearchProgress', () => {
  it('记录搜索从开始到完成', () => {
    const started = applySearchProgress([], { type: 'search_start', id: 'a', query: 'SCP-173' });
    expect(started).toEqual([{ id: 'a', query: 'SCP-173', state: 'running', sources: [] }]);
    const finished = applySearchProgress(started, { type: 'search_result', id: 'a', sources: [{ title: 'wiki', url: 'https://x' }] });
    expect(finished[0]).toMatchObject({ query: 'SCP-173', state: 'done', sources: [{ title: 'wiki', url: 'https://x' }] });
  });

  it('搜索结果带搜索词时用它补上开始时缺的', () => {
    const started = applySearchProgress([], { type: 'search_start', id: 'a', query: '' });
    expect(applySearchProgress(started, { type: 'search_result', id: 'a', query: 'SCP-682', sources: [] })[0].query).toBe('SCP-682');
  });

  it('标记失败的搜索，其他条目不变', () => {
    const entries = applySearchProgress(applySearchProgress([], { type: 'search_start', id: 'a', query: 'A' }), { type: 'search_start', id: 'b', query: 'B' });
    const next = applySearchProgress(entries, { type: 'search_failed', id: 'a' });
    expect(next.map(entry => entry.state)).toEqual(['failed', 'running']);
  });

  it('结构化草稿不影响搜索记录', () => {
    const entries = applySearchProgress([], { type: 'search_start', id: 'a', query: 'A' });
    expect(applySearchProgress(entries, { type: 'draft', data: {} })).toBe(entries);
  });
});

describe('displayDesignation', () => {
  it('从链接里取编号', () => {
    expect(displayDesignation('https://scp-wiki.wikidot.com/scp-3008')).toBe('SCP-3008');
  });

  it('统一大写', () => {
    expect(displayDesignation('scp 173')).toBe('SCP-173');
  });

  it('取不到编号时截短', () => {
    expect(displayDesignation('一段很长很长很长很长很长很长的描述文字')).toHaveLength(14);
    expect(displayDesignation('短描述')).toBe('短描述');
  });
});
