import React, { useState, useEffect } from 'react';

interface TutorialStep {
  targetId?: string; // ID of the element to highlight (optional)
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'center';
}

interface TutorialOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  t: (key: string) => string;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ isVisible, onClose, t }) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Define steps
  const steps: TutorialStep[] = [
    {
      title: t('tutorial.welcome_title'),
      content: t('tutorial.welcome_desc'),
      position: 'center'
    },
    {
      targetId: 'stability-meter',
      title: t('tutorial.stability_title'),
      content: t('tutorial.stability_desc'),
      position: 'top'
    },
    {
      targetId: 'chat-area',
      title: t('tutorial.narrative_title'),
      content: t('tutorial.narrative_desc'),
      position: 'center'
    },
    {
      targetId: 'input-area',
      title: t('tutorial.input_title'),
      content: t('tutorial.input_desc'),
      position: 'bottom'
    },
    {
      title: t('tutorial.tips_title'),
      content: t('tutorial.tips_desc'),
      position: 'center'
    }
  ];

  useEffect(() => {
    if (isVisible) {
      setCurrentStep(0);
    }
  }, [isVisible]);

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

  // Calculate position classes
  let positionClass = "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"; // default center
  if (step.position === 'top') positionClass = "top-24 left-1/2 transform -translate-x-1/2";
  if (step.position === 'bottom') positionClass = "bottom-24 left-1/2 transform -translate-x-1/2";

  return (
    <div className={`fixed inset-0 z-[202] flex items-center justify-center ${hasTarget ? 'bg-transparent pointer-events-none' : 'bg-black/70 backdrop-blur-sm pointer-events-auto'}`}>
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

      <div className={`absolute ${positionClass} w-[90%] max-w-md bg-black border border-scp-term p-6 shadow-[0_0_30px_rgba(0,255,0,0.2)] animate-in fade-in zoom-in-95 duration-300 pointer-events-auto`}>
        {/* CRT Scanline effect for the modal */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,0,0.03)_3px)] pointer-events-none"></div>
        
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
      </div>
    </div>
  );
};

export default TutorialOverlay;
