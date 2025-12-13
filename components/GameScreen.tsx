import React, { useState, useRef, useEffect } from 'react';
import { GameState, GameStatus, Message, EndingType } from '../types';
import { sendAction, extractVisualPrompt, extractStability, extractEnding, generateImage } from '../services/geminiService';
import Typewriter from './Typewriter';
import ConfirmationModal from './ConfirmationModal';
import WorldLineTree from './WorldLineTree';
import { useTranslation, ROLE_TRANSLATIONS } from '../utils/i18n';
import GameLogo from './GameLogo';

interface GameScreenProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

// SVG Noise Data URI for reliable rendering
const NOISE_SVG_DATA_URI = `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E`;

const StaticNoise = ({ opacity }: { opacity: number }) => (
  <div
    className="pointer-events-none absolute inset-0 z-[60] overflow-hidden mix-blend-color-dodge" 
    style={{ opacity }}
  >
    <div 
        className="absolute -inset-[100%] h-[300%] w-[300%] animate-noise"
        style={{ backgroundImage: `url("${NOISE_SVG_DATA_URI}")` }}
    ></div>
  </div>
);

const GameScreen: React.FC<GameScreenProps> = ({ gameState, setGameState }) => {
  const { t, language } = useTranslation();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAbortModal, setShowAbortModal] = useState(false);
  const [isGlitching, setIsGlitching] = useState(false);
  
  // Game Over Countdown States
  const [gameOverCountdown, setGameOverCountdown] = useState<number | null>(null);
  const [isCountdownActive, setIsCountdownActive] = useState(false);

  // Layout States
  const [isReportOpen, setIsReportOpen] = useState(true);
  const [isEndingOverlayCollapsed, setIsEndingOverlayCollapsed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current && gameState.status === GameStatus.PLAYING) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState.messages, gameState.status]);

  // --- Audio Alarm Logic (Web Audio API) ---
  const isCritical = gameState.stability <= 30 && gameState.stability > 0 && gameState.status === GameStatus.PLAYING;

  useEffect(() => {
    let ctx: AudioContext | null = null;
    let osc: OscillatorNode | null = null;
    let gain: GainNode | null = null;
    let lfo: OscillatorNode | null = null;
    let lfoGain: GainNode | null = null;

    if (isCritical) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        ctx = new AudioContextClass();
        
        osc = ctx.createOscillator();
        gain = ctx.createGain();
        lfo = ctx.createOscillator();
        lfoGain = ctx.createGain();

        // Siren configuration
        osc.type = 'sawtooth';
        osc.frequency.value = 150; 

        // LFO to modulate pitch
        lfo.type = 'sawtooth';
        lfo.frequency.value = 1; 
        lfoGain.gain.value = 100;

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        osc.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.value = 0.05;

        osc.start();
        lfo.start();
      } catch (e) {
        console.error("Audio playback failed", e);
      }
    }

    return () => {
      if (osc) osc.stop();
      if (lfo) lfo.stop();
      if (ctx && ctx.state !== 'closed') ctx.close();
    };
  }, [isCritical]);

  // --- Periodic Glitch Effect (Frequency scales with Stability) ---
  useEffect(() => {
    // Only active when playing and unstable (stability < 70)
    if (gameState.status !== GameStatus.PLAYING || gameState.stability > 70 || gameState.stability <= 0) return;

    let timeout: ReturnType<typeof setTimeout>;
    const triggerGlitch = () => {
        setIsGlitching(true);
        // Glitch duration: 150ms
        setTimeout(() => setIsGlitching(false), 150);
        
        // --- Frequency Calculation ---
        // Stability 70: ~15 seconds delay (Low frequency)
        // Stability 0: ~2 seconds delay (High frequency)
        const maxDelay = 9000;
        const minDelay = 2000;
        
        // Normalize stability (0-70 range) to 0-1 ratio
        // ratio = 1 means stability is 70 (Max Delay)
        // ratio = 0 means stability is 0 (Min Delay)
        const ratio = Math.max(0, Math.min(1, gameState.stability / 70));
        
        // Calculate delay
        const delay = minDelay + (ratio * (maxDelay - minDelay));
        
        // Add random variance (+/- 20%)
        const variance = delay * 0.2 * (Math.random() - 0.5);
        
        timeout = setTimeout(triggerGlitch, delay + variance);
    };

    // Initial random start
    timeout = setTimeout(triggerGlitch, 2000);
    return () => clearTimeout(timeout);
  }, [gameState.status, gameState.stability]);

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

  const getStabilityColor = () => {
    if (gameState.stability > 70) return 'text-scp-term';
    if (gameState.stability > 30) return 'text-yellow-500';
    return 'text-scp-accent';
  };

  const getKantCounterLabel = () => {
     if (gameState.stability > 70) return t('game.stable');
     if (gameState.stability > 30) return t('game.fluctuating');
     return t('game.critical');
  };

  const getDisplayRole = (role: string) => {
      if (language === 'zh') return role;
      return ROLE_TRANSLATIONS[role] || role;
  };

  // --- Visual Effects Calculation ---
  const instability = 100 - gameState.stability;
  const isUnstable = instability > 30; 
  
  // Noise opacity: Starts at instability 20, ramps up. 
  const noiseOpacity = Math.min(Math.max((instability - 20) / 140, 0), 0.5);

  const distortionScale = isUnstable ? Math.min((instability - 30) * 0.5, 30) : 0;
  
  // Check if we are currently viewing the report to disable effects
  const isViewingReport = gameState.status === GameStatus.GAME_OVER && isReportOpen;

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

  return (
    <>
    <style>
      {`
        @keyframes red-alert {
          0%, 100% { box-shadow: inset 0 0 50px rgba(195, 46, 46, 0.1); }
          50% { box-shadow: inset 0 0 200px rgba(195, 46, 46, 0.5); }
        }
        @keyframes noise {
            0% { transform: translate(0, 0); }
            10% { transform: translate(-5%, -5%); }
            20% { transform: translate(-10%, 5%); }
            30% { transform: translate(5%, -10%); }
            40% { transform: translate(-5%, 15%); }
            50% { transform: translate(-10%, 5%); }
            60% { transform: translate(15%, 0); }
            70% { transform: translate(0, 10%); }
            80% { transform: translate(-15%, 0); }
            90% { transform: translate(10%, 5%); }
            100% { transform: translate(5%, 0); }
        }
        .animate-noise {
            animation: noise 0.2s steps(2) infinite;
        }
        @keyframes shake {
            0% { transform: translate(1px, 1px) rotate(0deg); }
            10% { transform: translate(-1px, -2px) rotate(-1deg); }
            20% { transform: translate(-3px, 0px) rotate(1deg); }
            30% { transform: translate(3px, 2px) rotate(0deg); }
            40% { transform: translate(1px, -1px) rotate(1deg); }
            50% { transform: translate(-1px, 2px) rotate(-1deg); }
            60% { transform: translate(-3px, 1px) rotate(0deg); }
            70% { transform: translate(3px, 1px) rotate(-1deg); }
            80% { transform: translate(-1px, -1px) rotate(1deg); }
            90% { transform: translate(1px, 2px) rotate(0deg); }
            100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        .animate-shake {
            animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        
        /* Colorful Glitch Art Animation */
        @keyframes glitch-color-anim {
           0% { backdrop-filter: hue-rotate(0deg) invert(0); }
           20% { backdrop-filter: hue-rotate(90deg) invert(0.8) contrast(200%); }
           40% { backdrop-filter: hue-rotate(180deg) invert(0) contrast(150%); }
           60% { backdrop-filter: hue-rotate(270deg) invert(0.8) contrast(200%); }
           80% { backdrop-filter: hue-rotate(45deg) invert(0) contrast(150%); }
           100% { backdrop-filter: hue-rotate(0deg) invert(0); }
        }
        .animate-glitch-color { animation: glitch-color-anim 0.2s steps(4) infinite; }
      `}
    </style>

    {/* SVG Filters for Signal Distortion */}
    <svg className="hidden">
      <defs>
        <filter id="signal-interference">
          <feTurbulence type="fractalNoise" baseFrequency="0.005 0.01" numOctaves="2" result="warp">
            <animate attributeName="baseFrequency" values="0.005 0.01; 0.01 0.02; 0.005 0.01" dur="4s" repeatCount="indefinite"/>
          </feTurbulence>
          <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale={distortionScale} in="SourceGraphic" in2="warp" />
        </filter>
      </defs>
    </svg>

    {/* Critical State Red Flash Overlay */}
    {isCritical && (
      <div className="fixed inset-0 z-[100] pointer-events-none animate-[red-alert_2s_infinite]"></div>
    )}

    {/* Enhanced Colorful Glitch Art Overlay */}
    {isGlitching && (
      <div className="fixed inset-0 z-[120] pointer-events-none overflow-hidden flex flex-col justify-between">
         {/* Layer 1: Color Shift/Inversion */}
         <div className="absolute inset-0 animate-glitch-color mix-blend-hard-light opacity-80"></div>
         
         {/* Layer 2: RGB Split / Chromatic Aberration */}
         <div className="absolute inset-0 bg-red-600 mix-blend-screen opacity-30 translate-x-2 animate-pulse"></div>
         <div className="absolute inset-0 bg-blue-600 mix-blend-screen opacity-30 -translate-x-2 animate-pulse"></div>

         {/* Layer 3: Digital Artifacts (Blocks) */}
         <div className="w-full h-[15vh] bg-green-400 mix-blend-exclusion opacity-70 translate-y-[10vh] skew-x-12"></div>
         <div className="w-full h-[5vh] bg-purple-500 mix-blend-exclusion opacity-70 translate-y-[40vh] -skew-x-12"></div>
         <div className="w-full h-[25vh] bg-yellow-300 mix-blend-exclusion opacity-50 translate-y-[70vh] skew-x-6"></div>
         
         {/* Layer 4: Scanlines */}
         <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,#ff00ff_3px)] opacity-30 mix-blend-overlay"></div>
      </div>
    )}

        {/* TV Static Noise Overlay */}
    {gameState.status === GameStatus.PLAYING && noiseOpacity > 0 && (
        <StaticNoise opacity={noiseOpacity} />
    )}

    {/* Main Container */}
    <div 
        className={`relative z-10 w-full max-w-4xl h-[85vh] md:h-[90vh] flex flex-col bg-black/15 shadow-2xl overflow-hidden crt transition-all duration-1000 ${isGlitching && !isViewingReport ? 'animate-shake' : ''}`}
        style={isUnstable && !isViewingReport ? { filter: 'url(#signal-interference)' } : {}}
    >

      {/* Main Border */}
      <div className={`absolute inset-0 border pointer-events-none z-40 transition-colors duration-1000 ${isCritical ? 'border-scp-accent/50' : 'border-scp-gray/50'}`}></div>
      
      {/* Header */}
      <header className="bg-scp-gray/50 p-4 border-b border-scp-dark/50 relative flex justify-between items-center h-20 shrink-0">
        
        {/* Left Side: Logo & Kant Counter */}
        <div className="flex items-center gap-4 z-10 w-1/3">
           <div className="hidden sm:block">
              <GameLogo className="h-10 w-10 text-scp-text opacity-90" />
           </div>
           <div className="flex flex-col">
              <span className="text-[10px] text-scp-gray font-mono uppercase tracking-tighter">{t('game.stability_label')}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold font-mono ${getStabilityColor()} ${isCritical ? 'animate-pulse' : ''}`}>
                   {t('game.stability')}: {gameState.stability.toFixed(0)}%
                </span>
                <span className={`text-[10px] font-mono hidden sm:inline-block ${getStabilityColor()}`}>
                    {getKantCounterLabel()}
                </span>
              </div>
           </div>
        </div>

        {/* Center: Title */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <h1 className="text-lg sm:text-2xl font-report tracking-widest text-scp-text uppercase shadow-black drop-shadow-md text-shadow-sm text-center truncate max-w-[90%] px-2">
             {gameState.scpData?.name}
          </h1>
          <span className="text-[10px] text-scp-accent/80 font-mono tracking-[0.2em] uppercase">
             {gameState.scpData?.designation} // {t('game.archive_access')}
          </span>
        </div>
        
        {/* Right Side: Controls */}
        <div className="flex items-center justify-end gap-2 sm:gap-4 z-10 w-1/3">
             <div className="text-right text-[10px] font-mono text-gray-500 hidden lg:block bg-black/40 p-1 rounded leading-tight">
                <p>{t('game.role')}: {getDisplayRole(gameState.role)}</p>
                <p>{t('game.class')}: {gameState.scpData?.containmentClass}</p>
                <p>{t('game.turn')}: {gameState.turnCount}</p>
            </div>
            
            {/* Show "View Report" button if Game Over and Report Minimized */}
            {gameState.status === GameStatus.GAME_OVER && !isReportOpen && (
                 <button 
                    onClick={() => setIsReportOpen(true)}
                    className="bg-scp-term/20 hover:bg-scp-term/40 text-scp-term border border-scp-term px-2 sm:px-3 py-1 font-mono text-[10px] sm:text-xs transition-colors whitespace-nowrap animate-pulse"
                >
                    {t('game.view_report')}
                </button>
            )}

            <button 
                onClick={() => setShowAbortModal(true)}
                className="bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800 px-2 sm:px-3 py-1 font-mono text-[10px] sm:text-xs transition-colors whitespace-nowrap"
            >
                {t('game.terminate')}
            </button>
        </div>
      </header>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth text-shadow-sm"
      >
        {gameState.stability < 30 && (
           <div className="sticky top-0 z-50 bg-red-900/80 backdrop-blur border-l-4 border-red-600 p-2 text-red-300 font-mono text-xs animate-pulse shadow-lg mb-4">
              {t('game.alert_integrity')}
           </div>
        )}

        {gameState.messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[95%] sm:max-w-[85%] ${msg.sender === 'user' ? 'bg-scp-gray/60 border border-scp-text/20 backdrop-blur-sm' : ''} p-4 rounded-sm`}>
              
              {msg.sender === 'user' && (
                 <p className="font-mono text-xs text-scp-term mb-1 opacity-70">{t('game.action_log')}</p>
              )}
              
              <Typewriter 
                content={msg.content} 
                isStreaming={!!msg.isTyping}
                onOptionClick={handleOptionClick} 
              />

              {msg.imageUrl && (
                <div className="mt-4 border-2 border-scp-gray/50 p-1 animate-pulse-slow bg-black/90 shadow-lg">
                  <img src={msg.imageUrl} alt="Generated visual" className="w-full h-auto grayscale hover:grayscale-0 transition-all duration-700" />
                  <p className="text-[10px] text-center text-scp-gray mt-1 font-mono">{t('game.visual_log')}_{msg.id.slice(-4)}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {isProcessing && gameState.messages[gameState.messages.length-1]?.sender === 'user' && (
           <div className="text-scp-term/70 text-xs font-mono animate-pulse pl-4 bg-black/40 inline-block p-1 rounded">{t('game.generating')}</div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black/50 border-t border-scp-gray/30">
        <div className="flex gap-2 relative">
          <span className="absolute left-3 top-3 text-scp-term font-mono pointer-events-none"></span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isProcessing || !!gameState.endingType}
            placeholder={!!gameState.endingType ? t('game.input_placeholder_ended') : t('game.input_placeholder')}
            className="w-full bg-scp-gray/30 border border-scp-gray/40 text-scp-text pl-8 pr-4 py-3 font-mono focus:outline-none focus:border-scp-term focus:ring-1 focus:ring-scp-term/50 transition-all disabled:opacity-50 placeholder-gray-500 backdrop-blur-sm"
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || !input.trim() || !!gameState.endingType}
            className="px-6 py-2 bg-scp-text text-black font-bold font-mono hover:bg-scp-term disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            {t('game.btn_execute')}
          </button>
        </div>
      </div>

      {/* Dynamic Ending Overlay (Pre-Game Over) */}
      {gameState.endingType && gameState.status !== GameStatus.GAME_OVER && (() => {
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
      })()}
      
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
    </>
  );
};

export default GameScreen;