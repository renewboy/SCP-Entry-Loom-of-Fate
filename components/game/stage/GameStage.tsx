import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EndingType, GameState, GameStatus, Message, ObjectiveState, Role } from '../../../types';
import { getRoleTranslation, useTranslation } from '../../../utils/i18n';
import { buildBriefingContent, lastTextIndex, parseTurn, plainText, restoreChoiceNumber, StageMedia } from '../../../utils/beats';
import { stageAsset } from '../../../utils/stageAssets';
import { useBeatPlayer } from '../../../hooks/useBeatPlayer';
import { useStagePrefs } from '../../../hooks/useStagePrefs';
import { useStagePresentation } from '../../../hooks/useStagePresentation';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { playSfx, preloadSfx } from '../../../services/sfxService';
import EndingStage from '../ending/EndingStage';
import GameButton from '../../common/GameButton';
import { isFailedTurn } from '../../postGameReport/selectors/worldLine';
import { EndingStats, humeOf } from '../ending/endingSequences';
import Backlog from './Backlog';
import { prefersReducedMotion } from './BeatText';
import BriefingViewer from './BriefingViewer';
import EntityPortrait from './EntityPortrait';
import ChoicePanel, { ChoicePanelHandle } from './ChoicePanel';
import DossierOverlay, { DossierTab } from './DossierOverlay';
import MediaInsert, { INSERT_PLATES } from './MediaInsert';
import ObjectiveTracker from './ObjectiveTracker';
import RadarMinimap from './RadarMinimap';
import SiteNetwork from './SiteNetwork';
import StageNotices, { useNotices } from './StageNotices';
import StageWorld, { phaseIndex, StageWorldHandle, useStandins } from './StageWorld';
import { StageFilters, StageMenu } from './StageOverlays';
import SubtitleStage from './SubtitleStage';
import { buildNpcDossiers, NpcDossier } from '../../../utils/npcDossier';
import { buildVisitedRoute } from '../../../utils/siteNetwork';
import '../../../styles/stage.css';
import '../../../styles/stagePanels.css';

const TITLE_HOLD_MS = 1500;
const TITLE_VISIBLE_MS = 2100;
const MAP_CLOSE_MS = 660;
const INSERT_EXIT_MS = 520;
const REPLAY_AUTO_NEXT_MS = 1500;
const IDLE_MS = 3000;
const FIRST_HINT_MS = 11000;
const FIRST_HINT_KEY = 'loom-first-hint';
const PHASE_KEYS = ['stable', 'fluctuating', 'critical', 'collapse'];
const INTERACTIVE = '#choices, #hud-br, #hud-tr, #radar-wrap, #tracker, button, textarea, a, select, input';

type Overlay = 'none' | 'map' | 'dossier' | 'log' | 'menu' | 'briefing';

interface GameStageProps {
  gameState: GameState;
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  isMemoryEchoActive: boolean;
  /** A modal or the tutorial is on top: the stage ignores the keyboard */
  isInputLocked: boolean;
  onSave: () => void;
  onLoad: () => void;
  onTerminate: () => void;
  onViewArchive: () => void;
  /** Entered through the door on a new run, so the opening plays even if it has already finished streaming */
  freshRun?: boolean;
}

const noop = () => {};

const isIntro = (message: Message) => message.id === 'intro' || message.turnIndex === 0;

const objectiveSignature = (objectives: ObjectiveState[] = []) =>
  objectives.map(objective => `${objective.id}:${objective.status}:${Math.round(objective.progress)}`).join('|');

const GameStage: React.FC<GameStageProps> = ({ gameState, input, setInput, onSend, isMemoryEchoActive, isInputLocked, onSave, onLoad, onTerminate, onViewArchive, freshRun = false }) => {
  const { t, language, setLanguage } = useTranslation();
  const { prefs, updatePrefs } = useStagePrefs();
  const { messages, scpData, status, backgroundImage } = gameState;

  const [overlay, setOverlay] = useState<Overlay>('none');
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [uiActive, setUiActive] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const { notices, pushNotice } = useNotices();
  const [titleCard, setTitleCard] = useState<string | null>(null);
  const [humeShown, setHumeShown] = useState(gameState.stability);
  const [humeDelta, setHumeDelta] = useState<{ text: string; key: number } | null>(null);
  const [firstHint, setFirstHint] = useState(false);
  const [choosingLatch, setChoosingLatch] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
  const [mapFull, setMapFull] = useState(false);
  const [mapFocus, setMapFocus] = useState<string | null>(null);
  const [dossierTab, setDossierTab] = useState<DossierTab>('people');
  const [replayId, setReplayId] = useState<string | null>(null);
  const [replayNonce, setReplayNonce] = useState(0);
  const [lightbox, setLightbox] = useState<{ url: string; portrait: boolean } | null>(null);
  const [brokenPortrait, setBrokenPortrait] = useState<string | null>(null);

  // Some providers return links that expire, so a saved portrait may no longer load
  useEffect(() => {
    if (!gameState.mainImage) return;
    const image = new Image();
    image.onerror = () => setBrokenPortrait(gameState.mainImage);
    image.src = gameState.mainImage;
  }, [gameState.mainImage]);
  const entityImage = gameState.mainImage !== brokenPortrait ? gameState.mainImage : null;

  const gameRef = useRef<HTMLElement>(null);
  const stateForKeys = useRef<any>({});
  const worldRef = useRef<StageWorldHandle>(null);
  const choicesRef = useRef<ChoicePanelHandle>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const holdUntilRef = useRef(0);
  const touchStartY = useRef<number | null>(null);
  const wheelLockedUntil = useRef(0);

  // Once the game is over a finished turn can be played again on the stage
  const replayTurns = useMemo(() => messages.filter(message => message.sender === 'narrator' && !isFailedTurn(message)), [messages]);
  const replayIndex = replayId ? replayTurns.findIndex(message => message.id === replayId) : -1;
  const replaying = replayIndex >= 0;
  const shownMessages = useMemo(
    () => (replaying ? messages.slice(0, messages.findIndex(message => message.id === replayId) + 1) : messages),
    [messages, replaying, replayId]
  );

  const narrator = useMemo(() => {
    for (let i = shownMessages.length - 1; i >= 0; i -= 1) {
      if (shownMessages[i].sender === 'narrator') return shownMessages[i];
    }
    return null;
  }, [shownMessages]);

  const command = useMemo(() => {
    for (let i = shownMessages.length - 1; i >= 0; i -= 1) {
      if (shownMessages[i].sender === 'user') {
        const offering = shownMessages.slice(0, i).reverse().find(message => message.sender === 'narrator' && !isFailedTurn(message));
        return restoreChoiceNumber(shownMessages[i].content, offering?.content, language);
      }
      if (shownMessages[i].sender === 'narrator' && (isIntro(shownMessages[i]) || i < shownMessages.length - 1)) return null;
    }
    return null;
  }, [shownMessages, language]);

  const briefing = useMemo(() => buildBriefingContent(scpData, t), [scpData, language]);
  const turn = useMemo(
    () => {
      const intro = !!narrator && isIntro(narrator);
      return parseTurn(narrator?.content ?? '', {
        id: narrator?.id,
        intro,
        streaming: !!narrator?.isTyping,
        language,
        briefing: intro ? briefing : undefined
      });
    },
    [narrator?.id, narrator?.content, narrator?.isTyping, narrator?.turnIndex, language, briefing]
  );

  const introMessage = messages.find(message => message.sender === 'narrator' && isIntro(message));
  const briefingPages = useMemo(() => {
    if (!introMessage) return [];
    const { beats } = parseTurn(introMessage.content, {
      id: introMessage.id,
      intro: true,
      streaming: !!introMessage.isTyping,
      language,
      briefing
    });
    return beats.flatMap(item => (item.media?.type === 'DOSSIER' ? [item.media] : []));
  }, [introMessage?.id, introMessage?.content, introMessage?.isTyping, language, briefing]);

  const settled = !narrator?.isTyping;
  const gameEnded = !!gameState.endingType || status === GameStatus.GAME_OVER;
  const hasEnding = gameEnded && !replaying;
  const overlayOpen = overlay !== 'none';

  const player = useBeatPlayer({
    turnId: replaying ? `replay:${replayId}:${replayNonce}` : narrator?.id ?? null,
    turn,
    settled,
    hasEnding,
    paused: overlayOpen || isInputLocked,
    autoAdvance: prefs.autoAdvance,
    holdUntilRef,
    replaying,
    fromStart: freshRun
  });
  const { phase, index, beat } = player;

  const reading = phase === 'waiting' || phase === 'title' || phase === 'beats';
  const livePresented = useStagePresentation(gameState, reading, phase === 'waiting' || phase === 'title');
  const presented = useMemo(() => {
    if (!replaying || !narrator) return livePresented;
    const snapshot = replayTurns.slice(0, replayIndex + 1).reverse().find(message => message.stabilitySnapshot !== undefined);
    return {
      ...livePresented,
      stability: snapshot?.stabilitySnapshot ?? 100,
      map: livePresented.map && narrator.nodeId ? { ...livePresented.map, currentNodeId: narrator.nodeId } : livePresented.map
    };
  }, [livePresented, replaying, narrator, replayTurns, replayIndex]);
  useThemeColors(presented.stability);

  const blueprint = scpData?.mapBlueprint;
  const nodeName = useCallback((nodeId?: string) => {
    if (!nodeId) return '';
    return blueprint?.nodes.find(node => node.id === nodeId)?.name || '';
  }, [blueprint]);
  const speakerName = useCallback((npcId?: string) => {
    if (!npcId) return '';
    return gameState.npcs?.find(npc => npc.id === npcId)?.name
      || blueprint?.npcs.find(npc => npc.id === npcId)?.name
      || npcId;
  }, [gameState.npcs, blueprint]);

  const currentNodeId = presented.map?.currentNodeId;
  // Older saves did not record where each turn happened, so a replay shows no location for them
  const place = replaying && !narrator?.nodeId ? '' : nodeName(currentNodeId);
  // The stage holds back a move until the turn is read, but writing in this turn was seen where the turn ended
  const mediaPlace = narrator?.nodeId ? nodeName(narrator.nodeId) : place;
  const turnLabel = t('stage.turn_label', { n: (narrator?.turnIndex ?? (replaying ? replayIndex : 0)) + 1 });

  const sceneUrl = useMemo(() => {
    const narratorTurns = shownMessages.filter(message => message.sender === 'narrator' && message.imageUrl);
    if (narrator?.imageUrl) return narrator.imageUrl;
    for (let i = narratorTurns.length - 1; i >= 0; i -= 1) {
      if (narratorTurns[i].nodeId && narratorTurns[i].nodeId === currentNodeId) return narratorTurns[i].imageUrl as string;
    }
    if (narratorTurns.length) return narratorTurns[narratorTurns.length - 1].imageUrl as string;
    return backgroundImage;
  }, [shownMessages, narrator?.imageUrl, currentNodeId, backgroundImage]);

  const slots = useStandins(turn.beats, index, phase === 'beats', scpData?.npcImages);
  const speaking = beat?.kind === 'npc' && !!beat.npcId && !!scpData?.npcImages?.[beat.npcId];

  useEffect(() => {
    if (isMemoryEchoActive) pushNotice('SYSTEM', t('game.memory_echo_detected'));
  }, [isMemoryEchoActive]);

  /* ---------- beat side effects ---------- */
  const previousBeatKind = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!beat) {
      previousBeatKind.current = undefined;
      return;
    }
    if (beat.kind === 'system') {
      if (!player.instant) {
        pushNotice('OBJECTIVE_ADD', plainText(beat.text));
        playSfx('objectiveComplete');
      }
      player.markRevealed();
    }
    if (beat.kind === 'media' && !player.instant) {
      const type = beat.media?.type;
      playSfx(type === 'COMM' ? 'sweepReverse' : type === 'ENV' ? 'sweepDown' : 'quickSweep', { gain: 0.8 });
    }
    if (beat.kind === 'psi' && previousBeatKind.current !== 'psi' && !player.instant) {
      playSfx('sweepReverse', { gain: 0.9 });
      playSfx('glitch', { gain: 0.6 });
      worldRef.current?.tearBurst(1, 160);
    }
    previousBeatKind.current = beat.kind;
  }, [beat?.id]);

  const [insert, setInsert] = useState<{ id: string; media: StageMedia } | null>(null);
  const isInserting = beat?.kind === 'media';
  useEffect(() => {
    if (isInserting) {
      if (beat?.media) setInsert({ id: beat.id, media: beat.media });
      return;
    }
    const timer = setTimeout(() => setInsert(null), INSERT_EXIT_MS);
    return () => clearTimeout(timer);
  }, [isInserting, beat?.id]);

  /* ---------- choosing ---------- */
  useEffect(() => {
    if (phase !== 'choosing') {
      setChoosingLatch(false);
      return;
    }
    const raf = requestAnimationFrame(() => setChoosingLatch(true));
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const onChoiceHeight = useCallback((height: number) => {
    gameRef.current?.style.setProperty('--choice-h', `${height}px`);
  }, []);

  /* ---------- what changed once a turn has been read ---------- */
  const showTitleCard = useCallback((title: string) => {
    if (!title) return;
    holdUntilRef.current = Date.now() + (prefersReducedMotion() ? 0 : TITLE_HOLD_MS);
    setTitleCard(title);
  }, []);

  useEffect(() => {
    if (!titleCard) return;
    const timer = setTimeout(() => setTitleCard(null), TITLE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [titleCard]);

  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    preloadSfx();
    INSERT_PLATES.forEach(name => {
      new Image().src = stageAsset(`insert/${name}.jpg`);
    });
    ['end_escaped.jpg', 'end_collapse.jpg', 'contain_end.jpg'].forEach(name => {
      new Image().src = stageAsset(name);
    });
    if (!player.restored && place) showTitleCard(place);
  }, []);

  const previousPresented = useRef(presented);
  useEffect(() => {
    const before = previousPresented.current;
    previousPresented.current = presented;
    if (before === presented) return;

    if (player.restored || replaying) {
      setHumeShown(presented.stability);
      return;
    }

    if (before.map?.currentNodeId !== presented.map?.currentNodeId && presented.map?.currentNodeId) {
      const name = nodeName(presented.map.currentNodeId) || presented.map.currentNodeId;
      if (phase === 'waiting' || phase === 'title') {
        showTitleCard(name);
      } else {
        pushNotice('LOCATION', t('game.entering_zone'), name);
      }
      playSfx('footstep');
    }

    const previousObjectives = before.objectives || [];
    const currentObjectives = presented.objectives || [];
    const announced = turn.beats.filter(item => item.kind === 'system').map(item => item.text).join(' ');
    currentObjectives.forEach(objective => {
      const previous = previousObjectives.find(item => item.id === objective.id);
      if (!previous) {
        if (!announced.includes(objective.title)) {
          pushNotice('OBJECTIVE_ADD', t('game.objective_added'), objective.title);
          playSfx('objectiveComplete');
        }
      } else if (previous.status !== 'COMPLETED' && objective.status === 'COMPLETED') {
        pushNotice('OBJECTIVE', t('game.objective_completed'), objective.title);
        playSfx('objectiveComplete');
      } else if (previous.status !== 'FAILED' && objective.status === 'FAILED') {
        pushNotice('OBJECTIVE_FAIL', t('game.objective_failed'), objective.title);
        playSfx('glitch');
      }
    });
    previousObjectives.forEach(objective => {
      if (!currentObjectives.some(item => item.id === objective.id)) {
        pushNotice('OBJECTIVE_DELETE', t('game.objective_deleted'), objective.title);
        playSfx('glitch');
      }
    });
    if (objectiveSignature(previousObjectives) !== objectiveSignature(currentObjectives)) {
      setFlashKey(key => key + 1);
    }

    if (blueprint && presented.map) {
      const owned = (inventory: GameState['inventory'] = []) => new Set(inventory.flatMap(item => [item.id, ...(item.tags || [])]));
      const ownedBefore = owned(before.inventory);
      const ownedNow = owned(presented.inventory);
      const blocked = (nodeId: string, tokens: Set<string>) => {
        const requires = blueprint.nodes.find(node => node.id === nodeId)?.requires;
        return Array.isArray(requires) && requires.some(token => !tokens.has(token));
      };
      const here = presented.map.currentNodeId;
      blueprint.edges
        .filter(edge => edge.from === here || (edge.bidirectional && edge.to === here))
        .map(edge => (edge.from === here ? edge.to : edge.from))
        .forEach(neighbor => {
          if (blocked(neighbor, ownedBefore) && !blocked(neighbor, ownedNow)) {
            pushNotice('UNLOCK', t('game.access_granted'), `>> ${nodeName(neighbor) || neighbor}`);
            playSfx('doorUnlock');
          }
        });
    }

    const from = before.stability;
    const to = presented.stability;
    if (from !== to) {
      if (prefersReducedMotion()) {
        setHumeShown(to);
      } else {
        setHumeDelta({ text: `${to > from ? '+' : '−'}${Math.abs(to - from)}`, key: Date.now() });
        const startedAt = performance.now();
        const roll = (now: number) => {
          const progress = Math.max(0, Math.min(1, (now - startedAt) / 700));
          const eased = 1 - Math.pow(1 - progress, 3);
          setHumeShown(Math.round(from + (to - from) * eased));
          if (progress < 1) requestAnimationFrame(roll);
        };
        requestAnimationFrame(roll);
      }
      if (to > 0 && phaseIndex(to) > phaseIndex(from)) {
        if (prefs.fxLevel !== 'off') {
          worldRef.current?.shake();
          [0, 130, 300].forEach((delay, i) => setTimeout(() => {
            worldRef.current?.tearBurst(1.2 - i * 0.3, 120);
            playSfx('glitch');
          }, delay));
          playSfx('doorUnlock', { rate: 0.6, gain: 0.5 });
        }
        pushNotice('SYSTEM', t(`stage.phase_note.${PHASE_KEYS[phaseIndex(to)]}`));
      }
    }
  }, [presented]);

  /* ---------- overlays and input ---------- */
  const closeOverlay = useCallback(() => setOverlay('none'), []);
  const toggleOverlay = useCallback((target: Overlay) => {
    setOverlay(current => (current === target ? 'none' : target));
    if (target === 'map' || target === 'briefing') playSfx('quickSweep', { gain: 0.5 });
    if (target === 'map') {
      setMapFocus(null);
      setMapMounted(true);
    }
  }, []);

  const openMapFromRadar = useCallback((nodeId?: string) => {
    setMapFocus(nodeId ?? null);
    playSfx('quickSweep', { gain: 0.5 });
    setMapMounted(true);
    setOverlay('map');
  }, []);

  const toggleDossier = useCallback((tab: DossierTab) => {
    playSfx('quickSweep', { gain: 0.5 });
    setDossierTab(tab);
    setOverlay(current => (current === 'dossier' && stateForKeys.current.dossierTab === tab ? 'none' : 'dossier'));
  }, []);

  // The map always opens as the drawer; it leaves full screen once it has slid away
  useEffect(() => {
    if (overlay === 'map' || !mapFull) return;
    const timer = setTimeout(() => setMapFull(false), MAP_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [overlay, mapFull]);

  const quickFill = useCallback((text: string) => {
    setOverlay('none');
    if (replaying) return;
    if (phase === 'title' || phase === 'beats') player.skip();
    setInput(text);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [phase, player, replaying, setInput]);

  const startReplay = useCallback((messageId?: string) => {
    const target = messageId ?? replayTurns[0]?.id;
    if (!target) return;
    setOverlay('none');
    setReplayId(target);
    setReplayNonce(nonce => nonce + 1);
  }, [replayTurns]);

  const stopReplay = useCallback(() => {
    setOverlay('none');
    setReplayId(null);
  }, []);

  const replayStep = useCallback((delta: number) => {
    const target = replayTurns[replayIndex + delta];
    if (target) startReplay(target.id);
  }, [replayTurns, replayIndex, startReplay]);

  useEffect(() => {
    if (!replaying || phase !== 'choosing' || !player.auto || overlayOpen) return;
    const timer = setTimeout(() => replayStep(1), REPLAY_AUTO_NEXT_MS);
    return () => clearTimeout(timer);
  }, [replaying, phase, player.auto, overlayOpen, replayStep]);

  const zoomImage = useCallback((url: string) => setLightbox({ url, portrait: false }), []);
  const zoomPortrait = useCallback(() => {
    if (entityImage) setLightbox({ url: entityImage, portrait: true });
  }, [entityImage]);
  const openPortrait = useCallback(() => {
    if (briefingPages.length) toggleOverlay('briefing');
    else zoomPortrait();
  }, [briefingPages.length, toggleOverlay, zoomPortrait]);

  const fillFromLog = useCallback((designation: string) => {
    setOverlay('none');
    setInput(designation);
    if (phase === 'choosing') requestAnimationFrame(() => inputRef.current?.focus());
  }, [phase, setInput]);

  const canSend = phase === 'choosing' && !hasEnding && !replaying;
  const send = useCallback(() => {
    if (!canSend) return;
    onSend();
  }, [canSend, onSend]);

  const hasBriefing = briefingPages.length > 0;
  stateForKeys.current = { overlay, overlayOpen, uiHidden, phase, input, player, quickFill, toggleOverlay, closeOverlay, isInputLocked, lightbox, hasBriefing, mapFull, dossierTab, toggleDossier, replaying, replayStep, stopReplay };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = stateForKeys.current;
      if (current.isInputLocked || (event.target as Element)?.matches?.('textarea, input, select')) return;
      const { key } = event;
      const lower = key.toLowerCase();

      if (current.lightbox) {
        if (key === 'Escape') setLightbox(null);
        return;
      }

      if (current.phase === 'ending') {
        if (current.overlay === 'log' && (key === 'Escape' || lower === 'l')) current.closeOverlay();
        return;
      }
      if (key === 'Escape') {
        event.preventDefault();
        if (current.overlay === 'map' && current.mapFull) setMapFull(false);
        else if (current.overlayOpen) current.closeOverlay();
        else if (current.replaying) current.stopReplay();
        else current.toggleOverlay('menu');
        return;
      }
      if (key === 'Control') {
        current.player.setFast(true);
        return;
      }
      if (lower === 'l') return current.toggleOverlay('log');
      if (lower === 'm') return current.toggleOverlay('map');
      if (lower === 'g') return current.toggleDossier('items');
      if (lower === 'p') return current.toggleDossier('people');
      if (lower === 'f') {
        if (current.overlay === 'map') setMapFull((full: boolean) => !full);
        return;
      }
      if (lower === 'b') {
        if (current.hasBriefing) current.toggleOverlay('briefing');
        return;
      }
      if (lower === 'j') return setTrackerOpen(open => !open);
      if (lower === 'h') return setUiHidden(hidden => !hidden);
      if (current.uiHidden) return setUiHidden(false);
      if (current.overlayOpen) return;
      if (lower === 'a') return current.player.setAuto(!current.player.auto);
      if (key === ' ' || key === 'Enter' || key === 'ArrowRight') {
        event.preventDefault();
        if (current.replaying && current.phase === 'choosing') return current.replayStep(1);
        return current.player.advance();
      }
      if (key === 'ArrowLeft') {
        event.preventDefault();
        return current.player.back();
      }
      if (current.replaying) return;
      if (key === '/') {
        event.preventDefault();
        return current.quickFill(current.input);
      }
      if (current.phase === 'choosing' && /^[1-9]$/.test(key)) {
        event.preventDefault();
        choicesRef.current?.pick(Number(key) - 1);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') stateForKeys.current.player.setFast(false);
    };
    const onBlur = () => stateForKeys.current.player.setFast(false);
    let idleTimer: ReturnType<typeof setTimeout>;
    const onMouseMove = () => {
      setUiActive(true);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setUiActive(false), IDLE_MS);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('blur', onBlur);
      clearTimeout(idleTimer);
    };
  }, []);

  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(FIRST_HINT_KEY);
      if (!seen) localStorage.setItem(FIRST_HINT_KEY, '1');
    } catch {
      seen = true;
    }
    if (seen) return;
    setFirstHint(true);
    const timer = setTimeout(() => setFirstHint(false), FIRST_HINT_MS);
    return () => clearTimeout(timer);
  }, []);

  /* ---------- ending ---------- */
  const endingType = gameState.endingType || EndingType.UNKNOWN;
  const isPersonnel = gameState.role !== Role.SCP;
  const endingKey = endingType.toLowerCase();
  const escapedAsScp = endingType === EndingType.ESCAPED && !isPersonnel;
  const endingTitle = escapedAsScp ? t('stage.ending.escaped_scp_title') : t(`endings.${endingKey}.title`);
  const endingSubtitle = escapedAsScp ? t('stage.ending.escaped_scp_sub') : t(`endings.${endingKey}.subtitle`);

  const endingStats = useMemo<EndingStats>(() => {
    const trail = messages.filter(message => message.sender === 'narrator').map(message => message.stabilitySnapshot ?? 100);
    const final = endingType === EndingType.COLLAPSE ? 0 : gameState.stability;
    if (trail[trail.length - 1] !== final) trail.push(final);
    if (trail.length < 2) trail.unshift(100);
    let drop = 0;
    trail.forEach((value, i) => {
      if (i > 0) drop = Math.max(drop, trail[i - 1] - value);
    });
    return { turns: gameState.turnCount + 1, hume: humeOf(final), drop, trail, role: getRoleTranslation(gameState.role, language) };
  }, [messages, endingType, gameState.stability, gameState.turnCount, gameState.role, language]);

  /* ---------- map and dossier ---------- */
  const panelOpen = overlay === 'map' || overlay === 'dossier';
  const lastDossiers = useRef<NpcDossier[]>([]);
  const dossiers = useMemo(() => {
    // The minimap needs this too, so it refreshes whenever a turn has been read
    if (panelOpen || !reading) {
      lastDossiers.current = buildNpcDossiers(messages, presented.npcs || [], {
        currentNodeId,
        language,
        skipMessageId: reading ? narrator?.id : undefined
      });
    }
    return lastDossiers.current;
  }, [panelOpen, messages, presented.npcs, currentNodeId, language, reading, narrator?.id]);
  const visitedRoute = useMemo(
    () => (blueprint ? buildVisitedRoute(shownMessages, blueprint.startNodeId, currentNodeId) : []),
    [shownMessages, blueprint, currentNodeId]
  );
  const wallImages = useMemo(() => {
    const portraits = Object.values(scpData?.npcImages || {}).filter((url): url is string => !!url);
    return [...new Set([...portraits, entityImage, backgroundImage].filter((url): url is string => !!url))];
  }, [scpData?.npcImages, entityImage, backgroundImage]);

  const lastLineIndex = lastTextIndex(turn.beats);
  const lastLine = lastLineIndex >= 0 ? plainText(turn.beats[lastLineIndex].text) : '';

  /* ---------- render ---------- */
  const humePhase = phaseIndex(presented.stability);
  const gameClass = [
    !sceneUrl && 'no-image',
    speaking && 'speaking',
    beat?.kind === 'psi' && 'psi',
    isMemoryEchoActive && 'memory-echo',
    isInserting && 'inserting',
    choosingLatch && !replaying && 'choosing',
    replaying && 'replaying',
    player.auto && 'auto',
    uiActive && 'ui-active',
    uiHidden && 'ui-hidden'
  ].filter(Boolean).join(' ');

  const navItems: Array<{ key: string; label: string; hint: string; active?: boolean; run: () => void; id?: string }> = [
    { key: 'auto', label: t('stage.nav.auto'), hint: 'A', active: player.auto, run: () => player.setAuto(!player.auto) },
    { key: 'fast', label: t('stage.nav.fast'), hint: 'Ctrl', run: player.skip },
    { key: 'log', label: t('stage.nav.log'), hint: 'L', active: overlay === 'log', run: () => toggleOverlay('log') },
    { key: 'task', label: t('stage.nav.task'), hint: 'J', active: trackerOpen, run: () => setTrackerOpen(open => !open) },
    { key: 'map', label: t('stage.nav.map'), hint: 'M', active: overlay === 'map', run: () => toggleOverlay('map') },
    { key: 'dossier', label: t('stage.nav.dossier'), hint: 'P', active: overlay === 'dossier', run: () => toggleDossier('people') },
    replaying
      ? { key: 'exit', label: t('stage.replay.exit'), hint: 'Esc', run: stopReplay }
      : { key: 'menu', label: t('stage.nav.menu'), hint: 'Esc', active: overlay === 'menu', run: () => toggleOverlay('menu'), id: 'game-settings-button' }
  ];

  return (
    <div className={`stage-root ${prefersReducedMotion() ? 'reduced' : ''}`} style={{ '--fs': prefs.fontScale } as React.CSSProperties}>
      <StageFilters />
      <main
        id="game"
        ref={gameRef}
        className={gameClass}
        aria-label={scpData?.name}
        onClick={event => {
          if (uiHidden) {
            setUiHidden(false);
            return;
          }
          if ((event.target as Element).closest(INTERACTIVE)) return;
          if (replaying && phase === 'choosing') replayStep(1);
          else player.advance();
        }}
        onTouchStart={event => {
          touchStartY.current = (event.target as Element).closest('#radar-wrap, #tracker, #choices') ? null : event.touches[0].clientY;
        }}
        onTouchEnd={event => {
          if (touchStartY.current === null) return;
          const delta = event.changedTouches[0].clientY - touchStartY.current;
          touchStartY.current = null;
          if (delta < -60 && !overlayOpen && phase !== 'choosing') setOverlay('log');
        }}
        onWheel={event => {
          if ((event.target as Element).closest('#choices, #radar-wrap')) return;
          if (event.deltaY < -24 && Date.now() > wheelLockedUntil.current && !overlayOpen) {
            wheelLockedUntil.current = Date.now() + 800;
            setOverlay('log');
          }
        }}
      >
        <StageWorld
          ref={worldRef}
          sceneUrl={sceneUrl}
          slots={slots}
          images={scpData?.npcImages}
          stability={presented.stability}
          fxLevel={prefs.fxLevel}
          active={phase !== 'ending'}
          memoryEcho={isMemoryEchoActive}
        />

        <div id="hud-center">
          {scpData?.name && <div id="hud-title">{scpData.name}</div>}
          <div className="meta-line fate">{scpData?.designation} · {scpData?.containmentClass?.toUpperCase()}</div>
        </div>

        <header id="hud-tl">
          <div className="hud-id">
            {(entityImage || hasBriefing) && (
              <EntityPortrait
                id="hud-portrait"
                src={entityImage || stageAsset('insert/doc_typed.jpg')}
                appendix={t('app.appendix')}
                designation={scpData?.designation ?? ''}
                title={hasBriefing ? t('stage.briefing.open') : t('stage.briefing.zoom')}
                onClick={openPortrait}
              />
            )}
            <div className="hud-lines">
              <div id="hud-role">{t('game.role')}：{getRoleTranslation(gameState.role, language)}</div>
              <div className="meta-line dim">{turnLabel}{place ? ` · ${place}` : ''}</div>
            </div>
          </div>
          <ObjectiveTracker
            objectives={presented.objectives || []}
            open={trackerOpen}
            onToggle={() => setTrackerOpen(open => !open)}
            flashKey={flashKey}
            t={t}
          />
        </header>

        <div id="hud-tr" className={humePhase === 2 ? 'critical' : ''}>
          <div id="hume-block" aria-label={t('stage.hume_aria')}>
            <div className="meta-line dim">HUME {humeOf(humeShown)}</div>
            <div id="hume-row">
              {humeDelta && <span key={humeDelta.key} id="hume-delta" className="show">{humeDelta.text}</span>}
              <span id="hume-num">{humeShown}</span>
            </div>
            <div className="meta-line dim" id="hume-phase">{t(`stage.phase.${PHASE_KEYS[humePhase]}`)}</div>
          </div>
          {blueprint && presented.map && (
            <RadarMinimap
              blueprint={blueprint}
              map={presented.map}
              objectives={presented.objectives || []}
              inventory={presented.inventory || []}
              dossiers={dossiers}
              route={visitedRoute}
              npcImages={scpData?.npcImages}
              locationName={place}
              onOpen={openMapFromRadar}
              t={t}
            />
          )}
        </div>

        <nav id="hud-br" aria-label={t('stage.nav.menu')}>
          {navItems.map(item => (
            <button key={item.key} id={item.id} type="button" className={item.active ? 'active' : ''} onClick={item.run}>
              {item.label} <kbd>{item.hint}</kbd>
            </button>
          ))}
        </nav>

        <div id="title-card" className={titleCard ? 'on' : ''} aria-hidden="true">
          <i className="tc-scan" />
          <div className="meta-line sys">{t('game.entering_zone')}</div>
          <div id="tc-title">{titleCard}</div>
        </div>

        <div id="media-layer">
          {insert && (
            <MediaInsert
              key={insert.id}
              media={insert.media}
              designation={scpData?.designation ?? ''}
              speed={prefs.textSpeed}
              instant={isInserting ? player.instant : true}
              fast={player.fast}
              onDone={isInserting ? player.markRevealed : noop}
              finishRef={player.finishTypingRef}
              entityImage={entityImage}
              onZoomPortrait={zoomPortrait}
              place={mediaPlace}
              t={t}
            />
          )}
        </div>

        {beat?.media?.type === 'DOSSIER' && beat.media.attrs.page && (
          <>
            {!beat.media.attrs.page.startsWith('1/') && (
              <button type="button" className="page-turn prev" aria-label={t('stage.briefing.prev')} onClick={player.back}>‹</button>
            )}
            <button type="button" className="page-turn next" aria-label={t('stage.briefing.next')} onClick={player.advance}>›</button>
          </>
        )}

        <StageNotices notices={notices} t={t} />

        {replaying && (
          <div id="replay-bar">
            <span className="meta-line">{t('stage.replay.label', { n: replayIndex + 1, total: replayTurns.length })}</span>
            <GameButton variant="quiet" size="sm" disabled={replayIndex === 0} onClick={() => replayStep(-1)}>‹ {t('stage.replay.prev')}</GameButton>
            <GameButton
              variant={phase === 'choosing' && replayIndex < replayTurns.length - 1 ? 'primary' : 'quiet'}
              size="sm"
              disabled={replayIndex >= replayTurns.length - 1}
              onClick={() => replayStep(1)}
            >
              {t('stage.replay.next')} ›
            </GameButton>
          </div>
        )}

        <SubtitleStage
          beats={turn.beats}
          player={player}
          command={command}
          loadingText={phase === 'waiting' && !hasEnding && !replaying
            ? t(gameState.aiState === 'summarizing' ? 'stage.loading.summarizing' : 'stage.loading.weaving')
            : null}
          speed={prefs.textSpeed}
          speakerName={speakerName}
          t={t}
        />

        <ChoicePanel
          ref={choicesRef}
          turnId={narrator?.id ?? null}
          options={turn.options}
          input={input}
          setInput={setInput}
          onSend={send}
          inputRef={inputRef}
          onHeight={onChoiceHeight}
          t={t}
        />

        <div className="grain" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
      </main>

      {mapMounted && blueprint && presented.map && (
        <SiteNetwork
          open={overlay === 'map'}
          fullscreen={mapFull}
          onToggleFullscreen={() => setMapFull(full => !full)}
          onClose={closeOverlay}
          blueprint={blueprint}
          map={presented.map}
          objectives={presented.objectives || []}
          inventory={presented.inventory || []}
          dossiers={dossiers}
          route={visitedRoute}
          npcImages={scpData?.npcImages}
          backgroundImage={sceneUrl}
          focusNodeId={mapFocus}
          onAction={quickFill}
          t={t}
        />
      )}

      <DossierOverlay
        open={overlay === 'dossier'}
        tab={dossierTab}
        onTab={setDossierTab}
        dossiers={dossiers}
        inventory={presented.inventory || []}
        legacy={gameState.legacy}
        nodeName={nodeName}
        npcImages={scpData?.npcImages}
        wallImages={wallImages}
        paused={!!lightbox}
        onZoom={zoomImage}
        onClose={closeOverlay}
        t={t}
      />

      <div id="drawer-scrim" className={overlay === 'map' && !mapFull ? 'on' : ''} onClick={closeOverlay} />

      <Backlog
        open={overlay === 'log'}
        overEnding={phase === 'ending'}
        messages={messages}
        reading={reading && narrator && !replaying ? { messageId: narrator.id, beatIndex: index } : null}
        language={language}
        sceneUrl={sceneUrl}
        nodeName={nodeName}
        speakerName={speakerName}
        npcImages={scpData?.npcImages}
        briefing={briefing}
        onZoom={zoomImage}
        onReference={gameEnded ? undefined : fillFromLog}
        onReplay={gameEnded ? startReplay : undefined}
        onClose={closeOverlay}
        t={t}
      />

      <StageMenu
        open={overlay === 'menu'}
        designation={scpData?.designation ?? ''}
        scpName={scpData?.name ?? ''}
        turnCount={gameState.turnCount}
        tokenCount={gameState.tokenCount}
        prefs={prefs}
        onPrefs={updatePrefs}
        language={language}
        onLanguage={setLanguage}
        onClose={closeOverlay}
        onSave={() => { closeOverlay(); onSave(); }}
        onLoad={() => { closeOverlay(); onLoad(); }}
        onTerminate={() => { closeOverlay(); onTerminate(); }}
        t={t}
      />

      {phase === 'ending' && (
        <EndingStage
          type={endingType}
          restored={player.restored}
          title={endingTitle}
          subtitle={endingSubtitle}
          lastLine={lastLine}
          designation={scpData?.designation ?? ''}
          scpName={scpData?.name ?? ''}
          containmentClass={scpData?.containmentClass ?? ''}
          stats={endingStats}
          sceneUrl={sceneUrl}
          logOpen={overlay === 'log'}
          onArchive={onViewArchive}
          onOpenLog={() => setOverlay('log')}
          onReplay={() => startReplay()}
          t={t}
        />
      )}

      {overlay === 'briefing' && hasBriefing && (
        <BriefingViewer
          pages={briefingPages}
          designation={scpData?.designation ?? ''}
          speed={prefs.textSpeed}
          entityImage={entityImage}
          onZoomPortrait={zoomPortrait}
          paused={!!lightbox}
          onClose={closeOverlay}
          t={t}
        />
      )}

      {lightbox && (
        <div id="lightbox" role="dialog" onClick={() => setLightbox(null)}>
          {lightbox.portrait
            ? <EntityPortrait className="zoomed" src={lightbox.url} appendix={t('app.appendix')} designation={scpData?.designation ?? ''} />
            : <img src={lightbox.url} alt="" />}
        </div>
      )}

      {firstHint && !isInputLocked && (
        <button id="first-hint" type="button" onClick={() => setFirstHint(false)}>
          <span className="desk">{t('stage.hint.desktop')}</span>
          <span className="touch">{t('stage.hint.touch')}</span>
        </button>
      )}
    </div>
  );
};

export default GameStage;
