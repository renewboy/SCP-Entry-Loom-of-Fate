import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../utils/i18n';

interface TransitionOverlayProps {
    isVisible: boolean;
    onComplete: () => void;
    allowSkip?: boolean;
    title: string;
    steps: { text: string; delay: number }[];
    countdownDuration?: number; // seconds
    children?: React.ReactNode; // For extra content like checkboxes
}

const TransitionOverlay: React.FC<TransitionOverlayProps> = ({
    isVisible,
    onComplete,
    allowSkip = false,
    title,
    steps,
    countdownDuration = 0,
    children
}) => {
    const { t } = useTranslation();
    const [currentStep, setCurrentStep] = useState(0);
    const [countdown, setCountdown] = useState(countdownDuration);
    const [isFadingOut, setIsFadingOut] = useState(false);

    // Reset state when becomes visible
    useEffect(() => {
        if (isVisible) {
            setCurrentStep(0);
            setCountdown(countdownDuration);
            setIsFadingOut(false);
        }
    }, [isVisible, countdownDuration]);

    // Handle Steps
    useEffect(() => {
        if (!isVisible) return;
        
        const timers: NodeJS.Timeout[] = [];
        steps.forEach((step, index) => {
            timers.push(setTimeout(() => {
                setCurrentStep(prev => Math.max(prev, index + 1));
            }, step.delay));
        });

        return () => timers.forEach(clearTimeout);
    }, [isVisible, steps]);

    // Handle Countdown
    useEffect(() => {
        if (!isVisible || countdown <= 0 || isFadingOut) return;

        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleFinish();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isVisible, countdown, isFadingOut]);

    const handleFinish = () => {
        setIsFadingOut(true);
        setTimeout(() => {
            onComplete();
        }, 800);
    };

    const handleSkip = () => {
        if (allowSkip && !isFadingOut) {
            handleFinish();
        }
    };

    if (!isVisible && !isFadingOut) return null;

    return (
        <div 
            className={`absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity duration-700 ${isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            onClick={handleSkip}
        >
            <style>
                {`
                @keyframes tp-glitch-shift {
                    0% { transform: translate(0, 0); opacity: 0.4; }
                    20% { transform: translate(-1px, -1px); opacity: 0.6; }
                    40% { transform: translate(1px, 1px); opacity: 0.35; }
                    60% { transform: translate(-2px, 0); opacity: 0.55; }
                    80% { transform: translate(2px, -1px); opacity: 0.3; }
                    100% { transform: translate(0, 0); opacity: 0.4; }
                }
                @keyframes tp-glitch-slice {
                    0% { clip-path: inset(0 0 0 0); }
                    25% { clip-path: inset(10% 0 60% 0); }
                    50% { clip-path: inset(40% 0 30% 0); }
                    75% { clip-path: inset(65% 0 10% 0); }
                    100% { clip-path: inset(0 0 0 0); }
                }
                @keyframes tp-wave {
                    0% { transform: translateY(0); }
                    50% { transform: translateY(-2px); }
                    100% { transform: translateY(0); }
                }
                .tp-glitch-shell {
                    position: relative;
                    animation: tp-glitch-shift 1.4s steps(2, end) infinite;
                    box-shadow: 0 0 24px rgba(255, 64, 64, 0.2);
                }
                .tp-glitch {
                    position: relative;
                    display: inline-block;
                    animation: tp-wave 1.6s ease-in-out infinite;
                    text-shadow: 0 0 6px rgba(255, 64, 64, 0.25);
                }
                .tp-glitch::before,
                .tp-glitch::after {
                    content: attr(data-text);
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                }
                .tp-glitch::before {
                    color: rgba(255, 64, 64, 0.7);
                    animation: tp-glitch-shift 1.1s steps(2, end) infinite, tp-glitch-slice 2.2s steps(3, end) infinite;
                }
                .tp-glitch::after {
                    color: rgba(64, 255, 255, 0.7);
                    animation: tp-glitch-shift 0.9s steps(2, end) infinite reverse, tp-glitch-slice 1.8s steps(3, end) infinite reverse;
                }
                @media (prefers-reduced-motion: reduce) {
                    .tp-glitch,
                    .tp-glitch-shell,
                    .tp-glitch::before,
                    .tp-glitch::after {
                        animation: none;
                    }
                }
            `}
            </style>

            <div 
                className="w-full max-w-lg space-y-4 p-8 border-l-4 border-r-4 border-scp-alert bg-black/50 backdrop-blur-sm relative"
                onClick={(e) => e.stopPropagation()} // Prevent skip when clicking inside the box
            >
                {/* Countdown Display */}
                {countdown > 0 && (
                    <div className="absolute top-2 right-4 font-mono text-xl text-scp-alert font-bold">
                        0{countdown}
                    </div>
                )}
                
                {/* Title */}
                <div className="text-scp-alert font-report text-3xl font-bold tracking-[0.2em] text-center animate-pulse">
                    <span className="tp-glitch" data-text={title}>
                        {title}
                    </span>
                </div>
                
                {/* Progress Bar */}
                <div className="h-2 w-full bg-gray-900 overflow-hidden relative border border-gray-800">
                    <div className={`h-full bg-scp-alert transition-all duration-1000 ease-out ${currentStep >= 1 ? 'w-full' : 'w-0'}`}></div>
                </div>

                {/* Steps Text */}
                <div className="space-y-1 text-xs text-scp-alert/70 font-mono text-center h-8">
                    {steps.map((step, index) => (
                        <div key={index} className={currentStep >= index + 1 ? 'block' : 'hidden'}>
                            <span className="tp-glitch" data-text={`> ${step.text}`}>
                                &gt; {step.text}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Extra Children (e.g. Checkbox) */}
                {children && (
                    <div className="mt-6 pt-4 border-t border-gray-800">
                        {children}
                    </div>
                )}
                
                {/* Skip Hint */}
                {allowSkip && (
                    <div className="absolute -bottom-8 left-0 right-0 text-center text-[10px] text-gray-500 animate-pulse cursor-pointer">
                        [ {t('entity_profile.click_to_skip') || "CLICK ANYWHERE TO SKIP"} ]
                    </div>
                )}
            </div>
        </div>
    );
};

export default TransitionOverlay;
