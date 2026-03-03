import { useCallback, useState } from 'react';
import { SCPData } from '../../types';
import { generateImage } from '../../services/aiService';
import { enhanceBackgroundPrompt, enhanceEntityPrompt, enhanceNpcPrompt } from '../../services/ai/promptUtils';

export const useStoryImageManager = ({
    scpData,
    setScpData
}: {
    scpData: SCPData;
    setScpData: (newState: SCPData | ((prev: SCPData) => SCPData), commitMode?: 'immediate' | 'deferred') => void;
}) => {
    const [generatingState, setGeneratingState] = useState<{ bg: boolean; entity: boolean; npc: Record<string, boolean> }>({ bg: false, entity: false, npc: {} });
    const [bgImagePrompt, setBgImagePrompt] = useState('');
    const [entityImagePrompt, setEntityImagePrompt] = useState('');
    const [npcImagePrompts, setNpcImagePrompts] = useState<Record<string, string>>({});
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const getBgPrompt = useCallback((data: SCPData) => {
        return enhanceBackgroundPrompt(data.visualDescription ? data.visualDescription : 'SCP Foundation');
    }, []);

    const getEntityPrompt = useCallback((data: SCPData) => {
        return enhanceEntityPrompt(data.entityDescription ? data.entityDescription : data.designation);
    }, []);

    const setPromptsFromData = useCallback((data: SCPData) => {
        setBgImagePrompt(getBgPrompt(data));
        setEntityImagePrompt(getEntityPrompt(data));
        setNpcImagePrompts(data.npcVisuals || {});
    }, [getBgPrompt, getEntityPrompt]);

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
            const prompt = type === 'bg' ? bgImagePrompt : entityImagePrompt;
            const url = await generateImage(prompt, type === 'bg' ? "16:9" : "1:1");
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
