import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ObjectiveTracker from '../../components/game/stage/ObjectiveTracker';
import type { ObjectiveState } from '../../types';

const objective = (id: string, type: ObjectiveState['type'], status: ObjectiveState['status'] = 'ACTIVE'): ObjectiveState => ({
  id,
  type,
  status,
  title: `标题-${id}`,
  detail: `详情-${id}`,
  nodeId: 'node',
  progress: 10
});

const OBJECTIVES = [objective('side1', 'SIDE'), objective('main', 'MAIN'), objective('side2', 'SIDE'), objective('done', 'SIDE', 'COMPLETED')];
const t = (key: string) => key;

const titles = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('#tracker-list .trk-title')).map(element => element.textContent);

describe('ObjectiveTracker', () => {
  it('折叠时只显示追踪中的任务和其余数量', () => {
    const { container } = render(<ObjectiveTracker objectives={OBJECTIVES} open={false} onToggle={() => {}} flashKey={0} t={t} />);
    expect(container.querySelector('#tracker-head')?.textContent).toContain('标题-main');
    expect(container.querySelector('.trk-more')?.textContent).toBe('+2');
  });

  it('点击任务后，详情紧跟在这条任务下面，列表顺序不变', () => {
    const { container } = render(<ObjectiveTracker objectives={OBJECTIVES} open onToggle={() => {}} flashKey={0} t={t} />);
    const order = ['标题-main', '标题-side1', '标题-side2'];
    expect(titles(container)).toEqual(order);
    expect(screen.getByText('详情-main')).toBeTruthy();

    fireEvent.click(screen.getByText('标题-side2'));

    expect(titles(container)).toEqual(order);
    expect(screen.queryByText('详情-main')).toBeNull();
    const item = screen.getByText('标题-side2').closest('.trk-item');
    expect(item?.classList.contains('selected')).toBe(true);
    expect(item?.querySelector('.trk-detail')?.textContent).toBe('详情-side2');

    fireEvent.click(screen.getByText('标题-side1'));
    const first = screen.getByText('标题-side1').closest('.trk-item');
    expect(first?.querySelector('.trk-detail')?.textContent).toBe('详情-side1');
    expect(screen.queryByText('详情-side2')).toBeNull();
  });

  it('折叠后显示刚才选中的任务', () => {
    const { container, rerender } = render(<ObjectiveTracker objectives={OBJECTIVES} open onToggle={() => {}} flashKey={0} t={t} />);
    fireEvent.click(screen.getByText('标题-side2'));
    rerender(<ObjectiveTracker objectives={OBJECTIVES} open={false} onToggle={() => {}} flashKey={0} t={t} />);
    expect(container.querySelector('#tracker-head')?.textContent).toContain('标题-side2');
  });

  it('展开的标题不重复显示任务', () => {
    const { container } = render(<ObjectiveTracker objectives={OBJECTIVES} open onToggle={() => {}} flashKey={0} t={t} />);
    expect(container.querySelector('#tracker-head .trk-title')).toBeNull();
  });

  describe('任务更新时自动展开', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const flashed = () => {
      const onToggle = vi.fn();
      const view = render(<ObjectiveTracker objectives={OBJECTIVES} open={false} onToggle={onToggle} flashKey={0} t={t} />);
      view.rerender(<ObjectiveTracker objectives={OBJECTIVES} open={false} onToggle={onToggle} flashKey={1} t={t} />);
      return { ...view, onToggle };
    };

    it('几秒后自动收起', () => {
      const { container } = flashed();
      expect(container.querySelector('#tracker')?.classList.contains('open')).toBe(true);
      act(() => { vi.advanceTimersByTime(4800); });
      expect(container.querySelector('#tracker')?.classList.contains('open')).toBe(false);
    });

    it('点任务会让它保持展开', () => {
      const { onToggle } = flashed();
      fireEvent.click(screen.getByText('标题-side1'));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('点标题立刻收起', () => {
      const { container, onToggle } = flashed();
      fireEvent.click(container.querySelector('#tracker-head') as Element);
      expect(onToggle).not.toHaveBeenCalled();
      expect(container.querySelector('#tracker')?.classList.contains('open')).toBe(false);
    });
  });
});
