import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import StageNotices, { useNotices } from '../../components/game/stage/StageNotices';

const t = (key: string) => key;

describe('StageNotices', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('多条通知同时显示，各自到时间消失', () => {
    const { result } = renderHook(() => useNotices());
    act(() => result.current.pushNotice('OBJECTIVE', '任务完成', '营救秦洛仪'));
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => result.current.pushNotice('UNLOCK', '访问权限已获批', '>> 实验室'));
    expect(result.current.notices).toHaveLength(2);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.notices.map(notice => notice.type)).toEqual(['UNLOCK']);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.notices).toHaveLength(0);
  });

  it('按类型区分样式，显示主副文字和倒计时条', () => {
    const { container } = render(
      <StageNotices
        t={t}
        notices={[
          { id: '1', type: 'OBJECTIVE_FAIL', message: '任务失败', subMessage: '关闭发生器', durationMs: 4000 },
          { id: '2', type: 'LOCATION', message: '进入区域', durationMs: 4000 },
        ]}
      />,
    );
    expect(container.querySelector('.notice.objective-fail')).not.toBeNull();
    expect(container.querySelector('.notice.location')).not.toBeNull();
    expect(screen.getByText('关闭发生器').className).toContain('notice-sub');
    expect(screen.getByText('[OBJECTIVE_FAIL] game.system_msg')).toBeTruthy();
    expect((container.querySelector('.notice-timer') as HTMLElement).style.animationDuration).toBe('4000ms');
    expect(container.querySelector('.notice.location .notice-sub')).toBeNull();
  });
});
