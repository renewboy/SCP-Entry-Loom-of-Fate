import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SiteNetwork from '../../components/game/stage/SiteNetwork';
import type { MapBlueprint, ObjectiveState } from '../../types';
import type { NpcDossier } from '../../utils/npcDossier';

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key}:${Object.values(params).join('/')}` : key);

const blueprint: MapBlueprint = {
  id: 'map',
  title: '蓝图标题',
  startNodeId: 'a',
  nodes: [
    { id: 'a', name: '入口', danger: 10 },
    { id: 'b', name: '指挥中心', danger: 45 },
    { id: 'c', name: '实验室', danger: 75, requires: ['hazmat'], blockedText: '门被封锁' },
    { id: 'd', name: '穹室', danger: 85 },
  ],
  edges: [
    { from: 'a', to: 'b', bidirectional: true },
    { from: 'b', to: 'c', bidirectional: true },
    { from: 'c', to: 'd', bidirectional: true },
  ],
  npcs: [],
  objectives: [],
};

const objectives: ObjectiveState[] = [
  { id: 'o1', title: '进入穹室', type: 'MAIN', nodeId: 'd', status: 'ACTIVE', progress: 20 },
  { id: 'o2', title: '找到钥匙', type: 'SIDE', nodeId: 'b', status: 'ACTIVE', progress: 50, detail: '在指挥台下' },
];

const dossiers: NpcDossier[] = [
  { npc: { id: 'npc_x', name: '萧博士', archetype: '知情者', nodeId: 'b', alive: true }, met: true, quotes: [] },
  { npc: { id: 'npc_y', name: '神秘人', archetype: '未知', nodeId: 'b', alive: true }, met: false, quotes: [] },
  { npc: { id: 'npc_z', name: '已死的人', archetype: '死者', nodeId: 'b', alive: false }, met: true, quotes: [] },
];

const setup = (overrides: Partial<React.ComponentProps<typeof SiteNetwork>> = {}) => {
  const onAction = vi.fn();
  const onToggleFullscreen = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <SiteNetwork
      open
      fullscreen={false}
      onToggleFullscreen={onToggleFullscreen}
      onClose={onClose}
      blueprint={blueprint}
      map={{ id: 'map', title: '运行时标题', currentNodeId: 'b', discoveredNodeIds: ['a', 'b'] }}
      objectives={objectives}
      inventory={[]}
      dossiers={dossiers}
      route={[]}
      onAction={onAction}
      t={t}
      {...overrides}
    />,
  );
  return { ...view, onAction, onToggleFullscreen, onClose };
};

const node = (container: HTMLElement, id: string) => container.querySelector(`.net-node[data-id="${id}"]`) as Element;

describe('SiteNetwork', () => {
  it('默认是右侧抽屉，选中当前位置，图例在地图区域', () => {
    const { container } = setup();
    const root = container.querySelector('.net') as Element;
    expect(root.className).toContain('drawer');
    expect(root.className).toContain('right');
    expect(root.className).not.toContain('full');
    expect(container.querySelector('.net-panel h2')?.textContent).toBe('指挥中心');
    expect(container.querySelector('.net-panel .net-legend')).toBeNull();
    expect(root.querySelector(':scope > .net-legend')).not.toBeNull();
  });

  it('全屏按钮和关闭按钮交给上层', () => {
    const { container, onToggleFullscreen, onClose } = setup();
    fireEvent.click(container.querySelector('.net-mode') as Element);
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'stage.log.close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('全屏时按钮变成收起', () => {
    const { container } = setup({ fullscreen: true });
    expect(container.querySelector('.net')?.className).toContain('full');
    expect(container.querySelector('.net-mode')?.textContent).toContain('stage.network.collapse');
  });

  it('当前位置列出相邻区域，能去的可以前往，门禁显示原因', () => {
    const { container, onAction } = setup();
    const rows = container.querySelectorAll('.nx-adj');
    expect(rows).toHaveLength(2);
    expect(rows[1].textContent).toContain('门被封锁');
    expect(rows[1].querySelector('.nx-mini')).toBeNull();
    fireEvent.click(rows[0].querySelector('.nx-mini') as Element);
    expect(onAction).toHaveBeenCalledWith('game.map_go 入口');
  });

  it('当前位置的人可以交谈，没接触过的人不显示姓名，死人不列出', () => {
    const { container, onAction } = setup();
    expect(screen.queryByText('神秘人')).toBeNull();
    expect(screen.getByText('stage.dossier.unknown_name')).toBeTruthy();
    expect(screen.queryByText('已死的人')).toBeNull();
    const buttons = Array.from(container.querySelectorAll('.nx-person .nx-mini'));
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onAction).toHaveBeenCalledWith('game.map_talk 萧博士');
  });

  it('点击任务填入回顾指令，并显示详情', () => {
    const { container, onAction } = setup();
    expect(screen.getByText('在指挥台下')).toBeTruthy();
    fireEvent.click(container.querySelector('.nx-obj') as Element);
    expect(onAction).toHaveBeenCalledWith('game.map_review_objective [找到钥匙]');
  });

  it('点击门禁节点显示原因并禁止前往', () => {
    const { container, onAction } = setup();
    fireEvent.click(node(container, 'c'));
    expect(container.querySelector('.net-panel h2')?.textContent).toBe('实验室');
    expect(container.querySelector('.nx-lock p')?.textContent).toBe('门被封锁');
    expect((container.querySelector('.nx-go') as HTMLButtonElement).disabled).toBe(true);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('持有钥匙时门禁放行', () => {
    const { container, onAction } = setup({ inventory: [{ id: 'hazmat', name: 'hazmat' }] });
    fireEvent.click(node(container, 'c'));
    expect(container.querySelector('.nx-lock')).toBeNull();
    fireEvent.click(container.querySelector('.nx-go') as Element);
    expect(onAction).toHaveBeenCalledWith('game.map_go 实验室');
  });

  it('不相邻的节点给出提示，未探明的节点隐藏人员', () => {
    const { container } = setup();
    fireEvent.click(node(container, 'd'));
    expect(container.querySelector('.nx-note')?.textContent).toBe('stage.network.not_adjacent');
    expect(container.querySelector('.nx-go')).toBeNull();
    expect(screen.getAllByText('???').length).toBeGreaterThan(0);
  });

  it('未探明的节点显示问号，主线任务地点仍有标记', () => {
    const { container } = setup();
    expect(node(container, 'd').querySelector('.n-q')?.textContent).toBe('?');
    expect(node(container, 'd').querySelector('.n-main')).not.toBeNull();
    expect(node(container, 'a').querySelector('.n-q')).toBeNull();
    expect(node(container, 'a').querySelector('.n-start')?.textContent).toBe('S');
    expect(node(container, 'b').querySelector('.n-reticle')).not.toBeNull();
  });

  it('有路线时画红线，老存档没有路线时不画', () => {
    expect(setup().container.querySelector('.net-thread')).toBeNull();
    expect(setup({ route: ['a', 'b'] }).container.querySelector('.net-thread')).not.toBeNull();
  });

  it('键盘可以选中节点', () => {
    const { container } = setup();
    fireEvent.keyDown(node(container, 'a'), { key: 'Enter' });
    expect(container.querySelector('.net-panel h2')?.textContent).toBe('入口');
  });
});
