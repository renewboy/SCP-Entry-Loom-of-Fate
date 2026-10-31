import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DossierOverlay from '../../components/game/stage/DossierOverlay';
import type { NpcDossier } from '../../utils/npcDossier';

const t = (key: string) => key;

const dossiers: NpcDossier[] = [
  {
    npc: { id: 'npc_xiao', name: '萧博士', archetype: '知情者', nodeId: 'n1', alive: true, secretTags: ['双重忠诚'], dialogueGoals: ['试探玩家'] },
    met: true,
    quotes: [{ turn: 3, text: '第一句' }, { turn: 5, text: '最后一句' }],
  },
  {
    npc: { id: 'npc_qin', name: '秦洛仪', archetype: '幸存者', nodeId: 'n2', alive: false, secretTags: [] },
    met: true,
    quotes: [],
  },
  {
    npc: { id: 'npc_robot', name: '哨兵', archetype: '构装体', nodeId: 'n3', alive: true, secretTags: ['核心矛盾'] },
    met: false,
    quotes: [],
  },
];

const setup = (overrides: Partial<React.ComponentProps<typeof DossierOverlay>> = {}) => {
  const onZoom = vi.fn();
  const onTab = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <DossierOverlay
      open
      tab="people"
      onTab={onTab}
      dossiers={dossiers}
      inventory={[{ id: 'alpha_key', name: 'alpha_key' }, { id: 'badge', name: '工牌' }]}
      nodeName={id => `地点-${id}`}
      npcImages={{ npc_xiao: 'xiao.png' }}
      wallImages={[]}
      paused={false}
      onZoom={onZoom}
      onClose={onClose}
      t={t}
      {...overrides}
    />,
  );
  return { ...view, onZoom, onTab, onClose };
};

describe('DossierOverlay', () => {
  it('关闭时不渲染', () => {
    const { container } = setup({ open: false });
    expect(container.querySelector('#dossier')).toBeNull();
  });

  it('接触过的人直接显示秘密和最后一句话', () => {
    setup();
    expect(screen.getByText('双重忠诚')).toBeTruthy();
    expect(screen.getByText('最后一句')).toBeTruthy();
    expect(screen.getByText('地点-n1')).toBeTruthy();
  });

  it('没接触过的人不显示姓名和秘密，也不能打开', () => {
    const { container } = setup();
    expect(screen.queryByText('哨兵')).toBeNull();
    expect(screen.queryByText('核心矛盾')).toBeNull();
    expect(container.querySelector('article.pc.unmet')).not.toBeNull();
    fireEvent.click(container.querySelector('article.pc.unmet') as Element);
    expect(container.querySelector('#pd')).toBeNull();
  });

  it('死亡的人盖章，不显示位置', () => {
    const { container } = setup();
    const card = container.querySelector('button.pc.dead') as HTMLElement;
    expect(card.querySelector('.pc-stamp')?.textContent).toBe('stage.dossier.deceased');
    expect(card.textContent).toContain('stage.dossier.dead');
    expect(card.textContent).not.toContain('地点-n2');
  });

  it('计数只算接触过的人', () => {
    setup();
    expect(screen.getByRole('tab', { name: /stage.dossier.people/ }).textContent).toContain('2/3');
  });

  it('打开详情显示目标和全部台词，肖像可放大，Esc 先关详情', () => {
    const { container, onZoom } = setup();
    fireEvent.click(screen.getByText('萧博士').closest('button') as Element);
    expect(screen.getByText('试探玩家')).toBeTruthy();
    expect(container.querySelectorAll('.pd-quote')).toHaveLength(2);
    fireEvent.click(container.querySelector('.pd-photo') as Element);
    expect(onZoom).toHaveBeenCalledWith('xiao.png');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('#pd')).toBeNull();
    expect(container.querySelector('#dossier')).not.toBeNull();
  });

  it('放大图片时 Esc 不关详情', () => {
    const { container, rerender } = setup();
    fireEvent.click(screen.getByText('萧博士').closest('button') as Element);
    rerender(
      <DossierOverlay
        open
        tab="people"
        onTab={vi.fn()}
        dossiers={dossiers}
        inventory={[]}
        nodeName={id => `地点-${id}`}
        wallImages={[]}
        paused
        onZoom={vi.fn()}
        onClose={vi.fn()}
        t={t}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('#pd')).not.toBeNull();
  });

  it('物品页：没有显示名的物品把 id 转成文字', () => {
    setup({ tab: 'items' });
    expect(screen.getByText('alpha key')).toBeTruthy();
    expect(screen.getByText('工牌')).toBeTruthy();
    expect(screen.getByText('BADGE')).toBeTruthy();
  });

  it('物品为空时显示提示', () => {
    setup({ tab: 'items', inventory: [] });
    expect(screen.getByText('stage.drawer.no_items')).toBeTruthy();
  });

  it('没有遗产时不显示遗产页，并退回人员页', () => {
    setup({ tab: 'legacy' });
    expect(screen.queryByRole('tab', { name: /stage.dossier.legacy/ })).toBeNull();
    expect(screen.getByText('stage.dossier.title_people')).toBeTruthy();
  });

  it('有遗产时显示物品、特质和回响，回响最新的在前', () => {
    const { container } = setup({
      tab: 'legacy',
      legacy: {
        runCount: 3,
        items: [{ name: '残卡', description: '旧物', icon: '◈' }],
        traits: [{ name: '裂隙', description: '想起没发生的事', icon: '◆' }],
        echoes: [
          { title: '第一条', summary: '更早', endingType: 'DEATH', roleName: '甲' },
          { title: '第二条', summary: '更近', endingType: 'ESCAPED', roleName: '乙' },
        ],
      } as any,
    });
    expect(screen.getByText(/残卡/)).toBeTruthy();
    expect(screen.getByText(/裂隙/)).toBeTruthy();
    const echoes = container.querySelectorAll('.lg-card.echo');
    expect(echoes[0].textContent).toContain('第二条');
    expect(echoes[1].textContent).toContain('第一条');
  });

  it('切换标签和关闭交给上层', () => {
    const { onTab, onClose, container } = setup();
    fireEvent.click(screen.getByRole('tab', { name: /stage.dossier.items/ }));
    expect(onTab).toHaveBeenCalledWith('items');
    fireEvent.click(container.querySelector('.dz-close') as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
