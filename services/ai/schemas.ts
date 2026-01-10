import { z } from "zod";

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
