
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AudioDramaScript, AudioDramaScene, AudioDramaLine, Message } from '../../types';
import { ttsService } from '../../services/ttsService';
import { useTranslation } from '../../utils/i18n';
import GameLogo from '../GameLogo';
import { useGameAudio } from '../../hooks/useGameAudio';
import { useGlitchEffect } from '../../hooks/useGlitchEffect';
import VisualEffects from './VisualEffects';

interface AudioDramaPlayerProps {
  script: AudioDramaScript;
  messages: Message[];
  onClose: () => void;
  language: 'zh' | 'en';
  fallbackImage?: string | null;
}

interface SceneState {
  image: string | null;
}

const AudioDramaPlayer: React.FC<AudioDramaPlayerProps> = ({ script, messages, onClose, language, fallbackImage }) => {
  const { t } = useTranslation();
  
  // Playback State
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1); // -1 means scene start/transition
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSceneList, setShowSceneList] = useState(false);
  
  // Cache for resolved images: { sceneIndex: base64 }
  const [sceneImages, setSceneImages] = useState<Record<number, string | null>>({});

  // Refs for managing playback loop
  const isMounted = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null); // For BGM/SFX later

  // --- Pre-process script to split long lines ---
  const [processedScript, setProcessedScript] = useState<AudioDramaScript>(script);
  
  useEffect(() => {
    const MAX_LINE_LENGTH = 120;
    const newScenes = script.scenes.map(scene => {
        const newLines: typeof scene.lines = [];
        scene.lines.forEach(line => {
            if (line.text.length <= MAX_LINE_LENGTH) {
                newLines.push(line);
            } else {
                let remaining = line.text;
                let part = 0;
                while (remaining.length > 0) {
                    if (remaining.length <= MAX_LINE_LENGTH) {
                        newLines.push({
                            ...line,
                            id: `${line.id}_${part}`,
                            text: remaining,
                            sfx: part === 0 ? line.sfx : undefined 
                        });
                        break;
                    }

                    // Find cut point: Prioritize punctuation near MAX_LINE_LENGTH
                    // Search backwards from MAX_LINE_LENGTH
                    const searchBuffer = Math.min(20, MAX_LINE_LENGTH / 2); // Look back 20 chars or half length
                    const targetSlice = remaining.substring(MAX_LINE_LENGTH - searchBuffer, MAX_LINE_LENGTH);
                    
                    // Regex to find the last punctuation in this slice
                    const puncMatch = targetSlice.match(/([，。！？；,.;!?\s])[^，。！？；,.;!?\s]*$/);
                    
                    let cutIndex = MAX_LINE_LENGTH;
                    
                    if (puncMatch && puncMatch.index !== undefined) {
                         // Real index = (Start of slice) + (Match index) + 1 (include punc)
                         cutIndex = (MAX_LINE_LENGTH - searchBuffer) + puncMatch.index + 1;
                    }
                    
                    newLines.push({
                        ...line,
                        id: `${line.id}_${part}`,
                        text: remaining.substring(0, cutIndex),
                        sfx: part === 0 ? line.sfx : undefined 
                    });
                    remaining = remaining.substring(cutIndex);
                    part++;
                }
            }
        });
        return { ...scene, lines: newLines };
    });
    
    setProcessedScript({ ...script, scenes: newScenes });
  }, [script]);

  const currentScene = processedScript.scenes[currentSceneIndex];
  const currentLine = currentLineIndex >= 0 ? currentScene?.lines[currentLineIndex] : null;

  // --- Stability & Effects ---
  const currentMessage = messages.find(m => m.id === currentScene?.originalMessageId);
  // Default to 100 if not found, but try to carry over previous if possible (simplified here)
  const currentStability = currentMessage?.stabilitySnapshot ?? 100;
  
  const isCritical = useGameAudio(currentStability, isPlaying);
  const isGlitching = useGlitchEffect(currentStability, isPlaying);
  
  const instability = 100 - currentStability;
  const isUnstable = instability > 30;
  const noiseOpacity = Math.min(Math.max((instability - 20) / 140, 0), 0.5);
  const distortionScale = isUnstable ? Math.min((instability - 30) * 0.5, 30) : 0;

  const getStabilityColor = () => {
    if (currentStability > 70) return 'text-scp-term';
    if (currentStability > 30) return 'text-yellow-500';
    return 'text-scp-accent';
  };

  const getKantCounterLabel = () => {
     if (currentStability > 70) return t('game.stable');
     if (currentStability > 30) return t('game.fluctuating');
     return t('game.critical');
  };

  // --- Image Resolution Logic ---
  // Refactored to be simpler and less prone to stale closures or early returns
  useEffect(() => {
    const resolveImageForIndex = (index: number) => {
        const scene = processedScript.scenes[index];
        if (!scene) return;

        let imageUrl: string | null = null;
        let sourceLog = "Not found";

        // 1. Try Original Message ID
        if (scene.originalMessageId) {
            const startIndex = messages.findIndex(m => m.id === scene.originalMessageId);
            if (startIndex !== -1) {
                // Search backwards
                for (let i = startIndex; i >= 0; i--) {
                    if (messages[i].imageUrl) {
                        imageUrl = messages[i].imageUrl || null;
                        sourceLog = `Found in msg index ${i} (ID: ${messages[i].id})`;
                        break;
                    }
                }
            } else {
                sourceLog = `Message ID ${scene.originalMessageId} not found`;
            }
        }

        // 2. Fallback to previous scene (must access current state effectively)
        // We can't easily access the *updated* state of index-1 inside this effect loop if it's changing simultaneously.
        // But we can check the 'sceneImages' dependency.
        if (!imageUrl && index > 0) {
            imageUrl = sceneImages[index - 1] || null;
            if (imageUrl) sourceLog = "Fallback to previous scene";
        }

        // 3. Global Fallback
        if (!imageUrl && fallbackImage) {
            imageUrl = fallbackImage;
            sourceLog = "Global fallback";
        }

        // Update State
        setSceneImages(prev => {
            if (prev[index] === imageUrl) return prev; // No change
            console.log(`[AudioDramaPlayer] Setting image for Scene ${index + 1}: ${sourceLog}`);
            return { ...prev, [index]: imageUrl };
        });
    };

    // Resolve current and next
    resolveImageForIndex(currentSceneIndex);
    if (currentSceneIndex + 1 < processedScript.scenes.length) {
        resolveImageForIndex(currentSceneIndex + 1);
    }

  }, [currentSceneIndex, processedScript.scenes, messages, fallbackImage, sceneImages]); // Depend on sceneImages to re-eval fallback

  // --- Playback Logic (Effect Driven) ---
  
  useEffect(() => {
    let isCancelled = false;

    const playCurrentStep = async () => {
        if (!isPlaying) return;

        const scene = processedScript.scenes[currentSceneIndex];
        if (!scene) {
            setIsPlaying(false);
            return;
        }

        // Case A: Transition between scenes (index -1)
        if (currentLineIndex === -1) {
            // Wait for transition visual
            await new Promise(r => setTimeout(r, 1000 / playbackRate));
            if (!isCancelled && isPlaying) {
                setCurrentLineIndex(0);
            }
            return;
        }

        // Case B: Playing a line
        const line = scene.lines[currentLineIndex];
        if (line) {
            const character = processedScript.cast.find(c => c.name === line.speaker);
            const voice = character ? ttsService.getVoiceForCharacter(character, language) : null;
            
            try {
                // Apply global playback rate multiplier to base character rate
                const baseRate = 0.9;
                const finalRate = baseRate * playbackRate;
                
                await ttsService.speak(line.text, voice, {
                    rate: finalRate,
                    pitch: character?.gender === 'female' ? 1.1 : (character?.gender === 'robot' ? 0.8 : 1)
                });
            } catch (e) {
                console.error(e);
            }

            // Check cancellation again after async operation
            if (!isCancelled && isPlaying) { 
                // Auto-advance logic
                if (isAutoPlay) {
                    await new Promise(r => setTimeout(r, 500 / playbackRate)); // Pause between lines
                    if (!isCancelled && isPlaying) {
                        advanceStep();
                    }
                } else {
                    setIsPlaying(false); // Stop if not autoplay
                }
            }
        }
    };

    playCurrentStep();

    return () => {
        isCancelled = true;
        ttsService.stop();
    };
  }, [currentSceneIndex, currentLineIndex, isPlaying, processedScript, language, isAutoPlay, playbackRate]);

  const advanceStep = useCallback(() => {
      const scene = processedScript.scenes[currentSceneIndex];
      if (!scene) return;

      if (currentLineIndex < scene.lines.length - 1) {
          setCurrentLineIndex(prev => prev + 1);
      } else {
          // End of scene
          if (currentSceneIndex < processedScript.scenes.length - 1) {
              setCurrentSceneIndex(prev => prev + 1);
              setCurrentLineIndex(-1);
          } else {
              setIsPlaying(false);
              setIsAutoPlay(false);
          }
      }
  }, [currentSceneIndex, currentLineIndex, processedScript.scenes]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setIsAutoPlay(false);
      ttsService.stop();
    } else {
      setIsPlaying(true);
      setIsAutoPlay(true);
    }
  };

  const handleNext = () => {
      ttsService.stop();
      setIsPlaying(false); // Pause when manually skipping
      advanceStep();
  };

  const handlePrev = () => {
      ttsService.stop();
      setIsPlaying(false);
      if (currentLineIndex > 0) {
          setCurrentLineIndex(prev => prev - 1);
      } else if (currentSceneIndex > 0) {
          setCurrentSceneIndex(prev => prev - 1);
          setCurrentLineIndex(0); // Go to start of prev scene
      }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      isMounted.current = false;
      ttsService.stop();
    };
  }, []);

  const handleJumpToScene = (index: number) => {
    setCurrentSceneIndex(index);
    setCurrentLineIndex(0); // Start at first line (or -1 if we want transition)
    setShowSceneList(false);
    setIsPlaying(false); // Pause after jump
    ttsService.stop();
  };

  const cyclePlaybackRate = () => {
      const rates = [1.0, 1.25, 1.5, 2.0, 0.75];
      const currentIndex = rates.indexOf(playbackRate);
      const nextRate = rates[(currentIndex + 1) % rates.length];
      setPlaybackRate(nextRate);
  };

  // Typewriter effect state
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
      if (!currentLine) {
          setDisplayedText('');
          return;
      }
      
      let index = 0;
      const text = currentLine.text;
      setDisplayedText('');
      
      // Calculate speed based on length. Faster for longer text.
      // Base: 30ms per char.
      const baseSpeed = 30; 
      const speed = Math.max(5, baseSpeed / playbackRate);

      const timer = setInterval(() => {
          if (index < text.length) {
              setDisplayedText(prev => prev + text.charAt(index));
              index++;
          } else {
              clearInterval(timer);
          }
      }, speed);

      return () => clearInterval(timer);
  }, [currentLine, playbackRate]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        containerRef.current?.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
        setIsFullscreen(true);
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }
  };

  useEffect(() => {
      const handleFsChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // --- Render Helpers ---
  const currentImage = sceneImages[currentSceneIndex];
  
  if (currentImage) {
      // Debug render value
      console.log(`[AudioDramaPlayer] Rendering image for Scene ${currentSceneIndex + 1}. URL length: ${currentImage.length}. Starts with: ${currentImage.substring(0, 30)}`);
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center font-mono">
      {/* Viewer Area - Constrained to 16:9 Aspect Ratio unless fullscreen */}
      <div className={`relative flex flex-col shadow-2xl bg-black ${
          isFullscreen ? 'w-full h-full' : 'w-full max-w-6xl aspect-video'
      } ${isGlitching ? 'animate-shake' : ''}`}
      style={isUnstable ? { filter: 'url(#signal-interference)' } : {}}
      >
        <VisualEffects 
          isCritical={isCritical}
          isGlitching={isGlitching}
          noiseOpacity={noiseOpacity}
          distortionScale={distortionScale}
          showNoise={isPlaying}
        />
        
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex flex-col gap-2">
                {/* Stability Meter - Reused Style */}
                <div className="flex flex-col" id="stability-meter">
                    <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold font-mono ${getStabilityColor()} ${isCritical ? 'animate-pulse' : ''}`}>
                           HUME: {currentStability.toFixed(0)}%
                        </span>
                        <span className={`text-[10px] font-mono border border-current px-1 rounded ${getStabilityColor()}`}>
                            {getKantCounterLabel()}
                        </span>
                    </div>
                </div>

                <div>
                    <h2 className="text-xl text-white font-report tracking-widest uppercase text-shadow-sm">{processedScript.title}</h2>
                    <p className="text-xs text-scp-term mt-1">
                        SCENE {currentSceneIndex + 1} / {processedScript.scenes.length}: {currentScene?.location}
                    </p>
                </div>
            </div>
            <button onClick={onClose} className="text-white hover:text-red-500 transition-colors">
                ✕ CLOSE
            </button>
        </div>

        {/* Main Visual */}
        <div className="flex-1 relative bg-black overflow-hidden flex items-center justify-center group">
            {currentImage ? (
                <div 
                    className="absolute inset-0 bg-cover bg-center transition-all duration-[2000ms]"
                    style={{ 
                        backgroundImage: `url(${currentImage})`,
                        transform: isPlaying ? 'scale(1.05)' : 'scale(1)',
                    }}
                />
            ) : (
                <div className="text-scp-gray text-sm animate-pulse">
                    {'WAITING FOR VISUALS...'}
                </div>
            )}
            
            {/* Vignette & CRT Overlay */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/80 pointer-events-none"></div>
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

            {/* Subtitle / Dialogue Area */}
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 pb-24 bg-gradient-to-t from-black via-black/90 to-transparent min-h-[30%] flex flex-col justify-end items-center text-center transition-opacity duration-500">
                {currentLine ? (
                    <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="mb-2 flex items-center justify-center gap-3">
                            <span className="text-scp-term font-bold uppercase tracking-widest text-sm border-b border-scp-term/30 pb-1">
                                {currentLine.speaker}
                            </span>
                            {currentLine.emotion && (
                                <span className="text-gray-500 text-xs italic">
                                    [{currentLine.emotion}]
                                </span>
                            )}
                        </div>
                        <p className="text-lg md:text-2xl text-white font-serif leading-relaxed text-shadow-md min-h-[4rem] max-h-[8rem] overflow-hidden">
                            "{currentLine.text}"
                        </p>
                    </div>
                ) : (
                    <div className="text-gray-500 italic text-sm animate-pulse">
                        ...
                    </div>
                )}
            </div>
        </div>

        {/* Controls */}
        <div className="bg-scp-dark border-t border-scp-gray flex flex-col shrink-0 z-30">
            {/* Progress Bar (Full Width) */}
            <div className="w-full h-2 bg-gray-800 relative cursor-pointer group"
                onClick={(e) => {
                     // Simple seek logic: jump to scene based on width
                     // More precise seeking requires calculating scene + line index
                     const rect = e.currentTarget.getBoundingClientRect();
                     const percent = (e.clientX - rect.left) / rect.width;
                     const targetSceneIdx = Math.floor(percent * processedScript.scenes.length);
                     handleJumpToScene(Math.min(targetSceneIdx, processedScript.scenes.length - 1));
                }}
            >
                <div 
                    className="h-full bg-scp-term transition-all duration-500 relative"
                    style={{ width: `${((currentSceneIndex + (currentLineIndex / (currentScene?.lines.length || 1))) / processedScript.scenes.length) * 100}%` }}
                >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-lg transform scale-150 transition-opacity"></div>
                </div>
            </div>

            {/* Main Controls Row */}
            <div className="h-16 flex items-center justify-between px-6 gap-4">
                
                {/* Left: Time / Scene Info */}
                <div className="text-xs text-gray-500 font-mono min-w-[100px]">
                    {currentSceneIndex + 1} / {processedScript.scenes.length}
                </div>

                {/* Center: Playback Controls */}
                <div className="flex items-center justify-center gap-4 md:gap-8 flex-1">
                     <button 
                        onClick={() => setShowSceneList(true)}
                        className="text-gray-400 hover:text-white transition-colors p-2"
                        title="Scene List"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    </button>

                    <button 
                        onClick={handlePrev}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
                    </button>

                    <button 
                        onClick={togglePlay}
                        className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-scp-term transition-colors shadow-lg shadow-scp-term/20 scale-110"
                    >
                        {isPlaying ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        )}
                    </button>

                    <button 
                        onClick={handleNext}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
                    </button>

                     <button 
                        onClick={cyclePlaybackRate}
                        className="text-gray-400 hover:text-white transition-colors font-mono text-xs w-10 text-center border border-gray-700 rounded px-1 py-0.5 hover:border-gray-500"
                        title="Playback Speed"
                    >
                        {playbackRate}x
                    </button>
                </div>

                {/* Right: Settings / Volume */}
                <div className="flex justify-end items-center gap-6 text-xs text-gray-500 font-mono min-w-[150px]">
                     <button onClick={() => setIsAutoPlay(!isAutoPlay)} className="hover:text-white transition-colors">
                        AUTO: {isAutoPlay ? 'ON' : 'OFF'}
                     </button>
                     
                     <div className="h-4 w-px bg-gray-700"></div>

                     <button 
                        onClick={toggleFullscreen}
                        className="text-gray-400 hover:text-white transition-colors"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                        {isFullscreen ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                        )}
                    </button>
                </div>
            </div>
        </div>

        {/* Scene List Drawer */}
        {showSceneList && (
            <div className="absolute inset-0 z-50 bg-black/90 flex justify-end">
                <div className="w-80 h-full bg-scp-dark border-l border-scp-term p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-scp-term font-bold uppercase tracking-widest">SCENES</h3>
                        <button onClick={() => setShowSceneList(false)} className="text-gray-500 hover:text-white">✕</button>
                    </div>
                    <div className="space-y-2">
                        {script.scenes.map((scene, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleJumpToScene(idx)}
                                className={`w-full text-left p-3 border text-xs font-mono transition-colors ${
                                    currentSceneIndex === idx 
                                    ? 'border-scp-term bg-scp-term/10 text-white' 
                                    : 'border-scp-gray/30 text-gray-400 hover:border-scp-gray hover:text-gray-200'
                                }`}
                            >
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold">SCENE {idx + 1}</span>
                                    {currentSceneIndex === idx && <span className="text-scp-term">●</span>}
                                </div>
                                <div className="truncate opacity-80">{scene.location}</div>
                            </button>
                        ))}
                    </div>
                </div>
                {/* Backdrop click to close */}
                <div className="flex-1" onClick={() => setShowSceneList(false)}></div>
            </div>
        )}

      </div>
    </div>
  );
};

export default AudioDramaPlayer;
