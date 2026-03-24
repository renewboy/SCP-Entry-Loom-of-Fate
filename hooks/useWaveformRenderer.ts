import { useEffect, useRef } from 'react';

interface UseWaveformRendererOptions {
  stability: number;
  isPlaying: boolean;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ============================================================
// Main Hook: Audio Spectrum Visualizer Style
// ============================================================
export function useWaveformRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  { stability, isPlaying }: UseWaveformRendererOptions
) {
  const ampsRef = useRef<number[]>([]);
  const targetsRef = useRef<number[]>([]);

  // Debug toggle injected directly onto the window object for easy console access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__DEBUG_WAVEFORM_ENABLED = true;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let frameCount = 0;
    let lastRenderTime = 0;
    const TARGET_FPS = 30;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();
    const ro = new ResizeObserver(() => resizeCanvas());
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const render = (currentTime: number) => {
      // Respect debug toggle
      if ((window as any).__DEBUG_WAVEFORM_ENABLED === false) {
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         rafId = requestAnimationFrame(render);
         return;
      }

      if (document.hidden) { 
        rafId = requestAnimationFrame(render); 
        return; 
      }

      // Throttle framerate to 30 FPS
      if (currentTime - lastRenderTime < FRAME_INTERVAL) {
        rafId = requestAnimationFrame(render);
        return;
      }
      lastRenderTime = currentTime;

      const width = parseFloat(canvas.style.width) || 300;
      const height = parseFloat(canvas.style.height) || 40;
      const midY = height / 2;

      // 1. Instability calculation (Direct, no interpolation)
      const instability = 100 - stability;
      const inst = clamp01(instability / 100);
      const chaos = inst * inst;

      // 2. Get global accent color dynamically
      // GameScreen sets --theme-accent on the root element
      const computedStyle = getComputedStyle(document.documentElement);
      let accent = computedStyle.getPropertyValue('--theme-accent').trim();
      
      // Fallback color if the variable is not found
      if (!accent) {
         accent = '#33ff00';
      } else if (!accent.startsWith('#') && !accent.startsWith('rgb')) {
         // Some themes define --theme-accent as "0 255 0", convert to rgb
         if (accent.split(' ').length >= 3) {
            accent = `rgb(${accent.split(' ').join(',')})`;
         } else {
            accent = `#${accent}`; // Fallback heuristic
         }
      }

      // 3. Layout Bars (Frequency Bins)
      const barWidth = 4;
      const barGap = 2;
      const step = barWidth + barGap;
      const numBars = Math.floor(width / step);
      const startX = (width - numBars * step) / 2;

      // Resize arrays if canvas size changes
      if (ampsRef.current.length !== numBars) {
        ampsRef.current = new Array(numBars).fill(0);
        targetsRef.current = new Array(numBars).fill(0);
      }

      const amps = ampsRef.current;
      const targets = targetsRef.current;

      // 4. Update Targets (Driven strictly by Hume Field Stability)
      // inst = 0   => Stability 100 (Stable)
      // inst = 0.3 => Stability 70  (Fluctuating threshold)
      // inst = 0.7 => Stability 30  (Critical threshold)
      const time = Date.now() / 1000;
      const speed = lerp(2, 15, inst);
      const ampScale = lerp(0.15, 0.95, inst);
      
      // Noise scales up only after stability drops below 70 (inst > 0.3)
      const noiseScale = inst > 0.3 ? lerp(0, 0.8, (inst - 0.3) / 0.7) : 0;
      // Extreme spikes only appear when stability drops below 30 (inst > 0.7)
      const spikeProb = inst > 0.7 ? lerp(0, 0.15, (inst - 0.7) / 0.3) : 0;

      const maxHeight = height * 0.85;

      for (let i = 0; i < numBars; i++) {
        const nx = i / numBars; // 0.0 to 1.0
        // Hanning window to taper the edges smoothly
        const envelope = Math.pow(Math.sin(nx * Math.PI), 0.8);

        // Base low-frequency wave (always present, slow and smooth when stable)
        const wave1 = Math.sin(nx * Math.PI * lerp(3, 8, inst) + time * speed) * 0.5 + 0.5;
        
        // Mid-frequency wave (fades in and speeds up as instability increases)
        const wave2 = Math.sin(nx * Math.PI * lerp(5, 25, inst) - time * speed * 1.5) * 0.5 + 0.5;
        
        // Combine waves smoothly
        let v = wave1 * lerp(1, 0.4, inst) + wave2 * lerp(0, 0.6, inst);
        
        // Add chaotic noise when fluctuating (< 70)
        if (noiseScale > 0) {
            const noise = Math.random();
            v = lerp(v, noise, noiseScale);
        }
        
        let target = v * maxHeight * ampScale;
        
        // Add extreme spikes in critical state (< 30)
        if (spikeProb > 0 && Math.random() < spikeProb) {
            target = maxHeight * (0.8 + Math.random() * 0.2);
        }

        targets[i] = target * envelope;
      }

      // 5. Clear canvas
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, width, height);

      // 6. Draw center zero-line
      ctx.save();
      ctx.strokeStyle = `${accent}30`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(width, midY); ctx.stroke();
      ctx.restore();

      // 7. Draw Frequency Bars
      // Glow increases purely based on instability
      // With 30FPS cap, we can safely restore the higher blur values for better visual effect
      const baseBlur = lerp(0, 15, inst);

      // We optimize by grouping all bar drawing into a single path.
      // This vastly reduces the number of draw calls per frame.
      ctx.save();
      ctx.fillStyle = accent;
      
      if (baseBlur > 0) {
          ctx.shadowColor = accent;
          ctx.shadowBlur = baseBlur;
      }

      // Lerp speed: smooth when stable, twitchy when critical
      const lerpSpeed = lerp(0.1, 0.5, inst);

      ctx.beginPath();
      for (let i = 0; i < numBars; i++) {
        amps[i] = lerp(amps[i], targets[i], lerpSpeed);
        
        let h = Math.max(2, amps[i]); // Minimum height
        
        // Horizontal glitch offset (only when critical < 30)
        let xOffset = 0;
        if (inst > 0.7 && Math.random() < (inst - 0.7)) {
          xOffset = (Math.random() - 0.5) * 8;
        }

        const x = startX + i * step + xOffset;
        
        // Using rect instead of roundRect in a single path is much faster.
        // For a pixelated/cyberpunk feel, standard rect is fine.
        ctx.rect(x, midY - h / 2, barWidth - 1, h);
      }
      ctx.fill();
      ctx.restore();

      // 8. Static noise particles (Optimized into a single path)
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = 'rgba(255,255,255,1)';
      const pCount = Math.floor(10 * (1 + chaos * 6));
      ctx.beginPath();
      for (let i = 0; i < pCount; i++) {
        const w = Math.random() < 0.1 ? 2 : 1;
        ctx.rect(Math.random() * width, Math.random() * height, w, 1);
      }
      ctx.fill();
      ctx.restore();

      frameCount++;
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => { 
      cancelAnimationFrame(rafId); 
      ro.disconnect(); 
    };
  }, [stability, isPlaying, canvasRef]);
}
