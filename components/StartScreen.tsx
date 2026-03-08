

import React, { useState, useEffect, useRef } from 'react';
import { analyzeSCPUrl, restoreChatSession } from '../services/aiService';
import { loadGlobalSettings } from '../services/indexedDBService';
import { GameState, GameStatus, Role, LegacyData, EntityProfile } from '../types';
import ParticleText from './ParticleText';
import BootSequenceOverlay from './BootSequenceOverlay';
import SaveLoadModal from './SaveLoadModal';
import { useTranslation, ROLE_TRANSLATIONS } from '../utils/i18n';
import GameLogo from './GameLogo';
import LegacySidebar from './LegacySidebar';
import GlobalSettingsModal from './GlobalSettingsModal';
import { startGameProcess } from '../utils/gameStart';
import { checkAIConfigAvailable } from '../services/aiConfigService';
import SettingsGearIcon from './common/SettingsGearIcon';
import EntityProfileAugmentation from './EntityProfileAugmentation';

declare global {
    interface Window {
        aistudio?: any;
    }
}

interface StartScreenProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  legacyData?: LegacyData;
}

let bootShownInSession = false;

const StartScreen: React.FC<StartScreenProps> = ({ gameState, setGameState, legacyData }) => {
  const { t, language } = useTranslation();
  const LOADING_MESSAGES = React.useMemo(() => t('start.loading_msgs') as string[], [t]);
  const autoStartRef = useRef(false);

  const [urlInput, setUrlInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>(Role.RESEARCHER);
  const [customRole, setCustomRole] = useState('');
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canRetryInit, setCanRetryInit] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saveLoadModalOpen, setSaveLoadModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'game' | 'ai'>('game');
  const [settingsAttention, setSettingsAttention] = useState(false);
  const [showBoot, setShowBoot] = useState(false);
  
  const [showProfileAugmentation, setShowProfileAugmentation] = useState(false);
  const [entityProfile, setEntityProfile] = useState<EntityProfile | undefined>(undefined);

  useEffect(() => {
    loadGlobalSettings().then(settings => {
      if (!bootShownInSession && !settings.skipBootSequence) {
        setShowBoot(true);
      }
    });
  }, []);

  useEffect(() => {
    const checkKey = async () => {
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setHasApiKey(hasKey);
        } else {
            setHasApiKey(true);
        }
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (gameState.status !== GameStatus.ANALYZING) {
      autoStartRef.current = false;
      return;
    }
    if (!gameState.scpData || autoStartRef.current) return;

    autoStartRef.current = true;
    setError(null);
    setCanRetryInit(false);
    
    setLoadingStep(t('start.loading_retrieved', { designation: gameState.scpData.designation }));

    startGameProcess({ gameState, setGameState, language, t }).catch((e) => {
      console.error(e);
      setError(t('start.error_conn'));
      if ((e as any)?.code === "GEMINI_INIT_EMPTY") {
        setCanRetryInit(true);
        setLoadingStep(t('start.loading_retry'));
        return;
      }
      setLoadingStep(null);
      setGameState(prev => ({ ...prev, status: GameStatus.IDLE }));
    });
  }, [gameState.status, gameState.scpData, language, t, setGameState]);

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

  const handleRandomSCP = () => {
    // Generate a random number between 1 and 9999
    const num = Math.floor(Math.random() * 9999) + 1;
    const scpStr = `SCP-${String(num).padStart(3, '0')}`;
    setUrlInput(scpStr);
  };

  const startAnalysis = async (profile?: EntityProfile) => {
    setLoadingStep(t('start.loading_access'));

    try {
      const finalRole = selectedRole === Role.CUSTOM ? customRole : selectedRole;

      const settings = await loadGlobalSettings();
      const difficulty = settings.difficulty || 'normal';

      const scpData = await analyzeSCPUrl(urlInput, language, finalRole, difficulty, legacyData, profile);
      setLoadingStep(t('start.loading_retrieved', { designation: scpData.designation }));

      setLoadingStep(null);
      setGameState(prev => ({
          ...prev,
          status: GameStatus.TACTICAL_PREVIEW,
          scpData,
          role: finalRole,
          stability: 100,
          turnCount: 0,
          inventory: [],
          legacy: legacyData,
          returnFromEditor: false
      }));

    } catch (e) {
      console.error(e);
      setError(t('start.error_conn'));
      setLoadingStep(null);
    }
  };

  const handleStart = async () => {
    if (!urlInput.trim() || loadingStep) return;
    setError(null);
    setCanRetryInit(false);
    setLoadingStep(t('start.loading_checking_ai'));

    const configCheck = await checkAIConfigAvailable();
    if (!configCheck.available) {
      setSettingsInitialTab('ai');
      setSettingsAttention(true);
      setSettingsModalOpen(true);
      setLoadingStep(null);
      return;
    }
    
    // Check Entity Profile
    if (!entityProfile) {
        setLoadingStep(null);
        setGameState(prev => ({ ...prev, status: GameStatus.ENTITY_PROFILE }));
        setShowProfileAugmentation(true);
        return;
    }

    startAnalysis(entityProfile);
  };

  const handleProfileComplete = (profile: EntityProfile) => {
      setEntityProfile(profile);
      setShowProfileAugmentation(false);
      setGameState(prev => ({ ...prev, status: GameStatus.IDLE }));
      startAnalysis(profile);
  };

  const handleProfileBack = () => {
      setShowProfileAugmentation(false);
      setGameState(prev => ({ ...prev, status: GameStatus.IDLE }));
      startAnalysis(entityProfile);
  };

  const handleRetryInit = async () => {
    if (!gameState.scpData) return;
    setError(null);
    setCanRetryInit(false);
    setLoadingStep(t('start.loading_retrieved', { designation: gameState.scpData.designation }));
    try {
      await startGameProcess({ gameState, setGameState, language, t });
    } catch (e) {
      console.error(e);
      setError(t('start.error_conn'));
      if ((e as any)?.code === "GEMINI_INIT_EMPTY") {
        setCanRetryInit(true);
        setLoadingStep(t('start.loading_retry'));
        return;
      }
      setLoadingStep(null);
      setGameState(prev => ({ ...prev, status: GameStatus.IDLE }));
    }
  };

  const getRoleDisplay = (role: Role) => {
    if (role === Role.CUSTOM) return t('start.role_custom_opt');
    if (language === 'zh') return `> ${role}`;
    return `> ${ROLE_TRANSLATIONS[role] || role}`;
  };


  if (showProfileAugmentation) {
      return (
          <div className="absolute inset-0 z-50">
              <EntityProfileAugmentation 
                  role={selectedRole === Role.CUSTOM ? customRole : selectedRole}
                  scpDesignation={urlInput}
                  language={language}
                  onComplete={handleProfileComplete}
                  onBack={handleProfileBack}
              />
          </div>
      );
  }

  return (
    <>
    {showBoot && (
      <BootSequenceOverlay
        onComplete={() => {
          bootShownInSession = true;
          setShowBoot(false);
        }}
      />
    )}
    <div className="max-w-xl w-full p-8 scp-window scp-ui border border-scp-gray relative z-10 crt shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        {legacyData && <LegacySidebar legacyData={legacyData} />}
        <div className="absolute top-0 left-0 w-full h-1 bg-scp-accent shadow-[0_0_10px_rgba(195,46,46,0.5)]"></div>
        <div className="absolute bottom-0 right-0 w-20 h-20 border-r-2 border-b-2 border-scp-gray opacity-50 pointer-events-none"></div>

        {/* Logo positioned at the top-left of the terminal box */}
        <div className="absolute top-4 left-4 z-20">
            <GameLogo className="h-10 w-10 md:h-12 md:w-12 opacity-90 drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]" />
        </div>

        {/* Settings Button positioned at the top-right */}
        <button 
            onClick={() => {
              setSettingsInitialTab('game');
              setSettingsAttention(false);
              setSettingsModalOpen(true);
            }}
            className="absolute top-4 right-4 z-20 text-gray-400 hover:text-white transition-colors p-2"
            title={t('common.settings') || 'Settings'}
        >
            <SettingsGearIcon className="h-6 w-6" variant="outline" spin={false}/>
        </button>

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
                {canRetryInit && (
                    <button
                        onClick={handleRetryInit}
                        className="mt-2 px-6 py-2 bg-scp-accent/90 hover:bg-scp-accent text-white font-mono text-sm tracking-widest border border-red-500 transition-all shadow-[0_0_12px_rgba(195,46,46,0.4)] hover:shadow-[0_0_20px_rgba(195,46,46,0.6)]"
                    >
                        {t('start.btn_retry')}
                    </button>
                )}
            </div>
        ) : (
            <div className="space-y-6 flex-1 flex flex-col min-h-0">
                <div className="shrink-0">
                    <label className="block text-xs font-mono text-scp-white mb-1">{t('start.label_url')}</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            value={urlInput}
                            onChange={e => setUrlInput(e.target.value)}
                            placeholder={t('start.placeholder_url')}
                            className="w-full bg-scp-gray/20 border border-scp-gray p-3 pr-10 text-scp-text font-mono focus:border-scp-term focus:outline-none transition-all placeholder-gray-600 focus:bg-scp-gray/30"
                        />
                       <button
                            onClick={handleRandomSCP}
                            className="
                                absolute right-3 top-1/2 -translate-y-1/2
                                w-9 h-9
                                flex items-center justify-center
                                text-red-600
                                transition-transform duration-200
                                hover:scale-110
                            "
                            >
                            <svg viewBox="0 0 512 512" className="w-7 h-7" fill="none">
                                <g stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none">
                                    <path d="M512,124.355L405.406,17.71v84.695h-10.435c-92.763,0-138.917,75.524-179.637,142.158
                                                                    c-39.73,65.009-74.04,121.155-142.191,121.155H0v43.886h73.143c92.763,0,138.917-75.524,179.637-142.158
                                                                    c39.73-65.011,74.04-121.157,142.191-121.157h10.435v84.686L512,124.355z" className="scp-stroke-anim" pathLength="1000"/>
                                    <path d="M512,124.355L405.406,17.71v84.695h-10.435c-92.763,0-138.917,75.524-179.637,142.158
                                                                    c-39.73,65.009-74.04,121.155-142.191,121.155H0v43.886h73.143c92.763,0,138.917-75.524,179.637-142.158
                                                                    c39.73-65.011,74.04-121.157,142.191-121.157h10.435v84.686L512,124.355z" className="scp-stroke-anim" transform="translate(0 512) scale(1 -1)" pathLength="1000"/>
                                </g>
                            </svg>

                        </button>
                    </div>
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

                <div className="flex gap-2 shrink-0">
                    <button 
                        onClick={() => setGameState(prev => ({ ...prev, status: GameStatus.STORY_EDITOR, scpData: null }))}
                        className="flex-1 py-3 bg-scp-gray/20 hover:bg-scp-gray/40 text-gray-300 hover:text-white font-mono text-sm md:text-base border border-scp-gray hover:border-gray-400 transition-all tracking-widest uppercase backdrop-blur-sm"
                    >
                        {t('story_editor.title')}
                    </button>
                    <button 
                        onClick={() => setSaveLoadModalOpen(true)}
                        className="flex-1 py-3 bg-scp-gray/20 hover:bg-scp-gray/40 text-gray-300 hover:text-white font-mono text-sm md:text-base border border-scp-gray hover:border-gray-400 transition-all tracking-widest uppercase backdrop-blur-sm"
                    >
                        {t('save_load.load')}
                    </button>
                </div>
            </div>
        )}

      <SaveLoadModal
        isOpen={saveLoadModalOpen}
        onClose={() => setSaveLoadModalOpen(false)}
        mode="load"
        onLoadGame={async (gameState) => {
            if (gameState.chatHistory) {
                await restoreChatSession({
                    history: gameState.chatHistory,
                    role: gameState.role,
                    language,
                    tokenCount: gameState.tokenCount,
                    summaryContext: gameState.summaryContext
                });
            }
            setGameState(gameState);
            setSaveLoadModalOpen(false);
        }}
      />

      <GlobalSettingsModal 
        isOpen={settingsModalOpen} 
        onClose={() => {
          setSettingsModalOpen(false);
          setSettingsAttention(false);
        }}
        initialTab={settingsInitialTab}
        attention={settingsAttention}
      />
    </div>
    </>
  );
};

export default StartScreen;
