import React, { useRef } from 'react';
import { GameState, GameStatus, Language } from '../../types';
import SettingsMenu from './SettingsMenu';
import { getRoleTranslation } from '../../utils/i18n';
import StabilityMonitor from './StabilityMonitor';
import { useWaveformRenderer } from '../../hooks/useWaveformRenderer';
import { useViewport } from '../../hooks/useViewport';

interface GameHeaderProps {
  gameState: GameState;
  t: (key: string) => string;
  language: Language;
  isReportOpen: boolean;
  setIsReportOpen: (isOpen: boolean) => void;
  onSave: () => void;
  onLoad: () => void;
  onTerminate: () => void;
  isCritical: boolean;
  isMemoryEchoActive: boolean;
}

const GameHeader: React.FC<GameHeaderProps> = ({ 
    gameState, t, language, isReportOpen, setIsReportOpen, onSave, onLoad, onTerminate, isCritical, isMemoryEchoActive
}) => {
  const { isMobile } = useViewport();
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

  useWaveformRenderer(waveformCanvasRef, {
    stability: gameState.stability,
    isPlaying: gameState.status === GameStatus.PLAYING,
  });

  const getDisplayRole = (role: string) => {
      return getRoleTranslation(role, language);
  };

  const maxHume = 1.5;
  const humeValue = (gameState.stability / 100) * maxHume;

  const getStabilityColor = () => {
    if (gameState.stability > 70) return 'text-scp-term_fix';
    if (gameState.stability > 30) return 'text-scp-amber';
    return 'text-scp-accent';
  };

  return (
      <header className="relative isolate z-[70] flex items-center h-14 shrink-0 scp-ui border-b border-scp-dark/50">
        
        {/* ===== Layer 0: Waveform Canvas Background ===== */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <canvas
            ref={waveformCanvasRef}
            className="block w-full h-full pointer-events-none"
          />
          <div className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, 
                rgba(0,0,0,0.78) 0%, 
                rgba(0,0,0,0.38) 20%, 
                rgba(0,0,0,0.20) 50%, 
                rgba(0,0,0,0.38) 80%, 
                rgba(0,0,0,0.78) 100%)`
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.18) 60%, rgba(0,0,0,0.70) 100%)'
            }}
          />
          <div className="absolute inset-0 pointer-events-none opacity-12 bg-[repeating-linear-gradient(180deg,transparent,transparent_2px,rgba(255,255,255,0.04)_3px)]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-scp-term/40 to-transparent" />
        </div>

        {/* ===== Layer 1: Content ===== */}
        <div className="relative z-10 flex items-center w-full h-full px-3 sm:px-4 gap-2 sm:gap-3">
          
          {/* --- Left: HUME + Percentage --- */}
          <div className="flex items-center gap-2 shrink-0">
            <div className={`font-report tracking-wider uppercase text-shadow-sm font-bold transition-colors duration-500 text-sm sm:text-base whitespace-nowrap ${getStabilityColor()} ${isCritical ? 'animate-pulse' : ''}`}>
              <span className="opacity-70 text-[10px] sm:text-xs mr-1">{t('game.hume_label')}</span>
              {humeValue.toFixed(2)}
              <span className="ml-1 text-[11px] sm:text-sm opacity-80">({gameState.stability.toFixed(0)}%)</span>
            </div>
          </div>

          {/* --- Center: Title block --- */}
          <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
            {/* SCP Name */}
            <h1 className="text-sm sm:text-xl font-report tracking-widest text-scp-text uppercase shadow-black drop-shadow-md text-shadow-sm text-center truncate max-w-full leading-tight">
               {gameState.scpData?.name}
            </h1>

            <span className="text-[10px] sm:text-[10px] text-scp-accent/80 font-mono tracking-[0.15em] sm:tracking-[0.2em] uppercase truncate max-w-full">
               {gameState.scpData?.designation} // {gameState.scpData?.containmentClass}
            </span>
            {/* Mobile only: role on third line */}
            {isMobile && (
              <span className="text-[10px] font-mono tracking-widest text-gray-400 uppercase truncate max-w-full">
                {t('game.role')}: {getDisplayRole(gameState.role)}
              </span>
            )}
          </div>

          {/* --- Right: Role (PC only) + View Report + Gear --- */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {!isMobile && (
              <span className="text-[12px] font-report text-gray-400 whitespace-nowrap leading-tight">
                {t('game.role')}: {getDisplayRole(gameState.role)}
              </span>
            )}

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
        </div>

        <StabilityMonitor 
          stability={gameState.stability}
          isPlaying={gameState.status === GameStatus.PLAYING}
          isMemoryEchoActive={isMemoryEchoActive}
        />
      </header>
  );
};

export default GameHeader;
