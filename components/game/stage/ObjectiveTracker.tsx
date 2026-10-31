import React, { useEffect, useMemo, useState } from 'react';
import { ObjectiveState } from '../../../types';

const FLASH_MS = 4800;

interface ObjectiveTrackerProps {
  objectives: ObjectiveState[];
  open: boolean;
  onToggle: () => void;
  /** Changes whenever an objective changes; opens the tracker for a moment */
  flashKey: number;
  t: (key: string) => any;
}

const percent = (objective: ObjectiveState) => Math.max(0, Math.min(100, Math.round(objective.progress)));

const ObjectiveTracker: React.FC<ObjectiveTrackerProps> = ({ objectives, open, onToggle, flashKey, t }) => {
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (!flashKey) return;
    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashKey]);

  useEffect(() => setFlashing(false), [open]);

  const active = useMemo(() => {
    const live = objectives.filter(objective => objective.status === 'ACTIVE');
    return [...live.filter(o => o.type === 'MAIN'), ...live.filter(o => o.type !== 'MAIN')];
  }, [objectives]);

  if (active.length === 0) return null;
  const tracked = active.find(objective => objective.id === trackedId) || active[0];
  const isExpanded = open || flashing;

  const toggle = () => {
    if (flashing && !open) setFlashing(false);
    else onToggle();
  };

  const select = (id: string) => {
    setTrackedId(id);
    // Reading a row keeps a tracker the flash opened from closing underneath the player
    if (!open) onToggle();
  };

  const row = (objective: ObjectiveState) => (
    <>
      <span className="trk-type">{t(objective.type === 'MAIN' ? 'stage.tracker.main' : 'stage.tracker.side')}</span>
      <span className="trk-title">{objective.title}</span>
      <span className="trk-pct">{percent(objective)}%</span>
      <span className="trk-bar"><i style={{ width: `${percent(objective)}%` }} /></span>
    </>
  );

  return (
    <section id="tracker" className={`${isExpanded ? 'open' : ''} ${flashing ? 'flash' : ''}`} aria-label={t('stage.nav.task')}>
      <button id="tracker-head" type="button" title={t('stage.tracker.expand')} aria-expanded={isExpanded} onClick={toggle}>
        <span className="trk-chev" aria-hidden="true">›</span>
        {isExpanded
          ? <span className="trk-heading">{t('stage.nav.task')} · {active.length}</span>
          : <div className="trk-row">{row(tracked)}</div>}
        {!isExpanded && active.length > 1 && <span className="trk-more">+{active.length - 1}</span>}
      </button>
      <div id="tracker-list">
        {active.map(objective => {
          const selected = objective.id === tracked.id;
          return (
            <div key={objective.id} className={`trk-item ${selected ? 'selected' : ''}`}>
              <button type="button" className="trk-row" aria-expanded={selected} onClick={() => select(objective.id)}>
                {row(objective)}
              </button>
              {selected && objective.detail && <div className="trk-detail">{objective.detail}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ObjectiveTracker;
