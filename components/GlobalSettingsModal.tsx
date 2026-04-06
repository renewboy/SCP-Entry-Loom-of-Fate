import React, { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../utils/i18n';
import { loadGlobalSettings, saveGlobalSettings } from '../services/indexedDBService';
import { GlobalSettings, AISettings, AIProvider } from '../types';
import { getDefaultAISettings, validateAISettings, clearAISettingsCache } from '../services/aiConfigService';
import { testAIConnectivity } from '../services/aiConnectivityService';
import CrtSurface from './common/CrtSurface';
import { setBgmVolume } from '../services/bgmService';
import { setSfxVolume } from '../services/sfxService';
import SettingsRange from './common/SettingsRange';

interface GlobalSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'game' | 'ai';
    attention?: boolean;
}

type SettingsTab = 'game' | 'ai';

const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({ isOpen, onClose, initialTab = 'game', attention = false }) => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<GlobalSettings | null>(null);
    const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
    const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [providerOpen, setProviderOpen] = useState(false);
    const [attentionActive, setAttentionActive] = useState(false);
    const [highlightActive, setHighlightActive] = useState(false);
    const [connectivityError, setConnectivityError] = useState<string | null>(null);
    const [isTestingConnectivity, setIsTestingConnectivity] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadGlobalSettings().then(loaded => {
                setSettings(loaded);
                setBgmVolume(loaded.bgmVolume);
                setSfxVolume(loaded.sfxVolume);
                const defaults = getDefaultAISettings();
                const merged = {
                    ...defaults,
                    ...(loaded?.aiSettings || {}),
                    gemini: { ...defaults.gemini, ...(loaded?.aiSettings?.gemini || {}) },
                    openai: { ...defaults.openai, ...(loaded?.aiSettings?.openai || {}) },
                };
                setAiSettings(merged);
            });
            setActiveTab(initialTab);
            setValidationError(null);
            setConnectivityError(null);
            setSaveSuccess(false);
            setProviderOpen(false);
            setAttentionActive(attention);
            if (attention) {
                setHighlightActive(true);
                window.setTimeout(() => setHighlightActive(false), 2500);
            } else {
                setHighlightActive(false);
            }
        }
    }, [isOpen, initialTab, attention]);

    const handleToggle = (key: 'enableSceneImages' | 'enableBackgroundImages' | 'enableEntityImages' | 'enableNpcImages' | 'skipBootSequence') => {
        if (!settings) return;
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);
        saveGlobalSettings(newSettings);
    };

    const handleDifficultyChange = (difficulty: GlobalSettings['difficulty']) => {
        if (!settings) return;
        const newSettings = { ...settings, difficulty };
        setSettings(newSettings);
        saveGlobalSettings(newSettings);
    };

    const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

    const handleVolumeChange = (key: 'bgmVolume' | 'sfxVolume', value: number) => {
        if (!settings) return;
        const newSettings = { ...settings, [key]: clamp01(value) };
        setSettings(newSettings);
        saveGlobalSettings(newSettings);
        if (key === 'bgmVolume') {
            setBgmVolume(newSettings.bgmVolume);
            return;
        }
        setSfxVolume(newSettings.sfxVolume);
    };

    const handleProviderChange = (provider: AIProvider) => {
        if (!aiSettings) return;
        setAiSettings({ ...aiSettings, provider });
        setValidationError(null);
        setConnectivityError(null);
        setSaveSuccess(false);
        setProviderOpen(false);
    };

    const handleGeminiFieldChange = (field: 'apiKey' | 'chatModel' | 'imageModel', value: string) => {
        if (!aiSettings) return;
        setAiSettings({
            ...aiSettings,
            gemini: { ...aiSettings.gemini, [field]: value }
        });
        setValidationError(null);
        setConnectivityError(null);
        setSaveSuccess(false);
    };

    const handleOpenAIFieldChange = (field: 'apiKey' | 'baseUrl' | 'chatModel' | 'imageModel', value: string) => {
        if (!aiSettings) return;
        setAiSettings({
            ...aiSettings,
            openai: { ...aiSettings.openai, [field]: value }
        });
        setValidationError(null);
        setConnectivityError(null);
        setSaveSuccess(false);
    };

    const handleSaveAI = async () => {
        if (!aiSettings || !settings) return;
        
        const validation = validateAISettings(aiSettings);
        if (!validation.valid) {
            setValidationError(t('settings.ai_validation_required'));
            return;
        }

        setIsTestingConnectivity(true);
        setConnectivityError(null);
        try {
            await testAIConnectivity(aiSettings);
        } catch (err) {
            setConnectivityError(`Error: ${JSON.stringify(err)}. ${t('settings.ai_connectivity_failed')}`);
            setIsTestingConnectivity(false);
            setSaveSuccess(false);
            return;
        }
        setIsTestingConnectivity(false);

        const newSettings = { ...settings, aiSettings };
        setSettings(newSettings);
        await saveGlobalSettings(newSettings);
        clearAISettingsCache();
        setSaveSuccess(true);
        setValidationError(null);
        setAttentionActive(false);
    };

    const handleClearAI = async () => {
        if (!settings) return;
        const cleared = getDefaultAISettings();
        setAiSettings(cleared);
        const newSettings = { ...settings, aiSettings: cleared };
        setSettings(newSettings);
        await saveGlobalSettings(newSettings);
        clearAISettingsCache();
        setSaveSuccess(false);
        setValidationError(null);
        setConnectivityError(null);
        setAttentionActive(false);
        setProviderOpen(false);
    };

    if (!isOpen || !settings || !aiSettings) return null;

    const getLabel = (key: 'enableSceneImages' | 'enableBackgroundImages' | 'enableEntityImages' | 'enableNpcImages' | 'skipBootSequence') => {
        const keyMap: Record<'enableSceneImages' | 'enableBackgroundImages' | 'enableEntityImages' | 'enableNpcImages' | 'skipBootSequence', string> = {
            enableSceneImages: 'settings.scene_images',
            enableBackgroundImages: 'settings.bg_images',
            enableEntityImages: 'settings.entity_images',
            enableNpcImages: 'settings.npc_images',
            skipBootSequence: 'settings.skip_boot'
        };
        return t(keyMap[key]);
    };

    const content = (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-mono scp-ui">
            <CrtSurface className={`scp-window border w-full max-w-lg shadow-2xl flex flex-col relative overflow-hidden z-10 ${
                highlightActive ? 'border-scp-text shadow-[0_0_25px_rgba(224,224,224,0.35)] animate-pulse' : 'border-scp-accent/50'
            }`}>
                
                <div className="bg-black h-14 w-full flex items-center justify-between px-6 border-b border-scp-gray relative z-20 shrink-0 scp-window-header">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-scp-accent rounded-full animate-pulse"></div>
                        <span className="font-report text-xl tracking-widest text-scp-text uppercase shadow-black drop-shadow-md text-shadow-sm">
                            {t('settings.title')}
                        </span>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-gray-400 hover:text-white transition-colors text-2xl border border-gray-600/50 hover:border-white rounded-sm w-8 h-8 flex items-center justify-center"
                    >
                        ×
                    </button>
                </div>

                <div className="flex border-b border-scp-gray/30">
                    <button
                        onClick={() => setActiveTab('game')}
                        className={`flex-1 py-3 text-sm font-mono uppercase tracking-wider transition-colors ${
                            activeTab === 'game'
                                ? 'bg-scp-text text-black border-b-2 border-scp-text'
                                : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        {t('settings.tab_game')}
                    </button>
                    <button
                        onClick={() => setActiveTab('ai')}
                        className={`flex-1 py-3 text-sm font-mono uppercase tracking-wider transition-colors ${
                            activeTab === 'ai'
                                ? 'bg-scp-text text-black border-b-2 border-scp-text'
                                : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        {t('settings.tab_ai')}
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {activeTab === 'game' && (
                        <div className="space-y-4">
                            <div className="p-4 border border-scp-gray/30 bg-scp-gray/10">
                                <div className="text-xs text-gray-400 font-mono uppercase tracking-wider mb-3">
                                    {t('settings.difficulty')}
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {(['easy', 'normal', 'hard', 'insane'] as const).map(level => (
                                        <button
                                            key={level}
                                            onClick={() => handleDifficultyChange(level)}
                                            className={`h-9 px-3 text-xs font-mono border transition-all text-center whitespace-nowrap ${
                                                settings.difficulty === level
                                                    ? 'bg-scp-text text-black border-scp-text shadow-[0_0_10px_rgba(224,224,224,0.3)]'
                                                    : 'bg-transparent text-gray-400 border-scp-gray/30 hover:border-scp-gray hover:text-gray-200'
                                            }`}
                                        >
                                            {t(`settings.difficulty_${level}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="p-4 border border-scp-gray/30 bg-scp-gray/10 space-y-3">
                                <div className="text-xs text-gray-400 font-mono uppercase tracking-wider">
                                    {t('settings.section_images')}
                                </div>
                                {(['enableSceneImages', 'enableBackgroundImages', 'enableEntityImages', 'enableNpcImages'] as const).map((key) => (
                                    <div key={key} className="flex items-center justify-between px-3 py-2 border border-transparent hover:border-scp-accent/30 transition-colors">
                                        <span className="text-[13px] text-scp-text font-mono tracking-wider">
                                            {getLabel(key)}
                                        </span>
                                        <button
                                            onClick={() => handleToggle(key)}
                                            className={`w-11 h-5 rounded-full p-0.5 transition-colors duration-300 ease-in-out relative ${
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
                            <div className="p-4 border border-scp-gray/30 bg-scp-gray/10 space-y-3">
                                <div className="text-xs text-gray-400 font-mono uppercase tracking-wider">
                                    {t('settings.section_gameplay')}
                                </div>
                                <div className="flex items-center justify-between px-3 py-2 border border-transparent hover:border-scp-accent/30 transition-colors">
                                    <span className="text-[13px] text-scp-text font-mono tracking-wider">
                                        {getLabel('skipBootSequence')}
                                    </span>
                                    <button
                                        onClick={() => handleToggle('skipBootSequence')}
                                        className={`w-11 h-5 rounded-full p-0.5 transition-colors duration-300 ease-in-out relative ${
                                            settings.skipBootSequence ? 'bg-scp-accent' : 'bg-gray-700'
                                        }`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                                            settings.skipBootSequence ? 'translate-x-6' : 'translate-x-0'
                                        }`}></div>
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 border border-scp-gray/30 bg-scp-gray/10 space-y-4">
                                <div className="text-xs text-gray-400 font-mono uppercase tracking-wider">
                                    {t('settings.section_audio')}
                                </div>
                                <SettingsRange
                                    label={t('settings.bgm_volume')}
                                    value={settings.bgmVolume}
                                    onChange={(value) => handleVolumeChange('bgmVolume', value)}
                                />
                                <SettingsRange
                                    label={t('settings.sfx_volume')}
                                    value={settings.sfxVolume}
                                    onChange={(value) => handleVolumeChange('sfxVolume', value)}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="space-y-4">
                            {attentionActive && (
                                <div className="p-3 border border-scp-text/50 bg-black/20 text-gray-400 text-sm font-mono shadow-[0_0_12px_rgba(224,224,224,0.12)]">
                                    {t('settings.ai_attention')}
                                </div>
                            )}
                            <div className="p-3 border border-scp-gray/30 bg-black/20 text-gray-500 text-sm font-mono">
                                {t('settings.ai_recommendation')}
                            </div>
                            <div className="p-4 border border-scp-gray/30 bg-scp-gray/10">
                                <label className="block text-xs text-gray-400 font-mono uppercase tracking-wider mb-2">
                                    {t('settings.ai_provider')}
                                </label>
                                <div className="relative">
                                    <button
                                        onClick={() => setProviderOpen((prev) => !prev)}
                                        className="w-full bg-black/20 border border-scp-gray/30 text-scp-text px-3 py-2 text-sm font-mono text-left hover:border-scp-gray transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>{aiSettings.provider === 'gemini' ? t('settings.ai_provider_gemini') : t('settings.ai_provider_custom')}</span>
                                            <span className="text-xs text-gray-400">{providerOpen ? '▲' : '▼'}</span>
                                        </div>
                                    </button>
                                    {providerOpen && (
                                        <div className="absolute mt-2 w-full border border-scp-gray/30 bg-black/90 z-10">
                                            <button
                                                onClick={() => handleProviderChange('gemini')}
                                                className={`w-full text-left px-3 py-2 text-sm font-mono border-b border-scp-gray/30 transition-all ${
                                                    aiSettings.provider === 'gemini'
                                                        ? 'bg-scp-text text-black border-scp-text'
                                                        : 'bg-transparent text-gray-400 hover:text-gray-200'
                                                }`}
                                            >
                                                {t('settings.ai_provider_gemini')}
                                            </button>
                                            <button
                                                onClick={() => handleProviderChange('openai')}
                                                className={`w-full text-left px-3 py-2 text-sm font-mono transition-all ${
                                                    aiSettings.provider === 'openai'
                                                        ? 'bg-scp-text text-black border-scp-text'
                                                        : 'bg-transparent text-gray-400 hover:text-gray-200'
                                                }`}
                                            >
                                                {t('settings.ai_provider_custom')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {aiSettings.provider === 'gemini' && (
                                <div className="space-y-3">
                                    <div className="p-4 border border-scp-gray/30 bg-scp-gray/10">
                                        <label className="block text-xs text-gray-400 font-mono uppercase tracking-wider mb-2">
                                            {t('settings.ai_api_key')} *
                                        </label>
                                        <input
                                            type="password"
                                            value={aiSettings.gemini.apiKey || ''}
                                            onChange={(e) => handleGeminiFieldChange('apiKey', e.target.value)}
                                            placeholder={t('settings.ai_api_key_placeholder')}
                                            className="w-full bg-black/50 border border-scp-gray/30 text-scp-text px-3 py-2 text-sm font-mono focus:border-scp-accent focus:outline-none"
                                        />
                                        <div className="text-xs text-gray-500 mt-2">
                                            {t('settings.ai_api_key_note')}
                                        </div>
                                    </div>
                                    <div className="p-4 border border-scp-gray/30 bg-scp-gray/10">
                                        <label className="block text-xs text-gray-400 font-mono uppercase tracking-wider mb-2">
                                            {t('settings.ai_chat_model')} *
                                        </label>
                                        <input
                                            type="text"
                                            value={aiSettings.gemini.chatModel || ''}
                                            onChange={(e) => handleGeminiFieldChange('chatModel', e.target.value)}
                                            placeholder={t('settings.ai_model_placeholder')}
                                            className="w-full bg-black/50 border border-scp-gray/30 text-scp-text px-3 py-2 text-sm font-mono focus:border-scp-accent focus:outline-none"
                                        />
                                    </div>
                                    <div className="p-4 border border-scp-gray/30 bg-scp-gray/10">
                                        <label className="block text-xs text-gray-400 font-mono uppercase tracking-wider mb-2">
                                            {t('settings.ai_image_model')}
                                        </label>
                                        <input
                                            type="text"
                                            value={aiSettings.gemini.imageModel || ''}
                                            onChange={(e) => handleGeminiFieldChange('imageModel', e.target.value)}
                                            placeholder={t('settings.ai_model_placeholder')}
                                            className="w-full bg-black/50 border border-scp-gray/30 text-scp-text px-3 py-2 text-sm font-mono focus:border-scp-accent focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {aiSettings.provider === 'openai' && (
                                <div className="space-y-3">
                                    <div className="p-4 border border-scp-gray/30 bg-scp-gray/10">
                                        <label className="block text-xs text-gray-400 font-mono uppercase tracking-wider mb-2">
                                            {t('settings.ai_api_key')} *
                                        </label>
                                        <input
                                            type="password"
                                            value={aiSettings.openai.apiKey || ''}
                                            onChange={(e) => handleOpenAIFieldChange('apiKey', e.target.value)}
                                            placeholder={t('settings.ai_api_key_placeholder')}
                                            className="w-full bg-black/50 border border-scp-gray/30 text-scp-text px-3 py-2 text-sm font-mono focus:border-scp-accent focus:outline-none"
                                        />
                                        <div className="text-xs text-gray-500 mt-2">
                                            {t('settings.ai_api_key_note')}
                                        </div>
                                    </div>
                                    <div className="p-4 border border-scp-gray/30 bg-scp-gray/10">
                                        <label className="block text-xs text-gray-400 font-mono uppercase tracking-wider mb-2">
                                            {t('settings.ai_base_url')} *
                                        </label>
                                        <input
                                            type="text"
                                            value={aiSettings.openai.baseUrl || ''}
                                            onChange={(e) => handleOpenAIFieldChange('baseUrl', e.target.value)}
                                            placeholder={t('settings.ai_base_url_placeholder')}
                                            className="w-full bg-black/50 border border-scp-gray/30 text-scp-text px-3 py-2 text-sm font-mono focus:border-scp-accent focus:outline-none"
                                        />
                                    </div>
                                    <div className="p-4 border border-scp-gray/30 bg-scp-gray/10">
                                        <label className="block text-xs text-gray-400 font-mono uppercase tracking-wider mb-2">
                                            {t('settings.ai_chat_model')} *
                                        </label>
                                        <input
                                            type="text"
                                            value={aiSettings.openai.chatModel || ''}
                                            onChange={(e) => handleOpenAIFieldChange('chatModel', e.target.value)}
                                            placeholder={t('settings.ai_model_placeholder')}
                                            className="w-full bg-black/50 border border-scp-gray/30 text-scp-text px-3 py-2 text-sm font-mono focus:border-scp-accent focus:outline-none"
                                        />
                                    </div>
                                    <div className="p-4 border border-scp-gray/30 bg-scp-gray/10">
                                        <label className="block text-xs text-gray-400 font-mono uppercase tracking-wider mb-2">
                                            {t('settings.ai_image_model')}
                                        </label>
                                        <input
                                            type="text"
                                            value={aiSettings.openai.imageModel || ''}
                                            onChange={(e) => handleOpenAIFieldChange('imageModel', e.target.value)}
                                            placeholder={t('settings.ai_model_placeholder')}
                                            className="w-full bg-black/50 border border-scp-gray/30 text-scp-text px-3 py-2 text-sm font-mono focus:border-scp-accent focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {validationError && (
                                <div className="p-3 border border-red-500/50 bg-red-500/10 text-red-400 text-sm font-mono">
                                    {validationError}
                                </div>
                            )}

                            {connectivityError && (
                                <div className="p-3 border border-red-500/50 bg-red-500/10 text-red-400 text-sm font-mono">
                                    {connectivityError}
                                </div>
                            )}

                            {saveSuccess && (
                                <div className="p-3 border border-green-500/50 bg-green-500/10 text-green-400 text-sm font-mono">
                                    {t('settings.ai_save_success')}
                                </div>
                            )}

                            {isTestingConnectivity && (
                                <div className="p-3 border border-scp-gray/30 bg-black/20 text-gray-500 text-sm font-mono">
                                    {t('settings.ai_connectivity_testing')}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={handleClearAI}
                                    disabled={isTestingConnectivity}
                                    className="flex-1 py-3 bg-scp-gray/20 hover:bg-scp-gray/40 text-gray-300 hover:text-white font-mono text-sm border border-scp-gray hover:border-gray-400 transition-all tracking-widest uppercase backdrop-blur-sm"
                                >
                                    {t('settings.ai_clear')}
                                </button>
                                <button
                                    onClick={handleSaveAI}
                                    disabled={isTestingConnectivity}
                                    className="flex-1 py-3 bg-scp-text text-black font-mono uppercase tracking-wider text-sm hover:bg-scp-text/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {t('settings.ai_save')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </CrtSurface>
        </div>
    );

    return createPortal(content, document.body) as ReactNode;
};

export default GlobalSettingsModal;
