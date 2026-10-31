import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EndingType, GameState, GameStatus, Message, ObjectiveState, Role } from '../../../types';
import { getRoleTranslation, useTranslation } from '../../../utils/i18n';
import { buildBriefingContent, lastTextIndex, parseTurn, plainText, StageMedia } from '../../../utils/beats';
import { stageAsset } from '../../../utils/stageAssets';
import { useBeatPlayer } from '../../../hooks/useBeatPlayer';
import { useStagePrefs } from '../../../hooks/useStagePrefs';
import { useStagePresentation } from '../../../hooks/useStagePresentation';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { playSfx, preloadSfx } from '../../../services/sfxService';
import MapPanel from '../MapPanel';
import EndingStage from '../ending/EndingStage';
import { EndingStats, humeOf } from '../ending/endingSequences';
import Backlog from './Backlog';
import { prefersReducedMotion } from './BeatText';
import BriefingViewer from './BriefingViewer';
import EntityPortrait from './EntityPortrait';
import ChoicePanel, { ChoicePanelHandle } from './ChoicePanel';
import MediaInsert, { INSERT_PLATES } from './MediaInsert';
import ObjectiveTracker from './ObjectiveTracker';
import RadarMinimap from './RadarMinimap';
import StageWorld, { phaseIndex, StageWorldHandle, useStandins } from './StageWorld';
import { ItemsDrawer, StageFilters, StageMenu } from './StageOverlays';
import SubtitleStage from './SubtitleStage';
import '../../../styles/stage.css';

const TITLE_HOLD_MS = 1500;
const TITLE_VISIBLE_MS = 2100;
const SYSTEM_LINE_MS = 4200;
const SYSTEM_LINE_QUEUED_MS = 2600;
const INSERT_EXIT_MS = 520;
const IDLE_MS = 3000;
const FIRST_HINT_MS = 11000;
const FIRST_HINT_KEY = 'loom-first-hint';
const PHASE_KEYS = ['stable', 'fluctuating', 'critical', 'collapse'];
const INTERACTIVE = '#choices, #hud-br, #hud-tr, #radar-wrap, #tracker, button, textarea, a, select, input';

type Overlay = 'none' | 'map' | 'items' | 'log' | 'menu' | 'briefing';

interface SystemLine {
  text: string;
  alert: boolean;
}

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
}

const noop = () => {};

const isIntro = (message: Message) => message.id === 'intro' || message.turnIndex === 0;

const objectiveSignature = (objectives: ObjectiveState[] = []) =>
  objectives.map(objective => `${objective.id}:${objective.status}:${Math.round(objective.progress)}`).join('|');

const GameStage: React.FC<GameStageProps> = ({ gameState, input, setInput, onSend, isMemoryEchoActive, isInputLocked, onSave, onLoad, onTerminate, onViewArchive }) => {
  const { t, language, setLanguage } = useTranslation();
  const { prefs, updatePrefs } = useStagePrefs();
  const { messages, scpData, status, backgroundImage } = gameState;

  const [overlay, setOverlay] = useState<Overlay>('none');
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [uiActive, setUiActive] = useState(false);
  const [radarResetKey, setRadarResetKey] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [systemLine, setSystemLine] = useState<SystemLine | null>(null);
  const [systemVisible, setSystemVisible] = useState(false);
  const [titleCard, setTitleCard] = useState<{ meta: string; title: string } | null>(null);
  const [sweepKey, setSweepKey] = useState(0);
  const [humeShown, setHumeShown] = useState(gameState.stability);
  const [humeDelta, setHumeDelta] = useState<{ text: string; key: number } | null>(null);
  const [firstHint, setFirstHint] = useState(false);
  const [choosingLatch, setChoosingLatch] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
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
  const humeRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<StageWorldHandle>(null);
  const choicesRef = useRef<ChoicePanelHandle>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const holdUntilRef = useRef(0);
  const systemQueue = useRef<SystemLine[]>([]);
  const systemTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef<number | null>(null);
  const wheelLockedUntil = useRef(0);

  const narrator = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].sender === 'narrator') return messages[i];
    }
    return null;
  }, [messages]);

  const command = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].sender === 'user') return messages[i].content;
      if (messages[i].sender === 'narrator' && isIntro(messages[i])) return null;
    }
    return null;
  }, [messages]);

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
  const hasEnding = !!gameState.endingType || status === GameStatus.GAME_OVER;
  const overlayOpen = overlay !== 'none';

  const player = useBeatPlayer({
    turnId: narrator?.id ?? null,
    turn,
    settled,
    hasEnding,
    paused: overlayOpen || isInputLocked,
    autoAdvance: prefs.autoAdvance,
    holdUntilRef
  });
  const { phase, index, beat } = player;

  const reading = phase === 'waiting' || phase === 'title' || phase === 'beats';
  const presented = useStagePresentation(gameState, reading, phase === 'waiting' || phase === 'title');
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
  const place = nodeName(currentNodeId);
  const turnLabel = t('stage.turn_label', { n: (narrator?.turnIndex ?? 0) + 1 });

  const sceneUrl = useMemo(() => {
    const narratorTurns = messages.filter(message => message.sender === 'narrator' && message.imageUrl);
    if (narrator?.imageUrl) return narrator.imageUrl;
    for (let i = narratorTurns.length - 1; i >= 0; i -= 1) {
      if (narratorTurns[i].nodeId && narratorTurns[i].nodeId === currentNodeId) return narratorTurns[i].imageUrl as string;
    }
    if (narratorTurns.length) return narratorTurns[narratorTurns.length - 1].imageUrl as string;
    return backgroundImage;
  }, [messages, narrator?.imageUrl, currentNodeId, backgroundImage]);

  const slots = useStandins(turn.beats, index, phase === 'beats', scpData?.npcImages);
  const speaking = beat?.kind === 'npc' && !!beat.npcId && !!scpData?.npcImages?.[beat.npcId];

  /* ---------- system line ---------- */
  const pumpSystem = useCallback(() => {
    const nextLine = systemQueue.current.shift();
    if (!nextLine) {
      setSystemVisible(false);
      systemTimer.current = null;
      return;
    }
    setSystemLine(nextLine);
    setSystemVisible(true);
    systemTimer.current = setTimeout(pumpSystem, systemQueue.current.length ? SYSTEM_LINE_QUEUED_MS : SYSTEM_LINE_MS);
  }, []);

  const pushSystem = useCallback((text: string, alert = false) => {
    systemQueue.current.push({ text, alert });
    if (!systemTimer.current) pumpSystem();
  }, [pumpSystem]);

  useEffect(() => () => {
    if (systemTimer.current) clearTimeout(systemTimer.current);
  }, []);

  useEffect(() => {
    if (isMemoryEchoActive) pushSystem(t('game.memory_echo_detected'));
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
        pushSystem(beat.text);
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
    setTitleCard({ meta: `${scpData?.designation ?? ''} · ${turnLabel}`, title });
    setSweepKey(key => key + 1);
    playSfx('footstep');
    playSfx('sweep', { gain: 0.6 });
  }, [scpData?.designation, turnLabel]);

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

    if (player.restored) {
      setHumeShown(presented.stability);
      return;
    }

    if (before.map?.currentNodeId !== presented.map?.currentNodeId && presented.map?.currentNodeId) {
      const name = nodeName(presented.map.currentNodeId) || presented.map.currentNodeId;
      if (phase === 'waiting' || phase === 'title') {
        showTitleCard(name);
      } else {
        pushSystem(`${t('game.entering_zone')} · ${name}`);
        playSfx('footstep');
      }
    }

    const previousObjectives = before.objectives || [];
    const currentObjectives = presented.objectives || [];
    const announced = turn.beats.filter(item => item.kind === 'system').map(item => item.text).join(' ');
    currentObjectives.forEach(objective => {
      const previous = previousObjectives.find(item => item.id === objective.id);
      if (!previous) {
        if (!announced.includes(objective.title)) {
          pushSystem(`${t('game.objective_added')} · ${objective.title}`);
          playSfx('objectiveComplete');
        }
      } else if (previous.status !== 'COMPLETED' && objective.status === 'COMPLETED') {
        pushSystem(`${t('game.objective_completed')} · ${objective.title}`);
        playSfx('objectiveComplete');
      } else if (previous.status !== 'FAILED' && objective.status === 'FAILED') {
        pushSystem(`${t('game.objective_failed')} · ${objective.title}`, true);
        playSfx('glitch');
      }
    });
    previousObjectives.forEach(objective => {
      if (!currentObjectives.some(item => item.id === objective.id)) {
        pushSystem(`${t('game.objective_deleted')} · ${objective.title}`);
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
            pushSystem(`${t('game.access_granted')} · ${nodeName(neighbor) || neighbor}`);
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
        pushSystem(t(`stage.phase_note.${PHASE_KEYS[phaseIndex(to)]}`), true);
      }
    }
  }, [presented]);

  /* ---------- overlays and input ---------- */
  const closeOverlay = useCallback(() => setOverlay('none'), []);
  const toggleOverlay = useCallback((target: Overlay) => {
    setOverlay(current => (current === target ? 'none' : target));
    if (target === 'map' || target === 'items' || target === 'briefing') playSfx('quickSweep', { gain: 0.5 });
    if (target === 'map') setMapMounted(true);
  }, []);

  const quickFill = useCallback((text: string) => {
    setOverlay('none');
    if (phase === 'title' || phase === 'beats') player.skip();
    setInput(text);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [phase, player, setInput]);

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

  const canSend = phase === 'choosing' && !hasEnding;
  const send = useCallback(() => {
    if (!canSend) return;
    onSend();
  }, [canSend, onSend]);

  const hasBriefing = briefingPages.length > 0;
  const stateForKeys = useRef({ overlay, overlayOpen, uiHidden, phase, input, player, quickFill, toggleOverlay, closeOverlay, isInputLocked, lightbox, hasBriefing });
  stateForKeys.current = { overlay, overlayOpen, uiHidden, phase, input, player, quickFill, toggleOverlay, closeOverlay, isInputLocked, lightbox, hasBriefing };

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
        if (current.overlayOpen) current.closeOverlay();
        else current.toggleOverlay('menu');
        return;
      }
      if (key === 'Control') {
        current.player.setFast(true);
        return;
      }
      if (lower === 'l') return current.toggleOverlay('log');
      if (lower === 'm') return current.toggleOverlay('map');
      if (lower === 'g') return current.toggleOverlay('items');
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
        return current.player.advance();
      }
      if (key === 'ArrowLeft') {
        event.preventDefault();
        return current.player.back();
      }
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
    choosingLatch && 'choosing',
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
    { key: 'items', label: t('stage.nav.items'), hint: 'G', active: overlay === 'items', run: () => toggleOverlay('items') },
    { key: 'menu', label: t('stage.nav.menu'), hint: 'Esc', active: overlay === 'menu', run: () => toggleOverlay('menu'), id: 'game-settings-button' }
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
          player.advance();
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
          if ((event.target as Element).closest('#choices')) return;
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
          <div id="hume-block" ref={humeRef} aria-label={t('stage.hume_aria')}>
            <div className="meta-line dim">HUME {humeOf(humeShown)}</div>
            <div id="hume-row">
              {humeDelta && <span key={humeDelta.key} id="hume-delta" className="show">{humeDelta.text}</span>}
              <span id="hume-num">{humeShown}</span>
            </div>
            <div className="meta-line dim" id="hume-phase">{t(`stage.phase.${PHASE_KEYS[humePhase]}`)}</div>
          </div>
        </div>

        {blueprint && presented.map && (
          <RadarMinimap
            blueprint={blueprint}
            map={presented.map}
            objectives={presented.objectives || []}
            npcs={presented.npcs || []}
            locationName={place}
            resetKey={radarResetKey}
            anchorRef={humeRef}
            onOpen={() => toggleOverlay('map')}
            t={t}
          />
        )}

        <nav id="hud-br" aria-label={t('stage.nav.menu')}>
          {navItems.map(item => (
            <button key={item.key} id={item.id} type="button" className={item.active ? 'active' : ''} onClick={item.run}>
              {item.label} <kbd>{item.hint}</kbd>
            </button>
          ))}
        </nav>

        <div id="sweep" key={sweepKey} className={sweepKey ? 'run' : ''} aria-hidden="true" />
        <div id="title-card" className={titleCard ? 'on' : ''} aria-hidden="true">
          <div className="meta-line fate">{titleCard?.meta}</div>
          <div id="tc-title">{titleCard?.title}</div>
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

        <div id="system-line" className={`${systemVisible ? 'on' : ''} ${systemLine?.alert ? 'alert' : ''}`} aria-live="polite">
          <span className="dia">◆</span>{systemLine?.text}
        </div>

        <SubtitleStage
          beats={turn.beats}
          player={player}
          command={command}
          loadingText={phase === 'waiting' && !hasEnding
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

      <aside className={`drawer right map-drawer ${overlay === 'map' ? 'open' : ''}`} aria-label={t('stage.drawer.map')}>
        <div className="drawer-head">
          <div>
            <div className="meta-line sys">{t('stage.drawer.map')}</div>
            <div className="drawer-title">{place}</div>
          </div>
          <button type="button" className="drawer-close" onClick={closeOverlay}>✕ <kbd>M</kbd></button>
        </div>
        <div className="drawer-body scp-ui">
          {mapMounted && (
            <MapPanel
              gameState={{ ...gameState, ...presented }}
              onQuickAction={quickFill}
              fullWidth
              embedded
            />
          )}
        </div>
      </aside>

      <ItemsDrawer
        open={overlay === 'items'}
        inventory={presented.inventory || []}
        legacy={gameState.legacy}
        onClose={closeOverlay}
        t={t}
      />

      <div id="drawer-scrim" className={overlay === 'map' || overlay === 'items' ? 'on' : ''} onClick={closeOverlay} />

      <Backlog
        open={overlay === 'log'}
        overEnding={phase === 'ending'}
        messages={messages}
        reading={reading && narrator ? { messageId: narrator.id, beatIndex: index } : null}
        language={language}
        sceneUrl={sceneUrl}
        nodeName={nodeName}
        speakerName={speakerName}
        npcImages={scpData?.npcImages}
        briefing={briefing}
        onZoom={zoomImage}
        onReference={hasEnding ? undefined : fillFromLog}
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
        onRadarReset={() => setRadarResetKey(key => key + 1)}
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
