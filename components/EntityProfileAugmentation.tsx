import React, { useState, useEffect } from 'react';
import { EntityProfile, Language, LegacyData } from '../types';
import { useTranslation } from '../utils/i18n';
import { generateProfileCandidates } from '../services/aiService';
import { loadGlobalSettings, saveGlobalSettings } from '../services/indexedDBService';
import TransitionOverlay from './common/TransitionOverlay';
import EntityProfileScreen from './entityProfile/EntityProfileScreen';

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
    };

    const handleInputChange = (field: keyof EntityProfile, value: any) => {
        if (!selectedProfile) return;
        setSelectedProfile({ ...selectedProfile, [field]: value });
    };

    const handleConfirm = () => {
        if (selectedProfile) {
            onComplete(selectedProfile);
        }
    };

    return (
        <div className="w-full h-full relative overflow-hidden">
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
                            {t('entity_profile.enter_augmentation_checkbox')}
                        </span>
                    </label>
                </div>
                {!enterAugmentation && (
                    <div className="text-center text-[10px] text-scp-alert animate-pulse mt-2 uppercase tracking-widest">
                        {t('entity_profile.auto_proceed_msg')}
                    </div>
                )}
            </TransitionOverlay>

            <EntityProfileScreen
                role={role}
                scpDesignation={scpDesignation}
                ready={!showTransition}
                candidates={candidates}
                selectedProfile={selectedProfile}
                loadingAction={loadingAction}
                generationError={generationError}
                onBack={onBack}
                onGenerate={fetchCandidates}
                onSelect={handleSelectCandidate}
                onChange={handleInputChange}
                onConfirm={handleConfirm}
            />
        </div>
    );
};

export default EntityProfileAugmentation;
