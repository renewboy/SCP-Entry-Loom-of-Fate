import React, { useCallback, useEffect, useRef } from 'react';
import { NetworkPoint } from '../utils/siteNetwork';

export interface NetworkView {
  x: number;
  y: number;
  k: number;
}

interface NetworkViewOptions {
  positions: Record<string, NetworkPoint>;
  currentId: string;
  minZoom?: number;
  maxZoom?: number;
  onPaint?: (view: NetworkView) => void;
}

const DRAG_THRESHOLD = 4;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Pan and zoom for a site map, shared by the drawer, the full screen view and the minimap */
export function useNetworkView({ positions, currentId, minZoom = 0.45, maxZoom = 2.4, onPaint }: NetworkViewOptions) {
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<NetworkView>({ x: 0, y: 0, k: 1 });
  const draggedRef = useRef(false);
  const tweenRef = useRef(0);
  const latest = useRef({ positions, currentId, onPaint });
  latest.current = { positions, currentId, onPaint };

  const paint = useCallback(() => {
    const { x, y, k } = viewRef.current;
    worldRef.current?.setAttribute('transform', `translate(${x} ${y}) scale(${k})`);
    const here = latest.current.positions[latest.current.currentId];
    if (here && sweepRef.current) sweepRef.current.style.transform = `translate(${x + here.x * k}px, ${y + here.y * k}px) scale(${k})`;
    latest.current.onPaint?.(viewRef.current);
  }, []);

  const stopTween = useCallback(() => {
    cancelAnimationFrame(tweenRef.current);
    tweenRef.current = 0;
  }, []);

  const setView = useCallback((next: NetworkView) => {
    stopTween();
    viewRef.current = next;
    paint();
  }, [paint, stopTween]);

  /** Glides to a view, for following the player from one zone to the next */
  const glideTo = useCallback((next: NetworkView, duration = 900) => {
    stopTween();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setView(next);
      return;
    }
    const from = { ...viewRef.current };
    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = easeInOut(clamp((now - startedAt) / duration, 0, 1));
      viewRef.current = {
        x: from.x + (next.x - from.x) * progress,
        y: from.y + (next.y - from.y) * progress,
        k: from.k + (next.k - from.k) * progress,
      };
      paint();
      tweenRef.current = progress < 1 ? requestAnimationFrame(step) : 0;
    };
    tweenRef.current = requestAnimationFrame(step);
  }, [paint, setView, stopTween]);

  const onPointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button) return;
    stopTween();
    const start = { px: event.clientX, py: event.clientY, x: viewRef.current.x, y: viewRef.current.y };
    const svg = svgRef.current;
    draggedRef.current = false;
    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - start.px;
      const dy = move.clientY - start.py;
      if (!draggedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      draggedRef.current = true;
      svg?.classList.add('grabbing');
      viewRef.current = { ...viewRef.current, x: start.x + dx, y: start.y + dy };
      paint();
    };
    const onUp = () => {
      svg?.classList.remove('grabbing');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [paint, stopTween]);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    stopTween();
    const view = viewRef.current;
    const k = clamp(view.k * factor, minZoom, maxZoom);
    viewRef.current = { x: cx - (cx - view.x) * (k / view.k), y: cy - (cy - view.y) * (k / view.k), k };
    paint();
  }, [maxZoom, minZoom, paint, stopTween]);

  const zoomCenter = useCallback((factor: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (box) zoomAt(factor, box.width / 2, box.height / 2);
  }, [zoomAt]);

  // React attaches wheel listeners as passive, and zooming has to keep the wheel from reaching the page
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const box = svg.getBoundingClientRect();
      zoomAt(event.deltaY < 0 ? 1.1 : 0.9, event.clientX - box.left, event.clientY - box.top);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  useEffect(() => stopTween, [stopTween]);

  return { svgRef, worldRef, sweepRef, viewRef, draggedRef, paint, setView, glideTo, onPointerDown, zoomCenter };
}
