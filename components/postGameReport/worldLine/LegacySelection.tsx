import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LegacyData, LegacyItem, Trait, WorldEcho } from '../../../types';
import { useCompactScreen } from '../../../hooks/useCompactScreen';
import { playSfx, preloadSfx } from '../../../services/sfxService';
import { useTranslation } from '../../../utils/i18n';
import { threadStubPath, threadThroughRow, threadTrailPath } from '../../../utils/fateThread';
import { NetworkPoint } from '../../../utils/siteNetwork';
import { stageAsset } from '../../../utils/stageAssets';
import FateThread, { FateThreadDefs } from '../../common/FateThread';
import GameButton from '../../common/GameButton';
import '../../../styles/stage.css';
import '../../../styles/legacy.css';

const LIMIT = 5;
/** Where the core of the machine sits on anchor.jpg */
const CORE_AT = { x: 0.8, y: 0.3122 };
const DRAW_MS = 1100;
const CLEAR_AFTER_MS = 1200;
const LEAVE_AFTER_MS = 3700;
const TOAST_MS = 2600;
const THREAD_DELAY_STEP = 0.47;

type Kind = 'items' | 'traits';
type Entry = (LegacyItem | Trait) & { effectType?: Trait['effectType'] };

interface ThreadLine {
  key: string;
  d: string;
  draw: boolean;
  delay: number;
}

interface Painted {
  threads: ThreadLine[];
  stubs: string[];
  core: NetworkPoint | null;
}

const centerOf = (element: Element): NetworkPoint => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

export const EchoEntry: React.FC<{ echo: WorldEcho; now?: boolean }> = ({ echo, now = false }) => {
  const { t } = useTranslation();
  const titleKey = `report.outcome_titles.${echo.endingType}`;
  const title = t(titleKey);
  return (
    <article className={`lec ${now ? 'now' : ''}`}>
      <i className="lec-dot" />
      <div className="lec-meta"><em>{echo.roleName}</em>{title && title !== titleKey ? title : echo.endingType}</div>
      <h3 className="lec-title">“{echo.title}”</h3>
      <p className="lec-sum">{echo.summary}</p>
    </article>
  );
};

interface LegacySelectionProps {
  open: boolean;
  legacyData: Partial<LegacyData> | null;
  selectedTraits: Trait[];
  selectedItems: LegacyItem[];
  onToggleTrait: (trait: Trait) => void;
  onToggleItem: (item: LegacyItem) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Chooses what to carry into the next world line. Each pick ties a red thread from the last run through to the machine */
const LegacySelection: React.FC<LegacySelectionProps> = ({ open, legacyData, selectedTraits, selectedItems, onToggleTrait, onToggleItem, onCancel, onConfirm }) => {
  const { t } = useTranslation();
  const compact = useCompactScreen();
  const rootRef = useRef<HTMLElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const echoesRef = useRef<HTMLDivElement>(null);
  const firstSeen = useRef(new Map<string, number>());
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [painted, setPainted] = useState<Painted>({ threads: [], stubs: [], core: null });
  const [trail, setTrail] = useState({ d: '', width: 0, height: 0 });
  const [bumped, setBumped] = useState<Kind | null>(null);
  const [toast, setToast] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [cleared, setCleared] = useState(false);

  const items = legacyData?.items ?? [];
  const traits = legacyData?.traits ?? [];
  const echoes = legacyData?.echoes ?? [];
  const nextRun = legacyData?.runCount ?? echoes.length + 1;
  const pickedCount = { items: selectedItems.length, traits: selectedTraits.length };

  const paint = useCallback(() => {
    const root = rootRef.current;
    const list = listRef.current;
    const plate = plateRef.current?.getBoundingClientRect();
    if (!root || !list || !plate) return;
    const dots = root.querySelectorAll('.lg-echo .lec-dot');
    const listBox = list.getBoundingClientRect();
    const source = dots.length ? centerOf(dots[dots.length - 1]) : { x: listBox.left - 90, y: listBox.top + listBox.height / 2 };
    const core = { x: plate.left + plate.width * CORE_AT.x, y: plate.top + plate.height * CORE_AT.y };
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.lr'));
    const now = performance.now();
    const threads: ThreadLine[] = [];
    const stubs: string[] = [];
    const line = (key: string, d: string, delay = 0) => {
      if (!firstSeen.current.has(key)) firstSeen.current.set(key, now);
      threads.push({ key, d, delay, draw: now - (firstSeen.current.get(key) as number) < DRAW_MS });
    };

    if (compact) {
      // One column has no room for a thread per row, so a single trunk runs down the right edge
      const pins = rows.filter(row => row.classList.contains('on')).map(row => centerOf(row.querySelector('.lr-pin.r') as Element));
      const d = threadTrailPath([source, ...pins], 2.4);
      if (d) line('trunk', d);
    } else {
      rows.forEach((row, index) => {
        const box = row.getBoundingClientRect();
        if (box.bottom <= listBox.top + 2 || box.top >= listBox.bottom - 2) return;
        const left = centerOf(row.querySelector('.lr-pin.l') as Element);
        if (row.classList.contains('on')) {
          const right = centerOf(row.querySelector('.lr-pin.r') as Element);
          line(row.dataset.key as string, threadThroughRow(source, left, right, core), -index * THREAD_DELAY_STEP);
        } else {
          stubs.push(threadStubPath(left, source.y));
        }
      });
    }
    const alive = new Set(threads.map(thread => thread.key));
    firstSeen.current.forEach((_, key) => {
      if (!alive.has(key)) firstSeen.current.delete(key);
    });
    setPainted({ threads, stubs, core });
  }, [compact]);

  const paintTrail = useCallback(() => {
    const host = echoesRef.current;
    if (!host) return;
    const box = host.getBoundingClientRect();
    const points = Array.from(host.querySelectorAll('.lec-dot')).map(dot => {
      const point = centerOf(dot);
      return { x: point.x - box.left + host.scrollLeft, y: point.y - box.top + host.scrollTop };
    });
    setTrail({ d: threadTrailPath(points), width: host.scrollWidth, height: host.scrollHeight });
  }, []);

  const repaint = useCallback(() => {
    paintTrail();
    paint();
  }, [paint, paintTrail]);

  useEffect(() => {
    if (!open) return;
    setLeaving(false);
    setCleared(false);
    preloadSfx();
    playSfx('sweepUp');
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const host = echoesRef.current;
    if (host) host.scrollTop = host.scrollHeight;
    repaint();
  }, [open, repaint, selectedItems, selectedTraits, legacyData]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', repaint);
    // The Chinese glyphs arrive in pieces, and each piece can move the rows the threads are tied to
    document.fonts?.addEventListener?.('loadingdone', repaint);
    document.fonts?.ready.then(repaint);
    return () => {
      window.removeEventListener('resize', repaint);
      document.fonts?.removeEventListener?.('loadingdone', repaint);
    };
  }, [open, repaint]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;
  useEffect(() => {
    if (!leaving) return;
    const timers = [
      setTimeout(() => setCleared(true), CLEAR_AFTER_MS),
      setTimeout(() => confirmRef.current(), LEAVE_AFTER_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [leaving]);

  if (!open) return null;

  const toggle = (kind: Kind, entry: Entry, selected: boolean) => {
    if (leaving) return;
    if (!selected && pickedCount[kind] >= LIMIT) {
      setBumped(null);
      requestAnimationFrame(() => setBumped(kind));
      setToast(true);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(false), TOAST_MS);
      return;
    }
    playSfx('quickSweep');
    if (kind === 'items') onToggleItem(entry as LegacyItem);
    else onToggleTrait(entry as Trait);
  };

  const row = (kind: Kind, entry: Entry, index: number) => {
    const selected = (kind === 'items' ? selectedItems : selectedTraits).some(picked => picked.name === entry.name);
    return (
      <button
        key={`${entry.name}-${index}`}
        type="button"
        className={`lr ${selected ? 'on' : ''}`}
        data-key={`${kind}:${entry.name}`}
        aria-pressed={selected}
        onClick={() => toggle(kind, entry, selected)}
      >
        <i className="lr-pin l" /><i className="lr-pin r" />
        <span className="lr-no">{String(index + 1).padStart(2, '0')}</span>
        <span className="lr-body">
          <span className="lr-name">
            <em>{entry.icon}</em>{entry.name}
            {entry.effectType && <small className={entry.effectType}>{t(`legacy.effect_${entry.effectType.toLowerCase()}`)}</small>}
          </span>
          <span className="lr-desc">{entry.description}</span>
        </span>
        <span className="lr-state">{t(selected ? 'legacy.anchored' : 'legacy.not_selected')}</span>
      </button>
    );
  };

  const count = (kind: Kind) => (
    <b className={`${pickedCount[kind] >= LIMIT ? 'max' : ''} ${bumped === kind ? 'bump' : ''}`} onAnimationEnd={() => setBumped(null)}>{pickedCount[kind]} / {LIMIT}</b>
  );
  const nothingPicked = !selectedItems.length && !selectedTraits.length;

  return createPortal(
    <div className="stage-root lg-root">
      <section ref={rootRef} className={`p3-view lg ${leaving ? 'leaving' : ''}`}>
        <div ref={plateRef} className="plate right-bottom" style={{ backgroundImage: `url(${stageAsset('anchor.jpg')})` }} />
        <div className="lg-dim" />
        <svg className="lg-svg" aria-hidden="true">
          <FateThreadDefs />
          <g>{painted.stubs.map((d, index) => <path key={index} className="th-stub" d={d} />)}</g>
          <g>{painted.threads.map(thread => <FateThread key={thread.key} d={thread.d} draw={thread.draw} delay={thread.delay} />)}</g>
        </svg>
        <div className="lg-wrap" onScroll={paint}>
          <header className="lg-head">
            <div className="meta-line fate">{t('legacy.run_count')} #{nextRun - 1} // LEGACY</div>
            <h1>{t('legacy.modal_title')}</h1>
            <p>{t('legacy.modal_subtitle')}</p>
          </header>
          <div className="lg-col lg-echo">
            <div className="col-title"><span>{t('legacy.echoes')}</span><span>{t('common.read_only')}</span></div>
            <div className="col-scroll" ref={echoesRef} onScroll={paint}>
              <svg className="trail" width={trail.width} height={trail.height} aria-hidden="true">
                {trail.d && <FateThread d={trail.d} />}
              </svg>
              {echoes.map((echo, index) => <EchoEntry key={echo.id || index} echo={echo} now={index === echoes.length - 1} />)}
            </div>
          </div>
          <div className="lg-col lg-pick">
            <div className="col-scroll" ref={listRef} onScroll={paint}>
              <div className="col-title"><span>{t('legacy.items')}</span>{count('items')}</div>
              {items.map((entry, index) => row('items', entry, index))}
              {!items.length && <p className="col-empty">{t('legacy.no_items')}</p>}
              <div className="col-title second"><span>{t('legacy.traits')}</span>{count('traits')}</div>
              {traits.map((entry, index) => row('traits', entry, index))}
              {!traits.length && <p className="col-empty">{t('legacy.no_traits')}</p>}
            </div>
          </div>
          <footer className="lg-foot">
            <span className="left">{nothingPicked ? t('legacy.carry_nothing') : t('legacy.carry_summary', { items: selectedItems.length, traits: selectedTraits.length })}</span>
            <GameButton disabled={leaving} onClick={onCancel}>{t('common.cancel')}</GameButton>
            <GameButton
              variant="primary"
              disabled={leaving}
              onClick={() => {
                playSfx('bigSweep');
                setLeaving(true);
              }}
            >
              {t('legacy.confirm_start')}
            </GameButton>
          </footer>
        </div>
        <div
          className={`lg-next ${painted.threads.length ? 'linked' : ''}`}
          style={painted.core ? { '--x': `${painted.core.x}px`, '--y': `${painted.core.y}px` } as React.CSSProperties : undefined}
        >
          <i className="lg-next-dot" />
          <div className="lg-next-tag"><b>{t('legacy.next_world_line')}</b><small>{t('legacy.run_count')} #{nextRun}</small></div>
        </div>
        {toast && <div className="lg-toast" role="status">{t('legacy.limit_reached', { limit: LIMIT })}</div>}
        <div className={`lg-out ${cleared ? 'on' : ''}`}>
          <div><b>{t('legacy.world_line_reset')}</b><small>{t('legacy.run_count')} #{nextRun}</small></div>
        </div>
      </section>
    </div>,
    document.body,
  );
};

export default LegacySelection;
