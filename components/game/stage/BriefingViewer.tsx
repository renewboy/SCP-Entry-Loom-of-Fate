import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StageMedia } from '../../../utils/beats';
import { StageTextSpeed } from '../../../types';
import { playSfx } from '../../../services/sfxService';
import GameButton from '../../common/GameButton';
import MediaInsert from './MediaInsert';

const noop = () => {};

interface BriefingViewerProps {
  pages: StageMedia[];
  designation: string;
  speed: StageTextSpeed;
  entityImage?: string | null;
  onZoomPortrait: () => void;
  /** A zoomed image is on top: the keyboard belongs to it */
  paused: boolean;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

/** Re-reads the mission brief at any point in the game, page by page, without touching the story */
const BriefingViewer: React.FC<BriefingViewerProps> = ({ pages, designation, speed, entityImage, onZoomPortrait, paused, onClose, t }) => {
  const [page, setPage] = useState(0);
  const finishRef = useRef<(() => void) | null>(null);
  const lastPage = pages.length - 1;

  const turnTo = useCallback((target: number) => {
    setPage(target);
    playSfx('quickSweep', { gain: 0.5 });
  }, []);

  const next = useCallback(() => {
    if (page < lastPage) turnTo(page + 1);
    else onClose();
  }, [page, lastPage, turnTo, onClose]);

  useEffect(() => {
    if (paused) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft' && page > 0) {
        event.preventDefault();
        turnTo(page - 1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [paused, next, page, turnTo]);

  return (
    <section
      id="briefing-view"
      aria-label={t('stage.briefing.open')}
      onClick={event => {
        if (!(event.target as Element).closest('button')) next();
      }}
    >
      <MediaInsert
        key={page}
        media={pages[page]}
        designation={designation}
        speed={speed}
        instant
        fast={false}
        onDone={noop}
        finishRef={finishRef}
        entityImage={entityImage}
        onZoomPortrait={onZoomPortrait}
        t={t}
      />
      <GameButton variant="quiet" size="sm" className="bv-close" onClick={onClose}>✕ {t('stage.log.close')} <kbd>Esc</kbd></GameButton>
      {page > 0 && (
        <button type="button" className="page-turn prev" aria-label={t('stage.briefing.prev')} onClick={() => turnTo(page - 1)}>‹</button>
      )}
      {page < lastPage && (
        <button type="button" className="page-turn next" aria-label={t('stage.briefing.next')} onClick={() => turnTo(page + 1)}>›</button>
      )}
    </section>
  );
};

export default BriefingViewer;
