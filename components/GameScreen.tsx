import React, { useState, useRef, useEffect } from 'react';
import { GameState, GameStatus, EndingType, GameReviewData, QAPair, LegacyData } from '../types';
import { getChatHistory, restoreChatSession, clearMemoryCache } from '../services/aiService';
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
import { useThemeColors } from '../hooks/useThemeColors';
import { useTutorial } from '../hooks/useTutorial';
import { THEME_CSS } from '../styles/themeCss';

interface GameScreenProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const GameScreen: React.FC<GameScreenProps> = ({ gameState, setGameState }) => {
  const { t, language, setLanguage } = useTranslation();
  const [input, setInput] = useState('');
  const [showAbortModal, setShowAbortModal] = useState(false);
  const [saveLoadModalOpen, setSaveLoadModalOpen] = useState(false);
  const [saveLoadMode, setSaveLoadMode] = useState<'save' | 'load'>('save');
  const [isReportOpen, setIsReportOpen] = useState(true);
  const [isMemoryEchoActive, setMemoryEchoActive] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (scrollRef.current && gameState.status === GameStatus.PLAYING) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState.messages, gameState.status]);

  useEffect(() => {
    if (gameState.status === GameStatus.GAME_OVER) {
      setIsReportOpen(true);
    }
  }, [gameState.status]);

  const handleSendMessage = () => {
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
      setGameState(prev => ({ ...prev, chatHistory: history, language }));
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
      await restoreChatSession(newGameState.chatHistory, newGameState.role, newGameState.language || language);
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
        className={`relative z-10 w-full max-w-4xl h-[85vh] md:h-[90vh] flex flex-col bg-black/15 scp-ui shadow-2xl overflow-hidden crt transition-all duration-1000`}
        style={isUnstable && !isViewingReport ? { filter: 'url(#signal-interference)' } : {}}
    >
      {gameState.legacy && <LegacySidebar legacyData={gameState.legacy} />}

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
        isMemoryEchoActive={isMemoryEchoActive}
      />

      <ChatArea 
        gameState={gameState}
        t={t}
        isProcessing={isProcessing}
        scrollRef={scrollRef}
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
    <MapPanel 
      gameState={gameState}
      onQuickAction={handleOptionClick}
    />
    </>
  );
};

export default GameScreen;
