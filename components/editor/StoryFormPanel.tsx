import React from 'react';
import { SCPData } from '../../types';

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
    isMobile?: boolean;
}

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
    setLightboxImage,
    isMobile = false
}) => {
    const getInputClass = (value: string | undefined) => {
        const baseClass = `w-full bg-black/50 border p-1 ${isMobile ? 'text-base' : 'text-xs'} text-scp-text focus:outline-none transition-colors`;
        const borderClass = showValidationErrors && !value 
            ? "border-red-500 focus:border-red-500 placeholder-red-900/50" 
            : "border-gray-700 focus:border-scp-accent";
        return `${baseClass} ${borderClass}`;
    };
    
    const getTextareaClass = () => {
        return `w-full bg-black/50 border border-gray-700 p-2 ${isMobile ? 'text-base' : 'text-xs'} text-scp-text focus:border-scp-accent focus:outline-none`;
    };
    
    const getBtnClass = () => {
        return isMobile 
            ? "text-xs px-3 py-2 min-h-[44px] bg-scp-accent/20 border border-scp-accent/50 text-scp-accent hover:bg-scp-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
            : "text-[12px] px-2 py-1 bg-scp-accent/20 border border-scp-accent/50 text-scp-accent hover:bg-scp-accent/40 disabled:opacity-50 disabled:cursor-not-allowed";
    };
    
    const getUploadBtnClass = () => {
        return isMobile
            ? "text-xs px-3 py-2 min-h-[44px] bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 cursor-pointer"
            : "text-[12px] px-2 py-1 bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 cursor-pointer";
    };

    return (
        <div className={`p-4 space-y-6 ${isMobile ? 'h-full overflow-y-auto' : ''}`}>
            <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                    <label className="text-[12px] text-scp-text-dim font-bold uppercase block">
                        {t('story_editor.designation')} <span className="text-red-500">*</span>
                    </label>
                    <input 
                        type="text"
                        value={scpData.designation}
                        onChange={e => setScpData({...scpData, designation: e.target.value}, 'deferred')}
                        onBlur={commitScpData}
                        className={getInputClass(scpData.designation)}
                        placeholder="SCP-XXX"
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[12px] text-scp-text-dim font-bold uppercase block">{t('story_editor.containment_class')}</label>
                    <input 
                        type="text"
                        value={scpData.containmentClass || ''}
                        onChange={e => setScpData({...scpData, containmentClass: e.target.value}, 'deferred')}
                        onBlur={commitScpData}
                        className="w-full bg-black/50 border border-gray-700 p-1 text-xs text-scp-text focus:border-scp-accent focus:outline-none"
                        placeholder="Euclid"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[12px] text-scp-text-dim font-bold uppercase block">
                        {t('story_editor.player_role')} <span className="text-red-500">*</span>
                    </label>
                    <input 
                        type="text"
                        value={scpData.role || ''}
                        onChange={e => setScpData({...scpData, role: e.target.value}, 'deferred')}
                        onBlur={commitScpData}
                        className={getInputClass(scpData.role)}
                        placeholder="Researcher"
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[12px] text-scp-text-dim font-bold uppercase block">
                        {t('story_editor.name')} <span className="text-red-500">*</span>
                    </label>
                    <input 
                        type="text"
                        value={scpData.name}
                        onChange={e => setScpData({...scpData, name: e.target.value}, 'deferred')}
                        onBlur={commitScpData}
                        className={getInputClass(scpData.name)}
                        placeholder="The ..."
                        required
                    />
                </div>
            </div>

            <div className="space-y-3">
                <label className="text-xs text-scp-text-dim font-bold uppercase block">{t('story_editor.role_details')}</label>
                <textarea 
                    value={scpData.storyDraft?.roleDetails || ''}
                    onChange={e => setScpData({...scpData, storyDraft: {...scpData.storyDraft, roleDetails: e.target.value}}, 'deferred')}
                    onBlur={commitScpData}
                    className={`${getTextareaClass()} h-20`}
                    placeholder={t('story_editor.placeholder_role')}
                />
            </div>
            <div className="space-y-3">
                <label className="text-xs text-scp-text-dim font-bold uppercase block">{t('story_editor.story_background')}</label>
                <textarea 
                    value={scpData.storyDraft?.storyBackground || ''}
                    onChange={e => setScpData({...scpData, storyDraft: {...scpData.storyDraft, storyBackground: e.target.value}}, 'deferred')}
                    onBlur={commitScpData}
                    className={`${getTextareaClass()} h-24`}
                    placeholder={t('story_editor.placeholder_background')}
                />
            </div>
            <div className="space-y-3">
                <label className="text-xs text-scp-text-dim font-bold uppercase block">{t('story_editor.narrative_constraints')}</label>
                <textarea 
                    value={scpData.storyDraft?.narrativeConstraints || ''}
                    onChange={e => setScpData({...scpData, storyDraft: {...scpData.storyDraft, narrativeConstraints: e.target.value}}, 'deferred')}
                    onBlur={commitScpData}
                    className={`${getTextareaClass()} h-16`}
                    placeholder={t('story_editor.placeholder_constraints')}
                />
            </div>
            <div className="space-y-3">
                <label className="text-xs text-scp-text-dim font-bold uppercase block">{t('story_editor.opening_prompt')}</label>
                <textarea 
                    value={scpData.storyDraft?.openingPrompt || ''}
                    onChange={e => setScpData({...scpData, storyDraft: {...scpData.storyDraft, openingPrompt: e.target.value}}, 'deferred')}
                    onBlur={commitScpData}
                    className={`${getTextareaClass()} h-20`}
                    placeholder={t('story_editor.placeholder_opening')}
                />
            </div>
            
            <div className="border-t border-gray-800 pt-4 space-y-4">
                <label className="text-xs text-scp-text-dim font-bold uppercase block">{t('story_editor.images')}</label>
                
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-[12px] text-gray-500">{t('story_editor.bg_image')}</span>
                    </div>
                    <textarea 
                        value={bgImagePrompt}
                        onChange={e => setBgImagePrompt(e.target.value)}
                        className={`w-full h-16 bg-black/50 border border-gray-700 p-2 ${isMobile ? 'text-xs' : 'text-[12px]'} text-scp-text focus:border-scp-accent focus:outline-none mb-1`}
                        placeholder="Prompt..."
                    />
                    <div className="flex gap-1 justify-end">
                        <button 
                            onClick={() => handleGenerateImage('bg')} 
                            disabled={generatingState.bg || generatingState.entity}
                            className={getBtnClass()}
                        >
                            {t('story_editor.btn_generate')}
                        </button>
                        <label className={getUploadBtnClass()}>
                            {t('story_editor.btn_upload')}
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload('bg', e)} />
                        </label>
                    </div>
                    <div 
                        className={`w-full aspect-video bg-black/50 border border-gray-800 relative flex items-center justify-center overflow-hidden group cursor-pointer ${isMobile ? 'max-h-[40vh]' : ''}`}
                        onClick={() => scpData.storyDraft?.backgroundImage && setLightboxImage(scpData.storyDraft.backgroundImage)}
                    >
                        {scpData.storyDraft?.backgroundImage && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteImage('bg');
                                }}
                                className="absolute top-1 right-1 bg-black/70 hover:bg-red-900/80 text-white p-1 rounded-sm z-20 transition-colors opacity-0 group-hover:opacity-100"
                                title={t('common.delete')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                        {generatingState.bg && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col gap-2 items-center justify-center z-10 cursor-default" onClick={(e) => e.stopPropagation()}>
                                <div className="w-8 h-8 border-2 border-scp-accent border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-[12px] text-scp-accent animate-pulse">GENERATING...</span>
                            </div>
                        )}
                        {scpData.storyDraft?.backgroundImage ? (
                            <img src={scpData.storyDraft.backgroundImage} alt="Background" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                        ) : (
                            <span className="text-gray-700 text-xs">No Image</span>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-[12px] text-gray-500">{t('story_editor.entity_image')}</span>
                    </div>
                    <textarea 
                        value={entityImagePrompt}
                        onChange={e => setEntityImagePrompt(e.target.value)}
                        className={`w-full h-16 bg-black/50 border border-gray-700 p-2 ${isMobile ? 'text-xs' : 'text-[12px]'} text-scp-text focus:border-scp-accent focus:outline-none mb-1`}
                        placeholder="Prompt..."
                    />
                    <div className="flex gap-1 justify-end">
                        <button 
                            onClick={() => handleGenerateImage('entity')}
                            disabled={generatingState.bg || generatingState.entity}
                            className={getBtnClass()}
                        >
                            {t('story_editor.btn_generate')}
                        </button>
                        <label className={getUploadBtnClass()}>
                            {t('story_editor.btn_upload')}
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload('entity', e)} />
                        </label>
                    </div>
                    <div 
                        className={`w-full aspect-square bg-black/50 border border-gray-800 relative flex items-center justify-center overflow-hidden group cursor-pointer ${isMobile ? 'max-h-[40vh]' : ''}`}
                        onClick={() => scpData.storyDraft?.entityImage && setLightboxImage(scpData.storyDraft.entityImage)}
                    >
                        {scpData.storyDraft?.entityImage && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteImage('entity');
                                }}
                                className="absolute top-1 right-1 bg-black/70 hover:bg-red-900/80 text-white p-1 rounded-sm z-20 transition-colors opacity-0 group-hover:opacity-100"
                                title={t('common.delete')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                        {generatingState.entity && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col gap-2 items-center justify-center z-10 cursor-default" onClick={(e) => e.stopPropagation()}>
                                <div className="w-8 h-8 border-2 border-scp-accent border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-[12px] text-scp-accent animate-pulse">GENERATING...</span>
                            </div>
                        )}
                        {scpData.storyDraft?.entityImage ? (
                            <img src={scpData.storyDraft.entityImage} alt="Entity" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        ) : (
                            <span className="text-gray-700 text-xs">No Image</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoryFormPanel;
