
import React, { useState, useEffect } from 'react';
import { GameState, GameStatus } from './types';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import { LanguageProvider, useTranslation } from './utils/i18n';
import { pauseBgm, playBgm, resumeBgm, stopBgm, setBgmVolume } from './services/bgmService';
import { subscribeAIConfigMissing } from './services/events';
import GlobalSettingsModal from './components/GlobalSettingsModal';
import AuthorLinks from './components/AuthorLinks';
import { loadGlobalSettings } from './services/indexedDBService';
import { setSfxVolume } from './services/sfxService';
import { unlockAudio } from './services/audioUnlock';

import StoryEditor from './components/editor/StoryEditor';
import TacticalPreview from './components/TacticalPreview';
import FeedbackOverlay from './components/game/FeedbackOverlay';
import { useViewport } from './hooks/useViewport';

const LanguageToggle = () => {
    const { language, setLanguage, t } = useTranslation();
    const { isMobile } = useViewport();
    
    return (
        <button 
            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            className={`fixed top-2 right-4 z-[60] px-2 py-1 bg-black/80 border border-scp-gray/60 text-scp-text/80 font-mono text-xs hover:border-scp-term hover:text-scp-term hover:shadow-[0_0_10px_rgba(51,255,0,0.4)] transition-all backdrop-blur-md active:scale-95 ${isMobile ? "hidden" : ""}`}
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
   const [settingsModalOpen, setSettingsModalOpen] = useState(false);
   const [settingsAttention, setSettingsAttention] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeAIConfigMissing(() => {
      setSettingsModalOpen(true);
       setSettingsAttention(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    loadGlobalSettings().then((loaded) => {
      setBgmVolume(loaded.bgmVolume);
      setSfxVolume(loaded.sfxVolume);
    });
  }, []);

  useEffect(() => {
    if (gameState.status === GameStatus.PLAYING) {
      playBgm();
      return;
    }
    stopBgm();
  }, [gameState.status]);

  useEffect(() => {
    const handleUnlock = () => {
      unlockAudio().catch(() => {});
    };
    document.addEventListener('touchstart', handleUnlock, { once: true });
    document.addEventListener('click', handleUnlock, { once: true });
    return () => {
      document.removeEventListener('touchstart', handleUnlock);
      document.removeEventListener('click', handleUnlock);
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        pauseBgm();
      } else if (gameState.status === GameStatus.PLAYING) {
        resumeBgm();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [gameState.status]);

  return (
    <div className="relative w-screen h-screen-safe flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] text-scp-text" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
      <LanguageToggle />
      <FeedbackOverlay gameState={gameState} />
      
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
        <div className={`absolute top-16 w-32 h-32 md:w-64 md:h-64 border-2 border-scp-gray/30 z-[1] opacity-50 pointer-events-none filter sepia contrast-125 transition-all duration-1000 animate-pulse-slow ${gameState.legacy ? 'right-4 md:right-16 lg:right-[22rem] rotate-6' : 'left-4 md:left-16 -rotate-6'}`}>
             <img src={gameState.mainImage} className="w-full h-full object-cover" alt="Subject" />
             <div className="absolute bottom-0 right-0 bg-black/80 text-white text-xs px-2 py-1 font-mono border-t border-l border-scp-gray/50">
               {t('app.appendix')} // {gameState.scpData?.designation}
             </div>
        </div>
      )}

      {/* Main Content Container - z-10 */}
      <div className="relative z-10 w-full flex justify-center items-center p-2 sm:p-4 h-full">
        {(gameState.status === GameStatus.IDLE || gameState.status === GameStatus.ANALYZING || gameState.status === GameStatus.ENTITY_PROFILE) && (
          <StartScreen gameState={gameState} setGameState={setGameState} legacyData={gameState.legacy} />
        )}
        {gameState.status === GameStatus.TACTICAL_PREVIEW && (
          <TacticalPreview gameState={gameState} setGameState={setGameState} />
        )}
        {gameState.status === GameStatus.STORY_EDITOR && (
          <StoryEditor gameState={gameState} setGameState={setGameState} />
        )}
        {(gameState.status === GameStatus.PLAYING || gameState.status === GameStatus.GAME_OVER) && (
          <GameScreen gameState={gameState} setGameState={setGameState} />
        )}
      </div>

      {gameState.status !== GameStatus.ENTITY_PROFILE && (
        <>
          <AuthorLinks status={gameState.status} />

          <div className="absolute bottom-2 left-4 text-[10px] text-gray-600 font-mono pointer-events-none z-20 mix-blend-difference">
            {t('app.footer')}
          </div>

          <div className="absolute bottom-2 left-0 right-0 text-[10px] text-gray-600 font-mono pointer-events-none z-20 mix-blend-difference flex justify-center">
            © {new Date().getFullYear()} SCP Entry: Loom of Fate
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
        </>
      )}

      {/* Global CRT Scanline Overlay */}
       <div className="pointer-events-none absolute inset-0 z-[500] mix-blend-overlay opacity-10 bg-[url('https://www.transparenttextures.com/patterns/black-linen.png')]"></div>

      <GlobalSettingsModal 
        isOpen={settingsModalOpen} 
        onClose={() => {
          setSettingsModalOpen(false);
          setSettingsAttention(false);
        }}
        initialTab="ai"
        attention={settingsAttention}
      />
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
