import React, { useState, useEffect, useRef } from 'react';

interface SettingsMenuProps {
  onSave: () => void;
  onLoad: () => void;
  onTerminate: () => void;
  t: (key: string) => string;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ onSave, onLoad, onTerminate, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative z-50" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 flex items-center justify-center border border-scp-gray text-scp-text hover:bg-scp-gray/20 hover:text-white transition-colors"
        title={t('game.settings')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-black/90 border border-scp-gray shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm flex flex-col p-2 space-y-2">
           <button
                onClick={() => { onSave(); setIsOpen(false); }}
                className="w-full text-left bg-scp-gray/10 hover:bg-scp-gray/30 text-scp-text px-3 py-2 font-mono text-xs transition-colors flex items-center gap-2"
            >
                <span className="text-lg">💾</span> {t('save_load.save')}
            </button>

            <button
                onClick={() => { onLoad(); setIsOpen(false); }}
                className="w-full text-left bg-scp-gray/10 hover:bg-scp-gray/30 text-scp-text px-3 py-2 font-mono text-xs transition-colors flex items-center gap-2"
            >
                 <span className="text-lg">📂</span> {t('save_load.load')}
            </button>

            <div className="h-px bg-scp-gray/30 my-1"></div>

            <button 
                onClick={() => { onTerminate(); setIsOpen(false); }}
                className="w-full text-left bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-900/50 px-3 py-2 font-mono text-xs transition-colors flex items-center gap-2"
            >
                <span className="text-lg">⚠️</span> {t('game.terminate')}
            </button>
        </div>
      )}
    </div>
  );
};

export default SettingsMenu;
