import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChoiceOption } from '../../../utils/beats';

const MAX_INPUT_HEIGHT = 120;

interface ChoicePanelProps {
  turnId: string | null;
  options: ChoiceOption[];
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  /** Lets the subtitle sit just above the panel, whatever its height */
  onHeight: (height: number) => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

export interface ChoicePanelHandle {
  pick: (index: number) => void;
}

const ChoicePanel = React.forwardRef<ChoicePanelHandle, ChoicePanelProps>(({ turnId, options, input, setInput, onSend, inputRef, onHeight, t }, ref) => {
  const panelRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => setPicked(null), [turnId]);

  useLayoutEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [input, inputRef]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => onHeight(panel.offsetHeight));
    observer.observe(panel);
    return () => observer.disconnect();
  }, [onHeight]);

  const pick = useCallback((index: number) => {
    const option = options[index];
    if (!option) return;
    setPicked(index);
    setInput(option.fill);
    requestAnimationFrame(() => {
      const textarea = inputRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(option.fill.length, option.fill.length);
    });
  }, [options, setInput, inputRef]);

  React.useImperativeHandle(ref, () => ({ pick }), [pick]);

  const send = () => {
    if (input.trim()) {
      setPicked(null);
      inputRef.current?.blur();
      onSend();
      return;
    }
    barRef.current?.animate(
      [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }],
      { duration: 220 }
    );
  };

  return (
    <aside id="choices" ref={panelRef} aria-label={t('stage.choice.head')}>
      <div className="meta-line dim ch-head">{t('stage.choice.head')}</div>
      <ol id="choice-list">
        {options.map((option, index) => (
          <li key={`${turnId}:${index}`} style={{ transitionDelay: `${80 + index * 70}ms` }}>
            <button type="button" className={`choice ${picked === index ? 'picked' : ''}`} onClick={() => pick(index)}>
              <span className="idx">0{index + 1}</span>
              <span className="t">{option.title}</span>
              {option.detail && <span className="d">{option.detail}</span>}
            </button>
          </li>
        ))}
        {options.length === 0 && (
          <li className="meta-line dim choice-empty">{t('stage.choice.empty')}</li>
        )}
      </ol>
      <div id="cmd-bar" ref={barRef}>
        <textarea
          id="cmd-input"
          ref={inputRef}
          rows={1}
          value={input}
          placeholder={t('stage.choice.placeholder')}
          onChange={event => setInput(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
            if (event.key === 'Escape') {
              event.stopPropagation();
              event.currentTarget.blur();
            }
          }}
        />
        <button type="button" id="cmd-send" onClick={send}>{t('stage.choice.send')} <kbd>↵</kbd></button>
      </div>
      <div className="meta-line dim ch-foot">{t('stage.choice.foot', { keys: '1 2 3', log: 'L', back: '←' })}</div>
    </aside>
  );
});

export default ChoicePanel;
