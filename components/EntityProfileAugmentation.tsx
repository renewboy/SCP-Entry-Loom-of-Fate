import React, { useState, useEffect } from 'react';
import { EntityProfile, Language, LegacyData } from '../types';
import { useTranslation } from '../utils/i18n';
import { generateProfileCandidates } from '../services/aiService';
import { loadGlobalSettings, saveGlobalSettings } from '../services/indexedDBService';
import { useViewport } from '../hooks/useViewport';
import TransitionOverlay from './common/TransitionOverlay';
import CrtSurface from './common/CrtSurface';
import TagInput from './editor/TagInput';
import {
    panelContainerBase,
    editorPanelHeader,
    editorPanelTitle,
    inputBase,
    textareaBase,
    inputGroup,
    labelBase,
    toolbarButtonBase
} from './editor/editorStyles';

interface EntityProfileAugmentationProps {
    role: string;
    scpDesignation: string;
    language: Language;
    legacyData?: LegacyData;
    onComplete: (profile: EntityProfile) => void;
    onBack: () => void;
}

const EntityProfileAugmentation: React.FC<EntityProfileAugmentationProps> = ({
    role,
    scpDesignation,
    language,
    legacyData,
    onComplete,
    onBack
}) => {
    const { t } = useTranslation();
    const { isMobile } = useViewport();
    const [activeTab, setActiveTab] = useState<'candidates' | 'details'>('candidates');
    const [candidates, setCandidates] = useState<EntityProfile[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<EntityProfile | null>(null);
    const [loadingAction, setLoadingAction] = useState<'init' | 'reroll' | null>(null);
    const [showTransition, setShowTransition] = useState(true);
    const [generationError, setGenerationError] = useState(false);
    const [enterAugmentation, setEnterAugmentation] = useState(true);

    useEffect(() => {
        const initSettings = async () => {
            const settings = await loadGlobalSettings();
            setEnterAugmentation(!settings.skipEntityProfile);
        };
        initSettings();
    }, []);

    const updateEnterAugmentation = async (checked: boolean) => {
        setEnterAugmentation(checked);
        const settings = await loadGlobalSettings();
        await saveGlobalSettings({ ...settings, skipEntityProfile: !checked });
    };

    const fetchCandidates = async (mode: 'init' | 'reroll') => {
        try {
            setGenerationError(false);
            setLoadingAction(mode);
            if (mode === 'init') {
                setCandidates([]);
                setSelectedProfile(null);
            }
            if (mode === 'reroll') {
                setSelectedProfile(null);
            }
            const results = await generateProfileCandidates(role, scpDesignation, language, legacyData);
            if (results && results.length > 0) {
                setCandidates(results);
            } else {
                setGenerationError(true);
            }
        } catch (e) {
            console.error(e);
            setGenerationError(true);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleTransitionComplete = () => {
        if (enterAugmentation) {
            setShowTransition(false);
        } else {
            onBack();
        }
    };

    const handleSelectCandidate = (profile: EntityProfile) => {
        setSelectedProfile({ ...profile });
        if (isMobile) setActiveTab('details');
    };

    const handleInputChange = (field: keyof EntityProfile, value: any) => {
        if (!selectedProfile) return;
        setSelectedProfile({ ...selectedProfile, [field]: value });
    };

    const handleReroll = async () => {
        fetchCandidates('reroll');
    };

    const handleConfirm = () => {
        if (selectedProfile) {
            onComplete(selectedProfile);
        }
    };

    /* ==================== Shared render helpers ==================== */

    /** Status card — identical on mobile & desktop */
    const renderStatusCard = () => (
        <div className="scp-card p-4 space-y-3">
            <div className="text-xs text-scp-text-dim uppercase tracking-widest font-bold">
                {t('entity_profile.section_status')}
            </div>
            <div className="text-sm text-scp-alert font-bold tracking-wider">
                {generationError
                    ? t('entity_profile.generation_error')
                    : loadingAction
                    ? t('entity_profile.loading_candidates')
                    : candidates.length > 0
                    ? t('entity_profile.candidates_ready')
                    : t('entity_profile.profile_generation_standby')}
            </div>
            <div className="text-xs text-gray-500">
                {t('entity_profile.status_hint')}
            </div>
        </div>
    );

    /** Actions card — only diff is min-h-[44px] on mobile buttons */
    const renderActionsCard = (touchTargets: boolean) => (
        <div className="scp-card p-4 space-y-3">
            <div className="text-xs text-scp-text-dim uppercase tracking-widest font-bold">
                {t('entity_profile.section_actions')}
            </div>
            {candidates.length === 0 && loadingAction !== 'reroll' && (
                <button 
                    onClick={() => fetchCandidates('init')}
                    disabled={loadingAction !== null}
                    className={`w-full px-6 py-4 border border-scp-accent text-scp-accent hover:bg-scp-accent/10 transition-all uppercase tracking-widest font-bold text-sm shadow-[0_0_15px_rgba(255,0,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed ${touchTargets ? 'min-h-[44px]' : ''}`}
                >
                    <div className="flex items-center gap-3 justify-center">
                        {loadingAction === 'init' && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>}
                        <span>{loadingAction === 'init' ? t('entity_profile.loading') : t('entity_profile.initialize_generation')}</span>
                    </div>
                </button>
            )}
            {candidates.length > 0 && (
                <button 
                    onClick={handleReroll} 
                    disabled={loadingAction !== null}
                    className={`w-full py-3 border border-scp-gray/30 hover:bg-white/5 text-xs font-mono uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed ${touchTargets ? 'min-h-[44px]' : ''}`}
                >
                    <div className="flex items-center gap-2 justify-center">
                        {loadingAction === 'reroll' && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>}
                        <span>{loadingAction === 'reroll' ? t('entity_profile.loading') : t('entity_profile.reroll')}</span>
                    </div>
                </button>
            )}
        </div>
    );

    /** Candidate card list — diff: compact spacing & scrollbar style */
    const renderCandidateList = (compact: boolean) => (
        <div className={`flex-1 overflow-y-auto ${compact ? 'space-y-3' : 'space-y-4 custom-scrollbar pr-2'}`}>
            {candidates.map((candidate, idx) => (
                <div 
                    key={idx}
                    onClick={() => handleSelectCandidate(candidate)}
                    className={`
                        p-4 border-l-4 cursor-pointer transition-all hover:translate-x-1 relative group bg-[var(--scp-surface-2)]
                        ${selectedProfile?.name === candidate.name ? 'border-l-scp-accent bg-scp-accent/10' : 'border-l-gray-700 hover:border-l-scp-accent/50'}
                    `}
                >
                    <div className="font-bold text-lg mb-1 group-hover:text-scp-accent transition-colors">{candidate.name}</div>
                    <div className="text-xs text-scp-text-dim mb-2">{candidate.age}</div>
                    <div className="flex flex-wrap gap-1 mb-2">
                        {candidate.abilities.slice(0, 3).map((ab, i) => (
                            <span key={i} className="text-[10px] px-1 bg-black/30 border border-gray-700 rounded text-gray-400">
                                {ab}
                            </span>
                        ))}
                    </div>
                    <div className="text-xs opacity-70 line-clamp-3 italic">
                        "{candidate.background}"
                    </div>
                </div>
            ))}
            {generationError && (
                <div className="p-4 border border-red-500/50 bg-red-500/10 text-red-400 text-xs">
                    {t('entity_profile.generation_error_detail')}
                </div>
            )}
            <div 
                onClick={() => handleSelectCandidate({
                    name: role,
                    age: "Unknown",
                    abilities: [],
                    background: "",
                    keywords: []
                })}
                className={`
                    p-4 border border-dashed border-gray-600 cursor-pointer transition-all hover:bg-[var(--scp-surface-2)] text-center
                    ${selectedProfile?.name === role && candidates.every(c => c.name !== role) ? 'border-scp-accent text-scp-accent' : 'text-gray-500'}
                `}
            >
                + {t('entity_profile.custom_edit')}
            </div>
        </div>
    );

    /** Profile edit form — diff: grid cols, textarea height, spacing */
    const renderProfileForm = (compact: boolean) => (
        <div className={`flex-1 overflow-y-auto ${compact ? 'p-4 space-y-4' : 'p-6 space-y-6 custom-scrollbar'}`}>
            <div className={`grid ${compact ? 'grid-cols-1 gap-4' : 'grid-cols-2 gap-6'}`}>
                <div className={inputGroup}>
                    <label className={labelBase}>{t('entity_profile.subject_name')}</label>
                    <input 
                        type="text" 
                        className={inputBase}
                        value={selectedProfile?.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                    />
                </div>
                <div className={inputGroup}>
                    <label className={labelBase}>{t('entity_profile.chronological_age')}</label>
                    <input 
                        type="text" 
                        className={inputBase}
                        value={selectedProfile?.age || ''}
                        onChange={(e) => handleInputChange('age', e.target.value)}
                    />
                </div>
            </div>

            <TagInput
                label={t('entity_profile.capabilities')}
                tags={selectedProfile?.abilities || []}
                onChange={(tags) => handleInputChange('abilities', tags)}
            />

            <div className={inputGroup}>
                <label className={labelBase}>{t('entity_profile.origin')}</label>
                <textarea 
                    className={`${textareaBase} ${compact ? 'h-24' : 'h-32'} resize-none`}
                    value={selectedProfile?.background || ''}
                    onChange={(e) => handleInputChange('background', e.target.value)}
                />
            </div>

            <TagInput
                label={t('entity_profile.narrative_anchors')}
                tags={selectedProfile?.keywords || []}
                onChange={(tags) => handleInputChange('keywords', tags)}
            />
        </div>
    );

    /** Confirm button — diff: sizing & width */
    const renderConfirmButton = (compact: boolean) => (
        <div className={`p-4 border-t border-[var(--scp-border)] bg-[var(--scp-surface-2)] ${compact ? '' : 'flex justify-end'}`}>
            <button 
                onClick={handleConfirm}
                disabled={!selectedProfile || loadingAction !== null}
                className={`bg-scp-accent/90 hover:bg-scp-accent text-white font-report tracking-widest border border-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] ${
                    compact 
                        ? 'w-full px-6 py-3 text-base min-h-[44px]' 
                        : 'px-10 py-4 text-xl shadow-[0_0_15px_rgba(195,46,46,0.3)] hover:shadow-[0_0_25px_rgba(195,46,46,0.6)]'
                }`}
            >
                <div className="flex items-center gap-3 justify-center">
                    <span className={`font-report font-bold ${compact ? 'tracking-[0.15em]' : 'text-xl tracking-[0.2em]'}`}>{t('entity_profile.confirm_upload')}</span>
                    <span className="text-xs opacity-70">&gt;&gt;&gt;</span>
                </div>
            </button>
        </div>
    );

    return (
        <div className="w-full h-full relative bg-[var(--scp-bg)] text-[var(--scp-text)] font-mono flex flex-col overflow-hidden scp-ui crt">
            <TransitionOverlay
                isVisible={showTransition}
                onComplete={handleTransitionComplete}
                allowSkip={true}
                title={t('entity_profile.title')}
                steps={[
                    { text: t('entity_profile.transition_accessing', { designation: scpDesignation }), delay: 500 },
                    { text: t('entity_profile.transition_analyzing', { role: role.toUpperCase() }), delay: 1200 }
                ]}
                countdownDuration={3} 
            >
                <div className="flex items-center justify-center gap-2 mt-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-4 h-4 border border-scp-alert transition-all flex items-center justify-center ${enterAugmentation ? 'bg-scp-alert/20' : 'bg-transparent'}`}>
                            {enterAugmentation && <div className="w-2 h-2 bg-scp-alert"></div>}
                        </div>
                        <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={enterAugmentation} 
                            onChange={e => updateEnterAugmentation(e.target.checked)} 
                        />
                        <span className="text-xs text-gray-400 group-hover:text-white font-mono tracking-wider transition-colors">
                            {t('entity_profile.enter_augmentation_checkbox') || "ENTER PROFILE AUGMENTATION"}
                        </span>
                    </label>
                </div>
                {!enterAugmentation && (
                    <div className="text-center text-[10px] text-scp-alert animate-pulse mt-2 uppercase tracking-widest">
                        {t('entity_profile.auto_proceed_msg') || "AUTO-GENERATION SEQUENCE INITIATED"}
                    </div>
                )}
            </TransitionOverlay>

            {/* Header */}
            <div className="h-14 border-b border-[var(--scp-border)] flex items-center justify-between px-3 md:px-6 bg-[var(--scp-surface)] shrink-0 z-10">
                <div className="flex items-center gap-2 md:gap-4">
                    <button onClick={onBack} className={toolbarButtonBase}>
                        <span>←</span> {t('common.back')}
                    </button>
                    <h1 className="text-base md:text-lg font-bold tracking-widest text-scp-alert flex items-center gap-2">
                        {t('entity_profile.title')}
                    </h1>
                </div>
            </div>

            {isMobile ? (
                /* ==================== Mobile: Tab-based full-width layout ==================== */
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Background */}
                    <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>

                    {/* Tab bar */}
                    <div className={`flex border-b border-[var(--scp-border)] shrink-0 relative z-10 crt ${showTransition ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`}>
                        <button 
                            className={`flex-1 py-3 text-xs font-mono uppercase tracking-wider transition-colors min-h-[44px] ${activeTab === 'candidates' ? 'text-scp-accent border-b-2 border-scp-accent bg-scp-accent/5' : 'text-gray-200 hover:text-gray-100'}`}
                            onClick={() => setActiveTab('candidates')}>
                            {t('entity_profile.section_status') || 'CANDIDATES'}
                        </button>
                        <button 
                            className={`flex-1 py-3 text-xs font-mono uppercase tracking-wider transition-colors min-h-[44px] ${activeTab === 'details' ? 'text-scp-accent border-b-2 border-scp-accent bg-scp-accent/5' : 'text-gray-200 hover:text-gray-100'} ${!selectedProfile ? 'opacity-50' : ''}`}
                            onClick={() => selectedProfile && setActiveTab('details')}>
                            {t('story_editor.role_details') || 'DETAILS'}
                        </button>
                    </div>

                    {/* Tab content */}
                    <div className={`flex-1 overflow-y-auto relative z-10 crt ${showTransition ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`}>
                        {activeTab === 'candidates' ? (
                            /* ---------- Candidates tab ---------- */
                            <div className="p-4 flex flex-col gap-4 h-full">
                                {renderStatusCard()}
                                {renderActionsCard(true)}
                                {renderCandidateList(true)}
                            </div>
                        ) : (
                            /* ---------- Details tab ---------- */
                            <div className="flex flex-col h-full">
                                {renderProfileForm(true)}
                                {renderConfirmButton(true)}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* ==================== Desktop: Original dual-panel layout (unchanged) ==================== */
                <div className="flex-1 flex overflow-hidden relative p-6 gap-6">
                    {/* Background Grid */}
                    <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
                    <div className="absolute inset-0 pointer-events-none z-20"></div>

                    {/* Left: Candidates Selection */}
                    <div className={`w-96 z-10 ${showTransition ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'} crt`}>
                        <div className="h-full border-r border-[var(--scp-border)] bg-[var(--scp-surface)]/90 backdrop-blur-sm">
                            <div className="flex flex-col h-full p-6 gap-5">
                                {renderStatusCard()}
                                {renderActionsCard(false)}
                                {renderCandidateList(false)}
                            </div>
                        </div>
                    </div>

                    {/* Right: Editor Panel */}
                    <div className={`flex-1 ${panelContainerBase} border border-[var(--scp-border)] p-0 flex flex-col z-10 shadow-2xl crt ${!selectedProfile ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                        <div className={editorPanelHeader}>
                            <div className={editorPanelTitle}>
                                {t('story_editor.role_details')}
                            </div>
                            {selectedProfile && <div className="text-xs text-scp-accent animate-pulse">EDITING MODE ACTIVE</div>}
                        </div>

                        {renderProfileForm(false)}
                        {renderConfirmButton(false)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EntityProfileAugmentation;
