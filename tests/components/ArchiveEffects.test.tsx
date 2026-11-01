import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecryptText, RecordBarcode, RetrievalLog } from '../../components/entityProfile/ArchiveEffects';

const barsOf = (container: HTMLElement) => Array.from(container.querySelectorAll('rect')).map(bar => `${bar.getAttribute('x')}:${bar.getAttribute('width')}`).join();

describe('ArchiveEffects', () => {
  afterEach(() => vi.useRealTimers());

  it('同一个名字的条码每次都一样，不同名字不一样', () => {
    const first = render(<RecordBarcode seed="瓦莱里克" />);
    const again = render(<RecordBarcode seed="瓦莱里克" />);
    const other = render(<RecordBarcode seed="梅尔尼科夫" />);
    expect(barsOf(first.container)).toBe(barsOf(again.container));
    expect(barsOf(first.container)).not.toBe(barsOf(other.container));
  });

  it('解密文字始终带着真实内容，读屏不受干扰', () => {
    const { container } = render(<DecryptText text="特遣队长" />);
    expect(container.querySelector('span')?.getAttribute('aria-label')).toBe('特遣队长');
    expect(Array.from(container.textContent ?? '')).toHaveLength(4);
  });

  it('日志一行行出现，走过的行标记 OK，最后一行留着', () => {
    vi.useFakeTimers();
    const { container } = render(<RetrievalLog lines={['一', '二', '三']} doneLabel="OK" />);
    expect(container.querySelectorAll('li')).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('li.done i')?.textContent).toBe('OK');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(container.querySelectorAll('li')).toHaveLength(3);
    expect(container.querySelector('li.now')?.textContent).toBe('三');
  });
});
