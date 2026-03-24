import { useState, useRef, useCallback, useEffect } from 'react';

interface UseResizableOptions {
  /** Which side the panel is on — determines drag direction */
  side: 'left' | 'right';
  /** Default width in px */
  defaultWidth?: number;
  /** Minimum width in px */
  minWidth?: number;
  /** Maximum width in px */
  maxWidth?: number;
}

/**
 * Hook for drag-to-resize sidebar panels.
 * Returns current width, drag handle props, and a reset function.
 */
export function useResizable({
  side,
  defaultWidth = 320,
  minWidth = 200,
  maxWidth = 600,
}: UseResizableOptions) {
  const [width, setWidth] = useState(defaultWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(defaultWidth);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width]
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      // Left panel: drag right = wider; Right panel: drag left = wider
      const newWidth =
        side === 'left'
          ? startWidth.current + delta
          : startWidth.current - delta;
      setWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [side, minWidth, maxWidth]);

  const reset = useCallback(() => setWidth(defaultWidth), [defaultWidth]);

  return { width, onMouseDown, reset };
}
