import React, { useEffect, useMemo, useState } from 'react';

const GLYPHS = '█▓▒░#/%<>01';
const DECRYPT_MS = 620;
const LOG_STEP_MS = 950;

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const scramble = (text: string, revealed: number) => Array.from(text)
  .map((char, index) => (index < revealed || /\s/.test(char) ? char : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
  .join('');

/** A retrieved value resolving from noise, left to right. The label always carries the real text */
export const DecryptText: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
  const [shown, setShown] = useState(() => (reducedMotion() ? text : scramble(text, 0)));

  useEffect(() => {
    if (reducedMotion()) {
      setShown(text);
      return;
    }
    const length = Array.from(text).length;
    const startedAt = performance.now() + delay;
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - startedAt) / DECRYPT_MS));
      setShown(progress >= 1 ? text : scramble(text, Math.floor(progress * length)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [delay, text]);

  return <span aria-label={text}>{shown}</span>;
};

/** A record's filing barcode, the same bars every time for the same name */
export const RecordBarcode: React.FC<{ seed: string }> = ({ seed }) => {
  const bars = useMemo(() => {
    let hash = 7;
    const result: Array<{ x: number; width: number }> = [];
    let x = 0;
    while (x < 62) {
      for (const char of seed) hash = (hash * 31 + (char.codePointAt(0) ?? 0) + x) % 9973;
      const width = 1 + (hash % 3);
      result.push({ x, width });
      x += width + 1 + ((hash >> 3) % 3);
    }
    return result;
  }, [seed]);
  return (
    <svg className="ep-barcode" width="66" height="11" viewBox="0 0 66 11" aria-hidden="true">
      {bars.map(bar => <rect key={bar.x} x={bar.x} y="0" width={bar.width} height="11" />)}
    </svg>
  );
};

/** The terminal working through its lookups while candidates are generated */
export const RetrievalLog: React.FC<{ lines: string[]; doneLabel: string }> = ({ lines, doneLabel }) => {
  const [count, setCount] = useState(1);

  useEffect(() => {
    if (count >= lines.length) return;
    const timer = setTimeout(() => setCount(value => value + 1), LOG_STEP_MS);
    return () => clearTimeout(timer);
  }, [count, lines.length]);

  return (
    <ol className="ep-log" role="log">
      {lines.slice(0, count).map((line, index) => (
        <li key={line} className={index === count - 1 ? 'now' : 'done'}>
          <span>{line}</span>
          {index < count - 1 && <i>{doneLabel}</i>}
        </li>
      ))}
    </ol>
  );
};
