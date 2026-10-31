import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GameButton from '../../components/common/GameButton';

describe('GameButton', () => {
  it('默认是次要按钮，不会提交表单', () => {
    render(<GameButton>确定</GameButton>);
    const button = screen.getByRole('button', { name: '确定' });
    expect(button.className).toContain('gbtn-secondary');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('按层级和尺寸加样式，保留传入的类名和属性', () => {
    render(<GameButton id="send" variant="primary" size="sm" block className="extra">执行</GameButton>);
    const button = screen.getByRole('button', { name: '执行' });
    ['gbtn-primary', 'gbtn-sm', 'gbtn-block', 'extra'].forEach(name => expect(button.className).toContain(name));
    expect(button.id).toBe('send');
  });

  it('进行中显示运行线并禁止点击', () => {
    const onClick = vi.fn();
    const { container } = render(<GameButton loading onClick={onClick}>生成中</GameButton>);
    const button = screen.getByRole('button', { name: '生成中' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('.gbtn-run')).not.toBeNull();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
