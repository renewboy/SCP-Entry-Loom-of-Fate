import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface TypewriterProps {
  content: string;
  isStreaming: boolean;
  onComplete?: () => void;
}

const Typewriter: React.FC<TypewriterProps> = ({ content, isStreaming, onComplete }) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If we are streaming, we just pass the content through directly 
    // because the "stream" is already handled by the parent updating the prop incrementally.
    // However, for a true "character by character" feel on static text, we'd need internal state.
    // Given the LLM streams chunks, we update as chunks arrive.
    
    setDisplayedContent(content);
    
    if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }

  }, [content]);

  return (
    <div className="prose prose-invert prose-p:text-scp-text prose-headings:text-scp-accent max-w-none font-mono text-sm md:text-base leading-relaxed">
      <ReactMarkdown>{displayedContent}</ReactMarkdown>
      {isStreaming && <span className="inline-block w-2 h-4 bg-scp-term animate-pulse ml-1">▋</span>}
      <div ref={bottomRef} />
    </div>
  );
};

export default Typewriter;