import React, { useState, useRef, useEffect } from 'react';
import { GameState, GameStatus, Message, EndingType } from '../types';
import { sendAction, extractVisualPrompt, extractStability, extractEnding, generateImage, getChatHistory, restoreChatSession } from '../services/geminiService';
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
  const isCritical = useGameAudio(gameState);
  const isGlitching = useGlitchEffect(gameState);

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
      
      const stream = sendAction(userMsg.content, currentStability, newTurnCount, language);
      const iterator = stream[Symbol.asyncIterator]();
      
      // 30 seconds timeout limit for response stream
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 30000)
      );

      while (true) {
        // Race the stream iterator against the timeout
        const result = await Promise.race([
            iterator.next(),
            timeoutPromise
        ]);

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

      // Fallback: If stability drops to 0 but no ending tag, force COLLAPSE
      if (nextStability !== null && nextStability <= 0 && !detectedEndingType) {
        detectedEndingType = EndingType.COLLAPSE;
      }

      const visualResult = extractVisualPrompt(textAfterStability);
      const finalText = visualResult.cleanText;
      const visualPrompt = visualResult.visualPrompt;
      
      const updatedStability = nextStability !== null ? nextStability : gameState.stability;

      setGameState(prev => ({
        ...prev,
        stability: updatedStability,
        endingType: detectedEndingType,
        messages: prev.messages.map(m => 
          m.id === aiMsgId ? { 
              ...m, 
              content: finalText, 
              isTyping: false,
              stabilitySnapshot: updatedStability 
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
        turnCount: 0,
        endingType: null
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
    
    setGameState({ ...newGameState, messages: restoredMessages });
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

  // --- Visual Effects Calculation ---
  const instability = 100 - gameState.stability;
  const isUnstable = instability > 30; 
  
  // Noise opacity: Starts at instability 20, ramps up. 
  const noiseOpacity = Math.min(Math.max((instability - 20) / 140, 0), 0.5);

  const distortionScale = isUnstable ? Math.min((instability - 30) * 0.5, 30) : 0;
  
  // Check if we are currently viewing the report to disable effects
  const isViewingReport = gameState.status === GameStatus.GAME_OVER && isReportOpen;

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
