import React, { useEffect, useState, useRef } from 'react';
import { RuntimeNPCState } from '../types';
import MessageContent from './shared/MessageContent';

interface TypewriterProps {
  content: string;
  t: (key: string) => string;
  isStreaming: boolean;
  onComplete?: () => void;
  onOptionClick?: (text: string) => void;
  shouldAutoScroll?: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  npcs?: RuntimeNPCState[];
  npcImages?: Record<string, string>;
  onNpcImageClick?: (url: string) => void;
  stability?: number;
}

const Typewriter: React.FC<TypewriterProps> = ({
  content,
  t,
  isStreaming,
  onComplete,
  onOptionClick,
  shouldAutoScroll = false,
  scrollContainerRef,
  npcs,
  npcImages,
  onNpcImageClick,
  stability
}) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isVisualTyping, setIsVisualTyping] = useState(false);

  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSoundTime = useRef<number>(0);

  // Buffering Refs for slow typing effect
  const contentRef = useRef(content);
  const displayedLengthRef = useRef(0);
  const shouldAutoScrollRef = useRef(shouldAutoScroll);

  // Keep contentRef in sync with prop
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    shouldAutoScrollRef.current = shouldAutoScroll;
  }, [shouldAutoScroll]);

  // Sync displayed content when streaming ends or content significantly changes (e.g. tag removal)
  useEffect(() => {
    if (!isStreaming && content !== displayedContent) {
        setDisplayedContent(content);
        displayedLengthRef.current = content.length;
        setIsVisualTyping(false);
    }
  }, [content, isStreaming, displayedContent]);

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
    // If not streaming and content is already full (e.g. loaded from save), skip typing
    if (!isStreaming && displayedLengthRef.current === 0 && content.length > 0) {
        setDisplayedContent(content);
        displayedLengthRef.current = content.length;
        setIsVisualTyping(false);
        if (onComplete) onComplete();
        return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    const typeStep = () => {
        const target = contentRef.current;
        const currentLen = displayedLengthRef.current;

        // Check if fully complete (backend done AND visual typing done)
        if (!isStreaming && currentLen >= target.length) {
            // Ensure we match exactly if we overshot or if target shrank
            if (currentLen > target.length || displayedContent !== target) {
                 setDisplayedContent(target);
                 displayedLengthRef.current = target.length;
            }
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

            if (shouldAutoScrollRef.current && scrollContainerRef?.current) {
                requestAnimationFrame(() => {
                    if (!shouldAutoScrollRef.current || !scrollContainerRef.current) {
                        return;
                    }
                    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                });
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

  const showEmptyCursorAnchor = isVisualTyping && displayedContent.length === 0;

  return (
    <div className={`typewriter-container prose prose-invert prose-p:text-scp-text prose-headings:text-scp-accent max-w-none font-mono text-base md:text-lg leading-7 md:leading-8 tracking-[0.01em] ${isVisualTyping ? 'cursor-active' : ''}`}>
      <style>
        {`
          .typewriter-container ol {
            list-style: decimal !important;
            padding-left: 2.25rem !important;
            margin: 1.1rem 0 !important;
          }
          .typewriter-container ol ol {
            list-style: lower-alpha !important;
            padding-left: 2.75rem !important;
          }
          .typewriter-container ul {
            list-style: disc !important;
            padding-left: 2.1rem !important;
            margin: 1.1rem 0 !important;
          }
          .typewriter-container li {
            margin: 0.65rem 0 !important;
          }
          .typewriter-container p {
            margin: 0.85rem 0 !important;
          }
          .typewriter-container h1,
          .typewriter-container h2,
          .typewriter-container h3,
          .typewriter-container h4 {
            margin: 1.4rem 0 0.8rem !important;
          }
          /* Cursor styling stays attached to the latest rendered node. */
          @keyframes cursor-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          .typewriter-container.cursor-active > *:last-child::after {
            content: '▋';
            display: inline-block;
            animation: cursor-blink 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            color: var(--theme-accent, #33ff00);
            margin-left: 4px;
            vertical-align: baseline;
          }
          .typewriter-container.cursor-active .typewriter-empty-cursor::after {
            content: '▋';
            display: inline-block;
            animation: cursor-blink 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            color: var(--theme-accent, #33ff00);
          }
        `}
      </style>
      
      <MessageContent
        content={displayedContent}
        t={t}
        onOptionClick={onOptionClick}
        npcs={npcs}
        npcImages={npcImages}
        onNpcImageClick={onNpcImageClick}
        stability={stability}
      />
      {showEmptyCursorAnchor && (
        <span aria-hidden="true" className="typewriter-empty-cursor" />
      )}
    </div>
  );
};

export default Typewriter;
