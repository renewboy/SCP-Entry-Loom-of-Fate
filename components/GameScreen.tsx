import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GameState, GameStatus, Message, EndingType, GameReviewData, QAPair, LegacyData } from '../types';
import { sendAction, extractVisualPrompt, extractStability, extractEnding, extractLoc, extractMapUpdate, generateImage, getChatHistory, restoreChatSession, clearMemoryCache } from '../services/aiService';
import ConfirmationModal from './ConfirmationModal';
import SaveLoadModal from './SaveLoadModal';
import WorldLineTree from './WorldLineTree';
import LegacySidebar from './LegacySidebar';
import { useTranslation } from '../utils/i18n';

// New Imports
import GameHeader from './game/GameHeader';
import ChatArea from './game/ChatArea';
import InputArea from './game/InputArea';
import EndingOverlay from './game/EndingOverlay';
import TutorialOverlay from './game/TutorialOverlay';
import MapPanel from './game/MapPanel';
import { loadSetting, saveSetting, loadGlobalSettings } from '../services/indexedDBService';

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
  const [isMemoryEchoActive, setMemoryEchoActive] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const themeColors = useMemo(() => {
    if (gameState.stability > 70) {
      return {
        accent: '#33ff00',
        soft: 'rgba(51,255,0,0.18)',
        underline: 'rgba(51,255,0,0.45)',
        glow: 'rgba(51,255,0,0.35)'
      };
    }
    if (gameState.stability > 30) {
      return {
        accent: '#f59e0b',
        soft: 'rgba(245,158,11,0.18)',
        underline: 'rgba(245,158,11,0.45)',
        glow: 'rgba(245,158,11,0.35)'
      };
    }
    return {
      accent: '#ef4444',
      soft: 'rgba(239,68,68,0.18)',
      underline: 'rgba(239,68,68,0.45)',
      glow: 'rgba(239,68,68,0.35)'
    };
  }, [gameState.stability]);

  useEffect(() => {
    const root = document.documentElement;
    const prev = {
      accent: root.style.getPropertyValue('--theme-accent'),
      soft: root.style.getPropertyValue('--theme-accent-soft'),
      underline: root.style.getPropertyValue('--theme-accent-underline'),
      glow: root.style.getPropertyValue('--theme-accent-glow')
    };
    root.style.setProperty('--theme-accent', themeColors.accent);
    root.style.setProperty('--theme-accent-soft', themeColors.soft);
    root.style.setProperty('--theme-accent-underline', themeColors.underline);
    root.style.setProperty('--theme-accent-glow', themeColors.glow);
    return () => {
      root.style.setProperty('--theme-accent', prev.accent || '#33ff00');
      root.style.setProperty('--theme-accent-soft', prev.soft || 'rgba(51,255,0,0.18)');
      root.style.setProperty('--theme-accent-underline', prev.underline || 'rgba(51,255,0,0.45)');
      root.style.setProperty('--theme-accent-glow', prev.glow || 'rgba(51,255,0,0.35)');
    };
  }, [themeColors]);

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

  const buildMapContext = () => {
    const blueprint = gameState.scpData?.mapBlueprint;
    const runtime = gameState.map;
    if (!blueprint || !runtime) return '';

    const currentNode = blueprint.nodes.find(n => n.id === runtime.currentNodeId);
    const inventoryIds = new Set((gameState.inventory || []).map(i => i.id));
    const inventoryTags = new Set((gameState.inventory || []).flatMap(i => i.tags || []));
    const hasToken = (token: string) =>
      inventoryIds.has(token) || inventoryTags.has(token);

    const edges = blueprint.edges.filter(e =>
      e.from === runtime.currentNodeId || (e.bidirectional && e.to === runtime.currentNodeId)
    );

    const neighbors = edges.map(e => {
      const neighborId = e.from === runtime.currentNodeId ? e.to : e.from;
      const neighbor = blueprint.nodes.find(n => n.id === neighborId);
      const req = Array.isArray(neighbor?.requires) ? neighbor?.requires : [];
      const missing = req.filter(token => !hasToken(token));
      const blocked = missing.length > 0;
      const reason = blocked ? (neighbor?.blockedText || `缺少通行token:${missing.join(',')}`) : '';
      return {
        id: neighborId,
        name: neighbor?.name || neighborId,
        blocked,
        reason: reason || neighbor?.blockedText || ''
      };
    });

    const npcsHere = (gameState.npcs || []).filter(n => n.alive && n.nodeId === runtime.currentNodeId);
    const currentObj = (gameState.objectives || []).find(o => o.nodeId === runtime.currentNodeId);
    const lines: string[] = [];
    lines.push(`当前位置: ${currentNode?.name || runtime.currentNodeId} (${runtime.currentNodeId})`);
    if (currentNode) lines.push(`危险度: ${currentNode.danger}/100`);
    if (currentNode?.discoverables?.length) lines.push(`可发现物品: ${currentNode.discoverables.join(', ')}`);
    if (currentNode?.interactables?.length) lines.push(`可互动物品: ${currentNode.interactables.join(', ')}`);
    if (neighbors.length) {
      lines.push(`可达邻接地点:`);
      neighbors.forEach(n => lines.push(`- ${n.name} (${n.id})${n.blocked ? ` [门禁: ${n.reason || '阻挡'}]` : ''}`));
    }
    if ((gameState.inventory || []).length) lines.push(`已持有: ${(gameState.inventory || []).map(i => i.id).join(', ')}`);
    if (npcsHere.length) lines.push(`同地点NPC: ${npcsHere.map(n => `${n.name}(${n.id}), 对话目标: ${n.dialogueGoals}, 秘密标签: ${n.secretTags?.join(',') || '无'}`).join(', ')}`);
    if (currentObj) {
      const progressText = `${Math.max(0, Math.min(100, Math.round(currentObj.progress)))}%`;
      lines.push(`当前地点任务: ${currentObj.title} @ ${currentObj.nodeId}；进度: ${progressText}`);
      if (currentObj.detail) lines.push(`任务详情: ${currentObj.detail}`);
    }



    lines.push(`规则: 若行动涉及移动，移动成功时输出[LOC: node_id]。`);
    return lines.join('\n');
  };

  const applyMapUpdate = (prev: GameState, update: any): GameState => {
    if (!update || typeof update !== 'object') return prev;

    const next: GameState = { ...prev };
    const runtime = next.map ? { ...next.map } : undefined;
    const inventory = [...(next.inventory || [])];
    const npcs = [...(next.npcs || [])];
    const objectives = [...(next.objectives || [])];
    let stability = next.stability;

    const applyReward = (reward?: { accessTokens?: string[]; stabilityDelta?: number }) => {
      if (!reward) return;
      if (Array.isArray(reward.accessTokens)) {
        reward.accessTokens.forEach(id => {
          if (!inventory.some(i => i.id === id)) inventory.push({ id, name: id });
        });
      }
      if (typeof reward.stabilityDelta === 'number') {
        stability = Math.max(0, Math.min(100, stability + reward.stabilityDelta));
      }
    };

    const addAccessTokens: string[] = Array.isArray(update.addAccessTokens) ? update.addAccessTokens : [];
    addAccessTokens.forEach(id => {
      if (!inventory.some(i => i.id === id)) inventory.push({ id, name: id });
    });

    const npcMoves: any[] = Array.isArray(update.moveNPCs) ? update.moveNPCs : [];
    npcMoves.forEach(m => {
      const idx = npcs.findIndex(n => n.id === m.id);
      if (idx === -1) return;
      const current = npcs[idx];
      npcs[idx] = {
        ...current,
        nodeId: typeof m.nodeId === 'string' ? m.nodeId : current.nodeId,
        alive: typeof m.alive === 'boolean' ? m.alive : current.alive
      };
    });

    const objUpdates: any[] = Array.isArray(update.objectives) ? update.objectives : [];
    objUpdates.forEach(u => {
      const idx = objectives.findIndex(o => o.id === u.id);
      if (idx === -1) return;
      const current = objectives[idx];
      const nextStatus = typeof u.status === 'string' ? u.status : current.status;
      objectives[idx] = {
        ...current,
        status: nextStatus,
        progress: typeof u.progress === 'number' ? u.progress : current.progress
      };
      if (current.status !== 'COMPLETED' && nextStatus === 'COMPLETED') {
        applyReward(current.reward);
      }
    });

    next.map = runtime;
    next.inventory = inventory;
    next.npcs = npcs;
    next.objectives = objectives;
    next.stability = stability;
    return next;
  };

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
      
      const mapContext = buildMapContext();
      const stream = sendAction(userMsg.content, currentStability, newTurnCount, language, gameState.saveId, mapContext);
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

          let chunk = result.value;

          // Check for Memory Echo Token
          if (chunk.includes('[MEMORY_ACTIVE]')) {
             // Fallback for cases where null byte might be stripped
             console.log("[GameScreen] Memory Echo Detected (Fallback)!");
             setMemoryEchoActive(true);
             chunk = chunk.replace('[MEMORY_ACTIVE]', '');
             setTimeout(() => setMemoryEchoActive(false), 5000);
          }

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

      // Fallback: If stability drops to 0 but no ending tag, force COLLAPSE
      if (nextStability !== null && nextStability <= 0 && !detectedEndingType) {
        detectedEndingType = EndingType.COLLAPSE;
      }

      const locResult = extractLoc(textAfterStability);
      const textAfterLoc = locResult.cleanText;
      const mapUpdateResult = extractMapUpdate(textAfterLoc);
      const textAfterMapUpdate = mapUpdateResult.cleanText;

      const visualResult = extractVisualPrompt(textAfterMapUpdate);
      const finalText = visualResult.cleanText;
      const visualPrompt = visualResult.visualPrompt;
      
      const updatedStability = nextStability !== null ? nextStability : gameState.stability;

      const mapUpdate = mapUpdateResult.update;
      
      // Removed direct SFX playback here, moved to FeedbackOverlay
      
      setGameState(prev => {
        let base: GameState = {
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
        };

        if (base.map && locResult.locId) {
          const discovered = new Set(base.map.discoveredNodeIds);
          discovered.add(locResult.locId);
          base = {
            ...base,
            map: {
              ...base.map,
              currentNodeId: locResult.locId,
              discoveredNodeIds: Array.from(discovered)
            }
          };
        }

        if (mapUpdate) {
            // Objectives logic moved inside applyMapUpdate but SFX handled by FeedbackOverlay
        }

        return applyMapUpdate(base, mapUpdate);
      });

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
    // Check settings before generating
    const settings = await loadGlobalSettings();
    if (!settings.enableSceneImages) {
        console.log("[GameScreen] Scene image generation disabled by settings.");
        return;
    }

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
    // Check if we are in a Test Run
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

    // Clear memory cache when resetting the game
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
    // Clear memory cache before loading a new game state to avoid stale references
    clearMemoryCache();

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

  // --- Visual Effects Calculation (Now handled by StabilityMonitor, but we still need some for Layout) ---
  const instability = 100 - gameState.stability;
  const isUnstable = instability > 30; 
  const isViewingReport = gameState.status === GameStatus.GAME_OVER && isReportOpen;

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
        saveId: prev.saveId // Preserve the save ID for the next run
    }));
  };

  return (
    <>
    <style>{`
      .text-scp-term { color: var(--theme-accent) !important; }
      .text-scp-term\\/70 { color: var(--theme-accent) !important; opacity: 0.7; }
      .text-scp-term\\/80 { color: var(--theme-accent) !important; opacity: 0.8; }
      .text-scp-term\\/50 { color: var(--theme-accent) !important; opacity: 0.5; }
      .text-scp-term\\/30 { color: var(--theme-accent) !important; opacity: 0.3; }
      .border-scp-term { border-color: var(--theme-accent) !important; }
      .border-scp-term\\/30 { border-color: var(--theme-accent-underline) !important; }
      .border-scp-term\\/50 { border-color: var(--theme-accent-underline) !important; }
      .border-scp-term\\/60 { border-color: var(--theme-accent-underline) !important; }
      .bg-scp-term { background-color: var(--theme-accent) !important; }
      .bg-scp-term\\/20 { background-color: var(--theme-accent-soft) !important; }
      .bg-scp-term\\/40 { background-color: var(--theme-accent-soft) !important; }
      .bg-scp-term\\/60 { background-color: var(--theme-accent-soft) !important; }
      .bg-scp-term\\/80 { background-color: var(--theme-accent-soft) !important; }
      .hover\\:bg-scp-term\\/20:hover { background-color: var(--theme-accent-soft) !important; }
      .hover\\:bg-scp-term\\/10:hover { background-color: var(--theme-accent-soft) !important; }
      .hover\\:bg-scp-term:hover { background-color: var(--theme-accent) !important; }
      .hover\\:text-scp-term:hover { color: var(--theme-accent) !important; }
      .group:hover .group-hover\\:text-scp-term { color: var(--theme-accent) !important; }
      .group\\/btn:hover .group-hover\\/btn\\:text-scp-term { color: var(--theme-accent) !important; }
      .decoration-scp-term { text-decoration-color: var(--theme-accent) !important; }
      .decoration-scp-term\\/50 { text-decoration-color: var(--theme-accent-underline) !important; }
      .hover\\:decoration-scp-term:hover { text-decoration-color: var(--theme-accent) !important; }
      .focus\\:border-scp-term:focus { border-color: var(--theme-accent) !important; }
      .focus\\:ring-scp-term\\/50:focus { --tw-ring-color: var(--theme-accent-soft) !important; }
      .hover\\:border-scp-term:hover { border-color: var(--theme-accent) !important; }
      .hover\\:border-scp-term\\/60:hover { border-color: var(--theme-accent-underline) !important; }
      .text-shadow-green { text-shadow: 0 0 8px var(--theme-accent-glow) !important; }
    `}</style>
    {/* Main Container */}
    <div 
        className={`relative z-10 w-full max-w-4xl h-[85vh] md:h-[90vh] flex flex-col bg-black/15 scp-ui shadow-2xl overflow-hidden crt transition-all duration-1000`}
        style={isUnstable && !isViewingReport ? { filter: 'url(#signal-interference)' } : {}}
    >
      {gameState.legacy && <LegacySidebar legacyData={gameState.legacy} />}

      {/* Main Border - Simplified as StabilityMonitor handles Critical Visuals now */}
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
        isCritical={false} // Logic moved to StabilityMonitor inside Header
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
        onClose={() => setIsTutorialOpen(false)}
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
