import React from 'react';
import { GameState, GameStatus } from '../../types';
import GameLogo from '../GameLogo';
import SettingsMenu from './SettingsMenu';
import { ROLE_TRANSLATIONS } from '../../utils/i18n';

interface GameHeaderProps {
  gameState: GameState;
  t: (key: string) => string;
  language: string;
  isReportOpen: boolean;
  setIsReportOpen: (isOpen: boolean) => void;
  onSave: () => void;
  onLoad: () => void;
  onTerminate: () => void;
  isCritical: boolean;
}

const GameHeader: React.FC<GameHeaderProps> = ({ 
    gameState, t, language, isReportOpen, setIsReportOpen, onSave, onLoad, onTerminate, isCritical 
}) => {

  const getStabilityColor = () => {
    if (gameState.stability > 70) return 'text-scp-term';
    if (gameState.stability > 30) return 'text-yellow-500';
    return 'text-scp-accent';
  };

  const getKantCounterLabel = () => {
     if (gameState.stability > 70) return t('game.stable');
     if (gameState.stability > 30) return t('game.fluctuating');
     return t('game.critical');
  };

  const getDisplayRole = (role: string) => {
      if (language === 'zh') return role;
      return ROLE_TRANSLATIONS[role] || role;
  };

  const resourcePalette = [
    { key: 'health', label: t('game.resource_health'), value: gameState.health, color: 'bg-red-500' },
    { key: 'cognition', label: t('game.resource_cognition'), value: gameState.cognition, color: 'bg-blue-500' },
    { key: 'containmentIntegrity', label: t('game.resource_integrity'), value: gameState.containmentIntegrity, color: 'bg-amber-500' },
    { key: 'reputation', label: t('game.resource_reputation'), value: gameState.reputation, color: 'bg-purple-500' }
  ];

  return (
      <header className="bg-scp-gray/50 p-4 border-b border-scp-dark/50 relative flex justify-between items-center h-20 shrink-0">
        
        {/* Left Side: Logo & Kant Counter */}
        <div className="flex items-center gap-4 z-10 w-1/3">
           <div className="hidden sm:block">
              <GameLogo className="h-10 w-10 text-scp-text opacity-90" />
           </div>
           <div className="flex flex-col" id="stability-meter">
              <span className="text-[10px] text-scp-gray font-mono uppercase tracking-tighter">{t('game.stability_label')}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold font-mono ${getStabilityColor()} ${isCritical ? 'animate-pulse' : ''}`}>
                   {t('game.stability')}: {gameState.stability.toFixed(0)}%
                </span>
                <span className={`text-[10px] font-mono hidden sm:inline-block ${getStabilityColor()}`}>
                    {getKantCounterLabel()}
                </span>
              </div>
           </div>
           <div className="hidden md:grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-gray-400 font-mono uppercase tracking-widest">
             {resourcePalette.map(resource => (
               <div key={resource.key} className="flex flex-col gap-0.5">
                 <div className="flex items-center justify-between">
                   <span>{resource.label}</span>
                   <span className="text-scp-text">{Math.round(resource.value)}%</span>
                 </div>
                 <div className="h-1.5 border border-scp-gray/40 bg-black/40 overflow-hidden">
                   <div
                     className={`h-full ${resource.color}`}
                     style={{ width: `${Math.max(0, Math.min(resource.value, 100))}%` }}
                   />
                 </div>
               </div>
             ))}
           </div>
        </div>

        {/* Center: Title */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <h1 className="text-lg sm:text-2xl font-report tracking-widest text-scp-text uppercase shadow-black drop-shadow-md text-shadow-sm text-center truncate max-w-[90%] px-2">
             {gameState.scpData?.name}
          </h1>
          <span className="text-[10px] text-scp-accent/80 font-mono tracking-[0.2em] uppercase">
             {gameState.scpData?.designation} // {t('game.archive_access')}
          </span>
        </div>
        
        {/* Right Side: Controls */}
        <div className="flex items-center justify-end gap-2 sm:gap-4 z-10 w-1/3">
             <div className="text-right text-[10px] font-mono text-gray-500 hidden lg:block bg-black/40 p-1 rounded leading-tight">
                <p>{t('game.role')}: {getDisplayRole(gameState.role)}</p>
                <p>{t('game.class')}: {gameState.scpData?.containmentClass}</p>
                <p>{t('game.turn')}: {gameState.turnCount}</p>
                <p>{t('game.resource_inventory')}: {gameState.inventory.length}</p>
            </div>
            
            {/* Show "View Report" button if Game Over and Report Minimized */}
            {gameState.status === GameStatus.GAME_OVER && !isReportOpen && (
                 <button 
                    onClick={() => setIsReportOpen(true)}
                    className="bg-scp-term/20 hover:bg-scp-term/40 text-scp-term border border-scp-term px-2 sm:px-3 py-1 font-mono text-[10px] sm:text-xs transition-colors whitespace-nowrap animate-pulse"
                >
                    {t('game.view_report')}
                </button>
            )}

            <SettingsMenu 
              onSave={onSave}
              onLoad={onLoad}
              onTerminate={onTerminate}
              t={t}
            />
        </div>
      </header>
  );
};

export default GameHeader;
