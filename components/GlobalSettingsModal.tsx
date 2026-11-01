import React, { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../utils/i18n';
import { loadGlobalSettings, saveGlobalSettings } from '../services/indexedDBService';
import { AIModelRouteName, AIProvider, GlobalSettings, AISettings } from '../types';
import { getDefaultAISettings, validateAISettings, clearAISettingsCache } from '../services/aiConfigService';
import { testAIConnectivity } from '../services/aiConnectivityService';
import { resetProvider } from '../services/aiService';
import GameButton from './common/GameButton';
import '../styles/stage.css';
import '../styles/startScreen.css';
import { setBgmVolume } from '../services/bgmService';
import { setAmbienceVolume } from '../services/ambienceService';
import { setSfxVolume } from '../services/sfxService';
import SettingsRange from './common/SettingsRange';
import CustomSelect from './common/CustomSelect';
import SettingsToggle from './common/SettingsToggle';
import { IMAGE_DRAWING_STYLE_OPTIONS } from '../services/ai/imageStyles';

interface GlobalSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'game' | 'ai';
    attention?: boolean;
}

type SettingsTab = 'game' | 'ai';

const AI_ROUTE_ORDER: AIModelRouteName[] = ['analysis', 'narration', 'image', 'assistant', 'embedding'];
const AI_ROUTE_COPY_KEYS: Record<AIModelRouteName, { label: string; help: string }> = {
    analysis: {
        label: 'settings.ai_route_analysis_label',
        help: 'settings.ai_route_analysis_help'
    },
    assistant: {
        label: 'settings.ai_route_assistant_label',
        help: 'settings.ai_route_assistant_help'
    },
    narration: {
        label: 'settings.ai_route_narration_label',
        help: 'settings.ai_route_narration_help'
    },
    image: {
        label: 'settings.ai_route_image_label',
        help: 'settings.ai_route_image_help'
    },
    embedding: {
        label: 'settings.ai_route_embedding_label',
        help: 'settings.ai_route_embedding_help'
    }
};

interface AIRouteFieldProps {
    route: AIModelRouteName;
    settings: AISettings;
    t: (key: string) => string;
    onChange: (route: AIModelRouteName, field: 'provider' | 'model', value: string) => void;
}

const AIRouteField: React.FC<AIRouteFieldProps> = ({ route, settings, t, onChange }) => {
    const routeSettings = settings.routes[route];
    const embeddingLocked = route === 'embedding';
    const providerOptions = [
        { value: 'gemini', label: t('settings.ai_provider_gemini') },
        ...(!embeddingLocked ? [{ value: 'openai', label: t('settings.ai_provider_custom') }] : []),
    ];

    return (
        <div className="p-4 border border-scp-gray/30 bg-scp-gray/10 space-y-3">
            <div>
                <div className="text-sm text-scp-text font-mono tracking-wider">
                    {t(AI_ROUTE_COPY_KEYS[route].label)}
                </div>
                <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {t(AI_ROUTE_COPY_KEYS[route].help)}
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-3">
                <CustomSelect
                    label={`${t('settings.ai_route_provider')} *`}
                    value={routeSettings.provider}
                    options={providerOptions}
                    disabled={embeddingLocked}
                    variant="settings"
                    onChange={(value) => onChange(route, 'provider', value)}
                />
                <label className="block">
                    <span className="block text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1">
                        {t('settings.ai_route_model')} *
                    </span>
                    <input
                        type="text"
                        value={routeSettings.model || ''}
                        onChange={(e) => onChange(route, 'model', e.target.value)}
                        placeholder={t('settings.ai_model_placeholder')}
                        className="w-full bg-black/50 border border-scp-gray/30 text-scp-text px-3 py-2 text-sm font-mono focus:border-scp-accent focus:outline-none"
                    />
                </label>
            </div>
            {embeddingLocked && (
                <div className="text-xs text-gray-500">
                    {t('settings.ai_embedding_unavailable')}
                </div>
            )}
        </div>
    );
};

interface ProviderConnectionCardProps {
    provider: AIProvider;
    settings: AISettings;
    t: (key: string) => string;
    required: boolean;
    onProviderChange: (provider: AIProvider) => void;
    onChange: (provider: AIProvider, field: 'apiKey' | 'baseUrl', value: string) => void;
}

const ProviderConnectionCard: React.FC<ProviderConnectionCardProps> = ({ provider, settings, t, required, onProviderChange, onChange }) => {
    const providerSettings = settings.providers[provider];
    const baseUrlRequired = provider === 'openai' && required;
    const providerOptions = [
        { value: 'gemini', label: t('settings.ai_provider_gemini') },
        { value: 'openai', label: t('settings.ai_provider_custom') },
    ];

    return (
        <div className="p-4 border border-scp-gray/30 bg-scp-gray/10 space-y-3">
            <CustomSelect
                label={t('settings.ai_provider')}
                value={provider}
                options={providerOptions}
                variant="settings"
                onChange={(value) => onProviderChange(value as AIProvider)}
            />
            <label className="block">
                <span className="block text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1">
                    {t('settings.ai_api_key')}{required ? ' *' : ''}
                </span>
                <input
                    type="password"
                    value={providerSettings.apiKey || ''}
                    onChange={(e) => onChange(provider, 'apiKey', e.target.value)}
                    placeholder={t('settings.ai_api_key_placeholder')}
                    className="w-full bg-black/50 border border-scp-gray/30 text-scp-text px-3 py-2 text-sm font-mono focus:border-scp-accent focus:outline-none"
                />
            </label>
            <label className="block">
                <span className="block text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1">
                    {t('settings.ai_base_url')}{baseUrlRequired ? ' *' : ''}
                </span>
                <input
                    type="text"
                    value={providerSettings.baseUrl || ''}
                    onChange={(e) => onChange(provider, 'baseUrl', e.target.value)}
                    placeholder={t(provider === 'gemini' ? 'settings.ai_gemini_base_url_placeholder' : 'settings.ai_base_url_placeholder')}
                    className="w-full bg-black/50 border border-scp-gray/30 text-scp-text px-3 py-2 text-sm font-mono focus:border-scp-accent focus:outline-none"
                />
            </label>
            <div className="text-xs text-gray-500">
                {t('settings.ai_api_key_note')}
            </div>
        </div>
    );
};

const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({ isOpen, onClose, initialTab = 'game', attention = false }) => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<GlobalSettings | null>(null);
    const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
    const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [attentionActive, setAttentionActive] = useState(false);
    const [highlightActive, setHighlightActive] = useState(false);
    const [connectivityError, setConnectivityError] = useState<string | null>(null);
    const [isTestingConnectivity, setIsTestingConnectivity] = useState(false);
    const [selectedConnectionProvider, setSelectedConnectionProvider] = useState<AIProvider>('gemini');

    useEffect(() => {
        if (isOpen) {
            loadGlobalSettings().then(loaded => {
                setSettings(loaded);
                setBgmVolume(loaded.bgmVolume);
                setAmbienceVolume(loaded.bgmVolume);
                setSfxVolume(loaded.sfxVolume);
                const defaults = getDefaultAISettings();
                const merged = {
                    providers: {
                        gemini: { ...defaults.providers.gemini, ...(loaded?.aiSettings?.providers?.gemini || {}) },
                        openai: { ...defaults.providers.openai, ...(loaded?.aiSettings?.providers?.openai || {}) },
                    },
                    routes: {
                        ...defaults.routes,
                        ...(loaded?.aiSettings?.routes || {}),
                        embedding: {
                            provider: 'gemini' as const,
                            model: loaded?.aiSettings?.routes?.embedding?.model || defaults.routes.embedding.model,
                        },
                    },
                };
                setAiSettings(merged);
                setSelectedConnectionProvider(merged.routes.analysis.provider);
            });
            setActiveTab(initialTab);
            setValidationError(null);
            setConnectivityError(null);
            setSaveSuccess(false);
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

    const handleImageStyleChange = (imageStyle: GlobalSettings['imageStyle']) => {
        if (!settings) return;
        const newSettings = { ...settings, imageStyle };
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
            setAmbienceVolume(newSettings.bgmVolume);
            return;
        }
        setSfxVolume(newSettings.sfxVolume);
    };

    const handleProviderCredentialChange = (provider: AIProvider, field: 'apiKey' | 'baseUrl', value: string) => {
        if (!aiSettings) return;
        setAiSettings({
            ...aiSettings,
            providers: {
                ...aiSettings.providers,
                [provider]: {
                    ...aiSettings.providers[provider],
                    [field]: value
                }
            }
        });
        setValidationError(null);
        setConnectivityError(null);
        setSaveSuccess(false);
    };

    const handleRouteChange = (route: AIModelRouteName, field: 'provider' | 'model', value: string) => {
        if (!aiSettings) return;
        const provider = field === 'provider' ? value as AIProvider : aiSettings.routes[route].provider;
        if (field === 'provider') {
            setSelectedConnectionProvider(route === 'embedding' ? 'gemini' : provider);
        }
        setAiSettings({
            ...aiSettings,
            routes: {
                ...aiSettings.routes,
                [route]: {
                    ...aiSettings.routes[route],
                    provider: route === 'embedding' ? 'gemini' : provider,
                    model: field === 'model' ? value : aiSettings.routes[route].model
                }
            }
        });
        setValidationError(null);
        setConnectivityError(null);
        setSaveSuccess(false);
    };

    const handleSaveAI = async () => {
        if (!aiSettings || !settings) return;
        
        const validation = validateAISettings(aiSettings);
        if (!validation.valid) {
            if (validation.missingFields.some((field) => field.startsWith('providers.openai'))) {
                setSelectedConnectionProvider('openai');
            } else if (validation.missingFields.some((field) => field.startsWith('providers.gemini'))) {
                setSelectedConnectionProvider('gemini');
            }
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
        resetProvider();
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
        resetProvider();
        setSaveSuccess(false);
        setValidationError(null);
        setConnectivityError(null);
        setAttentionActive(false);
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

    const selectedProviderRequired = AI_ROUTE_ORDER.some(
        (route) => route !== 'embedding' && aiSettings.routes[route].provider === selectedConnectionProvider
    );

    const content = (
        <div className="stage-root settings-root" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
            <aside className={`st ${highlightActive ? 'attn' : ''}`} role="dialog" aria-label={t('settings.title')}>
                <div className="st-head">
                    <h2>{t('settings.title')}</h2>
                    <GameButton variant="icon" aria-label={t('common.back')} onClick={onClose}>×</GameButton>
                </div>

                <div className="st-tabs">
                    <button type="button" className={activeTab === 'game' ? 'on' : ''} onClick={() => setActiveTab('game')}>{t('settings.tab_game')}</button>
                    <button type="button" className={activeTab === 'ai' ? 'on' : ''} onClick={() => setActiveTab('ai')}>{t('settings.tab_ai')}</button>
                </div>

                <div className="st-body">
                    {activeTab === 'game' && (
                        <>
                            <section className="st-sec">
                                <h3>{t('settings.difficulty')}</h3>
                                <div className="st-seg">
                                    {(['easy', 'normal', 'hard', 'insane'] as const).map(level => (
                                        <button key={level} type="button" className={settings.difficulty === level ? 'on' : ''} onClick={() => handleDifficultyChange(level)}>
                                            {t(`settings.difficulty_${level}`)}
                                        </button>
                                    ))}
                                </div>
                            </section>
                            <section className="st-sec" aria-labelledby="visual-settings-heading">
                                <h3 id="visual-settings-heading">{t('settings.section_images')}</h3>
                                <div className="st-row">
                                    <span>{t('settings.image_style')}</span>
                                    <div className="st-select">
                                        <CustomSelect
                                            value={settings.imageStyle}
                                            options={IMAGE_DRAWING_STYLE_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
                                            variant="settings"
                                            onChange={value => handleImageStyleChange(value as GlobalSettings['imageStyle'])}
                                        />
                                    </div>
                                </div>
                                <p className="st-help">{t('settings.image_style_help')}</p>
                                {(['enableSceneImages', 'enableBackgroundImages', 'enableEntityImages', 'enableNpcImages'] as const).map((key) => (
                                    <div key={key} className="st-row">
                                        <span>{getLabel(key)}</span>
                                        <SettingsToggle checked={!!settings[key]} onChange={() => handleToggle(key)} />
                                    </div>
                                ))}
                            </section>
                            <section className="st-sec">
                                <h3>{t('settings.section_gameplay')}</h3>
                                <div className="st-row">
                                    <span>{getLabel('skipBootSequence')}</span>
                                    <SettingsToggle checked={!!settings.skipBootSequence} onChange={() => handleToggle('skipBootSequence')} />
                                </div>
                            </section>
                            <section className="st-sec">
                                <h3>{t('settings.section_audio')}</h3>
                                <div className="st-ranges">
                                    <SettingsRange label={t('settings.bgm_volume')} value={settings.bgmVolume} onChange={(value) => handleVolumeChange('bgmVolume', value)} />
                                    <SettingsRange label={t('settings.sfx_volume')} value={settings.sfxVolume} onChange={(value) => handleVolumeChange('sfxVolume', value)} />
                                </div>
                            </section>
                        </>
                    )}

                    {activeTab === 'ai' && (
                        <>
                            {attentionActive && <p className="st-note attn">{t('settings.ai_attention')}</p>}
                            <p className="st-note">{t('settings.ai_recommendation')}</p>
                            <section className="st-sec">
                                <h3>{t('settings.ai_section_connections')}</h3>
                                <p className="st-help">{t('settings.ai_provider_connection_help')}</p>
                                <ProviderConnectionCard
                                    provider={selectedConnectionProvider}
                                    settings={aiSettings}
                                    t={t}
                                    required={selectedProviderRequired}
                                    onProviderChange={setSelectedConnectionProvider}
                                    onChange={handleProviderCredentialChange}
                                />
                            </section>
                            <section className="st-sec">
                                <h3>{t('settings.ai_section_usage_models')}</h3>
                                <p className="st-help">{t('settings.ai_model_usage_help')}</p>
                                <div className="space-y-3">
                                    {AI_ROUTE_ORDER.map((route) => (
                                        <AIRouteField key={route} route={route} settings={aiSettings} t={t} onChange={handleRouteChange} />
                                    ))}
                                </div>
                            </section>

                            {validationError && <p className="st-note bad">{validationError}</p>}
                            {connectivityError && <p className="st-note bad">{connectivityError}</p>}
                            {saveSuccess && <p className="st-note good">{t('settings.ai_save_success')}</p>}
                            {isTestingConnectivity && <p className="st-note">{t('settings.ai_connectivity_testing')}</p>}

                            <div className="st-actions">
                                <GameButton disabled={isTestingConnectivity} onClick={handleClearAI}>{t('settings.ai_clear')}</GameButton>
                                <GameButton variant="primary" disabled={isTestingConnectivity} onClick={handleSaveAI}>{t('settings.ai_save')}</GameButton>
                            </div>
                        </>
                    )}
                </div>
            </aside>
        </div>
    );

    return createPortal(content, document.body) as ReactNode;
};

export default GlobalSettingsModal;
