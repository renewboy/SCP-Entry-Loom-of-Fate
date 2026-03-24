import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type ViewportPreset = 'auto' | 'mobile' | 'tablet';

const STORAGE_KEY = 'scp.viewportSimulator';
const EMBED_PARAM = 'viewportSimEmbed';

const readInitialPreset = (): { preset: ViewportPreset; landscape: boolean } => {
  if (typeof window === 'undefined') return { preset: 'auto', landscape: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { preset: 'auto', landscape: false };
    const parsed = JSON.parse(raw) as { preset?: ViewportPreset; landscape?: boolean };
    const preset = (parsed.preset === 'mobile' || parsed.preset === 'tablet' || parsed.preset === 'auto') ? parsed.preset : 'auto';
    return { preset, landscape: !!parsed.landscape };
  } catch {
    return { preset: 'auto', landscape: false };
  }
};

const shouldShowSimulator = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has(EMBED_PARAM)) return false;
  return params.has('viewport') || params.has('debugViewport') || (import.meta as any)?.env?.DEV;
};

const presetLabel = (preset: ViewportPreset) => {
  if (preset === 'mobile') return 'Mobile';
  if (preset === 'tablet') return 'Tablet';
  return 'Current screen size';
};

const baseDims = (preset: ViewportPreset) => {
  if (preset === 'mobile') return { w: 390, h: 844 };
  if (preset === 'tablet') return { w: 768, h: 1024 };
  return null;
};

export const ViewportSimulator: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const enabled = shouldShowSimulator();
  const initial = useMemo(() => readInitialPreset(), []);
  const [preset, setPreset] = useState<ViewportPreset>(initial.preset);
  const [landscape, setLandscape] = useState(initial.landscape);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset, landscape }));
    } catch {
    }
  }, [preset, landscape]);

  const frame = useMemo(() => {
    const dims = baseDims(preset);
    if (!dims) return null;
    const w = landscape ? dims.h : dims.w;
    const h = landscape ? dims.w : dims.h;
    return { w, h };
  }, [preset, landscape]);

  const scale = useMemo(() => {
    if (!frame) return 1;
    if (!viewport.w || !viewport.h) return 1;
    const margin = 24;
    const s = Math.min((viewport.w - margin) / frame.w, (viewport.h - margin) / frame.h);
    return Math.max(0.1, Math.min(1, s));
  }, [frame, viewport]);

  const iframeSrc = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    url.searchParams.set(EMBED_PARAM, '1');
    url.searchParams.delete('viewport');
    url.searchParams.delete('debugViewport');
    return url.toString();
  }, []);

  const content = !enabled || !frame ? (
    <>{children}</>
  ) : (
    <div className="w-screen h-screen flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      <div
        className="relative"
        style={{
          width: frame.w,
          height: frame.h,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
        }}
      >
        <div className="relative w-full h-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.65)] bg-black">
          <iframe
            src={iframeSrc}
            className="w-full h-full"
            style={{ border: 'none' }}
            title="Viewport Simulator"
          />
        </div>
      </div>
    </div>
  );

  const toolbar = (
    <div className="fixed top-4 left-4 z-[80] flex items-center gap-2">
      <div className="relative">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="h-10 px-3 rounded-xl bg-white/90 text-black border border-black/10 shadow-sm flex items-center gap-2 hover:bg-white transition-colors"
        >
          <span className="material-icons text-[18px]">devices</span>
          <span className="text-sm font-medium">{presetLabel(preset)}</span>
          <span className="material-icons text-[18px] opacity-70">{menuOpen ? 'expand_less' : 'expand_more'}</span>
        </button>
        {menuOpen && (
          <div className="absolute mt-2 w-56 rounded-xl bg-white text-black border border-black/10 shadow-lg overflow-hidden">
            <button
              onClick={() => { setPreset('auto'); setMenuOpen(false); }}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-black/5 text-left"
            >
              <span className="material-icons text-[18px]">desktop_windows</span>
              <span className="text-sm">Current screen size</span>
            </button>
            <button
              onClick={() => { setPreset('mobile'); setMenuOpen(false); }}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-black/5 text-left"
            >
              <span className="material-icons text-[18px]">smartphone</span>
              <span className="text-sm">Mobile</span>
            </button>
            <button
              onClick={() => { setPreset('tablet'); setMenuOpen(false); }}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-black/5 text-left"
            >
              <span className="material-icons text-[18px]">tablet_mac</span>
              <span className="text-sm">Tablet</span>
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setLandscape(v => !v)}
        className="h-10 w-10 rounded-xl bg-white/90 text-black border border-black/10 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
        title="Rotate"
      >
        <span className="material-icons text-[18px]">screen_rotation</span>
      </button>

      {frame && (
        <div className="h-10 px-3 rounded-xl bg-white/70 text-black border border-black/10 shadow-sm flex items-center gap-2">
          <span className="text-xs font-mono">{frame.w}×{frame.h}</span>
          <span className="text-xs font-mono opacity-70">×{scale.toFixed(2)}</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {content}
      {enabled && typeof document !== 'undefined' ? createPortal(toolbar, document.body) : null}
    </>
  );
};
