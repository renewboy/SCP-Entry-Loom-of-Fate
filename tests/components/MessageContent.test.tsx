import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RuntimeNPCState } from '../../types';
import MessageContent from '../../components/shared/MessageContent';

const npcs: RuntimeNPCState[] = [
  {
    id: 'npc_doctor',
    name: 'Dr. Ada',
    archetype: 'Scientist',
    nodeId: 'lab',
    alive: true
  }
];

const translate = (key: string) => ({
  'game.narrative_media.psi_pressure_label': '灵能压强',
}[key] || key);

const renderPsiPressure = (stability: number): number => {
  const html = renderToStaticMarkup(
    <MessageContent
      content={[
        '[#PSI]耳鸣像金属丝一样勒紧你的太阳穴。[/#PSI]',
        `[STABILITY: ${stability}]`
      ].join('\n\n')}
      t={translate}
      npcs={npcs}
      className="message-content-print"
      stability={stability}
    />
  );

  const match = html.match(/灵能压强<\/span><span[^>]*>(\d+)%<\/span>/);
  expect(match).not.toBeNull();
  return Number(match?.[1]);
};

describe('MessageContent', () => {
  it('渲染叙事介质和 NPC 发言，并过滤控制标签', () => {
    const html = renderToStaticMarkup(
      <MessageContent
        content={[
          '你在终端前停下。',
          '[#DOC: title="值班记录" style="typed"]实验对象于 03:14 再次敲击观察窗。[/#DOC]',
          '[@npc_doctor: 记录下来，然后马上离开这里。]',
          '[VISUAL: dark control room]',
          '[STABILITY: 68]'
        ].join('\n\n')}
        t={translate}
        npcs={npcs}
        className="message-content-print"
      />
    );

    expect(html).toContain('值班记录');
    expect(html).toContain('实验对象于 03:14 再次敲击观察窗。');
    expect(html).toContain('Dr. Ada');
    expect(html).toContain('记录下来，然后马上离开这里。');
    expect(html).not.toContain('[VISUAL: dark control room]');
    expect(html).not.toContain('[STABILITY: 68]');
  });

  it('渲染带部分错误闭合标签的介质内容', () => {
    const html = renderToStaticMarkup(
      <MessageContent
        content={[
          '你按住耳机。',
          '[#COMM: source="Iota-20 频道" time="02:22"]现实浓度跌至45%以下。[/＃COMM]',
          '[STABILITY: 45]'
        ].join('\n\n')}
        t={translate}
        npcs={npcs}
        className="message-content-print"
      />
    );

    expect(html).toContain('Iota-20 频道');
    expect(html).toContain('02:22');
    expect(html).toContain('现实浓度跌至45%以下。');
    expect(html).not.toContain('[/＃COMM]');
    expect(html).not.toContain('[STABILITY: 45]');
  });

  it('PSI介质的灵能压强会随稳定性连续变化', () => {
    const highPressure = renderPsiPressure(100);
    const midPressure = renderPsiPressure(68);
    const criticalPressure = renderPsiPressure(18);

    expect(highPressure).toBe(35);
    expect(midPressure).toBe(58);
    expect(criticalPressure).toBe(86);
    expect(midPressure).toBeGreaterThan(highPressure);
    expect(criticalPressure).toBeGreaterThan(midPressure);
  });
});
