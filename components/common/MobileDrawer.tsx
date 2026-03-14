import React from 'react';

interface MobileDrawerProps {
  onClose: () => void;
  title: string;
  side?: 'left' | 'right';
  children: React.ReactNode;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({ onClose, title, side = 'right', children }) => {
  return (
    <div className="fixed inset-0 z-[300]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className={`absolute top-0 bottom-0 ${side === 'right' ? 'right-0' : 'left-0'} w-[85vw] max-w-[400px] bg-[var(--scp-surface)] border-scp-border flex flex-col scp-ui`}
        style={{
          borderLeftWidth: side === 'right' ? '1px' : undefined,
          borderRightWidth: side === 'left' ? '1px' : undefined
        }}
      >
        <div
          className="h-12 flex items-center justify-between px-4 border-b border-scp-border shrink-0"
          style={{ paddingTop: 'var(--safe-top)' }}
        >
          <span className="text-sm font-mono uppercase text-scp-text-dim">{title}</span>
          <button
            className="min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default MobileDrawer;
