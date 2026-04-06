import React, { useState, useEffect } from 'react';
import { GameState, GameStatus } from './types';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import { LanguageProvider, useTranslation, languagePacks } from './utils/i18n';
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

const LanguageToggle = ({ status }: { status: GameStatus }) => {
    const { language, setLanguage, t } = useTranslation();
    const { isMobile } = useViewport();
    const availableLanguages = Object.values(languagePacks);
    const [isOpen, setIsOpen] = useState(false);
    
    // In mobile, only show language toggle on StartScreen (IDLE, ANALYZING, ENTITY_PROFILE)
    const isStartScreen = status === GameStatus.IDLE || status === GameStatus.ANALYZING || status === GameStatus.ENTITY_PROFILE;
    
    useEffect(() => {
      if (isMobile && !isStartScreen) {
        setIsOpen(false);
      }
    }, [isMobile, isStartScreen]);

    const isInGame = status === GameStatus.PLAYING || status === GameStatus.GAME_OVER;
    const accentClasses = {
        border: isInGame ? 'border-scp-term' : 'border-scp-accent',
        borderSoft: isInGame ? 'border-scp-term/60' : 'border-scp-accent/50',
        text: isInGame ? 'text-scp-term' : 'text-scp-accent',
        bg: isInGame ? 'bg-scp-term' : 'bg-scp-accent',
        hoverBorder: isInGame ? 'hover:border-scp-term' : 'hover:border-scp-accent',
        hoverBorderSoft: isInGame ? 'hover:border-scp-term/60' : 'hover:border-scp-accent/50',
        hoverBg: isInGame ? 'hover:bg-scp-term/15' : 'hover:bg-scp-accent/15',
        activeText: isInGame ? 'text-scp-term' : 'text-scp-accent'
    };
    
    return (
        <>
            {isOpen && (
                <button
                    type="button"
                    aria-label="Close language menu"
                    onClick={() => setIsOpen(false)}
                    className="fixed inset-0 z-[59] cursor-default"
                />
            )}
            <div className={`fixed top-2 right-4 z-[60] ${isMobile && !isStartScreen ? "hidden" : ""}`}>
                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    aria-label="Language selector"
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    className={`min-w-[84px] px-2.5 py-1.5 bg-black/85 border font-mono text-xs tracking-wider backdrop-blur-sm transition-all duration-200 rounded-sm scp-ui ${
                        isOpen
                            ? `${accentClasses.border} text-scp-text shadow-[0_0_18px_rgba(224,224,224,0.22)]`
                            : `border-scp-gray/70 text-gray-300 hover:text-white ${accentClasses.hoverBorder}`
                    }`}
                >
                    <span className="flex items-center justify-between gap-2">
                        <span>{t(`i18n.languages.${language}`)}</span>
                        <span className={`text-xs transition-transform duration-200 ${isOpen ? `rotate-180 ${accentClasses.text}` : ''}`}>▾</span>
                    </span>
                </button>

                {isOpen && (
                    <div className={`absolute right-0 mt-1.5 min-w-full overflow-hidden border ${accentClasses.borderSoft} bg-black/95 backdrop-blur-md shadow-2xl scp-window scp-ui`}>
                        <div className="py-0.5">
                            {availableLanguages.map((pack) => {
                                const code = pack.code;
                                const active = language === code;
                                return (
                                    <div
                                        key={code}
                                        className={`group relative border border-transparent ${accentClasses.hoverBorderSoft} transition-all duration-200 ${active ? 'bg-scp-gray/20' : ''}`}
                                    >
                                        <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${accentClasses.bg} ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}></div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLanguage(code);
                                                setIsOpen(false);
                                            }}
                                            className="relative z-10 w-full px-2.5 py-1.5 text-left font-mono text-xs text-gray-300 group-hover:text-white transition-colors"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <span className={`inline-block w-3 ${accentClasses.activeText} ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>›</span>
                                                <span>{t(`i18n.languages.${code}`)}</span>
                                            </span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

const AppContent: React.FC = () => {
  const { isMobile } = useViewport();
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
      <LanguageToggle status={gameState.status} />
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

          {/* Footer - Desktop: left, center, right. Mobile: Stacked or centered */}
          <div className={`absolute left-0 right-0 pointer-events-none z-20 mix-blend-difference flex px-4 ${isMobile ? 'bottom-2 flex-col items-center gap-1' : 'bottom-2 justify-between items-center'}`}>
            <div className={`text-[10px] text-gray-600 font-mono ${isMobile ? 'hidden' : ''}`}>
              {t('app.footer')}
            </div>
            <div className="text-[10px] text-gray-600 font-mono">
              © {new Date().getFullYear()} SCP Entry: Loom of Fate
            </div>
            <div className={`text-[10px] text-gray-600 font-mono pointer-events-auto ${isMobile ? 'hidden' : ''}`}>
              <a
                href="https://creativecommons.org/licenses/by-sa/3.0/"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted hover:text-gray-300"
              >
                {t('app.license')}
              </a>
            </div>
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
