import React from 'react';
import ReactMarkdown from 'react-markdown';
import { NarrativeMediumType } from '../../types';

interface NarrativeMediaProps {
  mediaType: NarrativeMediumType;
  content: string;
  attrs: Record<string, string>;
}

/* Shared markdown wrapper for media content */
const MediaMarkdown: React.FC<{ children: string; className?: string }> = ({ children, className }) => (
  <div className={className}>
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

/* DOC: Found document */
const DocMedia: React.FC<{ content: string; attrs: Record<string, string> }> = ({ content, attrs }) => {
  const title = attrs.title || 'DOCUMENT';
  const style = attrs.style || 'typed';
  const fontClass = style === 'handwritten' ? 'font-serif italic' : style === 'damaged' ? 'font-mono opacity-80' : 'font-mono';

  return (
    <div className="my-4 animate-in fade-in duration-500">
      <div className="bg-scp-gray/30 border border-white/10 rounded-sm overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border-b border-white/10">
          <span className="text-sm select-none">📄</span>
          <span className="text-sm font-mono text-scp-term/70 uppercase tracking-wider">{title}</span>
          {style === 'damaged' && (
            <span className="text-sm text-red-400/60 ml-auto">[DAMAGED]</span>
          )}
        </div>
        <MediaMarkdown className={`px-4 py-3 ${fontClass} text-base text-scp-text/90 leading-relaxed`}>
          {content}
        </MediaMarkdown>
      </div>
    </div>
  );
};

/* COMM: Intercepted communication */
const CommMedia: React.FC<{ content: string; attrs: Record<string, string> }> = ({ content, attrs }) => {
  const source = attrs.source || 'UNKNOWN';
  const time = attrs.time;

  return (
    <div className="my-4 animate-in fade-in duration-500">
      <div className="bg-black/40 border border-scp-term/20 rounded-sm overflow-hidden font-mono">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-scp-term/5 border-b border-scp-term/20">
          <span className="text-sm text-scp-term/60 select-none">◇</span>
          <span className="text-sm text-scp-term/80 uppercase tracking-wider">{source}</span>
          {time && <span className="text-sm text-scp-term/50 ml-auto">{time}</span>}
        </div>
        <MediaMarkdown className="px-4 py-3 text-base text-scp-term/90 leading-relaxed">
          {content}
        </MediaMarkdown>
      </div>
    </div>
  );
};

/* ENV: Environmental inscription */
const EnvMedia: React.FC<{ content: string; attrs: Record<string, string> }> = ({ content, attrs }) => {
  const envType = attrs.type || 'sign';
  const styleMap: Record<string, string> = {
    graffiti: 'font-serif italic text-red-400/80 text-lg',
    sign: 'font-mono text-yellow-300/80 uppercase tracking-widest text-base',
    screen: 'font-mono text-scp-term text-base',
    carving: 'font-serif tracking-wide text-stone-400/80 text-base',
  };
  const textStyle = styleMap[envType] || styleMap.sign;

  return (
    <div className="my-3 animate-in fade-in duration-300">
      <div className={`px-4 py-2 border-l-2 border-white/20 ${textStyle}`}>
        {envType === 'screen' && <span className="text-scp-term/40 text-sm mr-2 select-none">&gt;_</span>}
        <MediaMarkdown>{content}</MediaMarkdown>
      </div>
    </div>
  );
};

/* PSI: Sensory intrusion */
const PsiMedia: React.FC<{ content: string }> = ({ content }) => (
  <div className="my-4 animate-in fade-in duration-700">
    <div className="relative px-4 py-3 border-t border-b border-white/10">
      <MediaMarkdown
        className="italic text-base text-purple-300/70 leading-relaxed"
      >
        {content}
      </MediaMarkdown>
    </div>
  </div>
);

/* Main dispatcher */
const NarrativeMedia: React.FC<NarrativeMediaProps> = ({ mediaType, content, attrs }) => {
  switch (mediaType) {
    case 'DOC':  return <DocMedia  content={content} attrs={attrs} />;
    case 'COMM': return <CommMedia content={content} attrs={attrs} />;
    case 'ENV':  return <EnvMedia  content={content} attrs={attrs} />;
    case 'PSI':  return <PsiMedia  content={content} />;
    default:     return null;
  }
};

export default NarrativeMedia;
