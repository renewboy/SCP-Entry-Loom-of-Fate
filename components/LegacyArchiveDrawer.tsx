import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LegacyData } from '../types';
import { useCompactScreen } from '../hooks/useCompactScreen';
import { useResizable } from '../hooks/useResizable';
import { useTranslation } from '../utils/i18n';
import { threadTrailPath } from '../utils/fateThread';
import FateThread, { FateThreadDefs } from './common/FateThread';
import { EchoEntry } from './postGameReport/worldLine/LegacySelection';
import '../styles/stage.css';
import '../styles/legacy.css';

const DEFAULT_WIDTH = 340;

/** What carried over from earlier runs, on the start screen. The latest echo is on top and the thread flows up to it */
const LegacyArchiveDrawer: React.FC<{ legacyData: LegacyData; onWidthChange?: (width: number) => void }> = ({ legacyData, onWidthChange }) => {
  const { t } = useTranslation();
  const compact = useCompactScreen();
  const [open, setOpen] = useState(!compact);
  const { width, onMouseDown } = useResizable({ side: 'left', defaultWidth: DEFAULT_WIDTH, minWidth: 260, maxWidth: 560 });
  const drawerRef = useRef<HTMLElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const [trail, setTrail] = useState({ d: '', width: 0, height: 0 });
  const [tabAt, setTabAt] = useState(DEFAULT_WIDTH);

  useEffect(() => setOpen(!compact), [compact]);

  // On a wide screen the start menu moves aside for the drawer
  useEffect(() => {
    onWidthChange?.(open && !compact ? width : 0);
    return () => onWidthChange?.(0);
  }, [open, compact, width, onWidthChange]);

  useEffect(() => {
    if (!compact || !open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [compact, open]);

  useLayoutEffect(() => {
    const paint = () => {
      const host = trailRef.current;
      if (!host) return;
      const box = host.getBoundingClientRect();
      const points = Array.from(host.querySelectorAll('.lec-dot')).map(dot => {
        const point = dot.getBoundingClientRect();
        return { x: point.left + point.width / 2 - box.left, y: point.top + point.height / 2 - box.top };
      }).reverse();
      if (points.length === 1) points.unshift({ x: points[0].x, y: host.offsetHeight - 8 });
      setTrail({ d: threadTrailPath(points, 2.4), width: box.width, height: host.offsetHeight });
      setTabAt(drawerRef.current?.offsetWidth ?? DEFAULT_WIDTH);
    };
    paint();
    document.fonts?.ready.then(paint);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(paint);
    if (trailRef.current) observer.observe(trailRef.current);
    if (drawerRef.current) observer.observe(drawerRef.current);
    return () => observer.disconnect();
  }, [legacyData]);

  const cards = (entries: Array<{ name: string; icon: string; description: string }>) => entries.map((entry, index) => (
    <article key={`${entry.name}-${index}`} className="ar-card">
      <b><em>{entry.icon}</em>{entry.name}</b>
      <p>{entry.description}</p>
    </article>
  ));

  return createPortal(
    <div className="stage-root ar-root">
      {compact && open && <div className="ar-back" onClick={() => setOpen(false)} />}
      <aside ref={drawerRef} className={`ar-drawer ${open ? '' : 'shut'}`} style={{ width }} aria-label={t('legacy.sidebar_title')}>
        <header className="ar-head">
          <div className="meta-line fate">{t('legacy.archive_tag')}</div>
          <h2>{t('legacy.sidebar_title')}</h2>
          <small>{t('legacy.run_count')}: #{legacyData.runCount}</small>
        </header>
        <div className="ar-body">
          {legacyData.items.length > 0 && (
            <section className="ar-sec">
              <div className="col-title"><span>{t('legacy.items')}</span></div>
              {cards(legacyData.items)}
            </section>
          )}
          {legacyData.traits.length > 0 && (
            <section className="ar-sec">
              <div className="col-title"><span>{t('legacy.traits')}</span></div>
              {cards(legacyData.traits)}
            </section>
          )}
          {legacyData.echoes.length > 0 && (
            <section className="ar-sec">
              <div className="col-title"><span>{t('legacy.echoes')}</span></div>
              <div className="ar-trail" ref={trailRef}>
                <svg className="trail" width={trail.width} height={trail.height} aria-hidden="true">
                  <FateThreadDefs />
                  {trail.d && <FateThread d={trail.d} />}
                </svg>
                {[...legacyData.echoes].reverse().map((echo, index) => <EchoEntry key={echo.id || index} echo={echo} />)}
              </div>
            </section>
          )}
        </div>
        {!compact && <div className="ar-resize" onMouseDown={onMouseDown} />}
      </aside>
      <button
        type="button"
        className="ar-tab"
        style={{ left: open ? tabAt : 0 }}
        aria-label={t('legacy.sidebar_title')}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        {open ? '‹' : '›'}
      </button>
    </div>,
    document.body,
  );
};

export default LegacyArchiveDrawer;
