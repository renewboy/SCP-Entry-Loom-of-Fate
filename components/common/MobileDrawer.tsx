import React, { useEffect, useRef, useCallback, useState } from 'react';

interface MobileDrawerProps {
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  side?: 'left' | 'right';
  children: React.ReactNode;
}

const ANIMATION_MS = 250;

const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen: isOpenProp = true, onClose, title, side = 'right', children }) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Sync internal open state with isOpenProp
  useEffect(() => {
    if (isOpenProp) {
      requestAnimationFrame(() => setOpen(true));
    } else {
      setOpen(false);
    }
  }, [isOpenProp]);

  // Close with animation
  const animateClose = useCallback(() => {
    setOpen(false);
    setTimeout(onClose, ANIMATION_MS);
  }, [onClose]);

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') animateClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [animateClose]);

  const translateFrom = side === 'right' ? 'translate-x-full' : '-translate-x-full';
  const translateTo = 'translate-x-0';

  if (!isOpenProp) return null;

  return (
    <div className="fixed inset-0 z-[300]">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-[${ANIMATION_MS}ms] ${open ? 'opacity-60' : 'opacity-0'}`}
        onClick={animateClose}
      />

      {/* Drawer panel */}
      <div
        ref={panelRef}
        className={`absolute top-0 bottom-0 ${side === 'right' ? 'right-0' : 'left-0'}
          w-[85vw] max-w-[400px] bg-[var(--scp-surface)]
          flex flex-col scp-ui
          transition-transform duration-[${ANIMATION_MS}ms] ease-out
          ${open ? translateTo : translateFrom}`}
        style={{
          borderLeftWidth: side === 'right' ? '1px' : undefined,
          borderRightWidth: side === 'left' ? '1px' : undefined,
          borderColor: 'var(--scp-border)',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Header — only when title is provided */}
        {title ? (
          <div
            className="flex items-center justify-between px-4 border-b border-scp-border shrink-0"
            style={{ paddingTop: 'max(0.75rem, var(--safe-top))', minHeight: '3rem' }}
          >
            <span className="text-sm font-mono uppercase tracking-wider" style={{ color: 'var(--scp-text-dim)' }}>
              {title}
            </span>
            <button
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-scp-text/60 hover:text-scp-text"
              onClick={animateClose}
              aria-label="Close"
            >
              <span className="material-icons text-xl">close</span>
            </button>
          </div>
        ) : (
          <div style={{ paddingTop: 'var(--safe-top)' }} />
        )}

        {/* Scrollable content — respects bottom safe area */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 'var(--safe-bottom)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default MobileDrawer;
