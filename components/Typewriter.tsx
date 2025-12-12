import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface TypewriterProps {
  content: string;
  isStreaming: boolean;
  onComplete?: () => void;
}

const Typewriter: React.FC<TypewriterProps> = ({ content, isStreaming, onComplete }) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isVisualTyping, setIsVisualTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSoundTime = useRef<number>(0);

  // Buffering Refs for slow typing effect
  const contentRef = useRef(content);
  const displayedLengthRef = useRef(0);

  // Keep contentRef in sync with prop
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Manage Audio Context based on visual typing state
  useEffect(() => {
    if (isVisualTyping) {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }
    } else {
      // Close context when not typing to save resources
      if (audioCtxRef.current) {
        if (audioCtxRef.current.state !== 'closed') {
          audioCtxRef.current.close();
        }
        audioCtxRef.current = null;
      }
    }

    return () => {
      if (audioCtxRef.current) {
        if (audioCtxRef.current.state !== 'closed') {
          audioCtxRef.current.close();
        }
        audioCtxRef.current = null;
      }
    };
  }, [isVisualTyping]);

  const playKeystrokeSound = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    if (now - lastSoundTime.current < 0.02) return;
    lastSoundTime.current = now;

    const bufferSize = ctx.sampleRate * 0.05; // 50ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    // Sound 1: Click
    const clickNoise = ctx.createBufferSource();
    clickNoise.buffer = buffer;
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.value = 2500 + Math.random() * 500; 
    clickFilter.Q.value = 2.0; 
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0, now);
    clickGain.gain.linearRampToValueAtTime(0.15, now + 0.005);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    clickNoise.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickNoise.start(now);
    clickNoise.stop(now + 0.03);

    // Sound 2: Thud
    const thudNoise = ctx.createBufferSource();
    thudNoise.buffer = buffer;
    const thudFilter = ctx.createBiquadFilter();
    thudFilter.type = 'lowpass';
    thudFilter.frequency.value = 300 + Math.random() * 100;
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0, now);
    thudGain.gain.linearRampToValueAtTime(0.3, now + 0.01);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    thudNoise.connect(thudFilter);
    thudFilter.connect(thudGain);
    thudGain.connect(ctx.destination);
    thudNoise.start(now);
    thudNoise.stop(now + 0.05);
  };

  // Typing Loop
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const typeStep = () => {
        const target = contentRef.current;
        const currentLen = displayedLengthRef.current;

        // Check if fully complete (backend done AND visual typing done)
        if (!isStreaming && currentLen >= target.length) {
            setIsVisualTyping(false);
            if (onComplete) onComplete();
            return;
        }

        setIsVisualTyping(true);

        if (currentLen < target.length) {
            // Still have content to type from buffer
            const charsToAdd = Math.floor(Math.random() * 5) + 12; 
            const nextLen = Math.min(currentLen + charsToAdd, target.length);
            const nextText = target.slice(0, nextLen);
            
            setDisplayedContent(nextText);
            displayedLengthRef.current = nextLen;
            
            playKeystrokeSound();

            if (bottomRef.current) {
                bottomRef.current.scrollIntoView({ behavior: "smooth" });
            }

            const delay = 50 + Math.random() * 40;
            timeoutId = setTimeout(typeStep, delay);
        } else {
            // Buffer exhausted, but streaming is still true (waiting for backend)
            timeoutId = setTimeout(typeStep, 100);
        }
    };

    // Kick off the loop
    timeoutId = setTimeout(typeStep, 50);

    return () => clearTimeout(timeoutId);
  }, [isStreaming]); 

  // Handle content reset (e.g. new chat)
  useEffect(() => {
      if (content.length === 0) {
          setDisplayedContent('');
          displayedLengthRef.current = 0;
          setIsVisualTyping(false);
      }
  }, [content]);

  return (
    <div className={`typewriter-container prose prose-invert prose-p:text-scp-text prose-headings:text-scp-accent max-w-none font-mono text-sm md:text-base leading-relaxed ${isVisualTyping ? 'cursor-active' : ''}`}>
      <style>
        {`
          .typewriter-container ol {
            list-style: decimal !important;
            padding-left: 2rem !important;
            margin: 1rem 0 !important;
          }
          .typewriter-container ol ol {
            list-style: lower-alpha !important;
            padding-left: 2.5rem !important;
          }
          .typewriter-container li {
            margin: 0.5rem 0 !important;
          }
          /* Cursor styling attached to the last element */
          @keyframes cursor-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          .typewriter-container.cursor-active > *:last-child::after {
            content: '▋';
            display: inline-block;
            animation: cursor-blink 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            color: #33ff00;
            margin-left: 4px;
            vertical-align: baseline;
          }
          /* Fallback for empty content */
          .typewriter-container.cursor-active:empty::after {
            content: '▋';
            display: inline-block;
            animation: cursor-blink 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            color: #33ff00;
          }
        `}
      </style>
      
      <ReactMarkdown>{displayedContent}</ReactMarkdown>
      <div ref={bottomRef} />
    </div>
  );
};

export default Typewriter;