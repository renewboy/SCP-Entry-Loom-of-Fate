import React from 'react';
import { EndingType, GameState, GameStatus } from '../../types';

interface EndingOverlayProps {
    gameState: GameState;
    t: (key: string) => string;
    isEndingOverlayCollapsed: boolean;
    setIsEndingOverlayCollapsed: (value: boolean) => void;
    isCountdownActive: boolean;
    gameOverCountdown: number | null;
    handleCancelCountdown: () => void;
    handleManualEnter: () => void;
}

const EndingOverlay: React.FC<EndingOverlayProps> = ({
    gameState, t, isEndingOverlayCollapsed, setIsEndingOverlayCollapsed, 
    isCountdownActive, gameOverCountdown, handleCancelCountdown, handleManualEnter
}) => {

  // Render Ending Config
  const getEndingConfig = (type: EndingType) => {
      const typeKey = type.toLowerCase();
      const fallback = { title: t('endings.unknown.title'), subtitle: t('endings.unknown.subtitle') };
      
      let texts = {
          title: t(`endings.${typeKey}.title`) || fallback.title,
          subtitle: t(`endings.${typeKey}.subtitle`) || fallback.subtitle
      };

      switch(type) {
          case EndingType.CONTAINED:
              return {
                  ...texts,
                  color: "text-scp-term",
                  bg: "bg-green-900/90",
                  bar: "bg-scp-term",
                  button: "bg-green-800 border-green-500 text-green-100"
              };
          case EndingType.DEATH:
              return {
                  ...texts,
                  color: "text-gray-400",
                  bg: "bg-gray-900/95",
                  bar: "bg-gray-500",
                  button: "bg-gray-800 border-gray-500 text-gray-200"
              };
          case EndingType.ESCAPED:
              return {
                  ...texts,
                  color: "text-yellow-500",
                  bg: "bg-yellow-950/90",
                  bar: "bg-yellow-500",
                  button: "bg-yellow-800 border-yellow-500 text-yellow-200"
              };
          case EndingType.COLLAPSE:
          default:
              return {
                  ...texts,
                  color: "text-red-600",
                  bg: "bg-black/90",
                  bar: "bg-red-600",
                  button: "bg-red-900/50 border-red-600 text-red-200"
              };
      }
  };

  if (!gameState.endingType || gameState.status === GameStatus.GAME_OVER) return null;

  const config = getEndingConfig(gameState.endingType);
  
  if (isEndingOverlayCollapsed) {
      return (
          <div className={`absolute bottom-0 left-0 right-0 z-50 p-2 flex items-center justify-between ${config.bg} border-t ${config.bar}`}>
              <span className={`font-mono text-xs ${config.color} px-2`}>
                  {t('game.ending_reached')}: {config.title}
              </span>
              <button 
                  onClick={() => setIsEndingOverlayCollapsed(false)}
                  className="px-4 py-1 border border-scp-gray text-xs font-mono text-gray-300 hover:text-white hover:border-white transition-colors"
              >
                  {t('game.expand')}
              </button>
          </div>
      );
  }

  return (
    <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center ${config.bg} backdrop-blur-md animate-in fade-in duration-1000 p-4 text-center`}>
        <div className={`absolute top-0 left-0 w-full h-1 ${config.bar} animate-pulse`}></div>
        
        {/* Minimize Button */}
        <button 
            onClick={() => setIsEndingOverlayCollapsed(true)}
            className="absolute top-4 right-4 text-gray-500 hover:text-white font-mono text-xs flex items-center gap-1"
        >
            {t('game.minimize_br')}
        </button>

        <h2 className={`text-3xl md:text-4xl ${config.color} font-report mb-2 animate-pulse text-shadow-sm tracking-widest uppercase`}>
            {config.title}
        </h2>
        <p className={`${config.color} font-mono text-sm mb-12 tracking-wider opacity-80`}>
            {config.subtitle}
        </p>

        <div className="flex flex-col items-center space-y-6 w-full max-w-sm">
            {isCountdownActive ? (
                <>
                    <div className="text-6xl font-mono text-white mb-4 tabular-nums">
                        00:{gameOverCountdown?.toString().padStart(2, '0')}
                    </div>
                    <p className="text-gray-400 font-mono text-xs animate-pulse">
                        {t('game.auto_archiving')}
                    </p>
                    <div className="flex gap-4 mt-8">
                        <button 
                            onClick={handleCancelCountdown} 
                            className="px-6 py-2 border border-scp-gray text-gray-400 font-mono text-xs hover:border-white hover:text-white transition-all"
                        >
                            {t('game.cancel_en')}
                        </button>
                        <button 
                            onClick={handleManualEnter} 
                            className={`px-6 py-2 ${config.button} font-mono text-xs hover:opacity-80 transition-all`}
                        >
                            {t('game.enter_now')}
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div className={`font-mono text-sm border px-4 py-2 ${config.color} border-current opacity-70`}>
                        {t('game.archiving_aborted')}
                    </div>
                    <button 
                        onClick={handleManualEnter} 
                        className="w-full px-8 py-4 bg-scp-text text-black font-bold font-mono text-sm hover:bg-white shadow-[0_0_20px_rgba(224,224,224,0.3)] transition-all"
                    >
                        {t('game.access_logs')}
                    </button>
                </>
            )}
            
            {/* Secondary button to minimize/review */}
            <button 
                onClick={() => setIsEndingOverlayCollapsed(true)}
                className="text-gray-500 hover:text-gray-300 font-mono text-xs underline decoration-dotted"
            >
                {t('game.review_logs')}
            </button>
        </div>
    </div>
  );
};

export default EndingOverlay;
