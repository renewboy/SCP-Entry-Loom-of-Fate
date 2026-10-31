import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ReviewBoard from '../../../components/postGameReport/review/ReviewBoard';
import { buildWorldLineTurns } from '../../../components/postGameReport/selectors/worldLine';
import WorldLineThread from '../../../components/postGameReport/worldLine/WorldLineThread';
import type { GameReviewData, Message } from '../../../types';

const t = (key: string) => key;

const messages: Message[] = [
  { id: 'intro', sender: 'narrator', content: '开场。\n\n1. **进门**\n2. **离开**', timestamp: 0, turnIndex: 0, stabilitySnapshot: 100 },
  { id: 'u1', sender: 'user', content: '1', timestamp: 1, turnIndex: 1 },
  { id: 'n1', sender: 'narrator', content: '你推开门。门后是一条长廊。\n\n[@npc_a: 别进来]', timestamp: 1, turnIndex: 1, stabilitySnapshot: 80, nodeId: 'hall' },
  { id: 'u2', sender: 'user', content: '继续走', timestamp: 2, turnIndex: 2 },
  { id: 'n2', sender: 'narrator', content: '你继续向前。', timestamp: 2, turnIndex: 2, stabilitySnapshot: 60 },
] as Message[];

const review = {
  operationName: '行动',
  clearanceLevel: '4/1',
  evaluation: { rank: 'S', score: 95, verdict: '出色' },
  summary: '摘要',
  timelineAnalysis: [{ turn: 1, event: '选择进门', analysis: '很大胆', impact: 'POSITIVE' }],
  psychProfile: '侧写',
  strategicAdvice: '建议',
  perspectiveEvaluations: [],
  achievements: [],
  riskAssessment: { overall: 50, volatilityComment: '波动', riskByTurn: [{ turn: 1, risk: 70, reason: '太险', betterMove: '先观察' }] },
} as unknown as GameReviewData;

const turns = buildWorldLineTurns(messages);

const setup = (props: Partial<React.ComponentProps<typeof WorldLineThread>> = {}) => render(
  <WorldLineThread
    turns={turns}
    review={review}
    outcome={{ title: '逃离', text: '已离开', color: 'text-yellow-500', border: '', bg: '' }}
    endingType="ESCAPED"
    nodeName={id => (id === 'hall' ? '长廊' : '')}
    speakerName={id => id || ''}
    onZoom={vi.fn()}
    t={t}
    {...props}
  />,
);

const row = (container: HTMLElement, index: number) => container.querySelectorAll('.wl-row')[index] as HTMLElement;

describe('WorldLineThread', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: query === '(hover: hover)', media: query } as MediaQueryList));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const hover = (element: Element) => {
    fireEvent.pointerEnter(element);
    act(() => { vi.advanceTimersByTime(400); });
  };

  it('每回合一个节点，序号指令还原成选项，起手回合标为行动开始', () => {
    const { container } = setup();
    expect(container.querySelectorAll('.wl-row')).toHaveLength(3);
    const titles = Array.from(container.querySelectorAll('.wl-cmd')).map(el => el.textContent);
    expect(titles).toEqual(['report.start', '进门', '继续走']);
    expect(screen.getByText('T01')).toBeTruthy();
    expect(screen.getByText('长廊')).toBeTruthy();
  });

  it('关键回合带标记，没有走的路显示在回合里', () => {
    const { container } = setup();
    expect(row(container, 1).querySelector('.wl-flag')?.textContent).toContain('report.key_moment');
    expect(row(container, 1).querySelector('.wl-dot.key')).not.toBeNull();
    expect(row(container, 1).querySelector('.wl-paths')?.textContent).toContain('离开');
    expect(row(container, 0).querySelector('.wl-paths')).toBeNull();
    expect(row(container, 1).dataset.unchosen).toBe('1');
  });

  it('展开内容包括复盘批注、风险和解析后的正文', () => {
    const { container } = setup();
    const body = row(container, 1).querySelector('.wl-body') as HTMLElement;
    expect(body.textContent).toContain('很大胆');
    expect(body.textContent).toContain('太险');
    expect(body.textContent).toContain('别进来');
    expect(body.textContent).not.toContain('[@npc_a');
  });

  it('鼠标悬停展开，移开收起', () => {
    const { container } = setup();
    const main = row(container, 1).querySelector('.wl-main') as Element;
    hover(main);
    expect(row(container, 1).className).toContain('open');
    expect(row(container, 1).querySelector('.wl-card')?.getAttribute('aria-expanded')).toBe('true');
    fireEvent.pointerLeave(main);
    act(() => { vi.advanceTimersByTime(400); });
    expect(row(container, 1).className).not.toContain('open');
  });

  it('移到另一回合时只展开一个', () => {
    const { container } = setup();
    hover(row(container, 0).querySelector('.wl-main') as Element);
    fireEvent.pointerLeave(row(container, 0).querySelector('.wl-main') as Element);
    hover(row(container, 1).querySelector('.wl-main') as Element);
    expect(row(container, 0).className).not.toContain('open');
    expect(row(container, 1).className).toContain('open');
  });

  it('鼠标很快掠过时不展开', () => {
    const { container } = setup();
    const main = row(container, 1).querySelector('.wl-main') as Element;
    fireEvent.pointerEnter(main);
    act(() => { vi.advanceTimersByTime(50); });
    fireEvent.pointerLeave(main);
    act(() => { vi.advanceTimersByTime(400); });
    expect(row(container, 1).className).not.toContain('open');
  });

  it('鼠标点击不切换展开', () => {
    const { container } = setup();
    fireEvent.click(row(container, 1).querySelector('.wl-card') as Element, { detail: 1 });
    expect(row(container, 1).className).not.toContain('open');
  });

  it('没有悬停能力的设备不响应悬停', () => {
    vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: false, media: query } as MediaQueryList));
    const { container } = setup();
    hover(row(container, 1).querySelector('.wl-main') as Element);
    expect(row(container, 1).className).not.toContain('open');
  });

  it('触屏轻点切换展开', () => {
    const { container } = setup();
    const card = row(container, 1).querySelector('.wl-card') as Element;
    const pointerDown = Object.assign(new Event('pointerdown', { bubbles: true }), { pointerType: 'touch' });
    fireEvent(card, pointerDown);
    fireEvent.click(card, { detail: 1 });
    expect(row(container, 1).className).toContain('open');
    fireEvent.click(card, { detail: 1 });
    expect(row(container, 1).className).not.toContain('open');
  });

  it('键盘回车切换展开', () => {
    const { container } = setup();
    fireEvent.click(row(container, 1).querySelector('.wl-card') as Element, { detail: 0 });
    expect(row(container, 1).className).toContain('open');
  });

  it('结局节点显示结局信息和操作', () => {
    const { container } = setup({ children: <button type="button">新周目</button> });
    const end = container.querySelector('.wl-end') as HTMLElement;
    expect(end.textContent).toContain('逃离');
    expect(end.textContent).toContain('report.archived');
    expect(end.querySelector('.wl-end-kicker')?.className).toContain('text-yellow-500');
    expect(screen.getByText('新周目')).toBeTruthy();
  });
});

describe('ReviewBoard', () => {
  const board = (rank: string, overrides: Partial<GameReviewData> = {}) => render(
    <ReviewBoard
      data={{ ...review, evaluation: { rank, score: 50, verdict: '评语' }, ...overrides } as GameReviewData}
      scpData={null}
      stabilityHistory={[100, 80, 60]}
      messages={messages}
      turns={turns}
      onJump={vi.fn()}
      t={t}
    />,
  );

  it.each([
    ['S', 'text-yellow-400'],
    ['A', 'text-scp-term_fix'],
    ['B', 'text-blue-400'],
    ['C', 'text-gray-400'],
    ['D', 'text-orange-500'],
    ['F', 'text-red-600'],
  ])('评级 %s 用 report 字体和各自的颜色', (rank, color) => {
    const { container } = board(rank);
    const letter = container.querySelector('.rv-rank b') as HTMLElement;
    expect(letter.textContent).toBe(rank);
    expect(letter.className).toContain('font-report');
    expect(letter.className).toContain(color);
    expect(container.querySelector('.rv-rank p')?.className).toContain(color);
  });

  it('能在世界线上找到的转折点可以跳转，找不到的只显示', () => {
    const onJump = vi.fn();
    const { container } = render(
      <ReviewBoard
        data={{ ...review, timelineAnalysis: [...review.timelineAnalysis, { turn: 99, event: '不存在', analysis: '没有节点', impact: 'NEUTRAL' }] } as GameReviewData}
        scpData={null}
        stabilityHistory={[100, 80]}
        messages={messages}
        turns={turns}
        onJump={onJump}
        t={t}
      />,
    );
    fireEvent.click(container.querySelector('button.rv-key') as Element);
    expect(onJump).toHaveBeenCalledWith(1);
    expect(container.querySelectorAll('button.rv-key')).toHaveLength(1);
    expect(container.querySelectorAll('div.rv-key')).toHaveLength(1);
  });

  it('风险按量程显示：老复盘满分 5，新复盘满分 100', () => {
    const { container } = board('B', { riskAssessment: { overall: 50, volatilityComment: '', riskByTurn: [{ turn: 1, risk: 4, reason: 'a', betterMove: 'b' }, { turn: 2, risk: 70, reason: 'c', betterMove: 'd' }] } } as any);
    const meters = container.querySelectorAll('.rv-risk-meter b');
    expect(meters[0].textContent).toBe('4/5');
    expect(meters[1].textContent).toBe('70/100');
  });

  it('保留机密印章', () => {
    expect(board('B').container.querySelector('.rv-stamp')?.textContent).toBe('CONFIDENTIAL');
  });
});
