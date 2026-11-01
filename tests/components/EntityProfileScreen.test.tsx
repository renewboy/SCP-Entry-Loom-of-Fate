import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EntityProfileScreen from '../../components/entityProfile/EntityProfileScreen';
import { playButtonPress, playLightPress } from '../../services/sfxService';
import { LanguageProvider } from '../../utils/i18n';
import type { EntityProfile } from '../../types';

vi.mock('../../services/sfxService', async importOriginal => ({
  ...await importOriginal<typeof import('../../services/sfxService')>(),
  playButtonPress: vi.fn(),
  playLightPress: vi.fn(),
}));

const candidate: EntityProfile = { name: '瓦莱里克', age: '41', abilities: ['甲', '乙', '丙', '丁'], background: '幸存指挥官', keywords: ['失眠'] };

const setup = (overrides: Partial<React.ComponentProps<typeof EntityProfileScreen>> = {}) => {
  const props = {
    role: 'Researcher',
    scpDesignation: 'SCP-966',
    ready: true,
    candidates: [] as EntityProfile[],
    selectedProfile: null,
    loadingAction: null,
    generationError: false,
    onBack: vi.fn(),
    onGenerate: vi.fn(),
    onSelect: vi.fn(),
    onChange: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<LanguageProvider><EntityProfileScreen {...props} /></LanguageProvider>);
  return props;
};

describe('EntityProfileScreen', () => {
  it('背景是档案库走廊，没有地图网格', () => {
    setup();
    expect(document.querySelector('.ep-vault')).not.toBeNull();
    expect(document.querySelector('.map-backdrop')).toBeNull();
  });

  it('检索时走廊和日志一起动起来', () => {
    setup({ loadingAction: 'init' });
    expect(document.querySelector('.profile-view.searching')).not.toBeNull();
    expect(document.querySelector('.ep-log li')?.textContent).toContain('SCP-966');
    expect(document.querySelector('.ep-state.busy')).not.toBeNull();
    const button = document.querySelector('.ep-exec') as HTMLButtonElement;
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.ep-exec-track')).not.toBeNull();
    expect(document.querySelector('.ep-sec .gbtn-run')).toBeNull();
  });

  it('完整度跟着填写的字段走', () => {
    setup({ candidates: [candidate], selectedProfile: { ...candidate, background: '', keywords: [] } });
    expect(document.querySelectorAll('.ep-cells i.on')).toHaveLength(3);
    expect(document.querySelector('.ep-meter b')?.textContent).toBe('3/5');
    expect(document.querySelectorAll('.ep-row.filled')).toHaveLength(3);
  });

  it('没选中档案时提示未载入', () => {
    setup();
    expect(document.querySelector('.ep-empty')).not.toBeNull();
  });

  it('没有候选时可以初始化生成，也可以手动添加', () => {
    const props = setup();
    fireEvent.click(document.querySelector('.ep-exec.lead') as Element);
    expect(props.onGenerate).toHaveBeenCalledWith('init');
    fireEvent.click(document.querySelector('.ep-custom') as Element);
    expect(props.onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'Researcher', abilities: [], background: '', keywords: [] }));
  });

  it('候选卡片最多显示三项能力，点击后选中', () => {
    const props = setup({ candidates: [candidate] });
    expect(document.querySelectorAll('.ep-abilities i')).toHaveLength(3);
    expect(document.querySelector('.ep-card b span')?.getAttribute('aria-label')).toBe('瓦莱里克');
    fireEvent.click(document.querySelector('.ep-card') as Element);
    expect(props.onSelect).toHaveBeenCalledWith(candidate);
  });

  it('有候选时只能重新生成', () => {
    const props = setup({ candidates: [candidate] });
    expect(document.querySelector('.ep-exec.lead')).toBeNull();
    fireEvent.click(document.querySelector('.ep-exec') as Element);
    expect(props.onGenerate).toHaveBeenCalledWith('reroll');
  });

  it('没选中档案或正在生成时不能上传', () => {
    setup();
    expect((document.querySelector('.weave-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('.ep-form.off')).not.toBeNull();
  });

  it('选中后可以修改并上传', () => {
    const props = setup({ candidates: [candidate], selectedProfile: candidate });
    fireEvent.change(screen.getByDisplayValue('41'), { target: { value: '42' } });
    expect(props.onChange).toHaveBeenCalledWith('age', '42');
    vi.useFakeTimers();
    fireEvent.click(document.querySelector('.weave-btn') as Element);
    fireEvent.click(document.querySelector('.weave-btn') as Element);
    expect(document.querySelector('.profile-view.filing')).not.toBeNull();
    expect(props.onConfirm).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(document.querySelector('.ep-stamp')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('只有上传是完整按键音，其他按钮都是轻版', () => {
    vi.mocked(playButtonPress).mockClear();
    vi.mocked(playLightPress).mockClear();
    setup({ candidates: [candidate], selectedProfile: candidate });
    fireEvent.click(document.querySelector('.ep-card') as Element);
    fireEvent.click(document.querySelector('.ep-exec') as Element);
    fireEvent.click(document.querySelector('.ep-back') as Element);
    expect(playLightPress).toHaveBeenCalledTimes(3);
    expect(playButtonPress).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('.weave-btn') as Element);
    expect(playButtonPress).toHaveBeenCalledTimes(1);
    expect(playLightPress).toHaveBeenCalledTimes(3);
  });

  it('生成失败时显示错误，并保留手动添加', () => {
    setup({ generationError: true });
    expect(document.querySelector('.ep-state.err')).not.toBeNull();
    expect(document.querySelector('.ep-error')).not.toBeNull();
    expect(document.querySelector('.ep-custom')).not.toBeNull();
  });
});
