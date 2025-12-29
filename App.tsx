
import React, { useState } from 'react';
import { GameState, GameStatus } from './types';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import { LanguageProvider, useTranslation } from './utils/i18n';

const LanguageToggle = () => {
    const { language, setLanguage, t } = useTranslation();
    
    return (
        <button 
            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            className="absolute top-4 right-8 z-[60] px-4 py-2 bg-black/80 border-2 border-scp-gray text-scp-text font-bold font-mono text-lg hover:border-scp-term hover:text-scp-term hover:shadow-[0_0_10px_rgba(51,255,0,0.4)] transition-all backdrop-blur-md active:scale-95"
        >
            {t('app.switch_lang')}
        </button>
    );
};

const AppContent: React.FC = () => {
  const { t } = useTranslation();
  const [gameState, setGameState] = useState<GameState>({
    status: GameStatus.IDLE,
    scpData: null,
    role: '',
    messages: [],
    backgroundImage: null,
    mainImage: null,
    stability: 100,
    turnCount: 0,
    endingType: null
  });

  return (
    <div className="relative w-screen h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] text-scp-text">
      <LanguageToggle />
      
      {/* Dynamic Background Layer - z-0 */}
      <div className="absolute inset-0 z-0">
        {gameState.backgroundImage ? (
          <div 
            className="w-full h-full bg-cover bg-center transition-opacity duration-[3000ms] ease-in-out"
            style={{ backgroundImage: `url(${gameState.backgroundImage})` }}
          />
        ) : (
             // Default subtle texture
             <div className="w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
        )}
        
        {/* Vignette Overlay */}
        <div 
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at center, transparent 0%, rgba(5, 5, 5, 0.4) 60%, #050505 100%)' }}
        ></div>
      </div>

      {/* Floating Main SCP Image (Decoration) - z-1 */}
      {/* Placed between background and content */}
      {gameState.status === GameStatus.PLAYING && gameState.mainImage && (
        <div className="absolute top-16 right-4 md:right-16 w-32 h-32 md:w-64 md:h-64 border-2 border-scp-gray/30 z-[1] opacity-50 rotate-6 pointer-events-none filter sepia contrast-125 transition-all duration-1000 animate-pulse-slow">
             <img src={gameState.mainImage} className="w-full h-full object-cover" alt="Subject" />
             <div className="absolute bottom-0 right-0 bg-black/80 text-white text-xs px-2 py-1 font-mono border-t border-l border-scp-gray/50">
               {t('app.appendix')} // {gameState.scpData?.designation}
             </div>
        </div>
      )}

      {/* Main Content Container - z-10 */}
      <div className="relative z-10 w-full flex justify-center items-center p-2 sm:p-4 h-full">
        {gameState.status === GameStatus.IDLE ? (
          <StartScreen setGameState={setGameState} />
        ) : (
          <GameScreen gameState={gameState} setGameState={setGameState} />
        )}
      </div>

      {/* Footer Watermark */}
      <div className="absolute bottom-2 left-4 text-[10px] text-gray-600 font-mono pointer-events-none z-20 mix-blend-difference">
        {t('app.footer')}
      </div>

      <div className="absolute bottom-2 right-4 text-[10px] text-gray-600 font-mono z-20 mix-blend-difference">
        <a
          href="https://creativecommons.org/licenses/by-sa/3.0/"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto underline decoration-dotted hover:text-gray-300"
        >
          {t('app.license')}
        </a>
      </div>

      {/* Global CRT Scanline Overlay */}
       <div className="pointer-events-none absolute inset-0 z-50 mix-blend-overlay opacity-10 bg-[url('https://www.transparenttextures.com/patterns/black-linen.png')]"></div>
    </div>
  );
};

const App: React.FC = () => {
    return (
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    );
};

export default App;
