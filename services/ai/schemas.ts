import Ajv from "ajv";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SCPData } from "../../types";
import { normalizeAnalyzeScpData } from "./utils";

// --- Audio Drama Schemas ---

export const AudioDramaSchema = z.object({
    title: z.string(),
    cast: z.array(z.object({
        name: z.string(),
        role: z.string(),
        voiceDesc: z.string(),
        gender: z.enum(['male', 'female', 'neutral', 'robot'])
    })),
    scenes: z.array(z.object({
        id: z.number(),
        location: z.string(),
        originalMessageId: z.string(),
        bgmMood: z.string().optional(),
        lines: z.array(z.object({
            id: z.string(),
            speaker: z.string(),
            text: z.string().max(200),
            emotion: z.string().optional(),
            sfx: z.string().optional()
        }))
    }))
});

// --- Game Review Schemas ---

const ImpactEnum = z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL"]);
const EffectivenessEnum = z.enum(["HIGH", "MEDIUM", "LOW"]);
const RankEnum = z.enum(["S", "A", "B", "C", "D", "F"]);

const EvaluationSchema = z.object({
    rank: RankEnum,
    score: z.number().min(0).max(100),
    verdict: z.string()
});

const TimelineAnalysisSchema = z.object({
    turn: z.number().min(0),
    event: z.string(),
    analysis: z.string(),
    impact: ImpactEnum
});

const ObjectiveBreakdownSchema = z.object({
    objective: z.string(),
    completion: z.number().min(0).max(100),
    evidence: z.string(),
    missedOpportunity: z.string()
});

const RiskByTurnSchema = z.object({
    turn: z.number().min(0),
    risk: z.number().min(0),
    reason: z.string(),
    betterMove: z.string()
});

const RiskAssessmentSchema = z.object({
    overall: z.number().min(0),
    volatilityComment: z.string(),
    riskByTurn: z.array(RiskByTurnSchema)
});

const TacticsMatrixSchema = z.object({
    tactic: z.string(),
    count: z.number().min(0),
    effectiveness: EffectivenessEnum,
    note: z.string()
});

const CounterfactualSchema = z.object({
    title: z.string(),
    change: z.string(),
    expectedOutcome: z.string(),
    tradeoff: z.string()
});

const PerspectiveEvaluationSchema = z.object({
    sourceName: z.string(),
    stance: z.string(),
    comment: z.string()
});

const AchievementSchema = z.object({
    title: z.string(),
    description: z.string()
});

export const OperationEvaluationSchema = z.object({
    operationName: z.string(),
    clearanceLevel: z.string(),
    evaluation: EvaluationSchema,
    summary: z.string(),
    timelineAnalysis: z.array(TimelineAnalysisSchema),
    objectiveBreakdown: z.array(ObjectiveBreakdownSchema),
    riskAssessment: RiskAssessmentSchema,
    tacticsMatrix: z.array(TacticsMatrixSchema),
    counterfactuals: z.array(CounterfactualSchema),
    psychProfile: z.string(),
    strategicAdvice: z.string(),
    perspectiveEvaluations: z.array(PerspectiveEvaluationSchema),
    achievements: z.array(AchievementSchema)
});

// --- Analyze SCP Schemas ---

const StringArraySchema = z.array(z.string());

const MapBlueprintNodeSchema = z.object({
    id: z.string(),
    name: z.string(),
    danger: z.number().optional(),
    tags: StringArraySchema.optional(),
    discoverables: StringArraySchema.optional(),
    interactables: StringArraySchema.optional(),
    visualHint: z.string().optional(),
    requires: StringArraySchema.optional(),
    blockedText: z.string().optional(),
    layout: z.object({x: z.number(), y: z.number()}).optional(),
});

const MapBlueprintEdgeSchema = z.object({
    from: z.string(),
    to: z.string(),
    bidirectional: z.boolean(),
});

const MapBlueprintNPCSchema = z.object({
    id: z.string(),
    name: z.string(),
    archetype: z.string().optional(),
    initialNodeId: z.string(),
    secretTags: StringArraySchema.optional(),
    dialogueGoals: StringArraySchema.optional(),
});

const ObjectiveRewardSchema = z.object({
    accessTokens: StringArraySchema.optional(),
    stabilityDelta: z.number().optional(),
});

const MapBlueprintObjectiveSchema = z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(["MAIN", "SIDE"]),
    nodeId: z.string(),
    progress: z.number().optional(),
    detail: z.string().optional(),
    reward: ObjectiveRewardSchema.optional(),
});

const MapBlueprintSchema = z.object({
    id: z.string(),
    title: z.string(),
    startNodeId: z.string(),
    nodes: z.array(MapBlueprintNodeSchema),
    edges: z.array(MapBlueprintEdgeSchema),
    npcs: z.array(MapBlueprintNPCSchema),
    objectives: z.array(MapBlueprintObjectiveSchema),
});

const StoryDraftSchema = z.object({
    roleDetails: z.string().optional(),
    storyBackground: z.string().optional(),
    narrativeConstraints: z.string().optional(),
    openingPrompt: z.string().optional(),
    backgroundImage: z.string().optional(),
    entityImage: z.string().optional(),
});

export const AnalyzeScpDataSchema = z.object({
    designation: z.string(),
    name: z.string(),
    containmentClass: z.string(),
    role: z.string(),
    visualDescription: z.string().optional(),
    entityDescription: z.string().optional(),
    npcVisuals: z.record(z.string()).optional(),
    npcImages: z.record(z.string()).optional(),
    mapBlueprint: MapBlueprintSchema.optional(),
    storyDraft: StoryDraftSchema.optional(),
});

export const AnalyzeScpDataJsonSchema = zodToJsonSchema(AnalyzeScpDataSchema, "AnalyzeScpData");

const analyzeScpDataValidator = new Ajv({ allErrors: true }).compile(AnalyzeScpDataJsonSchema);

export const validateAnalyzeScpData = (value: unknown): { valid: boolean; errors: string[] } => {
    const valid = analyzeScpDataValidator(value);

    if (valid) {
        return { valid: true, errors: [] };
    }

    const errors = (analyzeScpDataValidator.errors || []).map(error => {
        const path = error.dataPath || "(root)";
        return `${path} ${error.message || "is invalid"}`;
    });

    return { valid: false, errors };
};

export const repairAnalyzeScpData = (value: unknown): {
    data: SCPData;
    valid: boolean;
    repaired: boolean;
    initialErrors: string[];
    finalErrors: string[];
} => {
    const initialValidation = validateAnalyzeScpData(value);

    if (initialValidation.valid) {
        return {
            data: value as SCPData,
            valid: true,
            repaired: false,
            initialErrors: [],
            finalErrors: []
        };
    }

    const repairedData = normalizeAnalyzeScpData(value);
    const finalValidation = validateAnalyzeScpData(repairedData);

    return {
        data: repairedData,
        valid: finalValidation.valid,
        repaired: true,
        initialErrors: initialValidation.errors,
        finalErrors: finalValidation.errors
    };
};
