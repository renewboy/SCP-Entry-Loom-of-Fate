import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CustomSelect from '../../components/common/CustomSelect';

const OPTIONS = [
  { value: 'a', label: '小' },
  { value: 'b', label: '标准' },
  { value: 'c', label: '大' },
];

const setup = () => {
  const onChange = vi.fn();
  render(<CustomSelect variant="settings" ariaLabel="字号" value="b" options={OPTIONS} onChange={onChange} />);
  return { onChange, trigger: screen.getByRole('button', { name: '字号' }) };
};

describe('CustomSelect', () => {
  it('显示当前选项，点击后才展开列表', () => {
    const { trigger } = setup();
    expect(trigger.textContent).toContain('标准');
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: '标准' }).getAttribute('aria-selected')).toBe('true');
  });

  it('选中后回调并收起', () => {
    const { trigger, onChange } = setup();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: '大' }));
    expect(onChange).toHaveBeenCalledWith('c');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('点外面收起', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('键盘可以操作，方向键到头不越界', () => {
    const { trigger, onChange } = setup();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  it('展开时按 Esc 不会传到外层', () => {
    const outer = vi.fn();
    const { trigger } = setup();
    document.addEventListener('keydown', outer);
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    document.removeEventListener('keydown', outer);
    expect(outer).not.toHaveBeenCalled();
  });
});
