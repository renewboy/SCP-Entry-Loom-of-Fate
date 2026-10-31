import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RadarMinimap from '../../components/game/stage/RadarMinimap';
import type { MapBlueprint } from '../../types';

const t = (key: string) => key;

const blueprint: MapBlueprint = {
  id: 'map',
  title: 'Site',
  startNodeId: 'a',
  nodes: [
    { id: 'a', name: '入口', danger: 10 },
    { id: 'b', name: '指挥中心', danger: 45 },
    { id: 'c', name: '实验室', danger: 80 },
  ],
  edges: [
    { from: 'a', to: 'b', bidirectional: true },
    { from: 'b', to: 'c', bidirectional: true },
  ],
  npcs: [],
  objectives: [],
};

const setup = () => {
  const onOpen = vi.fn();
  const view = render(
    <RadarMinimap
      blueprint={blueprint}
      map={{ id: 'map', title: 'Site', currentNodeId: 'b', discoveredNodeIds: ['a', 'b'] }}
      objectives={[]}
      inventory={[]}
      dossiers={[]}
      route={['a', 'b']}
      locationName="指挥中心"
      onOpen={onOpen}
      t={t}
    />,
  );
  return { ...view, onOpen };
};

describe('RadarMinimap', () => {
  it('和大地图用同一套绘制：弧线、节点和走过的路线', () => {
    const { container } = setup();
    expect(container.querySelectorAll('#radar .net-node')).toHaveLength(3);
    expect(container.querySelectorAll('#radar .net-edge')).toHaveLength(2);
    expect(container.querySelector('#radar .net-thread')).not.toBeNull();
    expect(container.querySelector('#radar .net-edge')?.getAttribute('d')).toContain('C ');
    expect(container.querySelector('#radar .net-node.current .n-reticle')).not.toBeNull();
  });

  it('放大、缩小、复位都在圆形窗口外面', () => {
    const { container } = setup();
    expect(container.querySelector('#radar .gbtn')).toBeNull();
    expect(container.querySelectorAll('.rd-tools .gbtn')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'stage.network.zoom_in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'stage.network.reset' })).toBeTruthy();
  });

  it('点击空白处打开地图，点击节点打开并选中这个节点', () => {
    const { container, onOpen } = setup();
    fireEvent.click(container.querySelector('#radar svg') as Element);
    expect(onOpen).toHaveBeenLastCalledWith(undefined);
    fireEvent.click(container.querySelector('.net-node[data-id="c"]') as Element);
    expect(onOpen).toHaveBeenLastCalledWith('c');
  });

  it('键盘回车打开地图', () => {
    const { onOpen } = setup();
    fireEvent.keyDown(screen.getByRole('button', { name: 'stage.radar.open' }), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('滚轮缩放不会传到舞台', () => {
    const { container } = setup();
    const onStageWheel = vi.fn();
    container.addEventListener('wheel', onStageWheel);
    fireEvent.wheel(container.querySelector('#radar svg') as Element, { deltaY: -100 });
    expect(onStageWheel).not.toHaveBeenCalled();
  });
});
