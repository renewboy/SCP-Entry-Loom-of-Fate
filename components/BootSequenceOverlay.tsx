import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from '../utils/i18n';
import { SCP_10042_LOF_ARCHIVE, BOOT_LOG_LINES } from '../data/scp_10042_lof_archive';

interface BootSequenceOverlayProps {
  onComplete: () => void;
}

type BootPhase = 'bios' | 'connect' | 'archive' | 'ready';

const BootSequenceOverlay: React.FC<BootSequenceOverlayProps> = ({ onComplete }) => {
  const { t, language } = useTranslation();
  const [phase, setPhase] = useState<BootPhase>('bios');
  const [visibleLogCount, setVisibleLogCount] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [visibleSections, setVisibleSections] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const lastSectionIdRef = useRef<string | null>(null);
  
  // BIOS & Connection Logs
  const bootLogs = useMemo(() => [
    ...BOOT_LOG_LINES.bios,
    ...BOOT_LOG_LINES.connect,
    ...BOOT_LOG_LINES.loading
  ], []);

  const archiveSections = useMemo(() => {
    const langKey = language === 'zh' ? 'zh' : 'en';
    const archive = SCP_10042_LOF_ARCHIVE;
    return [
      {
        id: 'header',
        kind: 'header' as const,
        title: t('boot.scp_id'),
        content: archive.id,
        meta: { label: t('boot.scp_class'), value: archive.class }
      },
      {
        id: 'procedures',
        kind: 'text' as const,
        title: t('boot.scp_procedures'),
        content: archive.special_containment_procedures[langKey]
      },
      {
        id: 'description',
        kind: 'text' as const,
        title: t('boot.scp_desc'),
        content: archive.description[langKey]
      },
      {
        id: 'features',
        kind: 'features' as const,
        title: t('boot.features_title'),
        items: archive.features.map((feature) => ({
          id: feature.id,
          name: feature.name[langKey],
          desc: feature.desc[langKey]
        }))
      },
      {
        id: 'warning',
        kind: 'warning' as const,
        title: t('boot.scp_warning'),
        content: archive.warning[langKey]
      }
    ];
  }, [language, t]);

  // Phase 0 & 1: Log Sequence
  useEffect(() => {
    if (phase !== 'bios') return;
    
    let timer: ReturnType<typeof setTimeout>;
    
    if (visibleLogCount < bootLogs.length) {
      // Varying speed for realism
      const delay = Math.random() * 300 + 50;
      timer = setTimeout(() => {
        setVisibleLogCount(c => c + 1);
      }, delay);
    } else {
      timer = setTimeout(() => setPhase('archive'), 800);
    }
    
    return () => clearTimeout(timer);
  }, [visibleLogCount, bootLogs.length, phase]);

  useEffect(() => {
    if (phase !== 'archive') return;
    setVisibleSections(0);
    setIsPaused(false);
  }, [phase, language]);

  useEffect(() => {
    if (phase !== 'archive') return;
    if (isPaused) return;
    if (visibleSections >= archiveSections.length) {
      setIsPaused(true);
      return;
    }
    const current = archiveSections[visibleSections];
    if (current && lastSectionIdRef.current !== current.id) {
      lastSectionIdRef.current = current.id;
    }
    const timer = setTimeout(() => {
      setVisibleSections((count) => count + 1);
    }, current?.kind === 'features' ? 1200 : 900);
    return () => clearTimeout(timer);
  }, [phase, isPaused, visibleSections, archiveSections]);

  // Phase 3: Ready & Fade out
  useEffect(() => {
    if (phase !== 'ready') return;
    
    const timer = setTimeout(() => {
      setIsFading(true);
      setTimeout(onComplete, 1000);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [phase, onComplete]);

  // Shake Effect Trigger
  useEffect(() => {
    if (phase === 'archive' && isPaused) {
      const timer = setTimeout(() => {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 300);
      }, 1100);
      return () => clearTimeout(timer);
    }
  }, [phase, isPaused]);

  // Interaction Handler
  const handleInteraction = () => {
    if (isFading) return;

    if (phase === 'archive') {
      if (isPaused) {
        setPhase('ready');
      } else {
        setVisibleSections(archiveSections.length);
        setIsPaused(true);
      }
    } else if (phase === 'ready') {
    } else {
        setVisibleLogCount(bootLogs.length);
        setPhase('archive');
    }
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (['Enter', ' ', 'Escape'].includes(event.key)) {
        handleInteraction();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, isPaused, visibleSections, isFading, archiveSections.length]);

  const keywords = useMemo(() => {
    if (language === 'zh') {
      return ['Keter', '模因', '世界回响', '记忆锚定', '现实崩溃', 'RAISA', 'MTF', "命运织机"];
    }
    return ['Keter', 'Memetic', 'World Echo', 'Memory Anchoring', 'Reality Collapse', 'RAISA', 'MTF', "Loom of Fate"];
  }, [language]);

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const renderWithGlitch = (text: string) => {
    if (!text) return text;
    const pattern = new RegExp(`(${keywords.map(escapeRegExp).join('|')})`, 'gi');
    return text.split(pattern).map((part, index) => {
      const matched = keywords.some((k) => k.toLowerCase() === part.toLowerCase());
      if (matched) {
        return (
          <span key={`${part}-${index}`} className="glitch-keyword">
            {part}
          </span>
        );
      }
      return <span key={`${part}-${index}`}>{part}</span>;
    });
  };

  return (
    <div
      onClick={handleInteraction}
      className={`fixed inset-0 z-[70] bg-black text-scp-text font-mono overflow-hidden transition-opacity duration-1000 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } ${isShaking ? 'animate-shake' : ''}`}
    >
      {/* CRT Effects */}
      <div className="absolute inset-0 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[71] bg-[length:100%_2px,3px_100%] pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none animate-scanline bg-[linear-gradient(0deg,rgba(0,0,0,0)_50%,rgba(0,255,0,0.1)_50%)] bg-[length:100%_4px] z-[72]" />

      <div className="relative z-10 h-full w-full p-8 md:p-12 flex flex-col items-center justify-center">
        {/* Header */}
        <div className="w-full max-w-4xl flex justify-between items-end border-b border-scp-text/30 pb-2 mb-4 absolute top-8 px-8">
          <div className="text-xs md:text-sm tracking-widest opacity-70">
            {t('boot.phase_' + phase)}
          </div>
          <div className="text-xs opacity-50">
            SECURE TERMINAL // 8829-AZ
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full max-w-4xl overflow-hidden relative flex flex-col justify-center">
          {/* Phase 0 & 1: Logs */}
          {(phase === 'bios' || phase === 'connect') && (
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

          {/* Phase 2: Archive - Centered & Scrollable if needed */}
          {phase === 'archive' && (
            <div className="relative h-full w-full overflow-y-auto custom-scrollbar px-2 md:px-4">
              <div className="pointer-events-none absolute inset-0 archive-scanline" />
              <div className="relative z-10 max-w-3xl mx-auto space-y-6 py-6">
                {archiveSections.slice(0, visibleSections).map((section, index) => (
                  <div
                    key={section.id}
                    className={`archive-section ${section.kind === 'warning' ? 'archive-warning' : ''}`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {section.kind === 'header' && (
                      <div className="space-y-3">
                        <div className="text-xs tracking-[0.5em] text-scp-text/50 uppercase">
                          {section.title}
                        </div>
                        <div className="text-2xl md:text-4xl font-report tracking-[0.2em] text-scp-text">
                          {section.content}
                        </div>
                        <div className="flex items-center gap-3 text-xs md:text-sm">
                          <span className="text-scp-text/60 tracking-widest uppercase">
                            {section.meta?.label}
                          </span>
                          <span className="px-2 py-0.5 border border-[#c32e2e]/60 text-[#c32e2e] tracking-[0.3em] uppercase">
                            {section.meta?.value}
                          </span>
                        </div>
                      </div>
                    )}
                    {section.kind === 'text' && (
                      <div className="space-y-3">
                        <div className="text-xs md:text-sm tracking-[0.35em] text-scp-text/60 uppercase">
                          {section.title}
                        </div>
                        <div className="text-sm md:text-base leading-7 md:leading-8 text-scp-text/90">
                          {renderWithGlitch(section.content)}
                        </div>
                      </div>
                    )}
                    {section.kind === 'features' && (
                      <div className="space-y-4">
                        <div className="text-xs md:text-sm tracking-[0.35em] text-scp-text/60 uppercase">
                          {section.title}
                        </div>
                        <div className="space-y-3">
                          {section.items?.map((item, itemIndex) => (
                            <div
                              key={item.id}
                              className="archive-feature"
                              style={{ animationDelay: `${itemIndex * 0.08}s` }}
                            >
                              <div className="text-sm md:text-base text-scp-text tracking-wide">
                                <span className="text-scp-text/60">{t('boot.feature_prefix')} </span>
                                <span className="text-scp-text/80">{item.id}</span>
                                <span className="text-scp-text/60"> — </span>
                                <span className="text-scp-text">{item.name}</span>
                              </div>
                              <div className="text-xs md:text-sm leading-6 text-scp-text/80 mt-1">
                                {renderWithGlitch(item.desc)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {section.kind === 'warning' && (
                      <div className="space-y-3">
                        <div className="text-xs md:text-sm tracking-[0.35em] text-[#c32e2e] uppercase">
                          {section.title}
                        </div>
                        <div className="text-sm md:text-base leading-7 text-[#c32e2e]">
                          {renderWithGlitch(section.content)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {isPaused && (
                  <div className="mt-6 text-scp-accent animate-pulse border-t border-scp-accent/30 pt-3 inline-block">
                    [{t('boot.press_any_key')}]
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Phase 3: Big Logo / Welcome */}
          {phase === 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-1000 z-50">
              <div className="text-center">
                <div className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 glitch-text text-[#c32e2e]" data-text={t('start.fate_loom')}>
                  {t('start.fate_loom')}
                </div>
                <div className="text-sm tracking-[0.5em] animate-pulse text-scp-text/70">
                  {t('boot.phase_ready')}
                </div>
              </div>
            </div>
          )}
          {phase === 'archive' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="archive-watermark text-scp-text/10 text-5xl md:text-7xl tracking-[0.6em]">
                SITE-19
              </div>
            </div>
          )}
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
        <div className="w-full max-w-4xl absolute bottom-8 px-8 flex justify-between items-center text-[10px] text-gray-500 uppercase tracking-wider">
          <div>{t('boot.access_granted')}</div>
          <div className="animate-pulse opacity-50">
            {phase === 'archive' && isPaused ? t('boot.press_any_key') : t('boot.skip_hint')}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scanline {
          0% { transform: translateY(0); }
          100% { transform: translateY(100vh); }
        }
        .animate-scanline {
          animation: scanline 8s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.3);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--scp-accent);
          border-radius: 2px;
        }
        .archive-section {
          border: 1px solid rgba(224, 224, 224, 0.08);
          background: rgba(5, 5, 5, 0.55);
          padding: 1.25rem;
          border-radius: 6px;
          box-shadow: 0 0 24px rgba(0, 0, 0, 0.4);
          animation: archive-reveal 0.9s ease forwards;
          opacity: 0;
          transform: translateY(10px);
          backdrop-filter: blur(6px);
        }
        .archive-warning {
          border-color: rgba(195, 46, 46, 0.5);
          box-shadow: 0 0 30px rgba(195, 46, 46, 0.2);
        }
        .archive-feature {
          border-left: 2px solid rgba(224, 224, 224, 0.2);
          padding-left: 0.75rem;
          animation: archive-reveal 0.8s ease forwards;
          opacity: 0;
          transform: translateY(8px);
        }
        .archive-watermark {
          font-family: "JetBrains Mono", monospace;
          text-shadow: 0 0 20px rgba(224, 224, 224, 0.1);
          letter-spacing: 0.6em;
        }
        .archive-scanline {
          background: linear-gradient(180deg, transparent 0%, rgba(195, 46, 46, 0.18) 50%, transparent 100%);
          animation: archive-sweep 8s linear infinite;
          mix-blend-mode: screen;
        }
        .stamp-seal {
          position: absolute;
          animation: stamp-sequence 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          filter: drop-shadow(0 0 16px rgba(195, 46, 46, 0.35));
        }
        .animate-shake {
          animation: screen-shake 0.3s cubic-bezier(.36,.07,.19,.97) both;
        }
        .glitch-keyword {
          position: relative;
          color: #c32e2e;
          text-shadow: 0 0 8px rgba(195, 46, 46, 0.5);
          animation: glitch-keyword 3s ease-in-out infinite;
        }
        .glitch-text {
          position: relative;
        }
        .glitch-text::before,
        .glitch-text::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .glitch-text::before {
          left: 2px;
          text-shadow: -1px 0 red;
          clip: rect(24px, 550px, 90px, 0);
          animation: glitch-anim-1 2.5s infinite linear alternate-reverse;
        }
        .glitch-text::after {
          left: -2px;
          text-shadow: -1px 0 blue;
          clip: rect(85px, 550px, 140px, 0);
          animation: glitch-anim-2 3s infinite linear alternate-reverse;
        }
        @keyframes glitch-anim-1 {
          0% { clip: rect(20px, 9999px, 80px, 0); }
          20% { clip: rect(60px, 9999px, 10px, 0); }
          40% { clip: rect(90px, 9999px, 100px, 0); }
          60% { clip: rect(10px, 9999px, 40px, 0); }
          80% { clip: rect(50px, 9999px, 30px, 0); }
          100% { clip: rect(70px, 9999px, 90px, 0); }
        }
        @keyframes glitch-anim-2 {
          0% { clip: rect(90px, 9999px, 100px, 0); }
          20% { clip: rect(10px, 9999px, 40px, 0); }
          40% { clip: rect(50px, 9999px, 30px, 0); }
          60% { clip: rect(70px, 9999px, 90px, 0); }
          80% { clip: rect(20px, 9999px, 80px, 0); }
          100% { clip: rect(60px, 9999px, 10px, 0); }
        }
        @keyframes archive-reveal {
          0% { opacity: 0; transform: translateY(12px); filter: blur(2px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes archive-sweep {
          0% { transform: translateY(-120%); }
          100% { transform: translateY(120%); }
        }
        @keyframes stamp-sequence {
          0% {
            opacity: 0;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(3) rotate(0deg);
          }
          10% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(3) rotate(0deg);
          }
          40% {
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(3) rotate(0deg);
          }
          100% {
            top: calc(100% - 2rem);
            left: calc(100% - 2rem);
            transform: translate(-100%, -100%) scale(1) rotate(-12deg);
            opacity: 0.8;
          }
        }
        @keyframes screen-shake {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-5px, 5px); }
          50% { transform: translate(5px, -5px); }
          75% { transform: translate(-5px, -5px); }
        }
        @keyframes glitch-keyword {
          0%, 100% { text-shadow: 0 0 6px rgba(195, 46, 46, 0.5); }
          50% { text-shadow: -1px 0 rgba(255, 80, 80, 0.8), 1px 0 rgba(80, 80, 255, 0.6); }
        }
      `}</style>
    </div>
  );
};

export default BootSequenceOverlay;
