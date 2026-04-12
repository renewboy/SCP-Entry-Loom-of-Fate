import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import WorldLineTimelineCard from '../../../components/postGameReport/worldLine/WorldLineTimelineCard';

describe('WorldLineTimelineCard', () => {
  it('在世界线卡片中按 markdown 渲染叙事文本', () => {
    const html = renderToStaticMarkup(
      <WorldLineTimelineCard
        event={{
          id: 'evt-1',
          trigger: 'INITIAL CONTAINMENT',
          response: '**Warning**\n\n- breach\n- lockdown',
          stability: 42,
        }}
        index={0}
        timelineLength={1}
        nodeIdLabel="Node"
        t={(key) => key}
      />,
    );

    expect(html).toContain('<strong>Warning</strong>');
    expect(html).toContain('<ul');
    expect(html).toContain('>breach</li>');
    expect(html).not.toContain('**Warning**');
  });
});
