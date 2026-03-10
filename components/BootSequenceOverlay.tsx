import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useTranslation } from '../utils/i18n';
import { SCP_10042_LOF_ARCHIVE, BOOT_LOG_LINES } from '../data/scp_10042_lof_archive';

interface BootSequenceOverlayProps {
  onComplete: () => void;
  skipToReady?: boolean;
}

type BootPhase = 'bios' | 'connect' | 'archive' | 'ready';

// ── Cipher animation character pools ──────────────────────────────────────────
const BLOCK_CHARS  = '█▓▒░▪■▬▀▄▌▐';
const GLITCH_CHARS = '!#$%@*<>[]{}|?&^~';

// Shared timing formula — must be used by BOTH the cipher hook and the delay scheduler
// so they are always in sync. Buffer of 220ms ensures next block never overlaps.
const GLITCH_DUR_MS = 88;   // ms each char spends glitching before locking in
const WAVE_MS_PER_CHAR = 6; // wave speed: lower = faster left-to-right spread
const WAVE_MAX_MS = 1400;   // upper bound so very long paragraphs don't drag
const WAVE_MIN_MS = 180;
const getCipherDuration = (charLen: number) =>
  Math.min(WAVE_MAX_MS, Math.max(WAVE_MIN_MS, charLen * WAVE_MS_PER_CHAR)) + GLITCH_DUR_MS + 90;
const toPlaceholder = (value: string) => value.split('').map(c => c === ' ' ? ' ' : '░').join('');

// ── FlatLine type ─────────────────────────────────────────────────────────────
// Each "line" is one semantic block (label, paragraph, feature row, etc.)
// CSS handles text wrapping — we never manually break sentences.
interface FlatLine {
  id: string;
  text: string;
  style:
    | 'section-label'
    | 'header-id'
    | 'header-class'
    | 'section-title'
    | 'content'
    | 'feature-name'
    | 'feature-desc'
    | 'warning-title'
    | 'warning-content'
    | 'spacer'
    | 'divider';
}

// ── Cipher reveal hook ────────────────────────────────────────────────────────
// Each character transitions: █ → random BLOCK_CHARS → random GLITCH_CHARS → real char
function useCipherReveal(text: string, skip: boolean, active: boolean) {
  const displayRef  = useRef<string>(toPlaceholder(text));
  const [, tick]    = useState(0);
  const forceRender = useCallback(() => tick(n => n + 1), []);
  const [isGlitching, setIsGlitching] = useState(false);
  const [isDone,      setIsDone]      = useState(false);
  const animRef  = useRef<number>(0);
  const doneRef  = useRef(false);

  useEffect(() => {
    doneRef.current  = false;
    setIsDone(false);
    displayRef.current = toPlaceholder(text);

    if (!active) {
      setIsGlitching(false);
      return;
    }

    if (skip) {
      displayRef.current = text;
      setIsDone(true);
      doneRef.current = true;
      setIsGlitching(false);
      return;
    }

    const chars = text.split('');
    if (chars.length === 0 || chars.every(c => c === ' ')) {
      displayRef.current = text;
      setIsDone(true);
      doneRef.current = true;
      return;
    }

    setIsGlitching(true);

    // Adaptive reveal speed: short lines are slower (more drama), long lines faster
    const totalRevealMs = Math.min(WAVE_MAX_MS, Math.max(WAVE_MIN_MS, chars.length * WAVE_MS_PER_CHAR));
    const GLITCH_DUR    = GLITCH_DUR_MS;

    // Pre-assign when each char starts revealing (left-to-right wave + noise)
    const revealTimes = chars.map((c, i) => {
      if (c === ' ') return -1;
      const base  = (i / Math.max(chars.length - 1, 1)) * totalRevealMs;
      const noise = (Math.random() - 0.5) * 55;
      return Math.max(0, base + noise);
    });

    const maxRevealTime = Math.max(...revealTimes.filter(t => t >= 0));
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = now - start;
      const arr = new Array<string>(chars.length);

      chars.forEach((target, i) => {
        if (target === ' ') { arr[i] = ' '; return; }
        const rt = revealTimes[i];
        if (elapsed < rt) {
          // Still fully blocked
          arr[i] = '█';
        } else if (elapsed < rt + GLITCH_DUR) {
          // Shattering: transition from block chars → glitch ASCII
          const progress = (elapsed - rt) / GLITCH_DUR;
          let pool: string;
          if      (progress < 0.30) pool = BLOCK_CHARS;
          else if (progress < 0.62) pool = BLOCK_CHARS + GLITCH_CHARS;
          else                      pool = GLITCH_CHARS;
          arr[i] = pool[Math.floor(Math.random() * pool.length)];
        } else {
          // Locked in
          arr[i] = target;
        }
      });

      displayRef.current = arr.join('');
      forceRender();

      if (elapsed < maxRevealTime + GLITCH_DUR + 90) {
        animRef.current = requestAnimationFrame(frame);
      } else {
        // Finalize — guarantee real text
        displayRef.current = text;
        forceRender();
        setIsGlitching(false);
        if (!doneRef.current) {
          doneRef.current = true;
          setIsDone(true);
        }
      }
    };

    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, [text, skip, active]); // eslint-disable-line react-hooks/exhaustive-deps

  return { display: displayRef.current, isGlitching, isDone };
}

// ── CipherLine component ──────────────────────────────────────────────────────
interface CipherLineProps {
  line: FlatLine;
  skip: boolean;
  active: boolean;
  containerRef?: (el: HTMLDivElement | null) => void;
  renderWithGlitch: (text: string) => React.ReactNode;
}

const CipherLine: React.FC<CipherLineProps> = React.memo(({ line, skip, active, containerRef, renderWithGlitch }) => {
  const { display, isGlitching, isDone } = useCipherReveal(line.text, skip, active);

  const cls = useMemo(() => {
    switch (line.style) {
      case 'section-label':   return 'text-[16px] md:text-[17px] font-report tracking-[0.35em] text-scp-text/45 uppercase mt-5 mb-0.5 cipher-line cipher-appear';
      case 'header-id':       return 'text-2xl md:text-4xl font-report tracking-[0.14em] text-scp-text cipher-line cipher-appear';
      case 'header-class':    return 'text-base md:text-lg font-report text-[#c32e2e] tracking-widest uppercase mt-1 cipher-line cipher-appear';
      case 'section-title':   return 'text-[16px] md:text-[18px] font-report tracking-[0.35em] text-scp-text/45 uppercase mt-5 mb-0.5 cipher-line cipher-appear';
      case 'content':         return 'text-m leading-[1.9] text-scp-text/85 cipher-line cipher-appear';
      case 'feature-name':    return 'text-m text-scp-text tracking-wide mt-2 font-report cipher-line cipher-appear';
      case 'feature-desc':    return 'text-m leading-[1.8] text-scp-text/65 pl-4 border-l border-scp-text/15 ml-1 cipher-line cipher-appear';
      case 'warning-title':   return 'text-[16px] tracking-[0.45em] font-report text-[#c32e2e]/80 uppercase mt-5 mb-0.5 cipher-line cipher-appear';
      case 'warning-content': return 'text-m leading-[1.9] text-[#c32e2e]/85 cipher-line cipher-appear';
      default:                return 'cipher-line cipher-appear';
    }
  }, [line.style]);

  if (line.style === 'spacer')  return <div ref={containerRef} className="h-2" />;
  if (line.style === 'divider') return <hr ref={containerRef} className="border-scp-text/10 my-4" />;
  if (!line.text)               return null;

  return (
    <div ref={containerRef} className={`${cls}${isGlitching ? ' cipher-glitching' : ''}`} style={{ position: 'relative' }}>
      {/*
        Invisible placeholder rendered with the REAL text so the element always occupies
        the correct final height. This prevents layout shifts caused by CJK characters
        (2ch wide) being replaced 1:1 with █ (1ch wide), which would collapse multi-line
        paragraphs to half their final height during the cipher animation.
      */}
      <span style={{ visibility: 'hidden', display: 'block' }}>{line.text}</span>
      {/* Cipher overlay — sits on top of the placeholder, never affects layout height */}
      <span
        className={isDone && !isGlitching ? 'cipher-final' : 'cipher-mask'}
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
      >
        {isDone && !isGlitching
          ? renderWithGlitch(line.text)
          : display}
        {isGlitching && <span className="cipher-cursor" aria-hidden>▌</span>}
      </span>
    </div>
  );
});
CipherLine.displayName = 'CipherLine';


// ── Main component ────────────────────────────────────────────────────────────
const BootSequenceOverlay: React.FC<BootSequenceOverlayProps> = ({ onComplete, skipToReady = false }) => {
  const { t, language } = useTranslation();

  const [phase,            setPhase]           = useState<BootPhase>(() => (skipToReady ? 'ready' : 'bios'));
  const [visibleLogCount,  setVisibleLogCount]  = useState(0);
  const [isFading,         setIsFading]         = useState(false);
  const [isPaused,         setIsPaused]         = useState(false);
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const [skipAnimation,    setSkipAnimation]    = useState(false);
  const [isShaking,        setIsShaking]        = useState(false);
  const [archiveEntering,  setArchiveEntering]  = useState(false);
  const scrollRef          = useRef<HTMLDivElement>(null);
  const interactionRef     = useRef<() => void>(() => {});
  const autoScrollRef      = useRef(true);
  const programmaticScrollRef = useRef(false);
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (skipToReady) {
      setPhase('ready');
    }
  }, [skipToReady]);

  // ── Data sources ──────────────────────────────────────────────────────────
  const bootLogs = useMemo(() => [
    ...BOOT_LOG_LINES.bios,
    ...BOOT_LOG_LINES.connect,
    ...BOOT_LOG_LINES.loading,
  ], []);

  const archiveSections = useMemo(() => {
    const lk = language === 'zh' ? 'zh' : 'en';
    const a  = SCP_10042_LOF_ARCHIVE;
    return [
      {
        id: 'header', kind: 'header' as const,
        title: t('boot.scp_id'), content: a.id,
        meta: { label: t('boot.scp_class'), value: a.class },
      },
      {
        id: 'procedures', kind: 'text' as const,
        title: t('boot.scp_procedures'),
        content: a.special_containment_procedures[lk],
      },
      {
        id: 'description', kind: 'text' as const,
        title: t('boot.scp_desc'), content: a.description[lk],
      },
      {
        id: 'features', kind: 'features' as const,
        title: t('boot.features_title'),
        items: a.features.map(f => ({
          id: f.id, name: f.name[lk], desc: f.desc[lk],
        })),
      },
      {
        id: 'warning', kind: 'warning' as const,
        title: t('boot.scp_warning'), content: a.warning[lk],
      },
    ];
  }, [language, t]);

  // ── Flatten archive sections → semantic blocks ───────────────────────────
  // One FlatLine = one semantic unit. CSS handles all text wrapping naturally.
  const flatLines = useMemo((): FlatLine[] => {
    const lines: FlatLine[] = [];
    archiveSections.forEach(section => {
      if (section.kind === 'header') {
        lines.push({ id: `${section.id}-lbl`,  text: section.title,             style: 'section-label' });
        lines.push({ id: `${section.id}-id`,   text: section.content,           style: 'header-id'     });
        lines.push({ id: `${section.id}-clbl`, text: section.meta?.label ?? '', style: 'section-label' });
        lines.push({ id: `${section.id}-cval`, text: section.meta?.value ?? '', style: 'header-class'  });
        lines.push({ id: `${section.id}-div`,  text: '',                        style: 'divider'       });
      } else if (section.kind === 'text') {
        lines.push({ id: `${section.id}-ttl`, text: section.title,   style: 'section-title' });
        lines.push({ id: `${section.id}-c`,   text: section.content, style: 'content'       });
        lines.push({ id: `${section.id}-sp`,  text: '',              style: 'spacer'        });
      } else if (section.kind === 'features') {
        lines.push({ id: `${section.id}-ttl`, text: section.title, style: 'section-title' });
        section.items?.forEach(item => {
          lines.push({ id: `${item.id}-nm`, text: `[${item.id}] ${item.name}`, style: 'feature-name' });
          lines.push({ id: `${item.id}-d`,  text: item.desc,                   style: 'feature-desc' });
        });
        lines.push({ id: `${section.id}-sp`, text: '', style: 'spacer' });
      } else if (section.kind === 'warning') {
        lines.push({ id: `${section.id}-ttl`, text: section.title,   style: 'warning-title'   });
        lines.push({ id: `${section.id}-w`,   text: section.content, style: 'warning-content' });
      }
    });
    return lines;
  }, [archiveSections]);

  // ── BIOS log ticker ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'bios') return;
    let timer: ReturnType<typeof setTimeout>;
    if (visibleLogCount < bootLogs.length) {
      timer = setTimeout(() => setVisibleLogCount(c => c + 1), Math.random() * 300 + 50);
    } else {
      timer = setTimeout(() => setPhase('connect'), 800);
    }
    return () => clearTimeout(timer);
  }, [visibleLogCount, bootLogs.length, phase]);

  // ── BIOS → Archive handoff ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'connect') return;
    const timer = setTimeout(() => setPhase('archive'), 1800);
    return () => clearTimeout(timer);
  }, [phase]);

  // ── Archive: reset on phase enter / language change ───────────────────────
  useEffect(() => {
    if (phase === 'archive') {
      setVisibleLineCount(0);
      setIsPaused(false);
      setSkipAnimation(false);
      autoScrollRef.current = true;
      setArchiveEntering(true);
      const timer = setTimeout(() => setArchiveEntering(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [phase, language]);

  // ── Archive: line-by-line progression ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'archive') return;
    if (skipAnimation) {
      setVisibleLineCount(flatLines.length);
      setIsPaused(true);
      return;
    }
    if (visibleLineCount >= flatLines.length) {
      setIsPaused(true);
      return;
    }
    // Delay before showing next block — longer for content paragraphs
    const current = flatLines[visibleLineCount];
    const textLen = current?.text?.length ?? 0;
    const delay =
      current?.style === 'spacer'  ? 40 :
      current?.style === 'divider' ? 60 :
      current?.style.includes('title') || current?.style.includes('label') ? 120 :
      current?.style === 'feature-name' || current?.style === 'feature-desc' ? 100 :
      // Content paragraphs: scale with text length so cipher has room to breathe
      getCipherDuration(textLen) + 80;

    const timer = setTimeout(() => setVisibleLineCount(c => c + 1), delay);
    return () => clearTimeout(timer);
  }, [phase, visibleLineCount, flatLines, skipAnimation]);

  // ── Auto-scroll to latest line ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'archive') return;
    if (!scrollRef.current) return;
    if (!autoScrollRef.current) return;
    if (visibleLineCount <= 0) return;
    let targetEl: HTMLDivElement | null = null;
    for (let i = Math.min(visibleLineCount - 1, flatLines.length - 1); i >= 0; i -= 1) {
      const id = flatLines[i]?.id;
      const el = id ? lineRefs.current[id] : null;
      if (el) {
        targetEl = el;
        break;
      }
    }
    if (!targetEl) return;
    programmaticScrollRef.current = true;
    targetEl.scrollIntoView({ block: 'end', behavior: 'smooth' });
    const timer = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 120);
    return () => window.clearTimeout(timer);
  }, [visibleLineCount, phase, flatLines]);

  // ── Ready phase fade-out ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready') return;
    const timer = setTimeout(() => {
      setIsFading(true);
      setTimeout(onComplete, 1000);
    }, 2000);
    return () => clearTimeout(timer);
  }, [phase, onComplete]);

  // ── Shake on pause ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'archive' && isPaused) {
      const timer = setTimeout(() => {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 300);
      }, 1100);
      return () => clearTimeout(timer);
    }
  }, [phase, isPaused]);

  // ── Keywords for glitch highlighting ─────────────────────────────────────
  const keywords = useMemo(() =>
    language === 'zh'
      ? ['Keter', '模因', '世界回响', '记忆锚定', '现实崩溃', 'RAISA', 'MTF', '命运织机']
      : ['Keter', 'Memetic', 'World Echo', 'Memory Anchoring', 'Reality Collapse', 'RAISA', 'MTF', 'Loom of Fate'],
  [language]);

  const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const renderWithGlitch = useCallback((text: string) => {
    if (!text) return text;
    const pattern = new RegExp(`(${keywords.map(escapeRegExp).join('|')})`, 'gi');
    return text.split(pattern).map((part, i) => {
      const matched = keywords.some(k => k.toLowerCase() === part.toLowerCase());
      return matched
        ? <span key={`${part}-${i}`} className="glitch-keyword">{part}</span>
        : <span key={`${part}-${i}`}>{part}</span>;
    });
  }, [keywords]);

  const handleArchiveUserInput = useCallback(() => {
    if (programmaticScrollRef.current) return;
    autoScrollRef.current = false;
  }, []);

  const setLineRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    lineRefs.current[id] = el;
  }, []);

  // ── Interaction handler (click / keypress) ────────────────────────────────
  const handleInteraction = useCallback(() => {
    if (isFading) return;
    if (phase === 'archive') {
      isPaused ? setPhase('ready') : setSkipAnimation(true);
    } else if (phase !== 'ready') {
      setVisibleLogCount(bootLogs.length);
      setPhase('archive');
    }
  }, [isFading, phase, isPaused, bootLogs.length]);

  const handleArchiveDoubleClick = useCallback(() => {
    autoScrollRef.current = true;
  }, []);

  // Keep ref fresh so keydown listener never goes stale
  useEffect(() => { interactionRef.current = handleInteraction; }, [handleInteraction]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['Enter', ' ', 'Escape'].includes(e.key)) interactionRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      onClick={handleInteraction}
      className={`fixed inset-0 z-[70] bg-black text-scp-text font-mono overflow-hidden transition-opacity duration-1000 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } ${isShaking ? 'animate-shake' : ''}`}
    >
      {/* CRT Effects */}
      <div className="absolute inset-0 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[71] bg-[length:100%_2px,3px_100%]" />

      <div className="relative z-10 h-full w-full flex flex-col items-center">

        {/* Header bar */}
        <div className="w-full max-w-4xl flex justify-between items-end border-b border-scp-text/30 pb-2 shrink-0 px-8 pt-8 md:px-12 md:pt-10">
          <div className="text-xs md:text-sm tracking-widest opacity-70">
            {t('boot.phase_' + phase)}
          </div>
          <div className="text-xs opacity-50">SECURE TERMINAL // 8829-AZ</div>
        </div>

        {/* ── Content area ── */}
        <div className="flex-1 w-full max-w-4xl overflow-hidden relative flex flex-col justify-center min-h-0 px-8 md:px-12">

          {/* Phase: BIOS logs */}
          {phase === 'bios' && (
            <div className="space-y-1 text-xs md:text-sm text-scp-text/80 self-start">
              {bootLogs.slice(0, visibleLogCount).map((line, idx) => (
                <div key={idx} className="flex">
                  <span className="mr-2 text-scp-accent">›</span>
                  {line}
                </div>
              ))}
              <div className="animate-pulse">_</div>
            </div>
          )}

          {/* Phase: Connect — soften BIOS → Archive handoff */}
          {phase === 'connect' && (
            <div className="relative w-full h-full">
              <div className="absolute inset-0 pointer-events-none handoff-sweep" />
              <div className="absolute top-0 left-0 px-8 md:px-12 pt-4 space-y-1 text-xs md:text-sm text-scp-text/35 handoff-bios">
                {bootLogs.map((line, idx) => (
                  <div key={idx} className="flex">
                    <span className="mr-2 text-scp-accent">›</span>
                    {line}
                  </div>
                ))}
                <div className="animate-pulse">_</div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="handoff-card text-center px-6 py-4">
                  <div className="text-[11px] tracking-[0.5em] text-scp-text/70 mb-3">
                    {t('boot.phase_connect')}
                  </div>
                  <div className="text-lg md:text-2xl font-report tracking-[0.25em] text-scp-accent">
                    {t('boot.phase_archive')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Phase: Archive — line-by-line cipher reveal */}
          {phase === 'archive' && (
            <div
              ref={scrollRef}
              onWheel={handleArchiveUserInput}
              onTouchStart={handleArchiveUserInput}
              onPointerDown={handleArchiveUserInput}
              onDoubleClick={handleArchiveDoubleClick}
              className={`relative h-full w-full overflow-y-auto custom-scrollbar px-2 md:px-4 ${archiveEntering ? 'archive-enter' : ''}`}
            >
              <div className="pointer-events-none absolute inset-0 archive-scanline" />

              <div className="relative z-10 max-w-3xl mx-auto py-6">
                {flatLines.map((line, index) => (
                  <CipherLine
                    key={line.id}
                    line={line}
                    skip={skipAnimation}
                    active={index < visibleLineCount}
                    containerRef={setLineRef(line.id)}
                    renderWithGlitch={renderWithGlitch}
                  />
                ))}

                {isPaused && (
                  <div className="mt-6 text-scp-accent animate-pulse border-t border-scp-accent/30 pt-3 inline-block">
                    [{t('boot.press_any_key')}]
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Phase: Ready */}
          {phase === 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-1000 z-50">
              <div className="text-center">
                <div
                  className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 glitch-text text-[#c32e2e]"
                  data-text={t('start.fate_loom')}
                >
                  {t('start.fate_loom')}
                </div>
                <div className="text-sm tracking-[0.5em] animate-pulse text-scp-text/70">
                  {t('boot.phase_ready')}
                </div>
              </div>
            </div>
          )}

          {/* Archive watermark */}
          {phase === 'archive' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="archive-watermark text-scp-text/10 text-5xl md:text-7xl tracking-[0.6em]">
                SITE-19
              </div>
            </div>
          )}

          {/* CONFIDENTIAL stamp */}
          {phase === 'archive' && isPaused && (
            <div className="pointer-events-none absolute z-[100] mix-blend-screen border-4 border-red-800 p-2 rounded stamp-seal">
              <div className="border border-red-800 px-4 py-2">
                <span className="text-2xl font-report text-red-800 font-bold uppercase tracking-widest">
                  CONFIDENTIAL
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="w-full max-w-4xl shrink-0 px-8 pb-8 md:px-12 md:pb-10 flex justify-between items-center text-[10px] text-gray-500 uppercase tracking-wider">
          <div>{t('boot.access_granted')}</div>
          <div className="animate-pulse opacity-50">
            {phase === 'archive' && isPaused ? t('boot.press_any_key') : t('boot.skip_hint')}
          </div>
        </div>
      </div>

      {/* ── All CSS ── */}
      <style>{`
        /* ── Scrollbar ──────────────────────────────── */
        .custom-scrollbar::-webkit-scrollbar       { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--scp-accent);
          border-radius: 2px;
        }

        /* ── Archive misc ───────────────────────────── */
        .archive-watermark {
          font-family: "JetBrains Mono", monospace;
          text-shadow: 0 0 20px rgba(224, 224, 224, 0.1);
          letter-spacing: 0.6em;
        }
        .archive-scanline {
          background: linear-gradient(180deg, transparent 0%, rgba(195,46,46,0.18) 50%, transparent 100%);
          animation: archive-sweep 8s linear infinite;
          mix-blend-mode: screen;
        }
        @keyframes archive-sweep {
          0%   { transform: translateY(-120%); }
          100% { transform: translateY(120%); }
        }

        /* ── Handoff bridge ────────────────────────── */
        .handoff-sweep {
          background: linear-gradient(120deg, rgba(195,46,46,0) 0%, rgba(195,46,46,0.15) 35%, rgba(195,46,46,0.35) 50%, rgba(195,46,46,0.15) 65%, rgba(195,46,46,0) 100%);
          animation: handoff-sweep 1.5s ease-in-out forwards;
          mix-blend-mode: screen;
        }
        @keyframes handoff-sweep {
          0%   { opacity: 0; transform: translateX(-60%); }
          30%  { opacity: 0.9; }
          100% { opacity: 0; transform: translateX(60%); }
        }
        .handoff-bios {
          animation: handoff-fade 1.6s ease forwards;
          filter: blur(0.6px);
          max-height: 60vh;
          overflow: hidden;
        }
        @keyframes handoff-fade {
          0%   { opacity: 0.75; transform: translateY(6px); }
          100% { opacity: 0.1; transform: translateY(-4px); }
        }
        .handoff-card {
          border: 1px solid rgba(195,46,46,0.35);
          background: linear-gradient(180deg, rgba(0,0,0,0.72), rgba(10,10,10,0.9));
          box-shadow: 0 0 30px rgba(195,46,46,0.2);
          animation: handoff-card 2s ease-in-out forwards;
        }
        @keyframes handoff-card {
          0%   { opacity: 0; transform: scale(0.96); filter: blur(1px); }
          60%  { opacity: 1; transform: scale(1); filter: blur(0); }
          100% { opacity: 0; transform: scale(1.02); }
        }

        /* ── Archive enter soften ──────────────────── */
        .archive-enter {
          animation: archive-enter 1.5s ease forwards;
        }
        @keyframes archive-enter {
          0%   { opacity: 0; filter: blur(2px); transform: translateY(6px); }
          100% { opacity: 1; filter: blur(0); transform: translateY(0); }
        }

        /* ── Cipher line: initial appear flash ──────── */
        .cipher-appear {
          animation: cipher-appear 0.18s ease forwards;
        }
        @keyframes cipher-appear {
          0%   { opacity: 0; transform: translateX(-3px); filter: brightness(2.5); }
          40%  { opacity: 1; transform: translateX(0);   filter: brightness(1.4); }
          100% { opacity: 1; transform: translateX(0);   filter: brightness(1);   }
        }

        /* ── Cipher glitch: color-channel split + jitter ── */
        .cipher-glitching {
          animation: cipher-glitch 0.07s steps(1) infinite;
          will-change: transform, text-shadow, filter;
        }
        @keyframes cipher-glitch {
          0%   {
            text-shadow: 1.2px 0 rgba(255,20,20,0.75), -1.2px 0 rgba(20,20,255,0.65);
            transform: translateX(0px);
            filter: brightness(1.05);
          }
          20%  {
            text-shadow: -1.5px 0 rgba(255,30,30,0.7), 1.5px 0 rgba(20,20,255,0.6);
            transform: translateX(0.8px);
            filter: brightness(1.1);
          }
          40%  {
            text-shadow: 1px 0 rgba(0,200,200,0.5), -1px 0 rgba(255,80,0,0.45);
            transform: translateX(-0.8px);
            filter: brightness(1.18);
          }
          60%  {
            text-shadow: none;
            transform: translateX(0.4px);
            filter: brightness(0.95);
          }
          80%  {
            text-shadow: 2px 0 rgba(255,20,20,0.55), -2px 0 rgba(20,20,255,0.5);
            transform: translateX(0px);
            filter: brightness(1.08);
          }
          100% {
            text-shadow: 1.2px 0 rgba(255,20,20,0.75), -1.2px 0 rgba(20,20,255,0.65);
            transform: translateX(0px);
            filter: brightness(1.05);
          }
        }

        /* ── Trailing cursor during reveal ─────────── */
        .cipher-cursor {
          display: inline-block;
          margin-left: 1px;
          color: rgba(224,224,224,0.55);
          animation: cipher-cursor-blink 0.14s steps(1) infinite;
        }
        @keyframes cipher-cursor-blink {
          0%, 49% { opacity: 1; }
          50%,100% { opacity: 0; }
        }

        /* ── Cipher mask (initial blocks) ─────────── */
        .cipher-mask {
          color: rgba(170, 180, 190, 0.55);
          text-shadow: 0 0 8px rgba(180, 180, 200, 0.12);
          letter-spacing: 0.015em;
        }

        /* ── Keyword glitch ─────────────────────────── */
        .glitch-keyword {
          position: relative;
          color: #c32e2e;
          text-shadow: 0 0 8px rgba(195,46,46,0.5);
          animation: glitch-keyword 3s ease-in-out infinite;
        }
        @keyframes glitch-keyword {
          0%,100% { text-shadow: 0 0 6px rgba(195,46,46,0.5); }
          50%      { text-shadow: -1px 0 rgba(255,80,80,0.8), 1px 0 rgba(80,80,255,0.6); }
        }

        /* ── "Fate Loom" title glitch ───────────────── */
        .glitch-text            { position: relative; }
        .glitch-text::before,
        .glitch-text::after     {
          content: attr(data-text);
          position: absolute; top: 0; left: 0;
          width: 100%; height: 100%;
        }
        .glitch-text::before {
          left: 2px;
          text-shadow: -1px 0 red;
          clip: rect(24px,550px,90px,0);
          animation: glitch-anim-1 2.5s infinite linear alternate-reverse;
        }
        .glitch-text::after {
          left: -2px;
          text-shadow: -1px 0 blue;
          clip: rect(85px,550px,140px,0);
          animation: glitch-anim-2 3s infinite linear alternate-reverse;
        }
        @keyframes glitch-anim-1 {
          0%   { clip: rect(20px,9999px,80px,0); }
          20%  { clip: rect(60px,9999px,10px,0); }
          40%  { clip: rect(90px,9999px,100px,0);}
          60%  { clip: rect(10px,9999px,40px,0); }
          80%  { clip: rect(50px,9999px,30px,0); }
          100% { clip: rect(70px,9999px,90px,0); }
        }
        @keyframes glitch-anim-2 {
          0%   { clip: rect(90px,9999px,100px,0);}
          20%  { clip: rect(10px,9999px,40px,0); }
          40%  { clip: rect(50px,9999px,30px,0); }
          60%  { clip: rect(70px,9999px,90px,0); }
          80%  { clip: rect(20px,9999px,80px,0); }
          100% { clip: rect(60px,9999px,10px,0); }
        }

        /* ── Stamp seal ─────────────────────────────── */
        .stamp-seal {
          position: absolute;
          animation: stamp-sequence 1.2s cubic-bezier(0.22,1,0.36,1) forwards;
          filter: drop-shadow(0 0 16px rgba(195,46,46,0.35));
        }
        @keyframes stamp-sequence {
          0%   { opacity:0; top:50%; left:50%; transform:translate(-50%,-50%) scale(3) rotate(0deg); }
          10%  { opacity:1; transform:translate(-50%,-50%) scale(3) rotate(0deg); }
          40%  { top:50%; left:50%; transform:translate(-50%,-50%) scale(3) rotate(0deg); }
          100% { top:calc(100% - 2rem); left:calc(100% - 2rem); transform:translate(-100%,-100%) scale(1) rotate(-12deg); opacity:0.8; }
        }

        /* ── Screen shake ───────────────────────────── */
        .animate-shake {
          animation: screen-shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes screen-shake {
          0%,100% { transform: translate(0,0); }
          25%     { transform: translate(-5px,5px); }
          50%     { transform: translate(5px,-5px); }
          75%     { transform: translate(-5px,-5px); }
        }
      `}</style>
    </div>
  );
};

export default BootSequenceOverlay;
