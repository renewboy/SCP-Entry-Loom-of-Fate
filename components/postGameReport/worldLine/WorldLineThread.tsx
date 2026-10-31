import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GameReviewData } from '../../../types';
import { canHover } from '../../game/stage/BeatText';
import LogBlockView from '../../game/stage/LogBlockView';
import { getImpactColorClass } from '../selectors/reviewStats';
import { instability, threadNoise, type WorldLineTurn } from '../selectors/worldLine';
import type { EndingDisplayConfig } from '../types';

const HOVER_OPEN_MS = 110;
const HOVER_CLOSE_MS = 200;
const SETTLE_AFTER_SCROLL_MS = 160;
const HOLD_MS = 440;
const FLASH_MS = 1600;
const NODE_Y = 22;
const STACKED_WIDTH = 780;

const pad = (value: number) => String(value).padStart(2, '0');

export interface WorldLineThreadHandle {
  jumpTo: (turn: number) => void;
}

interface WorldLineThreadProps {
  turns: WorldLineTurn[];
  review: GameReviewData | null;
  outcome: EndingDisplayConfig;
  endingType: string;
  nodeName: (nodeId?: string) => string;
  speakerName: (npcId?: string) => string;
  npcImages?: Record<string, string>;
  onZoom: (url: string) => void;
  children?: React.ReactNode;
  t: (key: string, params?: Record<string, string | number>) => any;
}

/** One node per turn on a single red thread. Resting the mouse on a turn opens it, as the old cards did */
const WorldLineThread = forwardRef<WorldLineThreadHandle, WorldLineThreadProps>(({ turns, review, outcome, endingType, nodeName, speakerName, npcImages, onZoom, children, t }, ref) => {
  const rootRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const hover = useRef<{ openTimer?: ReturnType<typeof setTimeout>; closeTimer?: ReturnType<typeof setTimeout>; scrolledAt: number }>({ scrolledAt: 0 });
  const lastPointer = useRef('mouse');
  const [openId, setOpenId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const openIdRef = useRef<string | null>(null);
  openIdRef.current = openId;

  const scroller = useCallback(() => rootRef.current?.closest('.report-root') as HTMLElement | null, []);
  const analysisByTurn = useMemo(() => new Map((review?.timelineAnalysis || []).map(item => [Number(item.turn), item])), [review]);
  const riskByTurn = useMemo(() => new Map((review?.riskAssessment?.riskByTurn || []).map(item => [Number(item.turn), item])), [review]);

  const rowsOf = () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>('.wl-row') || []);

  const updateProgress = useCallback(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const end = endRef.current;
    if (!root || !svg || !end) return;
    const anchor = window.innerHeight * 0.62 - root.getBoundingClientRect().top;
    const ratio = Math.max(0, Math.min(1, anchor / (end.offsetTop + 8)));
    svg.querySelectorAll<SVGPathElement>('.live, .live-glow').forEach(path => {
      path.style.strokeDashoffset = String(1 - ratio);
    });
    rowsOf().forEach(row => row.classList.toggle('lit', row.offsetTop + NODE_Y <= anchor));
  }, []);

  const draw = useCallback(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const end = endRef.current;
    if (!root || !svg || !end) return;
    const width = root.clientWidth;
    if (!width) return;
    const height = root.scrollHeight;
    const stacked = width < STACKED_WIDTH;
    const center = stacked ? 16 : width / 2;
    const maxShake = stacked ? 7 : 26;
    const rows = rowsOf();
    const endY = end.offsetTop + 8;
    const stops = rows.map(row => ({ y: row.offsetTop + NODE_Y, stability: Number(row.dataset.stability) }));
    stops.push({ y: endY, stability: stops[stops.length - 1]?.stability ?? 100 });

    const stabilityAt = (y: number) => {
      if (y <= stops[0].y) return stops[0].stability;
      for (let i = 1; i < stops.length; i += 1) {
        if (y <= stops[i].y) {
          const share = (y - stops[i - 1].y) / (stops[i].y - stops[i - 1].y || 1);
          return stops[i - 1].stability + (stops[i].stability - stops[i - 1].stability) * share;
        }
      }
      return stops[stops.length - 1].stability;
    };
    const xAt = (y: number, phase = 0, gain = 1) => center + instability(stabilityAt(y)) * maxShake * gain * threadNoise(y, phase);
    const line = (from: number, to: number, phase: number, gain: number) => {
      const parts: string[] = [];
      for (let y = from; y <= to; y += 4) parts.push(`${parts.length ? 'L' : 'M'} ${xAt(y, phase, gain).toFixed(1)} ${y}`);
      return parts.join(' ');
    };

    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const main = line(0, endY, 0, 1);
    svg.querySelectorAll('.ghost, .live, .live-glow').forEach(path => path.setAttribute('d', main));
    const frayFrom = stops.find(stop => stop.stability < 40)?.y ?? endY;
    svg.querySelector('.fray.a')?.setAttribute('d', line(frayFrom, endY, 2.1, 1.5));
    svg.querySelector('.fray.b')?.setAttribute('d', line(frayFrom, endY, 4.3, 1.2));

    // Dotted stubs off each node: the options that were on the table and not taken
    let stubs = '';
    rows.forEach(row => {
      const y = row.offsetTop + NODE_Y;
      const x = xAt(y);
      row.querySelector<HTMLElement>('.wl-dot')?.style.setProperty('left', `${x - row.offsetLeft}px`);
      if (stacked) return;
      const direction = row.classList.contains('left') ? 1 : -1;
      for (let k = 0; k < Number(row.dataset.unchosen); k += 1) {
        const reach = 30 + k * 12;
        stubs += `<path d="M ${x.toFixed(1)} ${y} C ${(x + direction * 16).toFixed(1)} ${y + 2}, ${(x + direction * (reach - 8)).toFixed(1)} ${y + 8 + k * 7}, ${(x + direction * reach).toFixed(1)} ${y + 16 + k * 11}"/>`;
      }
    });
    const stubLayer = svg.querySelector('.stubs');
    if (stubLayer) stubLayer.innerHTML = stubs;
    end.querySelector<HTMLElement>('.wl-knot')?.style.setProperty('left', `${xAt(endY) - end.offsetLeft}px`);
    updateProgress();
  }, [updateProgress]);

  useLayoutEffect(() => {
    draw();
  }, [draw, turns, openId]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    });
    observer?.observe(root);
    const area = scroller();
    const onScroll = () => {
      hover.current.scrolledAt = performance.now();
      requestAnimationFrame(updateProgress);
    };
    area?.addEventListener('scroll', onScroll, { passive: true });
    if (typeof document !== 'undefined' && document.fonts?.ready) document.fonts.ready.then(draw);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      area?.removeEventListener('scroll', onScroll);
      clearTimeout(hover.current.openTimer);
      clearTimeout(hover.current.closeTimer);
    };
  }, [draw, scroller, updateProgress]);

  // When the turn above collapses the content moves up, which would slide this turn out from under the mouse
  const holdInPlace = useCallback((row: HTMLElement) => {
    const area = scroller();
    if (!area) return;
    const startTop = row.getBoundingClientRect().top;
    const until = performance.now() + HOLD_MS;
    const step = () => {
      const drift = row.getBoundingClientRect().top - startTop;
      if (Math.abs(drift) > 0.5) area.scrollTop += drift;
      if (performance.now() < until) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [scroller]);

  const openFromHover = useCallback((id: string, row: HTMLElement) => {
    // A turn passing under a resting mouse while the page scrolls should not open
    if (performance.now() - hover.current.scrolledAt < SETTLE_AFTER_SCROLL_MS) {
      hover.current.openTimer = setTimeout(() => openFromHover(id, row), SETTLE_AFTER_SCROLL_MS);
      return;
    }
    setOpenId(id);
    holdInPlace(row);
  }, [holdInPlace]);

  useImperativeHandle(ref, () => ({
    jumpTo: (turnNumber: number) => {
      const target = [...turns].reverse().find(turn => turn.turn === turnNumber);
      const area = scroller();
      const row = target && rootRef.current?.querySelector<HTMLElement>(`[data-turn-id="${CSS.escape(target.id)}"]`);
      if (!target || !area || !row) return;
      area.scrollTo({ top: row.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop - 120, behavior: 'smooth' });
      setFlashId(target.id);
      setTimeout(() => setFlashId(current => (current === target.id ? null : current)), FLASH_MS);
    },
  }), [turns, scroller]);

  return (
    <section
      className="wl"
      id="wl"
      ref={rootRef}
      aria-label={t('report.nav_worldline')}
      onPointerDownCapture={event => { lastPointer.current = event.pointerType; }}
    >
      <svg className="wl-thread" ref={svgRef} aria-hidden="true">
        <path className="ghost" /><path className="fray a" /><path className="fray b" /><path className="live-glow" pathLength={1} /><path className="live" pathLength={1} /><g className="stubs" />
      </svg>

      {turns.map((turn, index) => {
        const side = index % 2 ? 'right' : 'left';
        const phase = turn.stability > 70 ? 'stable' : turn.stability > 30 ? 'fluct' : 'crit';
        const phaseLabel = t(`report.phase_${phase === 'crit' ? 'critical' : phase}`);
        const analysis = analysisByTurn.get(turn.turn);
        const risk = riskByTurn.get(turn.turn);
        const impactLabel = analysis && t(analysis.impact === 'POSITIVE' ? 'report.impact_pos' : analysis.impact === 'NEGATIVE' ? 'report.impact_neg' : 'report.impact_neu');
        const isOpen = openId === turn.id;
        const place = nodeName(turn.nodeId);
        return (
          <article
            key={turn.id}
            data-turn-id={turn.id}
            data-stability={turn.stability}
            data-unchosen={turn.unchosen.length}
            className={`wl-row ${side} ${phase} ${isOpen ? 'open' : ''} ${flashId === turn.id ? 'flash' : ''}`}
          >
            <span className={`wl-dot ${analysis ? 'key' : ''}`} aria-hidden="true" />
            <div
              className="wl-main"
              onPointerEnter={event => {
                if (event.pointerType === 'touch' || !canHover()) return;
                const row = event.currentTarget.closest('.wl-row') as HTMLElement;
                clearTimeout(hover.current.closeTimer);
                clearTimeout(hover.current.openTimer);
                hover.current.openTimer = setTimeout(() => openFromHover(turn.id, row), HOVER_OPEN_MS);
              }}
              onPointerLeave={event => {
                if (event.pointerType === 'touch' || !canHover()) return;
                clearTimeout(hover.current.openTimer);
                clearTimeout(hover.current.closeTimer);
                hover.current.closeTimer = setTimeout(() => setOpenId(current => (current === turn.id ? null : current)), HOVER_CLOSE_MS);
              }}
            >
              <button
                type="button"
                className="wl-card"
                aria-expanded={isOpen}
                onClick={event => {
                  // Touch and keyboard have no hover, so they are the only ones that toggle on press
                  if (lastPointer.current === 'touch' || event.detail === 0) setOpenId(isOpen ? null : turn.id);
                }}
              >
                {analysis && <span className={`wl-flag ${getImpactColorClass(analysis.impact)}`}>{t('report.key_moment')} · {impactLabel}</span>}
                <span className="wl-cmd">{turn.choice?.title || t('report.start')}</span>
                {turn.choice?.detail && <span className="wl-detail">{turn.choice.detail}</span>}
                {turn.summary && <span className="wl-sum">{turn.summary}</span>}
                <span className="wl-more">{t(isOpen ? 'report.collapse' : 'report.expand')} <i>{isOpen ? '−' : '+'}</i></span>
              </button>
              <div className="wl-body">
                <div className="wl-body-in">
                  {analysis && (
                    <div className={`wl-note ${analysis.impact.toLowerCase()}`}>
                      <div className="meta-line">{t('report.review_note')} · {impactLabel}</div>
                      <p><b>{analysis.event}</b></p>
                      <p>{analysis.analysis}</p>
                    </div>
                  )}
                  {risk && (
                    <div className="wl-note negative">
                      <div className="meta-line">{t('report.risk_level')} {risk.risk}</div>
                      <p>{risk.reason}</p>
                      <p className="alt">{t('report.better_move')}：{risk.betterMove}</p>
                    </div>
                  )}
                  {turn.blocks.map((block, blockIndex) => (
                    <LogBlockView key={blockIndex} block={block} speakerName={speakerName} npcImages={npcImages} onZoom={onZoom} t={t} />
                  ))}
                  {turn.unchosen.length > 0 && (
                    <div className="wl-paths">
                      <div className="meta-line dim">{t('report.paths_not_taken')}</div>
                      {turn.unchosen.map((title, pathIndex) => <div key={pathIndex} className="wl-path">{title}</div>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="wl-side">
              {turn.image && (
                <button type="button" className="wl-img" aria-label={t('stage.briefing.zoom')} onClick={() => onZoom(turn.image as string)}>
                  <img src={turn.image} alt="" loading="lazy" />
                </button>
              )}
              <div className="wl-meta">
                <span className="wl-turn">T{pad(turn.turn)}</span>
                <span className="wl-stab">{turn.stability}{turn.delta !== 0 && <i>{turn.delta > 0 ? '+' : '−'}{Math.abs(turn.delta)}</i>}</span>
                <span className="wl-phase">{phaseLabel}</span>
                {place && <span className="wl-loc">{place}</span>}
                {turn.speakers.length > 0 && (
                  <span className="wl-faces">
                    {turn.speakers.map(id => (
                      <span key={id} className="wl-face" title={speakerName(id)} style={npcImages?.[id] ? { backgroundImage: `url("${npcImages[id]}")` } : undefined} />
                    ))}
                  </span>
                )}
              </div>
            </div>
          </article>
        );
      })}

      <div className="wl-end" ref={endRef}>
        <span className="wl-knot" />
        <div className={`wl-end-kicker ${outcome.color}`}>{t('report.endpoint')} · {endingType}</div>
        <h2>{outcome.title}</h2>
        <p>{outcome.text}</p>
        <p className="archived">{t('report.archived')}</p>
        {children}
      </div>
    </section>
  );
});

WorldLineThread.displayName = 'WorldLineThread';

export default WorldLineThread;
