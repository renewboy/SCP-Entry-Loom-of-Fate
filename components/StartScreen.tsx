

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeSCPUrl, restoreChatSession } from '../services/aiService';
import { AnalysisProgress } from '../services/ai/types';
import { playAmbience, stopAmbience } from '../services/ambienceService';
import { loadGlobalSettings } from '../services/indexedDBService';
import { GameState, GameStatus, Role, LegacyData, EntityProfile, GlobalSettings, SCPData } from '../types';
import { repairAnalyzeScpData } from '../services/ai/schemas';
import BootSequenceOverlay from './BootSequenceOverlay';
import SaveLoadModal from './SaveLoadModal';
import { getRoleTranslation, useTranslation } from '../utils/i18n';
import LegacyArchiveDrawer from './LegacyArchiveDrawer';
import GlobalSettingsModal from './GlobalSettingsModal';
import { startGameProcess } from '../utils/gameStart';
import { checkAIConfigAvailable } from '../services/aiConfigService';
import EntityProfileAugmentation from './EntityProfileAugmentation';
import LoomScene, { LoomSceneHandle } from './start/LoomScene';
import StartMenu, { StartMenuHandle } from './start/StartMenu';
import WeaveWait, { applySearchProgress, displayDesignation, ExcerptEntry, SearchEntry } from './start/WeaveWait';
import '../styles/stage.css';
import '../styles/tactical.css';
import '../styles/startScreen.css';

/** Long enough for the map to finish weaving when the whole analysis arrives at once */
const filedHoldMs = (nodes: number) => Math.min(6500, Math.max(3800, nodes * 320 + 1500));

declare global {
    interface Window {
        aistudio?: any;
    }
}

interface StartScreenProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  legacyData?: LegacyData;
  /** The boot sequence and the wait screens have the whole window, without the footer and links */
  onModeChange?: (mode: StartMode) => void;
}

export type StartMode = 'boot' | 'menu' | 'drawer' | 'wait' | 'other';

let bootShownInSession = false;

const StartScreen: React.FC<StartScreenProps> = ({ gameState, setGameState, legacyData, onModeChange }) => {
  const { t, language } = useTranslation();
  const autoStartRef = useRef(false);
  const analysisInFlightRef = useRef(false);
  const startFlowRef = useRef(false);
  const sceneRef = useRef<LoomSceneHandle>(null);
  const menuRef = useRef<StartMenuHandle>(null);
  const sceneFrameRef = useRef<(() => void) | null>(null);

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
  const [bootSettled, setBootSettled] = useState(bootShownInSession);
  const playEntry = useRef(!bootShownInSession);
  const [skipBootSequence, setSkipBootSequence] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [filed, setFiled] = useState(false);
  const [searches, setSearches] = useState<SearchEntry[]>([]);
  const [excerpts, setExcerpts] = useState<ExcerptEntry[]>([]);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [analyzedData, setAnalyzedData] = useState<SCPData | null>(null);
  const [imageSettings, setImageSettings] = useState<Pick<GlobalSettings, 'enableEntityImages' | 'enableNpcImages'> | null>(null);
  const [scrim, setScrim] = useState(0);
  const [legacyOffset, setLegacyOffset] = useState(0);
  const [rolesOpen, setRolesOpen] = useState(false);
  
  const [showProfileAugmentation, setShowProfileAugmentation] = useState(false);
  const [entityProfile, setEntityProfile] = useState<EntityProfile | undefined>(undefined);

  useEffect(() => {
    loadGlobalSettings().then(settings => {
      setSkipBootSequence(Boolean(settings.skipBootSequence));
      setImageSettings({ enableEntityImages: settings.enableEntityImages, enableNpcImages: settings.enableNpcImages });
      if (!bootShownInSession) {
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

  const onAnalysisProgress = useCallback((progress: AnalysisProgress) => {
    if (progress.type === 'draft') {
      setDraft(progress.data);
      return;
    }
    setSearches(entries => applySearchProgress(entries, progress));
    if (progress.type === 'search_result' && progress.text) {
      const text = progress.text.trim();
      setExcerpts(entries => [...entries, { id: progress.id, text }]);
    }
  }, []);

  const startAnalysis = async (profile?: EntityProfile) => {
    if (analysisInFlightRef.current) return;

    analysisInFlightRef.current = true;
    startFlowRef.current = true;
    setLoadingStep(t('start.loading_access'));
    setAnalyzing(true);
    setFiled(false);
    setSearches([]);
    setExcerpts([]);
    setDraft(null);
    setAnalyzedData(null);

    try {
      const finalRole = selectedRole === Role.CUSTOM ? customRole : selectedRole;

      const settings = await loadGlobalSettings();
      const difficulty = settings.difficulty || 'normal';

      const rawScpData = await analyzeSCPUrl(urlInput, language, finalRole, difficulty, legacyData, profile, onAnalysisProgress);
      const repairedResult = repairAnalyzeScpData(rawScpData);

      if (!repairedResult.valid) {
        console.error('[StartScreen] analyzeSCPUrl returned invalid SCPData', {
          initialErrors: repairedResult.initialErrors,
          finalErrors: repairedResult.finalErrors,
          rawScpData,
          repairedScpData: repairedResult.data,
        });
        setError(t('start.error_invalid_analysis'));
        setLoadingStep(null);
        setAnalyzing(false);
        return;
      }

      const scpData = repairedResult.data;

      setLoadingStep(t('start.loading_retrieved', { designation: scpData.designation }));
      setAnalyzedData(scpData);
      setFiled(true);
      await new Promise(resolve => setTimeout(resolve, filedHoldMs(scpData.mapBlueprint?.nodes.length ?? 0)));

      setLoadingStep(null);
      setGameState(prev => ({
          ...prev,
          status: GameStatus.TACTICAL_PREVIEW,
          scpData,
          role: scpData.role,
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
      setAnalyzing(false);
    } finally {
      analysisInFlightRef.current = false;
      startFlowRef.current = false;
    }
  };

  const handleStart = async () => {
    if (!urlInput.trim() || loadingStep || startFlowRef.current || analysisInFlightRef.current) return;

    startFlowRef.current = true;
    setError(null);
    setCanRetryInit(false);
    setLoadingStep(t('start.loading_checking_ai'));

    const configCheck = await checkAIConfigAvailable();
    if (!configCheck.available) {
      setSettingsInitialTab('ai');
      setSettingsAttention(true);
      setSettingsModalOpen(true);
      setLoadingStep(null);
      startFlowRef.current = false;
      return;
    }

    await menuRef.current?.launch();

    // Check Entity Profile
    if (!entityProfile) {
        setLoadingStep(null);
        setGameState(prev => ({ ...prev, status: GameStatus.ENTITY_PROFILE }));
        setShowProfileAugmentation(true);
        startFlowRef.current = false;
        return;
    }

    void startAnalysis(entityProfile);
  };

  const handleProfileComplete = (profile: EntityProfile) => {
      if (analysisInFlightRef.current || startFlowRef.current) return;
      setEntityProfile(profile);
      setShowProfileAugmentation(false);
      setGameState(prev => ({ ...prev, status: GameStatus.IDLE }));
      void startAnalysis(profile);
  };

  const handleProfileSkip = () => {
      if (analysisInFlightRef.current || startFlowRef.current) return;
      setShowProfileAugmentation(false);
      setGameState(prev => ({ ...prev, status: GameStatus.IDLE }));
      void startAnalysis(entityProfile);
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

  const finishBoot = useCallback(() => {
    bootShownInSession = true;
    setShowBoot(false);
    setBootSettled(true);
  }, []);

  const opening = gameState.status === GameStatus.ANALYZING;
  const waiting = opening || analyzing;
  // Coming back to the menu after an error or the archive does not play the way in again
  if (waiting || showProfileAugmentation) playEntry.current = false;
  const mode: StartMode = showProfileAugmentation ? 'other' : waiting ? 'wait' : !bootSettled ? 'boot' : rolesOpen ? 'drawer' : 'menu';

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  useEffect(() => {
    if (mode === 'boot' && showBoot && !skipBootSequence) playAmbience('boot');
    else if (mode === 'menu' || mode === 'drawer') playAmbience('chamber');
    else if (mode === 'wait') playAmbience('weaving');
    else stopAmbience();
  }, [mode, showBoot, skipBootSequence]);
  useEffect(() => stopAmbience, []);

  useEffect(() => {
    if (mode === 'menu') {
      setScrim(0);
      menuRef.current?.reset();
    }
  }, [mode]);

  if (showProfileAugmentation) {
      return (
          <div className="absolute inset-0 z-50">
              <EntityProfileAugmentation 
                  role={selectedRole === Role.CUSTOM ? customRole : selectedRole}
                  scpDesignation={urlInput}
                  language={language}
                  legacyData={legacyData}
                  onComplete={handleProfileComplete}
                  onSkip={handleProfileSkip}
              />
          </div>
      );
  }

  const openingData = gameState.scpData;
  const designation = opening && openingData ? openingData.designation : displayDesignation(urlInput.trim() || analyzedData?.designation || '');
  const waitData = opening ? openingData : analyzedData ?? draft;
  const runBackground = opening ? (openingData?.storyDraft?.backgroundImage || gameState.backgroundImage) : null;

  return (
    <>
    {showBoot && <BootSequenceOverlay skipToReady={skipBootSequence} onComplete={finishBoot} />}
    <div className="stage-root start-view" style={{ '--legacy-offset': `${legacyOffset}px` } as React.CSSProperties}>
      <LoomScene ref={sceneRef} shot={waiting ? 'close' : 'wide'} scrim={scrim} background={runBackground} onFrame={() => sceneFrameRef.current?.()} />
      {waiting ? (
        <WeaveWait
          key={opening ? 'opening' : 'analysis'}
          kind={opening ? 'opening' : 'analysis'}
          scene={sceneRef}
          designation={designation}
          roleLabel={opening ? gameState.role : (selectedRole === Role.CUSTOM ? customRole : getRoleTranslation(selectedRole, language))}
          headline={loadingStep || (opening && openingData ? t('start.loading_retrieved', { designation: openingData.designation }) : t('start.loading_access'))}
          searches={searches}
          excerpts={excerpts}
          data={waitData}
          done={!opening && filed}
          entityImage={opening ? (openingData?.storyDraft?.entityImage || gameState.mainImage) : null}
          npcImages={opening ? openingData?.npcImages : undefined}
          showEntity={opening && Boolean(openingData?.storyDraft?.entityImage || gameState.mainImage || imageSettings?.enableEntityImages)}
          showNpcPortraits={opening && Boolean(imageSettings?.enableNpcImages || Object.keys(openingData?.npcImages ?? {}).length)}
          canRetry={canRetryInit}
          onRetry={handleRetryInit}
          onScrim={setScrim}
        />
      ) : (
        <StartMenu
          ref={menuRef}
          scene={sceneRef}
          entry={playEntry.current}
          held={!bootSettled}
          urlInput={urlInput}
          onUrlChange={setUrlInput}
          selectedRole={selectedRole}
          onRoleChange={setSelectedRole}
          customRole={customRole}
          onCustomRoleChange={setCustomRole}
          error={error}
          checking={loadingStep === t('start.loading_checking_ai')}
          onStart={handleStart}
          onStoryEditor={() => setGameState(prev => ({ ...prev, status: GameStatus.STORY_EDITOR, scpData: null }))}
          onLoad={() => setSaveLoadModalOpen(true)}
          onSettings={() => {
            setSettingsInitialTab('game');
            setSettingsAttention(false);
            setSettingsModalOpen(true);
          }}
          frameRef={sceneFrameRef}
          onRolesToggle={setRolesOpen}
        />
      )}
    </div>
    {legacyData && !waiting && <LegacyArchiveDrawer legacyData={legacyData} onWidthChange={setLegacyOffset} />}

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
    </>
  );
};

export default StartScreen;
