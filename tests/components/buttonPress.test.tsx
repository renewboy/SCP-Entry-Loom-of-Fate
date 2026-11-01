import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pressOnButtonClick } from '../../components/common/buttonPress';
import { playButtonPress, playLightPress } from '../../services/sfxService';

vi.mock('../../services/sfxService', () => ({ playButtonPress: vi.fn(), playLightPress: vi.fn() }));

const Screen = () => (
  <div onClickCapture={pressOnButtonClick}>
    <button type="button" className="weave-btn">继续<i>&gt;&gt;&gt;</i></button>
    <button type="button" className="weave-btn" disabled>上传</button>
    <button type="button">返回</button>
    <button type="button" disabled>禁用</button>
    <button type="button"><span>带图标</span></button>
    <p>说明文字</p>
  </div>
);

describe('pressOnButtonClick', () => {
  beforeEach(() => {
    vi.mocked(playButtonPress).mockClear();
    vi.mocked(playLightPress).mockClear();
  });

  it('推进游戏的按钮响完整按键音，包括按钮里的元素', () => {
    render(<Screen />);
    fireEvent.click(screen.getByText('继续'));
    fireEvent.click(screen.getByText('>>>'));
    expect(playButtonPress).toHaveBeenCalledTimes(2);
    expect(playLightPress).not.toHaveBeenCalled();
  });

  it('其他按钮响轻版，包括按钮里的元素', () => {
    render(<Screen />);
    fireEvent.click(screen.getByText('返回'));
    fireEvent.click(screen.getByText('带图标'));
    expect(playLightPress).toHaveBeenCalledTimes(2);
    expect(playButtonPress).not.toHaveBeenCalled();
  });

  it('点禁用按钮和其他地方不响', () => {
    render(<Screen />);
    fireEvent.click(screen.getByText('上传'));
    fireEvent.click(screen.getByText('禁用'));
    fireEvent.click(screen.getByText('说明文字'));
    expect(playButtonPress).not.toHaveBeenCalled();
    expect(playLightPress).not.toHaveBeenCalled();
  });
});
