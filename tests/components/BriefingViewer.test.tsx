import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BriefingViewer from '../../components/game/stage/BriefingViewer';
import type { StageMedia } from '../../utils/beats';

vi.mock('../../services/sfxService', () => ({ playSfx: vi.fn() }));

const page = (index: number, total: number, value: string): StageMedia => ({
  type: 'DOSSIER',
  attrs: total > 1 ? { page: `${index}/${total}` } : {},
  body: value,
  fields: [],
  sections: [{ label: '项目描述', value }],
});

const PAGES = [page(1, 2, '第一页内容'), page(2, 2, '第二页内容')];
const t = (key: string) => key;

const setup = (overrides: Partial<React.ComponentProps<typeof BriefingViewer>> = {}) => {
  const onClose = vi.fn();
  const onZoomPortrait = vi.fn();
  const view = render(
    <BriefingViewer
      pages={PAGES}
      designation="SCP-173"
      speed={2}
      entityImage="portrait.png"
      onZoomPortrait={onZoomPortrait}
      paused={false}
      onClose={onClose}
      t={t}
      {...overrides}
    />
  );
  return { ...view, onClose, onZoomPortrait };
};

describe('BriefingViewer', () => {
  it('点击翻页，读完最后一页关闭', () => {
    const { container, onClose } = setup();
    const root = container.querySelector('#briefing-view') as Element;
    expect(screen.getByText('第一页内容')).toBeTruthy();
    fireEvent.click(root);
    expect(screen.getByText('第二页内容')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(root);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('翻页键只在有上一页或下一页时出现', () => {
    const { container } = setup();
    expect(container.querySelector('.page-turn.prev')).toBeNull();
    fireEvent.click(container.querySelector('.page-turn.next') as Element);
    expect(screen.getByText('第二页内容')).toBeTruthy();
    expect(container.querySelector('.page-turn.next')).toBeNull();
    fireEvent.click(container.querySelector('.page-turn.prev') as Element);
    expect(screen.getByText('第一页内容')).toBeTruthy();
  });

  it('键盘前后翻页', () => {
    setup();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByText('第二页内容')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByText('第一页内容')).toBeTruthy();
  });

  it('放大肖像时键盘不翻页', () => {
    setup({ paused: true });
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByText('第一页内容')).toBeTruthy();
  });

  it('肖像只在第一页，带附录文字，点击放大且不翻页', () => {
    const { container, onZoomPortrait } = setup();
    const portrait = container.querySelector('.pg-photo') as HTMLElement;
    expect(portrait.textContent).toContain('app.appendix // SCP-173');
    fireEvent.click(portrait);
    expect(onZoomPortrait).toHaveBeenCalledTimes(1);
    expect(screen.getByText('第一页内容')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(container.querySelector('.pg-photo')).toBeNull();
  });

  it('旧格式的简报第一页也有肖像', () => {
    const { container } = setup({
      pages: [{ type: 'DOSSIER', attrs: {}, body: '**目标**：SCP-173', items: ['**目标**：SCP-173'] }],
    });
    expect(container.querySelector('.pg-photo')).not.toBeNull();
    expect(container.querySelector('.page-turn')).toBeNull();
  });
});
