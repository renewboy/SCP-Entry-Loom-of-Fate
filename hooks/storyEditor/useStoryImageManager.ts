import { useCallback, useState, useEffect } from 'react';
import { SCPData } from '../../types';
import { generateImage } from '../../services/aiService';
import { enhanceBackgroundPrompt, enhanceEntityPrompt, enhanceNpcPrompt } from '../../services/ai/promptUtils';
import { getBackgroundAspectRatio } from '../../services/ai/utils';

export const useStoryImageManager = ({
    scpData,
    setScpData
}: {
    scpData: SCPData;
    setScpData: (newState: SCPData | ((prev: SCPData) => SCPData), commitMode?: 'immediate' | 'deferred') => void;
}) => {
    const [generatingState, setGeneratingState] = useState<{ bg: boolean; entity: boolean; npc: Record<string, boolean> }>({ bg: false, entity: false, npc: {} });
    const [bgImagePrompt, setBgImagePromptState] = useState('');
    const [entityImagePrompt, setEntityImagePromptState] = useState('');
    const [npcImagePrompts, setNpcImagePrompts] = useState<Record<string, string>>({});
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const getBgPrompt = useCallback((data: SCPData) => {
        return data.visualDescription ? data.visualDescription : 'SCP Foundation';
    }, []);

    const getEntityPrompt = useCallback((data: SCPData) => {
        return data.entityDescription ? data.entityDescription : data.designation;
    }, []);

    const setPromptsFromData = useCallback((data: SCPData) => {
        setBgImagePromptState(getBgPrompt(data));
        setEntityImagePromptState(getEntityPrompt(data));
        setNpcImagePrompts(data.npcVisuals || {});
    }, [getBgPrompt, getEntityPrompt]);

    useEffect(() => {
        const nextBg = getBgPrompt(scpData);
        const nextEntity = getEntityPrompt(scpData);
        if (bgImagePrompt !== nextBg) setBgImagePromptState(nextBg);
        if (entityImagePrompt !== nextEntity) setEntityImagePromptState(nextEntity);
    }, [scpData, getBgPrompt, getEntityPrompt, bgImagePrompt, entityImagePrompt]);

    useEffect(() => {
        const nextNpcPrompts = scpData.npcVisuals || {};
        if (JSON.stringify(npcImagePrompts) !== JSON.stringify(nextNpcPrompts)) {
            setNpcImagePrompts(nextNpcPrompts);
        }
    }, [scpData.npcVisuals, npcImagePrompts]);

    const setBgImagePrompt = useCallback((value: string) => {
        setBgImagePromptState(value);
        setScpData(prev => ({
            ...prev,
            visualDescription: value
        }), 'deferred');
    }, [setScpData]);

    const setEntityImagePrompt = useCallback((value: string) => {
        setEntityImagePromptState(value);
        setScpData(prev => ({
            ...prev,
            entityDescription: value
        }), 'deferred');
    }, [setScpData]);

    const handleNpcPromptChange = (npcId: string, value: string) => {
        setNpcImagePrompts(prev => ({ ...prev, [npcId]: value }));
        // Also update SCPData to keep prompts in sync
        setScpData(prev => ({
            ...prev,
            npcVisuals: {
                ...(prev.npcVisuals || {}),
                [npcId]: value
            }
        }), 'deferred');
    };

    const handleImageUpload = (type: 'bg' | 'entity', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setScpData(prev => ({
                    ...prev,
                    storyDraft: {
                        ...(prev.storyDraft || {}),
                        [type === 'bg' ? 'backgroundImage' : 'entityImage']: reader.result as string
                    }
                }), 'immediate');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerateImage = async (type: 'bg' | 'entity') => {
        setGeneratingState(prev => ({ ...prev, [type]: true }));
        try {
            const prompt = type === 'bg' ? enhanceBackgroundPrompt(bgImagePrompt) : enhanceEntityPrompt(entityImagePrompt);
            const url = await generateImage(prompt, type === 'bg' ? getBackgroundAspectRatio() : "1:1");
            if (url) {
                setScpData(prev => ({
                    ...prev,
                    storyDraft: {
                        ...(prev.storyDraft || {}),
                        [type === 'bg' ? 'backgroundImage' : 'entityImage']: url
                    }
                }), 'immediate');
            }
        } catch (e) {
            alert("Image generation failed");
        } finally {
            setGeneratingState(prev => ({ ...prev, [type]: false }));
        }
    };

    const handleGenerateNPCImage = async (npcId: string) => {
        setGeneratingState(prev => ({ 
            ...prev, 
            npc: { ...prev.npc, [npcId]: true } 
        }));
        try {
            const basePrompt = npcImagePrompts[npcId];
            if (!basePrompt) return;
            
            // Add fallback style prompts for consistency
            const enhancedPrompt = enhanceNpcPrompt(basePrompt);
            
            const url = await generateImage(enhancedPrompt, "1:1");
            if (url) {
                setScpData(prev => ({
                    ...prev,
                    npcImages: {
                        ...(prev.npcImages || {}),
                        [npcId]: url
                    }
                }), 'immediate');
            }
        } catch (e) {
            alert("NPC Image generation failed");
        } finally {
            setGeneratingState(prev => ({ 
                ...prev, 
                npc: { ...prev.npc, [npcId]: false } 
            }));
        }
    };

    const handleUploadNPCImage = (npcId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setScpData(prev => ({
                    ...prev,
                    npcImages: {
                        ...(prev.npcImages || {}),
                        [npcId]: reader.result as string
                    }
                }), 'immediate');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDeleteNPCImage = (npcId: string) => {
        setScpData(prev => {
            const newImages = { ...(prev.npcImages || {}) };
            delete newImages[npcId];
            return {
                ...prev,
                npcImages: newImages
            };
        }, 'immediate');
    };

    const handleDeleteImage = (type: 'bg' | 'entity') => {
        setScpData(prev => ({
            ...prev,
            storyDraft: {
                ...(prev.storyDraft || {}),
                [type === 'bg' ? 'backgroundImage' : 'entityImage']: undefined
            }
        }), 'immediate');
    };

    return {
        generatingState,
        bgImagePrompt,
        setBgImagePrompt,
        entityImagePrompt,
        setEntityImagePrompt,
        lightboxImage,
        setLightboxImage,
        handleImageUpload,
        handleGenerateImage,
        handleDeleteImage,
        setPromptsFromData,
        npcImagePrompts,
        handleNpcPromptChange,
        handleGenerateNPCImage,
        handleUploadNPCImage,
        handleDeleteNPCImage
    };
};
