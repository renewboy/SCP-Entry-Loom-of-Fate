import React, { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../utils/i18n';
import { loadGlobalSettings, saveGlobalSettings } from '../services/indexedDBService';
import { GlobalSettings } from '../types';

interface GlobalSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({ isOpen, onClose }) => {
    const { t, language } = useTranslation();
    const [settings, setSettings] = useState<GlobalSettings | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadGlobalSettings().then(setSettings);
        }
    }, [isOpen]);

    const handleToggle = (key: keyof GlobalSettings) => {
        if (!settings) return;
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);
        saveGlobalSettings(newSettings);
    };

    if (!isOpen || !settings) return null;

    // Use i18n for labels
    const getLabel = (key: keyof GlobalSettings) => {
        const keyMap: Record<keyof GlobalSettings, string> = {
            enableSceneImages: 'settings.scene_images',
            enableBackgroundImages: 'settings.bg_images',
            enableEntityImages: 'settings.entity_images'
        };
        return t(keyMap[key]);
    };

    const content = (
        <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-mono">
            {/* CRT Scanline Effect Overlay */}
            <div className="pointer-events-none absolute inset-0 z-0 opacity-10" style={{
                backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 0, 0, 0.02), rgba(0, 0, 255, 0.06))',
                backgroundSize: '100% 2px, 3px 100%'
            }}></div>

            <div className="bg-black border border-scp-accent/50 w-full max-w-lg shadow-2xl flex flex-col relative overflow-hidden z-10">
                
                {/* Header */}
                <div className="bg-black h-14 w-full flex items-center justify-between px-6 border-b border-scp-gray relative z-20 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-scp-accent rounded-full animate-pulse"></div>
                        <span className="font-report text-xl tracking-widest text-scp-text uppercase shadow-black drop-shadow-md text-shadow-sm">
                            {t('settings.title') || (language === 'zh' ? '系统设置' : 'SYSTEM SETTINGS')}
                        </span>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-gray-400 hover:text-white transition-colors text-2xl border border-gray-600/50 hover:border-white rounded-sm w-8 h-8 flex items-center justify-center"
                    >
                        ×
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        {(Object.keys(settings) as Array<keyof GlobalSettings>).map((key) => (
                            <div key={key} className="flex items-center justify-between p-4 border border-scp-gray/30 bg-scp-gray/10 hover:border-scp-accent/30 transition-colors">
                                <span className="text-sm text-scp-text font-mono uppercase tracking-wider">
                                    {getLabel(key)}
                                </span>
                                <button
                                    onClick={() => handleToggle(key)}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out relative ${
                                        settings[key] ? 'bg-scp-accent' : 'bg-gray-700'
                                    }`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                                        settings[key] ? 'translate-x-6' : 'translate-x-0'
                                    }`}></div>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body) as ReactNode;
};

export default GlobalSettingsModal;
