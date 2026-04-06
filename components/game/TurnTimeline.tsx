import React from 'react';
import { X } from 'lucide-react';
import type { ChatTurn } from '../../utils/chatTurns';

interface TurnTimelineProps {
  turns: ChatTurn[];
  activeTurn: number | null;
  onJump: (turnNumber: number) => void;
  t: (key: string) => string;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onCollapse?: () => void;
}

const TurnTimeline: React.FC<TurnTimelineProps> = ({
  turns,
  activeTurn,
  onJump,
  t,
  isMobile = false,
  isOpen = true,
  onClose,
  onCollapse
}) => {
  if (turns.length === 0 || !isOpen) {
    return null;
  }

  const containerClasses = isMobile
    ? 'absolute right-3 top-14 z-40 w-20 rounded-sm bg-black/90 p-3 backdrop-blur-md scp-window'
    : 'relative hidden md:flex w-14 shrink-0 flex-col items-center bg-black/20 px-3 py-5';

  return (
    <aside
      className={containerClasses}
      aria-label="Turn timeline"
      style={{
        borderColor: 'var(--theme-accent-underline)',
        boxShadow: isMobile ? '0 0 20px var(--theme-accent-soft)' : undefined,
        borderLeftColor: !isMobile ? 'var(--theme-accent-underline)' : undefined,
        borderLeftWidth: !isMobile ? '1px' : undefined
      }}
    >
      {!isMobile && onCollapse && (
        <button
          type="button"
          onClick={onCollapse}
          className="absolute -left-4 top-1/2 z-50 flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-l border bg-black/85 text-sm transition-colors hover:bg-black"
          style={{ borderColor: 'var(--theme-accent-underline)', color: 'var(--theme-accent)' }}
          aria-label="Collapse turn timeline"
        >
          ›
        </button>
      )}

      {isMobile && (
        <div className="mb-3 flex items-center justify-between border-b border-scp-gray/20 pb-2">
          <span className="font-mono text-[10px] tracking-[0.3em]" style={{ color: 'var(--theme-accent)' }}>{t('game.turns')}</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center border transition-colors hover:text-scp-term"
            aria-label="Close timeline"
            style={{ borderColor: 'var(--theme-accent-underline)', color: 'var(--theme-accent)' }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="relative flex-1 self-stretch overflow-y-auto">
        <div className={`relative flex flex-col items-center ${isMobile ? 'gap-3' : 'gap-4'} py-2`}>
          <div
            className="pointer-events-none absolute left-1/2 top-4 w-px -translate-x-1/2"
            style={{
              bottom: '1rem',
              background: 'linear-gradient(to bottom, transparent, var(--theme-accent) 12%, var(--theme-accent) 88%, transparent)'
            }}
          />
          {turns.map((turn) => {
            const isActive = turn.turnNumber === activeTurn;

            return (
              <button
                key={turn.anchorId}
                type="button"
                onClick={() => onJump(turn.turnNumber)}
                title={`${t('game.turn')} ${String(turn.turnNumber).padStart(2, '0')}`}
                className="group relative z-10 flex h-8 w-8 items-center justify-center outline-none focus:outline-none focus:ring-0"
                aria-label={`${t('game.turn')} ${turn.turnNumber}`}
                style={{ outline: 'none' }}
              >
                {isActive && (
                  <span className="pointer-events-none absolute inset-0">
                    <span className="absolute left-[5px] top-[5px] h-1.5 w-1.5 border-l border-t" style={{ borderColor: 'var(--theme-accent)' }} />
                    <span className="absolute right-[5px] top-[5px] h-1.5 w-1.5 border-r border-t" style={{ borderColor: 'var(--theme-accent)' }} />
                    <span className="absolute bottom-[5px] left-[5px] h-1.5 w-1.5 border-b border-l" style={{ borderColor: 'var(--theme-accent)' }} />
                    <span className="absolute bottom-[5px] right-[5px] h-1.5 w-1.5 border-b border-r" style={{ borderColor: 'var(--theme-accent)' }} />
                  </span>
                )}
                <span
                  className={`absolute h-3.5 w-3.5 rounded-full border-2 transition-all duration-200 ${isActive ? 'animate-pulse' : ''}`}
                  style={{
                    borderColor: 'var(--theme-accent)',
                    backgroundColor: 'var(--theme-accent)',
                    opacity: isActive ? 1 : 0.88
                  }}
                />
                <span
                  className={`pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-sm bg-black/90 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.2em] opacity-0 shadow-lg transition-all duration-150 group-hover:opacity-100 ${
                    isMobile ? 'group-hover:translate-x-0' : ''
                  } ${isActive ? 'opacity-100' : ''}`}
                  style={{ border: '1px solid var(--theme-accent-underline)', color: 'var(--theme-accent)' }}
                >
                  {t('game.turn')}-{String(turn.turnNumber).padStart(2, '0')}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};

export default TurnTimeline;
