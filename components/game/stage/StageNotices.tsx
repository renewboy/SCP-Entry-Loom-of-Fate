import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, MapPin, Unlock } from 'lucide-react';

export type NoticeType = 'UNLOCK' | 'OBJECTIVE' | 'OBJECTIVE_ADD' | 'OBJECTIVE_DELETE' | 'OBJECTIVE_FAIL' | 'LOCATION' | 'SYSTEM';

export interface Notice {
  id: string;
  type: NoticeType;
  message: string;
  subMessage?: string;
  durationMs: number;
}

const NOTICE_MS = 4000;

const ICONS: Partial<Record<NoticeType, typeof CheckCircle2>> = { UNLOCK: Unlock, LOCATION: MapPin };

export function useNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const sequence = useRef(0);

  const pushNotice = useCallback((type: NoticeType, message: string, subMessage?: string, durationMs = NOTICE_MS) => {
    sequence.current += 1;
    const id = `notice-${sequence.current}`;
    setNotices(previous => [...previous, { id, type, message, subMessage, durationMs }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setNotices(previous => previous.filter(notice => notice.id !== id));
    }, durationMs);
    timers.current.add(timer);
  }, []);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
  }, []);

  return { notices, pushNotice };
}

const StageNotices: React.FC<{ notices: Notice[]; t: (key: string) => any }> = ({ notices, t }) => (
  <div id="notices" aria-live="polite">
    {notices.map(notice => {
      const Icon = ICONS[notice.type] || CheckCircle2;
      return (
        <div key={notice.id} className={`notice ${notice.type.toLowerCase().replace('_', '-')}`}>
          <div className="notice-text">
            <div className="notice-tag">[{notice.type}] {t('game.system_msg')}</div>
            <div className="notice-msg">{notice.message}</div>
            {notice.subMessage && <div className="notice-sub">{notice.subMessage}</div>}
          </div>
          <Icon className="notice-icon" aria-hidden="true" />
          <i className="notice-timer" style={{ animationDuration: `${notice.durationMs}ms` }} />
        </div>
      );
    })}
  </div>
);

export default StageNotices;
