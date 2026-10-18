import { EntityProfile, SCPData } from '../../types';
import {
    AnalyzeScpDataSubmissionSchema,
    AnalyzeScpDataSubmissionJsonSchema,
    ProfileCandidatesSubmissionJsonSchema,
    ProfileCandidatesSubmissionSchema,
    repairAnalyzeScpData,
} from './schemas';

export interface SubmissionContract<T> {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    parse: (value: unknown) => T | null;
    errors: (value: unknown) => string[];
}

const schemaErrors = (schema: { safeParse: (value: unknown) => any }, value: unknown): string[] => {
    const result = schema.safeParse(value);
    return result.success ? [] : result.error.issues.map(
        (issue: any) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
};

export const profileCandidatesSubmission: SubmissionContract<EntityProfile[]> = {
    name: 'submit_profile_candidates',
    description: 'Submit the final character profile candidates after completing the required research.',
    parameters: ProfileCandidatesSubmissionJsonSchema,
    parse: (value) => {
        const result = ProfileCandidatesSubmissionSchema.safeParse(value);
        return result.success ? result.data.candidates as EntityProfile[] : null;
    },
    errors: (value) => schemaErrors(ProfileCandidatesSubmissionSchema, value),
};

export const scpAnalysisSubmission: SubmissionContract<SCPData> = {
    name: 'submit_scp_analysis',
    description: 'Submit the final structured SCP analysis after completing the required research.',
    parameters: AnalyzeScpDataSubmissionJsonSchema,
    parse: (value) => {
        const result = repairAnalyzeScpData(value);
        return result.valid && AnalyzeScpDataSubmissionSchema.safeParse(result.data).success
            ? result.data : null;
    },
    errors: (value) => schemaErrors(AnalyzeScpDataSubmissionSchema, repairAnalyzeScpData(value).data),
};

export const validateSubmission = <T>(contract: SubmissionContract<T>, value: unknown): T => {
    const data = contract.parse(value);
    if (data !== null) return data;
    const issues = contract.errors(value);
    const error = new Error(`Invalid ${contract.name} arguments: ${issues.join('; ')}`);
    Object.assign(error, { issues });
    throw error;
};

export const webSearchFunction = {
    name: 'web_search',
    description: 'Search authoritative SCP sources and return facts with source URLs.',
    parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'The SCP designation, role, and facts to research.' } },
        required: ['query'],
    },
};

export const toOpenAIResponseTool = <T>(contract: SubmissionContract<T>) => ({
    type: 'function',
    name: contract.name,
    description: contract.description,
    parameters: contract.parameters,
});

const GEMINI_SCHEMA_TYPES: Record<string, string> = {
    array: 'ARRAY',
    boolean: 'BOOLEAN',
    integer: 'INTEGER',
    number: 'NUMBER',
    object: 'OBJECT',
    string: 'STRING',
};

const toGeminiSchema = (schema: any): Record<string, unknown> => {
    const converted: Record<string, unknown> = {};
    if (typeof schema?.type === 'string' && GEMINI_SCHEMA_TYPES[schema.type]) {
        converted.type = GEMINI_SCHEMA_TYPES[schema.type];
    }
    if (schema?.description) converted.description = schema.description;
    if (schema?.format) converted.format = schema.format;
    for (const key of ['minItems', 'maxItems', 'minimum', 'maximum', 'minLength', 'maxLength']) {
        if (schema?.[key] !== undefined) converted[key] = schema[key];
    }
    if (Array.isArray(schema?.enum)) converted.enum = schema.enum;
    if (Array.isArray(schema?.required)) converted.required = schema.required;
    if (schema?.items) converted.items = toGeminiSchema(schema.items);
    if (schema?.properties && typeof schema.properties === 'object') {
        converted.properties = Object.fromEntries(
            Object.entries(schema.properties).map(([key, value]) => [key, toGeminiSchema(value)]),
        );
    }
    return converted;
};

export const toGeminiFunctionTool = <T>(contract: SubmissionContract<T>) => ({
    functionDeclarations: [{
        name: contract.name,
        description: contract.description,
        parameters: toGeminiSchema(contract.parameters),
    }],
});

export const getGeminiSubmissionConfig = <T>(contract: SubmissionContract<T>) => ({
    tools: [{
        functionDeclarations: [
            { ...webSearchFunction, parameters: toGeminiSchema(webSearchFunction.parameters) },
            ...toGeminiFunctionTool(contract).functionDeclarations,
        ],
    }],
    toolConfig: {
        functionCallingConfig: {
            mode: 'AUTO',
        },
    },
});
