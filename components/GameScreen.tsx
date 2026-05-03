import React, { useState, useRef, useEffect } from 'react';
import { GameState, GameStatus, EndingType, GameReviewData, QAPair, LegacyData } from '../types';
import { getChatHistory, getSummaryContext, restoreChatSession, clearMemoryCache } from '../services/aiService';
import ConfirmationModal from './ConfirmationModal';
import SaveLoadModal from './SaveLoadModal';
import WorldLineTree from './WorldLineTree';
import LegacySidebar from './LegacySidebar';
import { useTranslation } from '../utils/i18n';

import GameHeader from './game/GameHeader';
import ChatArea from './game/ChatArea';
import InputArea from './game/InputArea';
import EndingOverlay from './game/EndingOverlay';
import TutorialOverlay from './game/TutorialOverlay';
import MapPanel from './game/MapPanel';

import { useMapContext } from '../hooks/useMapContext';
import { useMapUpdate } from '../hooks/useMapUpdate';
import { useGameLoop } from '../hooks/useGameLoop';
import { useGameOverCountdown } from '../hooks/useGameOverCountdown';
import { useGlitchEffect } from '../hooks/useGlitchEffect';
import { useThemeColors } from '../hooks/useThemeColors';
import { useViewport } from '../hooks/useViewport';
import MobileDrawer from './common/MobileDrawer';
import { useTutorial } from '../hooks/useTutorial';
import { THEME_CSS } from '../styles/themeCss';

const AUTO_SCROLL_THRESHOLD_PX = 72;

interface GameScreenProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const GameScreen: React.FC<GameScreenProps> = ({ gameState, setGameState }) => {
  const { t, language, setLanguage } = useTranslation();
  const { isMobile } = useViewport();
  const [mobileDrawer, setMobileDrawer] = useState<'none' | 'map' | 'legacy'>('none');
  const [input, setInput] = useState('');
  const [showAbortModal, setShowAbortModal] = useState(false);
  const [saveLoadModalOpen, setSaveLoadModalOpen] = useState(false);
  const [saveLoadMode, setSaveLoadMode] = useState<'save' | 'load'>('save');
  const [isReportOpen, setIsReportOpen] = useState(true);
  const [isMemoryEchoActive, setMemoryEchoActive] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoScrollRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const userScrollIntentRef = useRef(false);

  useThemeColors(gameState.stability);
  
  const { isTutorialOpen, closeTutorial } = useTutorial(gameState.turnCount);

  const buildMapContext = useMapContext(gameState);
  const applyMapUpdate = useMapUpdate();

  const { isProcessing, handleSend } = useGameLoop({
    gameState,
    setGameState,
    language,
    t,
    setInput,
    setMemoryEchoActive,
    buildMapContext,
    applyMapUpdate
  });

  const { countdown, isActive: isCountdownActive, cancel: handleCancelCountdown, isCollapsed: isEndingOverlayCollapsed, setIsCollapsed: setIsEndingOverlayCollapsed } = useGameOverCountdown(gameState, setGameState);
  const isGlitching = useGlitchEffect(gameState.stability, gameState.status === GameStatus.PLAYING);

  const isNearBottom = (container: HTMLDivElement) => (
    container.scrollHeight - container.scrollTop - container.clientHeight <= AUTO_SCROLL_THRESHOLD_PX
  );

  const scrollChatToBottom = () => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    programmaticScrollRef.current = true;
    container.scrollTop = container.scrollHeight;

    window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 120);
  };

  const handleChatUserScrollIntent = (forceDisable = false) => {
    if (programmaticScrollRef.current) {
      return;
    }

    userScrollIntentRef.current = true;

    if (forceDisable) {
      autoScrollRef.current = false;
      return;
    }

    const container = scrollRef.current;
    if (container && !isNearBottom(container)) {
      autoScrollRef.current = false;
    }
  };

  const handleChatScroll = () => {
    const container = scrollRef.current;
    if (!container || programmaticScrollRef.current) {
      return;
    }

    if (isNearBottom(container)) {
      autoScrollRef.current = true;
      userScrollIntentRef.current = false;
      return;
    }

    if (userScrollIntentRef.current) {
      autoScrollRef.current = false;
    }
  };

  useEffect(() => {
    if (gameState.status === GameStatus.PLAYING && autoScrollRef.current) {
      scrollChatToBottom();
    }
  }, [gameState.messages, gameState.status]);

  useEffect(() => {
    if (gameState.status === GameStatus.GAME_OVER) {
      setIsReportOpen(true);
    }
  }, [gameState.status]);

  const handleSendMessage = () => {
    autoScrollRef.current = true;
    userScrollIntentRef.current = false;
    requestAnimationFrame(() => {
      scrollChatToBottom();
    });
    void handleSend(input);
  };

  const handleAbort = () => {
    if (gameState.scpData?.designation === 'TEST-RUN') {
      setGameState(prev => ({
        ...prev,
        status: GameStatus.STORY_EDITOR,
        scpData: null,
        role: '',
        messages: [],
        stability: 100,
        turnCount: 0
      }));
      setShowAbortModal(false);
      return;
    }

    clearMemoryCache();
    
    setGameState({
      status: GameStatus.IDLE,
      scpData: null,
      role: '',
      messages: [],
      backgroundImage: null,
      mainImage: null,
      stability: 100,
      turnCount: 0,
      endingType: null,
      gameReview: null,
      qaHistory: []
    });
    setShowAbortModal(false);
  };

  const handleOpenSaveModal = async () => {
    try {
      const history = await getChatHistory();
      const summaryContext = await getSummaryContext();
      setGameState(prev => ({ ...prev, chatHistory: history, summaryContext, language }));
      setSaveLoadMode('save');
      setSaveLoadModalOpen(true);
    } catch (e) {
      console.error("Failed to sync chat history before save", e);
      setGameState(prev => ({ ...prev, language }));
      setSaveLoadMode('save');
      setSaveLoadModalOpen(true);
    }
  };

  const handleLoadGame = async (newGameState: GameState) => {
    clearMemoryCache();

    if (newGameState.language) {
      setLanguage(newGameState.language);
    }

    if (newGameState.chatHistory) {
      await restoreChatSession({
        history: newGameState.chatHistory,
        role: newGameState.role,
        language: newGameState.language || language,
        tokenCount: newGameState.tokenCount,
        summaryContext: newGameState.summaryContext
      });
    }
    
    const restoredMessages = newGameState.messages.map(msg => ({
      ...msg,
      isTyping: false
    }));
    
    setGameState({ ...newGameState, messages: restoredMessages });
    setSaveLoadModalOpen(false);
  };

  const handleManualEnter = () => {
    setGameState(prev => ({ ...prev, status: GameStatus.GAME_OVER }));
  };

  const handleOptionClick = (text: string) => {
    setInput(text);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleReviewUpdate = (review: GameReviewData) => {
    setGameState(prev => ({ ...prev, gameReview: review }));
  };

  const handleQAUpdate = (qa: QAPair) => {
    setGameState(prev => ({ 
      ...prev, 
      qaHistory: [...(prev.qaHistory || []), qa] 
    }));
  };

  const handleNewGamePlus = (legacyData: LegacyData) => {
    if (gameState.saveId) {
      clearMemoryCache(gameState.saveId);
    }

    setGameState(prev => ({
      status: GameStatus.IDLE,
      scpData: null,
      role: '',
      messages: [],
      backgroundImage: null,
      mainImage: null,
      stability: 100,
      turnCount: 1,
      endingType: null,
      gameReview: null,
      qaHistory: [],
      legacy: legacyData,
      saveId: prev.saveId
    }));
  };

  const instability = 100 - gameState.stability;
  const isUnstable = instability > 30; 
  const isViewingReport = gameState.status === GameStatus.GAME_OVER && isReportOpen;

  return (
    <>
    <style>{THEME_CSS}</style>
    <div 
        className={`relative z-10 w-full max-w-4xl ${isMobile ? 'h-[100dvh]' : 'h-[85vh] md:h-[90vh]'} flex flex-col bg-black/15 scp-ui shadow-2xl overflow-hidden crt transition-all duration-1000 ${isGlitching && !isViewingReport ? 'animate-shake' : ''}`}
        style={isUnstable && !isViewingReport ? { filter: 'url(#signal-interference)' } : {}}
    >
      {gameState.legacy && <LegacySidebar legacyData={gameState.legacy} isDrawerOpen={mobileDrawer === 'legacy'} onDrawerClose={() => setMobileDrawer('none')} />}

      <div className={`absolute inset-0 border pointer-events-none z-40 transition-colors duration-1000 border-scp-gray/50`}></div>
      
      <GameHeader 
        gameState={gameState} 
        t={t} 
        language={language}
        isReportOpen={isReportOpen}
        setIsReportOpen={setIsReportOpen}
        onSave={handleOpenSaveModal}
        onLoad={() => { setSaveLoadMode('load'); setSaveLoadModalOpen(true); }}
        onTerminate={() => {
            if (gameState.scpData?.designation === 'TEST-RUN') {
                 handleAbort();
            } else {
                 setShowAbortModal(true);
            }
        }}
        isCritical={false}
        isGlitching={isGlitching}
        isMemoryEchoActive={isMemoryEchoActive}
      />

      <ChatArea 
        gameState={gameState}
        t={t}
        isProcessing={isProcessing}
        scrollRef={scrollRef}
        onScroll={handleChatScroll}
        onUserScrollIntent={handleChatUserScrollIntent}
        shouldAutoScroll={autoScrollRef.current}
        onOptionClick={handleOptionClick}
      />

      <InputArea 
        input={input}
        setInput={setInput}
        handleSend={handleSendMessage}
        isProcessing={isProcessing}
        gameState={gameState}
        t={t}
        inputRef={inputRef}
      />

      {/* Left-edge legacy tab (mobile only) */}
      {isMobile && gameState.status === GameStatus.PLAYING && gameState.legacy && mobileDrawer !== 'legacy' && (
        <button
          onClick={() => setMobileDrawer('legacy')}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-[90] w-6 min-h-[56px] flex items-center justify-center bg-black/80 border border-l-0 border-scp-term/40 rounded-r text-scp-term/70 active:bg-scp-term/20"
        >
          <span className="text-xs font-mono">›</span>
        </button>
      )}

      {/* Right-edge map tab (mobile only) */}
      {isMobile && gameState.status === GameStatus.PLAYING && mobileDrawer !== 'map' && (
        <button
          onClick={() => setMobileDrawer('map')}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-[90] w-6 min-h-[56px] flex items-center justify-center bg-black/80 border border-r-0 border-scp-term/40 rounded-l text-scp-term/70 active:bg-scp-term/20"
        >
          <span className="text-xs font-mono">‹</span>
        </button>
      )}

      <EndingOverlay 
        gameState={gameState}
        t={t}
        isEndingOverlayCollapsed={isEndingOverlayCollapsed}
        setIsEndingOverlayCollapsed={setIsEndingOverlayCollapsed}
        isCountdownActive={isCountdownActive}
        gameOverCountdown={countdown}
        handleCancelCountdown={handleCancelCountdown}
        handleManualEnter={handleManualEnter}
      />
      
      {gameState.status === GameStatus.GAME_OVER && (
          <div className={isReportOpen ? 'contents' : 'hidden'}>
            <WorldLineTree 
                messages={gameState.messages} 
                scpData={gameState.scpData} 
                onRestart={handleAbort} 
                onNewGamePlus={handleNewGamePlus}
                onMinimize={() => setIsReportOpen(false)}
                backgroundImage={gameState.backgroundImage}
                endingType={gameState.endingType || EndingType.UNKNOWN}
                role={gameState.role}
                gameReview={gameState.gameReview || null}
                qaHistory={gameState.qaHistory}
                onReviewUpdate={handleReviewUpdate}
                onQAUpdate={handleQAUpdate}
                currentLegacyData={gameState.legacy}
                saveId={gameState.saveId}
            />
          </div>
      )}

    </div>

    <ConfirmationModal 
        isOpen={showAbortModal}
        onCancel={() => setShowAbortModal(false)}
        onConfirm={handleAbort}
        title={t('modal.title')}
        message={t('modal.message')}
    />

    <TutorialOverlay 
        isVisible={isTutorialOpen}
        onClose={closeTutorial}
        t={t}
    />

    <SaveLoadModal
        isOpen={saveLoadModalOpen}
        onClose={() => setSaveLoadModalOpen(false)}
        mode={saveLoadMode}
        currentGameState={gameState}
        onLoadGame={handleLoadGame}
        onSaveComplete={(id) => setGameState(prev => ({ ...prev, saveId: id }))}
    />
    {isMobile ? (
      <MobileDrawer
        isOpen={mobileDrawer === 'map'}
        onClose={() => setMobileDrawer('none')}
        title=""
        side="right"
      >
        <MapPanel 
          gameState={gameState}
          onQuickAction={(text) => { setMobileDrawer('none'); handleOptionClick(text); }}
          fullWidth
        />
      </MobileDrawer>
    ) : (
      <MapPanel 
        gameState={gameState}
        onQuickAction={handleOptionClick}
      />
    )}
    </>
  );
};

export default GameScreen;
