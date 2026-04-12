import React from 'react';
import ReactMarkdown from 'react-markdown';
import { NarrativeMediumType } from '../../types';
import CrtSurface from '../common/CrtSurface';
import StaticNoise from './StaticNoise';

interface NarrativeMediaProps {
  mediaType: NarrativeMediumType;
  content: string;
  attrs: Record<string, string>;
  t: (key: string) => string;
  stability?: number;
}

const MediaMarkdown: React.FC<{ children: string; className?: string; style?: React.CSSProperties }> = ({ children, className, style }) => (
  <div className={className} style={style}>
    <ReactMarkdown
      components={{
        p: ({ children: c }) => <p className="my-1">{c}</p>,
        strong: ({ children: c }) => <strong className="font-bold">{c}</strong>,
        em: ({ children: c }) => <em>{c}</em>,
        ol: ({ children: c, ...props }) => <ol className="list-decimal pl-6 my-1" {...props}>{c}</ol>,
        ul: ({ children: c, ...props }) => <ul className="list-disc pl-6 my-1" {...props}>{c}</ul>,
      }}
    >
      {children}
    </ReactMarkdown>
  </div>
);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getInstabilityRatio(stability?: number): number {
  if (stability === undefined) return 0;
  return (100 - clamp(stability, 0, 100)) / 100;
}

function getGlitchIntensity(stability?: number): number {
  const instability = getInstabilityRatio(stability);
  if (instability <= 0) return 0;
  return Math.min(1, Math.pow(instability, 1.25));
}

function getPsiPressure(stability?: number): number {
  const instability = getInstabilityRatio(stability);
  const pressure = 35 + 60 * Math.pow(instability, 0.85);
  return Math.round(clamp(pressure, 35, 95));
}

/* ═══════════════════════════════════════════════════
   DOC — Classified Foundation Document
   ═══════════════════════════════════════════════════ */
const DocMedia: React.FC<{ content: string; attrs: Record<string, string>; stability?: number; t: (key: string) => string }> = ({ content, attrs, stability, t }) => {
  const title = attrs.title || 'DOCUMENT';
  const style = attrs.style || 'typed';
  const glitchIntensity = getGlitchIntensity(stability);
  const isDamaged = style === 'damaged';
  const isHandwritten = style === 'handwritten';

  const fontClass = isHandwritten
    ? 'font-report text-red-400/90'
    : isDamaged
      ? 'font-mono text-stone-300/85'
      : 'font-report text-stone-200/95';

  const containerStyle: React.CSSProperties = glitchIntensity > 0 ? {
    boxShadow: `inset 0 0 ${12 * glitchIntensity}px rgba(195, 46, 46, ${0.08 + glitchIntensity * 0.15})`,
  } : undefined;

  return (
    <div className="my-4 animate-in fade-in duration-700">
      <div className="narrative-doc scp-archive rounded-sm overflow-hidden relative" style={containerStyle}>
        <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.04] border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xs select-none text-red-500/70 font-black tracking-widest">⚠</span>
            <span className="text-[10px] font-mono text-red-500/60 uppercase tracking-[0.2em] font-bold">
              {t('game.narrative_media.doc_header_classified')}
            </span>
            {isDamaged && (
              <span
                className="ml-1 inline-flex items-center whitespace-nowrap shrink-0 px-2 py-[1px] border border-red-700/45 bg-red-950/15"
                style={{
                  boxShadow: '0 0 10px rgba(127, 29, 29, 0.12)',
                }}
              >
                <span className="text-[9px] font-report font-bold text-red-500/70 tracking-[0.35em] uppercase">
                  {t('game.narrative_media.doc_damaged_tag')}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-scp-text-dim/50 uppercase tracking-wider">
              {t('game.narrative_media.doc_header_level')}
            </span>
            <span className="text-[10px] font-mono text-scp-amber/70 font-bold">4</span>
          </div>
        </div>

        <MediaMarkdown className={`px-4 py-3 ${fontClass} text-sm leading-relaxed`}>
          {content}
        </MediaMarkdown>

        <div className="flex items-center justify-between px-3 py-1 bg-white/[0.02] border-t border-white/5">
          <span className="text-[9px] font-mono text-scp-text-dim/40 uppercase tracking-widest">
            {t('game.narrative_media.doc_footer_file')}-{title}
          </span>
          <span className="text-[9px] font-mono text-scp-text-dim/40 tracking-wider">
            {t('game.narrative_media.doc_footer_page')} 1 {t('game.narrative_media.doc_footer_of')} 1
          </span>
        </div>

      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   COMM — Intercepted Communication Signal
   ═══════════════════════════════════════════════════ */
const CommMedia: React.FC<{ content: string; attrs: Record<string, string>; stability?: number; t: (key: string) => string }> = ({ content, attrs, stability, t }) => {
  const source = attrs.source || 'UNKNOWN';
  const time = attrs.time;
  const glitchIntensity = getGlitchIntensity(stability);

  const sourceColorMap: Record<string, string> = {
    'SITE-COMMAND': 'text-scp-amber',
    'MTF': 'text-scp-alert',
    'SCIENTIST': 'text-scp-cyan',
    'O5': 'text-purple-400',
  };
  const sourceColor = sourceColorMap[source.toUpperCase()] || 'text-scp-term';

  const signalBars = '▓▓▓▓▓░░░░░';

  return (
    <div className="my-4 animate-in fade-in duration-700">
      <div className={`bg-black/95 border border-scp-term/20 rounded-sm overflow-hidden font-mono relative ${
        glitchIntensity > 0.5 ? 'animate-pulse' : ''
      }`} style={{
        boxShadow: glitchIntensity > 0
          ? `0 0 ${15 * glitchIntensity}px rgba(51, 255, 0, ${0.05 + glitchIntensity * 0.08}), inset 0 0 ${10 * glitchIntensity}px rgba(51, 255, 0, ${0.03 + glitchIntensity * 0.05})`
          : undefined,
      }}>
        <div className="flex items-center justify-between px-3 py-1.5 bg-scp-term/[0.04] border-b border-scp-term/20">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-scp-term/40 select-none">◈</span>
            <span className={`text-[10px] ${sourceColor} uppercase tracking-[0.15em] font-bold`}>
              {t('game.narrative_media.comm_signal_intercepted')}
            </span>
          </div>
          <span className="text-[9px] font-mono text-scp-term/30 tracking-wider">
            {signalBars}
          </span>
        </div>

        <MediaMarkdown className={`px-4 py-3 text-sm leading-relaxed ${sourceColor}`}>
          {`>_ ${content}`}
        </MediaMarkdown>

        <div className="relative h-4 overflow-hidden">
          <StaticNoise opacity={0.15 + glitchIntensity * 0.2} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-mono text-scp-term/25 uppercase tracking-[0.3em] animate-pulse">
              [ {t('game.narrative_media.comm_signal_lost')} ]
            </span>
          </div>
        </div>

        {(source || time) && (
          <div className="flex items-center justify-between px-3 py-1 bg-scp-term/[0.03] border-t border-scp-term/10">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500/70 animate-ping" style={{ animationDuration: '2s' }}></span>
              <span className="text-[9px] font-mono text-scp-term/40 uppercase tracking-widest">
                {t('game.narrative_media.comm_rec')}
              </span>
              {time && (
                <span className="text-[9px] font-mono text-scp-term/30 tabular-nums">
                  {time}
                </span>
              )}
            </div>
            <span className={`text-[9px] font-mono ${sourceColor} opacity-50 uppercase tracking-wider`}>
              &lt;{source}&gt;
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   ENV — Environmental Inscription
   ═══════════════════════════════════════════════════ */
const EnvMedia: React.FC<{ content: string; attrs: Record<string, string>; t: (key: string) => string }> = ({ content, attrs, t }) => {
  const envType = attrs.type || 'sign';

  const typeConfig: Record<string, {
    barColor: string;
    textStyle: string;
    prefix: string;
    containerExtra?: string;
  }> = {
    graffiti: {
      barColor: 'bg-red-600/60',
      textStyle: 'font-serif italic text-red-400/85 text-lg font-black tracking-wide',
      prefix: '',
      containerExtra: '-rotate-[0.5deg]',
    },
    sign: {
      barColor: 'bg-yellow-500/70',
      textStyle: 'font-mono text-yellow-300/85 uppercase tracking-[0.2em] text-sm font-extrabold',
      prefix: '',
      containerExtra: 'border-y-2 border-yellow-500/20',
    },
    screen: {
      barColor: 'bg-green-500/60',
      textStyle: 'font-mono text-green-400 text-sm',
      prefix: '> _ ',
    },
    carving: {
      barColor: 'bg-stone-500/40',
      textStyle: 'font-serif tracking-wide text-stone-400/85 text-sm',
      prefix: '',
      containerExtra: 'bg-gradient-to-t from-red-950/15 to-transparent',
    },
  };

  const cfg = typeConfig[envType] || typeConfig.sign;

  if (envType === 'screen') {
    return (
      <div className="my-3 animate-in fade-in duration-500">
        <CrtSurface className="rounded-sm overflow-hidden">
          <div className="flex">
            <div className={`w-[3px] ${cfg.barColor} shrink-0`} />
            <div className="flex-1 px-4 py-2.5 min-h-0">
              <MediaMarkdown className={`${cfg.textStyle} leading-relaxed`}>
                {`${cfg.prefix}${content}`}
              </MediaMarkdown>
            </div>
          </div>
          <div className="px-4 pb-1.5 pt-0">
            <span className="text-[8px] font-mono text-green-500/25 uppercase tracking-[0.2em]">
              ▸ {t('game.narrative_media.env_scan_label')} · {t('game.narrative_media.env_scan_source')}: SCREEN_DISPLAY
            </span>
          </div>
        </CrtSurface>
      </div>
    );
  }

  return (
    <div className={`my-3 animate-in fade-in duration-500 ${cfg.containerExtra || ''}`}>
      <div className="flex">
        <div className={`w-[3px] ${cfg.barColor} shrink-0 self-stretch`} />
        <div className={`flex-1 px-4 py-2.5 border-l border-l-white/5 ${cfg.containerExtra?.includes('gradient') ? '' : ''}`}>
          <MediaMarkdown className={`${cfg.textStyle} leading-relaxed`}>
            {`${cfg.prefix}${content}`}
          </MediaMarkdown>
        </div>
      </div>
      <div className="pl-5 pt-1">
        <span className="text-[8px] font-mono text-scp-text-dim/30 uppercase tracking-[0.2em]">
          ▸ {t('game.narrative_media.env_scan_label')} · {t('game.narrative_media.env_scan_source')}: {envType.toUpperCase()}
        </span>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   PSI — Sensory Intrusion / Psychic Effect
   ═══════════════════════════════════════════════════ */
const PsiMedia: React.FC<{ content: string; stability?: number; t: (key: string) => string }> = ({ content, stability, t }) => {
  const glitchIntensity = getGlitchIntensity(stability);
  const psiPressure = getPsiPressure(stability);

  return (
    <div className="my-4 animate-in fade-in duration-1000 group">
      <style>{`
        @keyframes psi-border-pulse {
          0%, 100% { border-color: rgba(148, 163, 184, 0.18); }
          50% { border-color: rgba(168, 85, 247, ${0.18 + glitchIntensity * 0.22}); }
        }
        @keyframes psi-bleed {
          0% { background-position: center; opacity: 0; }
          50% { opacity: ${0.08 + glitchIntensity * 0.1}; }
          100% { background-position: 200% center; opacity: 0; }
        }
        @keyframes psi-pressure-pulse {
          0%, 100% { box-shadow: 0 0 6px rgba(168, 85, 247, 0.18); }
          50% { box-shadow: 0 0 ${12 + glitchIntensity * 14}px rgba(168, 85, 247, ${0.22 + glitchIntensity * 0.26}); }
        }
        .psi-container:hover {
          transform: skewX(${0.25 + glitchIntensity * 0.75}deg);
        }
        @keyframes psi-vhs-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(4px); }
        }
      `}</style>

      <div
        className="psi-container relative overflow-hidden rounded-sm transition-transform duration-300 backdrop-blur-sm"
        style={{
          background: `linear-gradient(180deg, rgba(12, 12, 16, 0.86), rgba(8, 8, 10, 0.9))`,
          borderTop: `1px solid rgba(148, 163, 184, ${0.14 + glitchIntensity * 0.1})`,
          borderBottom: `1px solid rgba(148, 163, 184, ${0.14 + glitchIntensity * 0.1})`,
          boxShadow: `0 0 ${14 + glitchIntensity * 18}px rgba(168, 85, 247, ${0.08 + glitchIntensity * 0.1}), inset 0 0 ${18 + glitchIntensity * 18}px rgba(0, 0, 0, 0.6)`,
          animation: `psi-border-pulse ${3.2 - glitchIntensity * 1.4}s ease-in-out infinite`,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.028) 0px, rgba(255,255,255,0.028) 1px, transparent 2px, transparent 4px)',
            animation: 'psi-vhs-scroll 3.5s linear infinite',
            opacity: 0.22 + glitchIntensity * 0.32,
          }}
        />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(60% 120% at 50% 50%, rgba(168, 85, 247, 0.16), rgba(168, 85, 247, 0.06) 35%, transparent 70%)',
            animation: `psi-bleed ${4.2 - glitchIntensity * 1.2}s ease-in-out infinite`,
          }}
        />

        <div className="relative z-10 px-4 py-3">
          <MediaMarkdown
            className="italic text-base leading-relaxed"
            style={{
              color: `rgba(226, 232, 240, ${0.78 + glitchIntensity * 0.14})`,
              textShadow: glitchIntensity > 0
                ? `${-1 - glitchIntensity * 2.2}px 0 rgba(239, 68, 68, ${0.18 + glitchIntensity * 0.28}), ${1 + glitchIntensity * 2.2}px 0 rgba(6, 182, 212, ${0.14 + glitchIntensity * 0.24}), 0 0 ${8 + glitchIntensity * 10}px rgba(168, 85, 247, ${0.12 + glitchIntensity * 0.22})`
                : `-0.8px 0 rgba(239, 68, 68, 0.12), 0.8px 0 rgba(6, 182, 212, 0.1), 0 0 8px rgba(168, 85, 247, 0.1)`,
              filter: glitchIntensity > 0.55 ? `blur(${glitchIntensity * 0.25}px)` : undefined,
            }}
          >
            {content}
          </MediaMarkdown>
        </div>

        <div className="relative z-10 px-4 pb-2.5">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{
              background: 'rgba(148, 163, 184, 0.14)',
              animation: `psi-pressure-pulse ${2.8 - glitchIntensity * 1.1}s ease-in-out infinite`,
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${psiPressure}%`,
                background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.2), rgba(192, 132, 252, 0.62), rgba(168, 85, 247, 0.22))',
                boxShadow: `0 0 ${10 + glitchIntensity * 12}px rgba(168, 85, 247, ${0.18 + glitchIntensity * 0.22})`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] font-mono text-scp-text/45 tracking-[0.22em]">
              {t('game.narrative_media.psi_pressure_label')}
            </span>
            <span className="text-[9px] font-mono text-scp-text/40 tabular-nums tracking-wider">
              {psiPressure}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   Main Dispatcher
   ═══════════════════════════════════════════════════ */
const NarrativeMedia: React.FC<NarrativeMediaProps> = ({ mediaType, content, attrs, stability, t }) => {
  switch (mediaType) {
    case 'DOC':
      return <DocMedia content={content} attrs={attrs} stability={stability} t={t} />;
    case 'COMM':
      return <CommMedia content={content} attrs={attrs} stability={stability} t={t} />;
    case 'ENV':
      return <EnvMedia content={content} attrs={attrs} t={t} />;
    case 'PSI':
      return <PsiMedia content={content} stability={stability} t={t} />;
    default:
      return null;
  }
};

export default NarrativeMedia;
