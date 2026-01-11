import React, { useState, useRef, useEffect } from 'react';
import { GameState, GameStatus, Message, EndingType, GameReviewData, QAPair } from '../types';
import { sendAction, extractVisualPrompt, extractStability, extractEnding, extractResources, generateImage, getChatHistory, restoreChatSession } from '../services/aiService';
import ConfirmationModal from './ConfirmationModal';
import SaveLoadModal from './SaveLoadModal';
import WorldLineTree from './WorldLineTree';
import { useTranslation } from '../utils/i18n';

// New Imports
import { useGameAudio } from '../hooks/useGameAudio';
import { useGlitchEffect } from '../hooks/useGlitchEffect';
import VisualEffects from './game/VisualEffects';
import GameHeader from './game/GameHeader';
import ChatArea from './game/ChatArea';
import InputArea from './game/InputArea';
import EndingOverlay from './game/EndingOverlay';
import TutorialOverlay from './game/TutorialOverlay';
import { loadSetting, saveSetting } from '../services/indexedDBService';

interface GameScreenProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const GameScreen: React.FC<GameScreenProps> = ({ gameState, setGameState }) => {
  const { t, language, setLanguage } = useTranslation();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAbortModal, setShowAbortModal] = useState(false);
  const [saveLoadModalOpen, setSaveLoadModalOpen] = useState(false);
  const [saveLoadMode, setSaveLoadMode] = useState<'save' | 'load'>('save');
  
  // Tutorial State
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  // Game Over Countdown States
  const [gameOverCountdown, setGameOverCountdown] = useState<number | null>(null);
  const [isCountdownActive, setIsCountdownActive] = useState(false);

  // Layout States
  const [isReportOpen, setIsReportOpen] = useState(true);
  const [isEndingOverlayCollapsed, setIsEndingOverlayCollapsed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check for tutorial on mount
  useEffect(() => {
    const checkTutorial = async () => {
      // Only show tutorial if game is just starting (turn 0 or 1)
      if (gameState.turnCount <= 1) {
        const hasSeenTutorial = await loadSetting('hasSeenTutorial');
        if (!hasSeenTutorial) {
          setIsTutorialOpen(true);
          await saveSetting('hasSeenTutorial', true);
        }
      }
    };
    checkTutorial();
  }, [gameState.turnCount]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current && gameState.status === GameStatus.PLAYING) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState.messages, gameState.status]);

  // Use Custom Hooks
  const isPlaying = gameState.status === GameStatus.PLAYING;
  const isCritical = useGameAudio(gameState.stability, isPlaying);
  const isGlitching = useGlitchEffect(gameState.stability, isPlaying);

  // --- Game Over Trigger Logic ---
  useEffect(() => {
    if (gameState.endingType && gameState.status === GameStatus.PLAYING && gameOverCountdown === null) {
        setGameOverCountdown(10);
        setIsCountdownActive(true);
        setIsEndingOverlayCollapsed(false);
    }
  }, [gameState.endingType, gameState.status, gameOverCountdown]);

  // --- Countdown Timer ---
  useEffect(() => {
    if (isCountdownActive && gameOverCountdown !== null) {
        if (gameOverCountdown > 0) {
            const timer = setTimeout(() => setGameOverCountdown(prev => prev! - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setGameState(prev => ({ ...prev, status: GameStatus.GAME_OVER }));
        }
    }
  }, [isCountdownActive, gameOverCountdown, setGameState]);

  useEffect(() => {
      if (gameState.status === GameStatus.GAME_OVER) {
          setIsReportOpen(true);
      }
  }, [gameState.status]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const currentStability = gameState.stability;
    const currentState = {
      stability: currentStability,
      health: gameState.health,
      cognition: gameState.cognition,
      containmentIntegrity: gameState.containmentIntegrity,
      reputation: gameState.reputation,
      inventory: gameState.inventory
    };
    const newTurnCount = gameState.turnCount + 1;
    const originalInput = input; // Capture input to restore on error/timeout

    console.log(`[GameScreen] processing turn ${newTurnCount}, stability ${currentStability}`);

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: input,
      timestamp: Date.now()
    };

    setGameState(prev => ({
      ...prev,
      turnCount: newTurnCount,
      messages: [...prev.messages, userMsg]
    }));
    setInput('');
    setIsProcessing(true);

    const aiMsgId = (Date.now() + 1).toString();
    setGameState(prev => ({
      ...prev,
      messages: [...prev.messages, {
        id: aiMsgId,
        sender: 'narrator',
        content: '',
        timestamp: Date.now(),
        isTyping: true
      }]
    }));

    try {
      console.log("[GameScreen] Invoking sendAction stream...");
      let fullResponse = '';
      
      const stream = sendAction(userMsg.content, currentState, newTurnCount, language);
      const iterator = stream[Symbol.asyncIterator]();
      
      // Idle Timeout Limit (30s)
      // Reset timer on every chunk received.
      const IDLE_TIMEOUT_MS = 30000;
      let idleTimeoutId: NodeJS.Timeout;

      const createTimeoutPromise = () => new Promise<never>((_, reject) => {
          idleTimeoutId = setTimeout(() => reject(new Error('TIMEOUT')), IDLE_TIMEOUT_MS);
      });

      try {
        while (true) {
          // Race the stream iterator against the idle timeout
          const result = await Promise.race([
              iterator.next(),
              createTimeoutPromise()
          ]);
          
          // Clear timeout immediately after winning the race
          clearTimeout(idleTimeoutId!);

          if (result.done) break;

          const chunk = result.value;
          fullResponse += chunk;
          setGameState(prev => ({
            ...prev,
            messages: prev.messages.map(m => 
              m.id === aiMsgId ? { ...m, content: fullResponse } : m
            )
          }));
        }
      } catch (e) {
         // Ensure timeout is cleared if iterator.next() throws or timeout triggers
         clearTimeout(idleTimeoutId!);
         throw e;
      }

      console.log("[GameScreen] Stream completed. Full response length:", fullResponse.length);

      if (!fullResponse) {
          console.warn("[GameScreen] Warning: Received empty response from model.");
          // We don't throw here, but flow continues. The regexes below will fail gracefully.
      }

      // Chain of extraction: Ending -> Stability -> Visual -> Clean Text
      const endingResult = extractEnding(fullResponse);
      const textAfterEnding = endingResult.cleanText;
      let detectedEndingType = endingResult.endingType;

      const stabilityResult = extractStability(textAfterEnding);
      const textAfterStability = stabilityResult.cleanText;
      const nextStability = stabilityResult.newStability;

      const resourceResult = extractResources(textAfterStability);
      const textAfterResources = resourceResult.cleanText;

      // Fallback: If stability drops to 0 but no ending tag, force COLLAPSE
      if (nextStability !== null && nextStability <= 0 && !detectedEndingType) {
        detectedEndingType = EndingType.COLLAPSE;
      }

      const visualResult = extractVisualPrompt(textAfterResources);
      const finalText = visualResult.cleanText;
      const visualPrompt = visualResult.visualPrompt;
      
      const updatedStability = nextStability !== null ? nextStability : gameState.stability;
      const updatedResources = {
        health: resourceResult.resources.health ?? gameState.health,
        cognition: resourceResult.resources.cognition ?? gameState.cognition,
        containmentIntegrity: resourceResult.resources.containmentIntegrity ?? gameState.containmentIntegrity,
        reputation: resourceResult.resources.reputation ?? gameState.reputation,
        inventory: resourceResult.resources.inventory ?? gameState.inventory
      };

      setGameState(prev => ({
        ...prev,
        stability: updatedStability,
        health: updatedResources.health,
        cognition: updatedResources.cognition,
        containmentIntegrity: updatedResources.containmentIntegrity,
        reputation: updatedResources.reputation,
        inventory: updatedResources.inventory,
        endingType: detectedEndingType,
        messages: prev.messages.map(m => 
          m.id === aiMsgId ? { 
              ...m, 
              content: finalText, 
              isTyping: false,
              stabilitySnapshot: updatedStability,
              health: updatedResources.health,
              cognition: updatedResources.cognition,
              containmentIntegrity: updatedResources.containmentIntegrity,
              reputation: updatedResources.reputation,
              inventory: updatedResources.inventory
          } : m
        )
      }));

      if (visualPrompt) {
        generateIllustration(aiMsgId, visualPrompt);
      }

    } catch (error: any) {
      console.error("[GameScreen] Game Loop Error:", error);
      
      let errorMessage = t('game.err_offline');
      if (error.message === 'TIMEOUT') {
          errorMessage = t('game.err_timeout');
          setInput(originalInput); // Restore user input so they can try again easily
      }

      // Update UI to reflect error state instead of hanging on loading
      setGameState(prev => ({
        ...prev,
        messages: prev.messages.map(m => 
          m.id === aiMsgId ? { ...m, content: errorMessage, isTyping: false } : m
        )
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const generateIllustration = async (messageId: string, prompt: string) => {
    const base64 = await generateImage(prompt + ", dark aesthetic, scp foundation style, cinematic lighting", "16:9");
    if (base64) {
      setGameState(prev => ({
        ...prev,
        messages: prev.messages.map(m => 
          m.id === messageId ? { ...m, imageUrl: base64 } : m
        )
      }));
    }
  };

  const handleAbort = () => {
    setGameState({
        status: GameStatus.IDLE,
        scpData: null,
        role: '',
        messages: [],
        backgroundImage: null,
        mainImage: null,
        stability: 100,
        health: 100,
        cognition: 100,
        containmentIntegrity: 100,
        reputation: 100,
        inventory: [],
        turnCount: 1,
        endingType: null,
        gameReview: null,
        qaHistory: []
    });
    setShowAbortModal(false);
  };

  const handleOpenSaveModal = async () => {
    try {
        const history = await getChatHistory();
        setGameState(prev => ({ ...prev, chatHistory: history, language:language }));
        setSaveLoadMode('save');
        setSaveLoadModalOpen(true);
    } catch (e) {
        console.error("Failed to sync chat history before save", e);
        // Still open modal but maybe warn? Or just proceed.
        setGameState(prev => ({ ...prev, language }));
        setSaveLoadMode('save');
        setSaveLoadModalOpen(true);
    }
  };

  const handleLoadGame = async (newGameState: GameState) => {
    if (newGameState.language) {
      setLanguage(newGameState.language);
    }

    if (newGameState.chatHistory) {
        // Restore the chat session in the service
        // Use the language from the save state if available, otherwise current
        await restoreChatSession(newGameState.chatHistory, newGameState.role, newGameState.language || language);
    }
    
    // Disable typing effect for loaded messages
    const restoredMessages = newGameState.messages.map(msg => ({
      ...msg,
      isTyping: false
    }));
    
    const normalizedGameState = {
      ...newGameState,
      health: newGameState.health ?? 100,
      cognition: newGameState.cognition ?? 100,
      containmentIntegrity: newGameState.containmentIntegrity ?? 100,
      reputation: newGameState.reputation ?? 100,
      inventory: newGameState.inventory ?? []
    };

    setGameState({ ...normalizedGameState, messages: restoredMessages });
    setSaveLoadModalOpen(false);
  };

  const handleManualEnter = () => {
      setGameState(prev => ({ ...prev, status: GameStatus.GAME_OVER }));
  };

  const handleCancelCountdown = () => {
      setIsCountdownActive(false);
  };

  // Handler for clicking options in Typewriter
  const handleOptionClick = (text: string) => {
    setInput(text);
    if (inputRef.current) {
        inputRef.current.focus();
    }
  };

  // --- Handlers for Updating Game State from Review/QA ---
  const handleReviewUpdate = (review: GameReviewData) => {
      setGameState(prev => ({ ...prev, gameReview: review }));
  };

  const handleQAUpdate = (qa: QAPair) => {
      setGameState(prev => ({ 
          ...prev, 
          qaHistory: [...(prev.qaHistory || []), qa] 
      }));
  };

  // --- Visual Effects Calculation ---
  const instability = 100 - gameState.stability;
  const isUnstable = instability > 30; 
  
  // Noise opacity: Starts at instability 20, ramps up. 
  const noiseOpacity = Math.min(Math.max((instability - 20) / 140, 0), 0.5);

  const distortionScale = isUnstable ? Math.min((instability - 30) * 0.5, 30) : 0;
  
  // Check if we are currently viewing the report to disable effects
  const isViewingReport = gameState.status === GameStatus.GAME_OVER && isReportOpen;

  const resourcePalette = [
    { key: 'health', label: t('game.resource_health'), value: gameState.health, color: 'bg-red-500', text: 'text-red-300' },
    { key: 'cognition', label: t('game.resource_cognition'), value: gameState.cognition, color: 'bg-blue-500', text: 'text-blue-300' },
    { key: 'containmentIntegrity', label: t('game.resource_integrity'), value: gameState.containmentIntegrity, color: 'bg-amber-500', text: 'text-amber-300' },
    { key: 'reputation', label: t('game.resource_reputation'), value: gameState.reputation, color: 'bg-purple-500', text: 'text-purple-300' }
  ];

  return (
    <>
    <VisualEffects 
      isCritical={isCritical}
      isGlitching={isGlitching}
      noiseOpacity={noiseOpacity}
      distortionScale={distortionScale}
      showNoise={gameState.status === GameStatus.PLAYING}
    />

    {/* Main Container */}
    <div 
        className={`relative z-10 w-full max-w-4xl h-[85vh] md:h-[90vh] flex flex-col bg-black/15 shadow-2xl overflow-hidden crt transition-all duration-1000 ${isGlitching && !isViewingReport ? 'animate-shake' : ''}`}
        style={isUnstable && !isViewingReport ? { filter: 'url(#signal-interference)' } : {}}
    >

      {/* Main Border */}
      <div className={`absolute inset-0 border pointer-events-none z-40 transition-colors duration-1000 ${isCritical ? 'border-scp-accent/50' : 'border-scp-gray/50'}`}></div>
      
      <GameHeader 
        gameState={gameState} 
        t={t} 
        language={language}
        isReportOpen={isReportOpen}
        setIsReportOpen={setIsReportOpen}
        onSave={handleOpenSaveModal}
        onLoad={() => { setSaveLoadMode('load'); setSaveLoadModalOpen(true); }}
        onTerminate={() => setShowAbortModal(true)}
        isCritical={isCritical}
      />

      <div className="border-b border-scp-gray/30 bg-black/40 px-4 py-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {resourcePalette.map(resource => (
            <div key={resource.key} className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-gray-400">
                <span>{resource.label}</span>
                <span className={`${resource.text} font-bold`}>{Math.round(resource.value)}%</span>
              </div>
              <div className="h-2 border border-scp-gray/50 bg-black overflow-hidden">
                <div
                  className={`h-full ${resource.color}`}
                  style={{ width: `${Math.max(0, Math.min(resource.value, 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-gray-400">
          <span className="text-scp-text">{t('game.resource_inventory')}</span>
          {gameState.inventory.length ? (
            gameState.inventory.map(item => (
              <span key={item} className="border border-scp-gray/40 bg-black/40 px-2 py-0.5 text-gray-200">
                {item}
              </span>
            ))
          ) : (
            <span className="text-gray-500">{t('game.resource_inventory_empty')}</span>
          )}
        </div>
      </div>

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
        handleSend={handleSend}
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
        gameOverCountdown={gameOverCountdown}
        handleCancelCountdown={handleCancelCountdown}
        handleManualEnter={handleManualEnter}
      />
      
      {/* World Line Tree Overlay (Game Over State) */}
      {gameState.status === GameStatus.GAME_OVER && (
          <div className={isReportOpen ? 'contents' : 'hidden'}>
            <WorldLineTree 
                messages={gameState.messages} 
                scpData={gameState.scpData} 
                onRestart={handleAbort} 
                onMinimize={() => setIsReportOpen(false)}
                backgroundImage={gameState.backgroundImage}
                endingType={gameState.endingType || EndingType.UNKNOWN}
                role={gameState.role}
                gameReview={gameState.gameReview || null}
                qaHistory={gameState.qaHistory}
                onReviewUpdate={handleReviewUpdate}
                onQAUpdate={handleQAUpdate}
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
        onClose={() => setIsTutorialOpen(false)}
        t={t}
    />

    <SaveLoadModal
        isOpen={saveLoadModalOpen}
        onClose={() => setSaveLoadModalOpen(false)}
        mode={saveLoadMode}
        currentGameState={gameState}
        onLoadGame={handleLoadGame}
    />
    </>
  );
};

export default GameScreen;
