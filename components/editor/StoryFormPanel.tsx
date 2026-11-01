import React from 'react';
import { SCPData } from '../../types';
import { AreaField, Field, ImageSlot, TextField } from './EditorFields';

interface StoryFormPanelProps {
    t: (key: string, params?: Record<string, string | number>) => any;
    scpData: SCPData;
    setScpData: (newState: SCPData | ((prev: SCPData) => SCPData), commitMode?: 'immediate' | 'deferred') => void;
    commitScpData: () => void;
    showValidationErrors: boolean;
    bgImagePrompt: string;
    setBgImagePrompt: (value: string) => void;
    entityImagePrompt: string;
    setEntityImagePrompt: (value: string) => void;
    generatingState: { bg: boolean; entity: boolean };
    handleGenerateImage: (type: 'bg' | 'entity') => void;
    handleImageUpload: (type: 'bg' | 'entity', e: React.ChangeEvent<HTMLInputElement>) => void;
    handleDeleteImage: (type: 'bg' | 'entity') => void;
    setLightboxImage: (value: string | null) => void;
}

type IdentityField = 'designation' | 'containmentClass' | 'name' | 'role';
type DraftField = 'roleDetails' | 'storyBackground' | 'narrativeConstraints' | 'openingPrompt';

const StoryFormPanel: React.FC<StoryFormPanelProps> = ({
    t,
    scpData,
    setScpData,
    commitScpData,
    showValidationErrors,
    bgImagePrompt,
    setBgImagePrompt,
    entityImagePrompt,
    setEntityImagePrompt,
    generatingState,
    handleGenerateImage,
    handleImageUpload,
    handleDeleteImage,
    setLightboxImage
}) => {
    const blueprint = scpData.mapBlueprint;
    const identity = (key: IdentityField, labelKey: string, placeholder: string, required = false, mono = false) => (
        <TextField
            mono={mono}
            label={t(labelKey)}
            required={required}
            error={required && showValidationErrors && !scpData[key] ? t('story_editor.required_field') : undefined}
            value={scpData[key] || ''}
            placeholder={placeholder}
            onChange={value => setScpData(prev => ({ ...prev, [key]: value }), 'deferred')}
            onBlur={commitScpData}
        />
    );
    const draft = (key: DraftField, labelKey: string, placeholderKey: string, height: number) => (
        <AreaField
            label={t(labelKey)}
            height={height}
            value={scpData.storyDraft?.[key] || ''}
            placeholder={t(placeholderKey)}
            onChange={value => setScpData(prev => ({ ...prev, storyDraft: { ...prev.storyDraft, [key]: value } }), 'deferred')}
            onBlur={commitScpData}
        />
    );
    const image = (kind: 'bg' | 'entity', labelKey: string, url: string | undefined, prompt: string, setPrompt: (value: string) => void, ratio: string) => (
        <Field label={t(labelKey)}>
            <ImageSlot
                url={url}
                ratio={ratio}
                generating={generatingState[kind]}
                disabled={generatingState.bg || generatingState.entity}
                labels={{ generate: t('story_editor.btn_generate'), upload: t('story_editor.btn_upload'), delete: t('common.delete'), empty: t('story_editor.no_image'), generating: t('story_editor.generating') }}
                onGenerate={() => handleGenerateImage(kind)}
                onUpload={e => handleImageUpload(kind, e)}
                onDelete={() => handleDeleteImage(kind)}
                onZoom={setLightboxImage}
            />
            <textarea style={{ height: 58 }} value={prompt} placeholder={t('story_editor.image_prompt_placeholder')} onChange={e => setPrompt(e.target.value)} onBlur={commitScpData} />
        </Field>
    );

    return (
        <div className="story-grid">
            <div>
                <h2>{t('story_editor.section_file')}</h2>
                {identity('designation', 'story_editor.designation', 'SCP-XXX', true, true)}
                {identity('containmentClass', 'story_editor.containment_class', 'Euclid')}
                {identity('name', 'story_editor.name', 'The ...', true)}
                {identity('role', 'story_editor.player_role', 'Researcher', true)}
                <p className="story-note">
                    {blueprint?.nodes.length ?? 0} {t('map_editor.nodes')} · {blueprint?.npcs.length ?? 0} {t('map_editor.npcs')} · {blueprint?.objectives.length ?? 0} {t('map_editor.objectives')}
                    <br />
                    {t('map_editor.auto_saved')}
                </p>
            </div>
            <div>
                <h2>{t('story_editor.section_narrative')}</h2>
                {draft('roleDetails', 'story_editor.role_details', 'story_editor.placeholder_role', 96)}
                {draft('storyBackground', 'story_editor.story_background', 'story_editor.placeholder_background', 150)}
                {draft('narrativeConstraints', 'story_editor.narrative_constraints', 'story_editor.placeholder_constraints', 96)}
                {draft('openingPrompt', 'story_editor.opening_prompt', 'story_editor.placeholder_opening', 96)}
            </div>
            <div>
                <h2>{t('story_editor.images')}</h2>
                {image('bg', 'story_editor.bg_image', scpData.storyDraft?.backgroundImage, bgImagePrompt, setBgImagePrompt, '16 / 9')}
                {image('entity', 'story_editor.entity_image', scpData.storyDraft?.entityImage, entityImagePrompt, setEntityImagePrompt, '1 / 1')}
            </div>
        </div>
    );
};

export default StoryFormPanel;
