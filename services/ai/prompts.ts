import { GameDifficulty, Language, MapBlueprint, StoryDraft, LegacyData, EntityProfile } from '../../types';
import { translate } from '../../utils/i18n';
import { ContextPromptAnchors } from './types';
import { joinPromptSections, renderPromptTemplate } from './promptTemplateEngine';
import systemInstructionTemplate from './templates/systemInstruction.njk?raw';
import analyzeScpPromptTemplate from './templates/analyzeScpPrompt.njk?raw';
import profileCandidatesPromptTemplate from './templates/profileCandidatesPrompt.njk?raw';
import startGamePromptTemplate from './templates/startGamePrompt.njk?raw';
import normalTurnRequirementsTemplate from './templates/normalTurnRequirements.njk?raw';
import contextPromptTemplate from './templates/contextPrompt.njk?raw';
import legacyGenerationPromptTemplate from './templates/legacyGenerationPrompt.njk?raw';
import compressionPromptTemplate from './templates/compressionPrompt.njk?raw';
import audioDramaPromptTemplate from './templates/audioDramaPrompt.njk?raw';
import gameReviewPromptTemplate from './templates/gameReviewPrompt.njk?raw';
import qaPromptTemplate from './templates/qaPrompt.njk?raw';

export const getSystemInstruction = (_role: string, language: Language) =>
    renderPromptTemplate(systemInstructionTemplate, {
        outputLanguage: translate(language, 'i18n.prompt_language_labels.zh')
    });

export const getAnalyzeSCPPrompt = (input: string, language: Language, role: string, difficulty: GameDifficulty, legacyData?: LegacyData, profile?: EntityProfile) => {
    const langInstruction = translate(language, 'i18n.prompt_language_labels.en');
    return renderPromptTemplate(analyzeScpPromptTemplate, {
        input,
        role,
        difficulty,
        languageInstruction: langInstruction,
        legacy: legacyData || null,
        profile: profile || null
    });
};

export const getProfileCandidatesPrompt = (role: string, scpDesignation: string, language: Language, legacyData?: LegacyData) => {
    const langInstruction = translate(language, 'i18n.prompt_language_labels.en');
    return renderPromptTemplate(profileCandidatesPromptTemplate, {
        role,
        scpDesignation,
        languageInstruction: langInstruction,
        legacy: legacyData || null
    });
};

const getNormalTurnRequirements = (langInstruction: string) =>
    renderPromptTemplate(normalTurnRequirementsTemplate, {
        outputLanguage: langInstruction
    });

export const getStartGamePrompt = (
    role: string,
    scpDesignation: string,
    containmentClass: string,
    language: Language,
    difficulty: GameDifficulty,
    legacyData?: LegacyData,
    mapBlueprint?: MapBlueprint,
    storyDraft?: StoryDraft,
    npcVisuals?: Record<string, string>
) => {
    const langInstruction = translate(language, 'i18n.prompt_language_labels.zh');
    const isEmptyStoryDraft = Object.values(storyDraft || {}).every(value => !value);
    const sanitizedMapBlueprint = mapBlueprint ? {
        ...mapBlueprint,
        nodes: mapBlueprint.nodes.map(({ layout, ...rest }) => rest)
    } : null;
    const hasNpcVisuals = Boolean(npcVisuals && Object.keys(npcVisuals).length > 0);

    return renderPromptTemplate(startGamePromptTemplate, {
        role,
        scpDesignation,
        containmentClass,
        difficulty,
        hasStoryDraft: !isEmptyStoryDraft,
        storyDraftRoleDetails: storyDraft?.roleDetails || 'N/A',
        storyDraftBackground: storyDraft?.storyBackground || 'N/A',
        storyDraftNarrativeConstraints: storyDraft?.narrativeConstraints || 'N/A',
        storyDraftOpeningPrompt: storyDraft?.openingPrompt || 'N/A',
        hasLegacy: Boolean(legacyData),
        legacy: legacyData || null,
        hasMapBlueprint: Boolean(sanitizedMapBlueprint),
        mapBlueprintJson: sanitizedMapBlueprint ? JSON.stringify(sanitizedMapBlueprint) : '',
        hasNpcVisuals,
        npcVisualsJson: hasNpcVisuals ? JSON.stringify(npcVisuals) : '',
        outputLanguage: langInstruction,
    });
};

export const getLegacyGenerationPrompt = (ending: string, role: string, language: Language) => {
    return renderPromptTemplate(legacyGenerationPromptTemplate, {
        ending,
        role,
        outputLanguage: translate(language, 'i18n.prompt_language_labels.en')
    });
};

export const getCompressionPrompt = (historyText: string, language: Language, firstMessageContent?: string) => {
    return renderPromptTemplate(compressionPromptTemplate, {
        hasFirstMessageContent: Boolean(firstMessageContent),
        firstMessageContent: firstMessageContent || '',
        historyText,
        outputLanguage: translate(language, 'i18n.prompt_language_labels.en')
    });
}

export const getContextPrompt = (
    action: string,
    currentStability: number,
    turnCount: number,
    language: Language,
    ragContext?: string,
    mapContext?: string,
    promptAnchors?: ContextPromptAnchors
) => {
    const langInstruction = translate(language, 'i18n.prompt_language_labels.zh');
    const normalTurnReminder = getNormalTurnRequirements(langInstruction);

    const contextPrompt = renderPromptTemplate(contextPromptTemplate, {
        currentStability,
        turnCount,
        action,
        outputLanguage: langInstruction,
        anchorBeforeItems: (promptAnchors?.anchorBefore || []).map(item => item.trim()).filter(Boolean),
        ragContext: ragContext?.trim() || '',
        mapContext: mapContext?.trim() || '',
        normalTurnReminder: joinPromptSections(normalTurnReminder),
        anchorAfterItems: (promptAnchors?.anchorAfter || []).map(item => item.trim()).filter(Boolean)
    });
    console.log("getContextPrompt: ", contextPrompt);
    return contextPrompt;
};

export const getAudioDramaPrompt = (storyLog: string, role: string, scpDesignation: string, language: Language) => {
    return renderPromptTemplate(audioDramaPromptTemplate, {
        storyLog,
        role,
        scpDesignation,
        outputLanguage: translate(language, 'i18n.prompt_language_labels.en')
    });
};

export const getGameReviewPrompt = (role: string, ending: string, language: Language) => {
    return renderPromptTemplate(gameReviewPromptTemplate, {
        role,
        ending,
        outputLanguage: translate(language, 'i18n.prompt_language_labels.en')
    });
};

export const getQAPrompt = (question: string, language: Language) => {
    return renderPromptTemplate(qaPromptTemplate, {
        question,
        outputLanguage: translate(language, 'i18n.prompt_language_labels.zh')
    });
};
