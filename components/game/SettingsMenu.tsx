import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, FolderOpen, Save } from 'lucide-react';
import SettingsGearIcon from '../common/SettingsGearIcon';

interface SettingsMenuProps {
  onSave: () => void;
  onLoad: () => void;
  onTerminate: () => void;
  t: (key: string) => string;
  /** Mobile-only: role name to display at top of menu */
  role?: string;
  /** Mobile-only: containment class to display at top of menu */
  containmentClass?: string;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ onSave, onLoad, onTerminate, t, role, containmentClass }) => {
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

  const hasMobileInfo = role || containmentClass;

  return (
    <div className="relative z-50 scp-ui" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        id="game-settings-button"
        className="w-8 h-8 flex items-center justify-center border border-scp-gray text-scp-text hover:bg-scp-gray/20 hover:text-white transition-colors"
        title={t('game.settings')}
      >
        <SettingsGearIcon className="h-5 w-5" variant="solid" spin={false} />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full z-[80] mt-2 w-48 scp-window border border-scp-gray shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm flex flex-col p-2 space-y-2">
           {/* Mobile-only: Show role & class info at top */}
           {hasMobileInfo && (
             <>
               <div className="text-[10px] font-mono text-gray-400 leading-tight px-2 py-1">
                 {role && <p>{t('game.role')}: {role}</p>}
                 {containmentClass && <p>{t('game.class')}: {containmentClass}</p>}
               </div>
               <div className="h-px bg-scp-gray/30 my-1"></div>
             </>
           )}

           <button
                onClick={() => { onSave(); setIsOpen(false); }}
                className="w-full text-left bg-scp-gray/10 hover:bg-scp-gray/30 text-scp-text px-3 py-2 font-mono text-xs transition-colors flex items-center gap-2"
            >
                <Save className="w-4 h-4" /> {t('save_load.save')}
            </button>

            <button
                onClick={() => { onLoad(); setIsOpen(false); }}
                className="w-full text-left bg-scp-gray/10 hover:bg-scp-gray/30 text-scp-text px-3 py-2 font-mono text-xs transition-colors flex items-center gap-2"
            >
                 <FolderOpen className="w-4 h-4" /> {t('save_load.load')}
            </button>

            <div className="h-px bg-scp-gray/30 my-1"></div>

            <button 
                onClick={() => { onTerminate(); setIsOpen(false); }}
                className="w-full text-left bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-900/50 px-3 py-2 font-mono text-xs transition-colors flex items-center gap-2"
            >
                <AlertTriangle className="w-4 h-4" /> {t('game.terminate')}
            </button>
        </div>
      )}
    </div>
  );
};

export default SettingsMenu;
