import React, { useState, useEffect } from 'react';
import { GameState, GameStatus, EndingType, GameReviewData, QAPair, LegacyData } from '../types';
import { getChatHistory, getSummaryContext, restoreChatSession, clearMemoryCache } from '../services/aiService';
import ConfirmationModal from './ConfirmationModal';
import SaveLoadModal from './SaveLoadModal';
import WorldLineTree from './WorldLineTree';
import { useTranslation } from '../utils/i18n';

import GameStage from './game/stage/GameStage';
import StageEntryDoor from './game/stage/StageEntryDoor';
import TutorialOverlay from './game/TutorialOverlay';

import { useMapContext } from '../hooks/useMapContext';
import { useMapUpdate } from '../hooks/useMapUpdate';
import { useGameLoop } from '../hooks/useGameLoop';
import { useTutorial } from '../hooks/useTutorial';
import { THEME_CSS } from '../styles/themeCss';
import { clearStageEntry, hasPendingStageEntry } from '../utils/stageEntry';

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
  const [freshRun] = useState(hasPendingStageEntry);
  const [door, setDoor] = useState<'closed' | 'opening' | 'gone'>(freshRun ? 'closed' : 'gone');

  useEffect(clearStageEntry, []);

  const { isTutorialOpen, closeTutorial } = useTutorial(gameState.turnCount);

  const buildMapContext = useMapContext(gameState);
  const applyMapUpdate = useMapUpdate();

  const { handleSend } = useGameLoop({
    gameState,
    setGameState,
    language,
    t,
    setInput,
    setMemoryEchoActive,
    buildMapContext,
    applyMapUpdate
  });

  useEffect(() => {
    if (gameState.status === GameStatus.GAME_OVER) {
      setIsReportOpen(true);
    }
  }, [gameState.status]);

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

  const handleViewArchive = () => {
    setIsReportOpen(true);
    setGameState(prev => ({ ...prev, status: GameStatus.GAME_OVER }));
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

  return (
    <>
    <style>{THEME_CSS}</style>
    {door !== 'gone' && <StageEntryDoor onReveal={() => setDoor('opening')} onDone={() => setDoor('gone')} />}
    {door !== 'closed' && <GameStage
      freshRun={freshRun}
      gameState={gameState}
      input={input}
      setInput={setInput}
      onSend={() => { void handleSend(input); }}
      isMemoryEchoActive={isMemoryEchoActive}
      isInputLocked={isTutorialOpen || showAbortModal || saveLoadModalOpen || (gameState.status === GameStatus.GAME_OVER && isReportOpen)}
      onSave={handleOpenSaveModal}
      onLoad={() => { setSaveLoadMode('load'); setSaveLoadModalOpen(true); }}
      onTerminate={() => {
        if (gameState.scpData?.designation === 'TEST-RUN') {
          handleAbort();
        } else {
          setShowAbortModal(true);
        }
      }}
      onViewArchive={handleViewArchive}
    />}

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
              npcs={gameState.npcs}
          />
        </div>
    )}

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
    </>
  );
};

export default GameScreen;
