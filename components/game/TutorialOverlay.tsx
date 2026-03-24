import React, { useMemo, useRef, useState, useEffect } from 'react';
import CrtSurface from '../common/CrtSurface';

interface TutorialStep {
  targetId?: string; // ID of the element to highlight (optional)
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'center' | 'left' | 'right';
}

interface TutorialOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  t: (key: string) => string;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ isVisible, onClose, t }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelSize, setPanelSize] = useState<{ width: number; height: number } | null>(null);

  // Define steps
  const steps: TutorialStep[] = useMemo(() => ([
    {
      title: t('tutorial.welcome_title'),
      content: t('tutorial.welcome_desc'),
      position: 'center'
    },
    {
      targetId: 'stability-monitor-ui',
      title: t('tutorial.stability_title'),
      content: t('tutorial.stability_desc'),
      position: 'bottom'
    },
    {
      targetId: 'map-panel',
      title: t('tutorial.map_title'),
      content: t('tutorial.map_desc'),
      position: 'left'
    },
    {
      targetId: 'chat-area',
      title: t('tutorial.narrative_title'),
      content: t('tutorial.narrative_desc'),
      position: 'top'
    },
    {
      targetId: 'input-area',
      title: t('tutorial.input_title'),
      content: t('tutorial.input_desc'),
      position: 'top'
    },
    {
      targetId: 'game-settings-button',
      title: t('tutorial.settings_title'),
      content: t('tutorial.settings_desc'),
      position: 'bottom'
    },
    {
      title: t('tutorial.tips_title'),
      content: t('tutorial.tips_desc'),
      position: 'center'
    }
  ]), [t]);

  useEffect(() => {
    if (isVisible) {
      setCurrentStep(0);
    }
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const step = steps[currentStep];
    if (!step?.targetId) {
      setTargetRect(null);
      return;
    }
    const update = () => {
      const el = document.getElementById(step.targetId as string);
      if (!el) {
        setTargetRect(null);
        return;
      }
      setTargetRect(el.getBoundingClientRect());
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isVisible, currentStep, steps]);

  useEffect(() => {
    if (!isVisible) return;
    const rafId = window.requestAnimationFrame(() => {
      const node = panelRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (rect.width && rect.height) {
        setPanelSize({ width: rect.width, height: rect.height });
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isVisible, currentStep, targetRect, steps]);

  useEffect(() => {
    if (!isVisible) return;
    const step = steps[currentStep];
    if (!step?.targetId) return;
    const el = document.getElementById(step.targetId as string);
    if (!el) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
      }
    }
  }, [isVisible, currentStep, steps]);

  if (!isVisible) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const hasTarget = !!step.targetId;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const computeFloatingStyle = (): React.CSSProperties | undefined => {
    if (typeof window === 'undefined') return undefined;
    const margin = 16;
    const padding = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxWidth = Math.min(420, Math.floor(vw * 0.9));
    const width = panelSize?.width || maxWidth;
    const height = panelSize?.height || 240;
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    if (!hasTarget || !targetRect) {
      const left = clamp(vw / 2 - width / 2, padding, vw - padding - width);
      const top = clamp(vh / 2 - height / 2, padding, vh - padding - height);
      return { left, top, width, position: 'absolute' };
    }

    const centerX = targetRect.left + targetRect.width / 2;
    const centerY = targetRect.top + targetRect.height / 2;

    const spaceTop = targetRect.top - margin;
    const spaceBottom = vh - targetRect.bottom - margin;
    const spaceLeft = targetRect.left - margin;
    const spaceRight = vw - targetRect.right - margin;

    const preferred = step.position || 'center';
    const fits = (pos: TutorialStep['position']) => {
      if (pos === 'top') return spaceTop >= height;
      if (pos === 'bottom') return spaceBottom >= height;
      if (pos === 'left') return spaceLeft >= width;
      if (pos === 'right') return spaceRight >= width;
      return true;
    };
    const pickBest = (): TutorialStep['position'] => {
      if (fits(preferred)) return preferred;
      const candidates: TutorialStep['position'][] = ['bottom', 'top', 'right', 'left', 'center'];
      for (const c of candidates) {
        if (fits(c)) return c;
      }
      return 'center';
    };
    const pos = pickBest();

    let left = vw / 2 - width / 2;
    let top = vh / 2 - height / 2;

    if (pos === 'top') {
      left = centerX - width / 2;
      top = targetRect.top - margin - height;
    } else if (pos === 'bottom') {
      left = centerX - width / 2;
      top = targetRect.bottom + margin;
    } else if (pos === 'left') {
      left = targetRect.left - margin - width;
      top = centerY - height / 2;
    } else if (pos === 'right') {
      left = targetRect.right + margin;
      top = centerY - height / 2;
    } else {
      left = centerX - width / 2;
      top = centerY - height / 2;
    }

    left = clamp(left, padding, vw - padding - width);
    top = clamp(top, padding, vh - padding - height);
    return { left, top, width, position: 'absolute' };
  };

  return (
    <div className={`fixed inset-0 z-[202] ${hasTarget ? 'bg-transparent pointer-events-none' : 'bg-black/70 backdrop-blur-sm pointer-events-auto'} scp-ui`}>
      {/* Highlight Effect (Simulated) */}
      {step.targetId && (
        <style>
          {`
            #${step.targetId} {
              position: relative;
              z-index: 201;
              box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 255, 255, 0.2);
              border-color: rgba(255, 255, 255, 0.5);
            }
          `}
        </style>
      )}

      <div ref={panelRef} style={computeFloatingStyle()} className="pointer-events-auto">
        <CrtSurface className="w-[90vw] max-w-md scp-window border border-scp-term p-6 shadow-[0_0_30px_rgba(0,255,0,0.2)] animate-in fade-in zoom-in-95 duration-300">
          <div className="flex justify-between items-start mb-4 border-b border-scp-term/30 pb-2">
            <h3 className="text-xl font-report text-scp-term tracking-widest uppercase">{step.title}</h3>
            <span className="text-xs font-mono text-scp-term/50">STEP {currentStep + 1}/{steps.length}</span>
          </div>
          
          <p className="font-mono text-sm text-gray-300 leading-relaxed mb-8">
            {step.content}
          </p>

          <div className="flex justify-between items-center">
            <button 
              onClick={handleSkip}
              className="text-xs font-mono text-gray-500 hover:text-gray-300 underline decoration-dotted"
            >
              {t('tutorial.skip')}
            </button>
            
            <button 
              onClick={handleNext}
              className="px-6 py-2 bg-scp-term text-black font-bold font-mono text-xs hover:bg-white transition-colors shadow-[0_0_10px_rgba(0,255,0,0.4)]"
            >
              {isLastStep ? t('tutorial.finish') : t('tutorial.next')}
            </button>
          </div>
        </CrtSurface>
      </div>
    </div>
  );
};

export default TutorialOverlay;
