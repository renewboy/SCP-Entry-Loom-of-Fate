
import React, { useState, useEffect } from 'react';
import { analyzeSCPUrl, initializeGameChatStream, generateImage, extractVisualPrompt, extractStability } from '../services/geminiService';
import { GameState, GameStatus, Role } from '../types';
import ParticleText from './ParticleText';
import { useTranslation, ROLE_TRANSLATIONS } from '../utils/i18n';
import GameLogo from './GameLogo';

interface StartScreenProps {
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const StartScreen: React.FC<StartScreenProps> = ({ setGameState }) => {
  const { t, language } = useTranslation();
  const LOADING_MESSAGES = t('start.loading_msgs') as string[];

  const [urlInput, setUrlInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>(Role.RESEARCHER);
  const [customRole, setCustomRole] = useState('');
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    // Check for API key on mount
    const checkKey = async () => {
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setHasApiKey(hasKey);
        } else {
            // Fallback for dev environments without the special window object
            setHasApiKey(true);
        }
    };
    checkKey();
  }, []);

  // Effect to cycle through loading messages if the current one is in the list
  useEffect(() => {
    if (loadingStep && LOADING_MESSAGES.includes(loadingStep)) {
      const timer = setTimeout(() => {
        setLoadingStep((current) => {
          if (!current) return null;
          const idx = LOADING_MESSAGES.indexOf(current);
          if (idx === -1) return current;
          return LOADING_MESSAGES[(idx + 1) % LOADING_MESSAGES.length];
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loadingStep, LOADING_MESSAGES]);

  const handleSelectKey = async () => {
      try {
          if (window.aistudio && window.aistudio.openSelectKey) {
              await window.aistudio.openSelectKey();
              setHasApiKey(true);
          }
      } catch (e) {
          console.error("API Key selection failed", e);
          setError(t('start.error_api'));
      }
  };

  const handleStart = async () => {
    if (!urlInput.trim()) return;
    setError(null);
    setLoadingStep(t('start.loading_access'));

    try {
      // 1. Analyze SCP
      const scpData = await analyzeSCPUrl(urlInput, language);
      setLoadingStep(t('start.loading_retrieved', { designation: scpData.designation }));

      const finalRole = selectedRole === Role.CUSTOM ? customRole : selectedRole;
      
      // 2. Start Background Image Gen (Async)
      console.log("[StartScreen] Initiating background image generation...");
      
      const bgDescription = scpData.visualDescription || `texture and atmosphere of ${scpData.name}`;
      const bgPrompt = `Atmospheric, cinematic lighting, abstract horror background representing ${bgDescription}, subtle, texture, scp foundation style, dark moody`;
      
      generateImage(bgPrompt, "16:9").then(bgUrl => {
         if(bgUrl) setGameState(prev => ({...prev, backgroundImage: bgUrl}));
      });

      // 3. Generate Main SCP Image (Async)
      const entityDescription = scpData.entityDescription;
      const mainPrompt = `Close up full body shot of ${scpData.name}: ${entityDescription}. detailed, photorealistic, containment cell, scp foundation record photo`;
      
      generateImage(mainPrompt, "1:1").then(mainUrl => {
         if(mainUrl) setGameState(prev => ({...prev, mainImage: mainUrl}));
      });

      // 4. Initialize Chat with Stream
      setLoadingStep(LOADING_MESSAGES[0]);
      
      // Create the generator
      const stream = initializeGameChatStream(scpData, finalRole, language);
      const msgId = 'intro';
      let fullText = "";
      let isFirstChunk = true;

      for await (const chunk of stream) {
        fullText += chunk;
        
        if (isFirstChunk) {
            // SWITCH TO GAME SCREEN IMMEDIATELY ON FIRST TEXT
            setGameState(prev => ({
                ...prev,
                status: GameStatus.PLAYING,
                scpData,
                role: finalRole,
                stability: 100,
                turnCount: 0,
                messages: [{
                    id: msgId,
                    sender: 'narrator',
                    content: fullText,
                    timestamp: Date.now(),
                    isTyping: true
                }]
            }));
            isFirstChunk = false;
        } else {
             // Update the message content in real-time
             setGameState(prev => ({
                ...prev,
                messages: prev.messages.map(m => 
                    m.id === msgId ? { ...m, content: fullText } : m
                )
             }));
        }
      }

      // 5. Post-process the full text (once stream is done)
      // Extract stability, visuals and clean tags
      const stabilityResult = extractStability(fullText);
      const textAfterStability = stabilityResult.cleanText;
      const introStability = stabilityResult.newStability ?? 100;

      const { cleanText, visualPrompt } = extractVisualPrompt(textAfterStability);
      
      setGameState(prev => ({
        ...prev,
        messages: prev.messages.map(m => 
            m.id === msgId ? { 
                ...m, 
                content: cleanText, 
                isTyping: false,
                stabilitySnapshot: introStability 
            } : m
        )
      }));

      // Generate intro image if prompt exists
      if (visualPrompt) {
          generateImage(visualPrompt, "16:9").then(introImageUrl => {
               if (introImageUrl) {
                    setGameState(prev => ({
                        ...prev,
                        messages: prev.messages.map(m => 
                            m.id === msgId ? { ...m, imageUrl: introImageUrl } : m
                        )
                    }));
               }
          });
      }

    } catch (e) {
      console.error(e);
      setError(t('start.error_conn'));
      setLoadingStep(null);
    }
  };

  const getRoleDisplay = (role: Role) => {
    if (role === Role.CUSTOM) return t('start.role_custom_opt');
    if (language === 'zh') return `> ${role}`;
    return `> ${ROLE_TRANSLATIONS[role] || role}`;
  };

  return (
    <div className="max-w-xl w-full p-8 bg-black/60 border border-scp-gray relative backdrop-blur-md z-10 crt shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 left-0 w-full h-1 bg-scp-accent shadow-[0_0_10px_rgba(195,46,46,0.5)]"></div>
        <div className="absolute bottom-0 right-0 w-20 h-20 border-r-2 border-b-2 border-scp-gray opacity-50 pointer-events-none"></div>

        {/* Logo positioned at the top-left of the terminal box */}
        <div className="absolute top-4 left-4 z-20">
            <GameLogo className="h-10 w-10 md:h-12 md:w-12 opacity-90 drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]" />
        </div>

        {/* Replaced static titles with ParticleText */}
      
        <div className="mb-2 shrink-0 mt-8">
          <ParticleText 
            text={t('start.scp_archive')} 
            fontFamily='"Special Elite", cursive' 
            fontSize={42} 
            color="#e0e0e0" 
            gap={2}
          />
        </div>
        <div className="mb-8 shrink-0">
           <ParticleText 
            text={t('start.fate_loom')} 
            fontFamily='"JetBrains Mono", monospace' 
            fontSize={28} 
            color="#c32e2e" 
            gap={2}
          />
        </div>

        {error && (
            <div className="bg-red-900/30 border border-red-500/50 p-4 mb-6 text-red-200 text-sm font-mono backdrop-blur-sm shrink-0">
                {t('start.error_prefix')}{error}
            </div>
        )}

        {loadingStep ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="w-16 h-16 border-4 border-scp-term border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(51,255,0,0.2)]"></div>
                <p className="font-mono text-scp-term animate-pulse text-shadow-green">{loadingStep}</p>
                <div className="w-full bg-gray-900/50 h-1 mt-4 overflow-hidden rounded">
                     <div className="h-full bg-scp-term animate-[scanline_2s_linear_infinite] w-1/2 shadow-[0_0_10px_#33ff00]"></div>
                </div>
            </div>
        ) : (
            <div className="space-y-6 flex-1 flex flex-col min-h-0">
                <div className="shrink-0">
                    <label className="block text-xs font-mono text-scp-white mb-1">{t('start.label_url')}</label>
                    <input 
                        type="text" 
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        placeholder={t('start.placeholder_url')}
                        className="w-full bg-scp-gray/20 border border-scp-gray p-3 text-scp-text font-mono focus:border-scp-term focus:outline-none transition-all placeholder-gray-600 focus:bg-scp-gray/30"
                    />
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                    <label className="block text-xs font-mono text-scp-white mb-1">{t('start.label_role')}</label>
                    {/* Role Selection Container with Fixed Height and Scroll */}
                    <div className="max-h-64 overflow-y-auto border border-scp-gray/30 bg-black/20 p-2 custom-scrollbar">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Object.values(Role).map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setSelectedRole(r)}
                                    className={`p-2 text-xs md:text-sm font-mono text-left border transition-all ${
                                        selectedRole === r 
                                        ? 'bg-scp-text text-black border-scp-text shadow-[0_0_10px_rgba(224,224,224,0.3)]' 
                                        : 'bg-transparent text-gray-400 border-scp-gray/30 hover:border-scp-gray hover:text-gray-200'
                                    }`}
                                >
                                    {getRoleDisplay(r)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {selectedRole === Role.CUSTOM && (
                     <input 
                        type="text" 
                        value={customRole}
                        onChange={e => setCustomRole(e.target.value)}
                        placeholder={t('start.placeholder_custom')}
                        className="w-full bg-scp-gray/20 border-b border-scp-gray p-2 text-scp-text font-mono focus:border-scp-term focus:outline-none text-sm transition-all focus:bg-scp-gray/30 shrink-0"
                    />
                )}

                <button 
                    onClick={handleStart}
                    disabled={!urlInput}
                    className="w-full mt-auto py-4 bg-scp-accent/90 hover:bg-scp-accent text-white font-report text-xl tracking-widest border border-red-500 transition-all shadow-[0_0_15px_rgba(195,46,46,0.3)] hover:shadow-[0_0_25px_rgba(195,46,46,0.6)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] shrink-0"
                >
                    {t('start.btn_start')}
                </button>
            </div>
        )}
    </div>
  );
};

export default StartScreen;
