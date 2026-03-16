import { useEffect, useRef, useMemo } from 'react';

interface UseWaveformRendererOptions {
  stability: number;
  isPlaying: boolean;
}

/**
 * Extracted waveform canvas rendering logic from StabilityMonitor.
 * Renders the waveform animation onto a given canvas element.
 * The canvas will fill its parent container (uses ResizeObserver).
 */
export function useWaveformRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  { stability, isPlaying }: UseWaveformRendererOptions
) {
  const phaseRef = useRef(0);
  const driftRef = useRef(0);
  const spikeRef = useRef<{ x: number; amp: number } | null>(null);

  const instability = 100 - stability;

  const accentColor = useMemo(() => {
    if (stability > 70) return '#2bdc6b';
    if (stability > 30) return '#f59e0b';
    return '#ef4444';
  }, [stability]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    // --- ResizeObserver to dynamically size canvas ---
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const cssWidth = rect.width;
      const cssHeight = rect.height;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();

    const ro = new ResizeObserver(() => resizeCanvas());
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    // --- Rendering logic (unchanged from StabilityMonitor) ---
    const instabilityRatio = Math.max(0, Math.min(1, instability / 100));
    const baseAmp = 3.5 + instabilityRatio * 18.0;
    const chaos = instabilityRatio * instabilityRatio;
    const speed = 0.08 + instabilityRatio * 0.25;
    const gridStep = 10;

    const render = () => {
      const cssWidth = parseFloat(canvas.style.width) || 164;
      const cssHeight = parseFloat(canvas.style.height) || 40;
      const width = cssWidth;
      const height = cssHeight;

      phaseRef.current += speed;
      const phase = phaseRef.current;
      const targetDrift = Math.sin(phase * 0.7) * (2 + instabilityRatio * 6);
      driftRef.current = driftRef.current * 0.92 + targetDrift * 0.08;

      if (instabilityRatio > 0.6) {
        const hasSpike = spikeRef.current !== null;
        if (!hasSpike && Math.random() < 0.05 + chaos * 0.08) {
          spikeRef.current = { x: Math.random() * width, amp: (8 + Math.random() * 22) * chaos };
        }
      }

      if (spikeRef.current) {
        spikeRef.current.amp *= 0.94;
        if (spikeRef.current.amp < 0.8) {
          spikeRef.current = null;
        }
      }

      ctx.clearRect(0, 0, width, height);

      // Background — semi-transparent for header overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
        ctx.stroke();
      }
      ctx.restore();

      // Waveform points
      const points: { x: number; y: number }[] = [];
      const midY = height / 2;
      for (let x = 0; x <= width; x += 2) {
        const nx = x / width;
        const t = nx * Math.PI * 2;
        const band1 = Math.sin(t * 3.5 + phase * 1.5) * baseAmp;
        const band2 = Math.sin(t * (7.0 + instabilityRatio * 6.0) + phase * 2.5) * (baseAmp * (0.25 + 0.75 * chaos));
        const band3 = Math.sin(t * (14.0 + instabilityRatio * 15.0) + phase * 4.2) * (baseAmp * (0.1 + 0.5 * chaos));
        const jag = Math.sin(t * 25 + phase * 10.0) * (baseAmp * 0.15 * chaos);
        let y = midY + driftRef.current * 0.12 + band1 + band2 + band3 + jag;

        if (spikeRef.current) {
          const dx = (x - spikeRef.current.x) / 12;
          const spike = Math.exp(-dx * dx) * spikeRef.current.amp;
          y -= spike;
        }

        y = Math.max(2, Math.min(height - 2, y));
        points.push({ x, y });
      }

      const accent = accentColor;
      const accentGlow = 'rgba(255,255,255,0.25)';
      const strokeGradient = ctx.createLinearGradient(0, 0, width, 0);
      strokeGradient.addColorStop(0, 'rgba(255,255,255,0.25)');
      strokeGradient.addColorStop(0.15, accent);
      strokeGradient.addColorStop(0.85, accent);
      strokeGradient.addColorStop(1, 'rgba(255,255,255,0.15)');

      const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
      fillGradient.addColorStop(0, 'rgba(255,255,255,0.08)');
      fillGradient.addColorStop(0.2, `${accent}33`);
      fillGradient.addColorStop(0.6, `${accent}11`);
      fillGradient.addColorStop(1, 'rgba(0,0,0,0)');

      // Fill area
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = fillGradient;
      ctx.beginPath();
      ctx.moveTo(points[0].x, height);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 3D shadow
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      points.forEach((p, idx) => {
        const ox = 1.5;
        const oy = 2.5;
        if (idx === 0) ctx.moveTo(p.x + ox, p.y + oy);
        else ctx.lineTo(p.x + ox, p.y + oy);
      });
      ctx.stroke();
      ctx.restore();

      // Inner glow
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = accentGlow;
      ctx.lineWidth = 4;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y - 1);
        else ctx.lineTo(p.x, p.y - 1);
      });
      ctx.stroke();
      ctx.restore();

      // Main line
      ctx.save();
      ctx.strokeStyle = strokeGradient;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.restore();

      // Center line
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY + 0.5);
      ctx.lineTo(width, midY + 0.5);
      ctx.stroke();
      ctx.restore();

      // Noise particles
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = 'rgba(255,255,255,1)';
      for (let i = 0; i < 16 + Math.floor(18 * instabilityRatio); i += 1) {
        const px = Math.random() * width;
        const py = Math.random() * height;
        ctx.fillRect(px, py, 1, 1);
      }
      ctx.restore();

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [accentColor, instability, stability, canvasRef]);
}
