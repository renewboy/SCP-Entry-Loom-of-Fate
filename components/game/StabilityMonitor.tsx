import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameAudio } from '../../hooks/useGameAudio';
import { useGlitchEffect } from '../../hooks/useGlitchEffect';
import VisualEffects from './VisualEffects';
import { useTranslation } from '../../utils/i18n';

interface StabilityMonitorProps {
  stability: number;
  isPlaying: boolean;
  isMemoryEchoActive: boolean;
}

const StabilityMonitor: React.FC<StabilityMonitorProps> = ({ stability, isPlaying, isMemoryEchoActive }) => {
  const { t } = useTranslation();
  const prevStabilityRef = useRef(stability);
  const [delta, setDelta] = useState<{ val: number; id: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);
  const driftRef = useRef(0);
  const spikeRef = useRef<{ x: number; amp: number } | null>(null);

  // --- Visual & Audio Logic Calculation ---
  const instability = 100 - stability;
  
  // Audio: Critical State
  const isCritical = useGameAudio(stability, isPlaying);

  // Visual: Glitch & Noise
  const isGlitching = useGlitchEffect(stability, isPlaying);

  const noiseOpacity = Math.min(Math.max((instability - 20) / 140, 0), 0.5);
  const distortionScale = instability > 30 ? Math.min((instability - 30) * 0.5, 30) : 0;

  // --- Delta UI Logic ---
  useEffect(() => {
    const diff = stability - prevStabilityRef.current;
    if (diff !== 0) {
      setDelta({ val: diff, id: Date.now() });
      // Reset delta display after animation
      const timer = setTimeout(() => setDelta(null), 2000);
      return () => clearTimeout(timer);
    }
    prevStabilityRef.current = stability;
  }, [stability]);

  const getStabilityColor = () => {
    if (stability > 70) return 'text-scp-term_fix';
    if (stability > 30) return 'text-yellow-500';
    return 'text-scp-accent'; // Red
  };

  const getKantCounterLabel = () => {
     if (stability > 70) return t('game.stable');
     if (stability > 30) return t('game.fluctuating');
     return t('game.critical');
  };

  const humeValue = (stability / 100) * 2.0;
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
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const cssWidth = 164;
    const cssHeight = 40;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = cssWidth;
    const height = cssHeight;
    const gridStep = 10;
    const instabilityRatio = Math.max(0, Math.min(1, instability / 100));
    // 增加振幅基数和波动性乘数
    const baseAmp = 3.5 + instabilityRatio * 18.0; 
    const chaos = instabilityRatio * instabilityRatio;
    // 显著增加波动速度（频率）
    const speed = 0.08 + instabilityRatio * 0.25; 

    const render = () => {
      phaseRef.current += speed;
      const phase = phaseRef.current;
      const targetDrift = Math.sin(phase * 0.7) * (2 + instabilityRatio * 6);
      driftRef.current = driftRef.current * 0.92 + targetDrift * 0.08;

      if (instabilityRatio > 0.6) {
        const hasSpike = spikeRef.current !== null;
        if (!hasSpike && Math.random() < 0.05 + chaos * 0.08) { // 增加尖峰概率
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

      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.fillRect(0, 0, width, height);

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

      const points: { x: number; y: number }[] = [];
      const midY = height / 2;
      for (let x = 0; x <= width; x += 2) {
        const nx = x / width;
        const t = nx * Math.PI * 2;
        // 增加频率系数，使波形更密集
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
      const accentGlow = 'rgba(255,255,255,0.25)'; // 增强高光不透明度
      const strokeGradient = ctx.createLinearGradient(0, 0, width, 0);
      strokeGradient.addColorStop(0, 'rgba(255,255,255,0.25)');
      strokeGradient.addColorStop(0.15, accent);
      strokeGradient.addColorStop(0.85, accent);
      strokeGradient.addColorStop(1, 'rgba(255,255,255,0.15)');

      const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
      fillGradient.addColorStop(0, 'rgba(255,255,255,0.08)'); // 增强填充顶部亮度，营造立体感
      fillGradient.addColorStop(0.2, `${accent}33`); // 增加不透明度 1A -> 33
      fillGradient.addColorStop(0.6, `${accent}11`);
      fillGradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.save();
      ctx.globalAlpha = 0.85; // 增加填充整体不透明度
      ctx.fillStyle = fillGradient;
      ctx.beginPath();
      ctx.moveTo(points[0].x, height);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 3D 阴影层 (偏移并加深颜色)
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      points.forEach((p, idx) => {
        const ox = 1.5; // 增加阴影偏移
        const oy = 2.5;
        if (idx === 0) ctx.moveTo(p.x + ox, p.y + oy);
        else ctx.lineTo(p.x + ox, p.y + oy);
      });
      ctx.stroke();
      ctx.restore();

      // 内发光/边缘高光层
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = accentGlow;
      ctx.lineWidth = 4; // 减小高光宽度使其更锐利
      ctx.shadowColor = accent;
      ctx.shadowBlur = 8; // 增加发光
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y - 1); // 稍微上移高光层
        else ctx.lineTo(p.x, p.y - 1);
      });
      ctx.stroke();
      ctx.restore();

      // 主线条
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

      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY + 0.5);
      ctx.lineTo(width, midY + 0.5);
      ctx.stroke();
      ctx.restore();

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
    return () => cancelAnimationFrame(rafId);
  }, [accentColor, instability, stability]);

  return (
    <>
      {/* 1. Portal for Visual Effects (Full Screen Overlay) */}
      {typeof document !== 'undefined' && createPortal(
        <VisualEffects 
            isCritical={isCritical}
            isGlitching={isGlitching}
            isMemoryEcho={isMemoryEchoActive}
            noiseOpacity={noiseOpacity}
            distortionScale={distortionScale}
            showNoise={isPlaying}
        />,
        document.body
      )}

      {/* 2. UI Component (Rendered where this component is placed) */}
      <div className="flex flex-col select-none" id="stability-monitor-ui">
        <div className="flex items-center gap-3 relative">
          <div className="flex flex-col gap-2">
            <div className="relative flex items-baseline gap-3">
              <div className="flex items-baseline gap-2">
                <span className={`font-report tracking-widest uppercase shadow-black drop-shadow-md text-shadow-sm font-bold transition-colors duration-500 ${getStabilityColor()} ${isCritical ? 'animate-pulse' : ''}`}>
                   {t('game.hume_label') } {humeValue.toFixed(2)} ({stability.toFixed(0)}%) 
                </span>
                <span className={`text-[12px] font-report shadow-black drop-shadow-md text-shadow-sm font-bold leading-none ${getStabilityColor()}`}>
                    {getKantCounterLabel()}
                  </span>
              </div>
              {delta && (
                <div
                  key={delta.id}
                  className={`text-xs font-bold font-mono animate-[float-up_1s_ease-out_forwards] ${delta.val > 0 ? 'text-emerald-400' : 'text-rose-500'}`}
                >
                  {delta.val > 0 ? '+' : ''}{delta.val.toFixed(0)}%
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <canvas ref={canvasRef} className="bg-black/40 border border-scp-gray/40 rounded-sm" />
                <div className="absolute inset-0 pointer-events-none opacity-25 bg-[repeating-linear-gradient(180deg,transparent,transparent_2px,rgba(255,255,255,0.04)_3px)] rounded-sm"></div>
              </div>

              <div className="hidden sm:flex flex-col gap-1 min-w-[128px]">
                <div className="flex items-center justify-between gap-3">
                 
                
                </div>
               
              </div>
            </div>
          </div>
        </div>
        <style>{`
          @keyframes float-up {
              0% { opacity: 1; transform: translateY(0); }
              100% { opacity: 0; transform: translateY(-15px); }
          }
        `}</style>
      </div>
    </>
  );
};

export default StabilityMonitor;
