import React, { useEffect, useMemo, useState } from 'react';

interface BootSequenceOverlayProps {
  onComplete: () => void;
}

const BootSequenceOverlay: React.FC<BootSequenceOverlayProps> = ({ onComplete }) => {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const lines = useMemo(
    () => [
      'BOOTSTRAP: SCP FOUNDATION SECURE TERMINAL',
      'CHECKSUM [████████████████] OK',
      'ESTABLISHING SCiPNET LINK........ OK',
      'AUTH PROTOCOL: KETER-LVL',
      'CRYPTOGRAPHIC HANDSHAKE...... OK',
      'REALITY ANCHOR SYNC.......... OK',
      'ARCHIVE LAYER MOUNT.......... OK',
      'ACCESS GATE OPEN',
    ],
    []
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (visibleCount < lines.length) {
      timer = setTimeout(() => setVisibleCount((c) => c + 1), 260);
    } else if (!isFading) {
      timer = setTimeout(() => setIsFading(true), 800);
    } else {
      timer = setTimeout(onComplete, 700);
    }
    return () => clearTimeout(timer);
  }, [visibleCount, lines.length, isFading, onComplete]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onComplete]);

  return (
    <div
      onClick={onComplete}
      className={`fixed inset-0 z-[70] bg-black/95 text-scp-text font-mono tracking-widest transition-opacity duration-700 ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-full h-full bg-[repeating-linear-gradient(180deg,transparent,transparent_2px,rgba(255,255,255,0.04)_3px)] opacity-60"></div>
      </div>
      <div className="relative z-10 h-full w-full flex items-center justify-center px-6">
        <div className="max-w-2xl w-full border border-scp-gray/40 bg-black/60 backdrop-blur-md p-6 sm:p-8 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
          <div className="text-xs text-scp-gray mb-3">SECURE BOOT SEQUENCE</div>
          <div className="space-y-2 text-[11px] sm:text-sm">
            {lines.slice(0, visibleCount).map((line, idx) => (
              <div key={`${line}-${idx}`} className="flex items-center gap-2">
                <span className="text-scp-term">›</span>
                <span>{line}</span>
              </div>
            ))}
            {visibleCount < lines.length && (
              <div className="flex items-center gap-2 text-scp-term">
                <span>›</span>
                <span className="boot-cursor">_</span>
              </div>
            )}
          </div>
          <div className="mt-6 text-[10px] text-gray-500">PRESS ENTER TO SKIP</div>
        </div>
      </div>
      <style>
        {`
          .boot-cursor {
            animation: boot-blink 1s step-end infinite;
          }
          @keyframes boot-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}
      </style>
    </div>
  );
};

export default BootSequenceOverlay;
