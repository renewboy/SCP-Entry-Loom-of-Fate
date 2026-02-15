import { useCallback, useState } from 'react';
import { SCPData } from '../../types';
import { generateImage } from '../../services/aiService';

export const useStoryImageManager = ({
    scpData,
    setScpData
}: {
    scpData: SCPData;
    setScpData: React.Dispatch<React.SetStateAction<SCPData>>;
}) => {
    const [generatingState, setGeneratingState] = useState<{ bg: boolean; entity: boolean }>({ bg: false, entity: false });
    const [bgImagePrompt, setBgImagePrompt] = useState('');
    const [entityImagePrompt, setEntityImagePrompt] = useState('');
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const getBgPrompt = useCallback((data: SCPData) => {
        return `Atmospheric, cinematic lighting, abstract horror background representing ${data.visualDescription ? data.visualDescription : 'SCP Foundation'}, subtle, texture, scp foundation style, dark moody`;
    }, []);

    const getEntityPrompt = useCallback((data: SCPData) => {
        return `Close up full body shot of ${data.entityDescription ? data.entityDescription : data.designation}. detailed, photorealistic, containment cell, scp foundation record photo`;
    }, []);

    const setPromptsFromData = useCallback((data: SCPData) => {
        setBgImagePrompt(getBgPrompt(data));
        setEntityImagePrompt(getEntityPrompt(data));
    }, [getBgPrompt, getEntityPrompt]);

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
                }));
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
                }));
            }
        } catch (e) {
            alert("Image generation failed");
        } finally {
            setGeneratingState(prev => ({ ...prev, [type]: false }));
        }
    };

    const handleDeleteImage = (type: 'bg' | 'entity') => {
        setScpData(prev => ({
            ...prev,
            storyDraft: {
                ...(prev.storyDraft || {}),
                [type === 'bg' ? 'backgroundImage' : 'entityImage']: undefined
            }
        }));
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
        setPromptsFromData
    };
};
