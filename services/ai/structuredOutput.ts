import { EntityProfile, SCPData } from '../../types';
import {
    AnalyzeScpDataSubmissionJsonSchema,
    ProfileCandidatesSubmissionJsonSchema,
    ProfileCandidatesSubmissionSchema,
    repairAnalyzeScpData,
} from './schemas';
import { safeParseJson } from './utils';

type SubmissionProtocol = 'gemini' | 'openai';

interface SubmissionContract<T> {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    parse: (value: unknown) => T | null;
}

export const profileCandidatesSubmission: SubmissionContract<EntityProfile[]> = {
    name: 'submit_profile_candidates',
    description: 'Submit the final character profile candidates after completing the required research.',
    parameters: ProfileCandidatesSubmissionJsonSchema,
    parse: (value) => {
        const result = ProfileCandidatesSubmissionSchema.safeParse(value);
        return result.success ? result.data.candidates as EntityProfile[] : null;
    },
};

export const scpAnalysisSubmission: SubmissionContract<SCPData> = {
    name: 'submit_scp_analysis',
    description: 'Submit the final structured SCP analysis after completing the required research.',
    parameters: AnalyzeScpDataSubmissionJsonSchema,
    parse: (value) => {
        const result = repairAnalyzeScpData(value);
        return result.valid ? result.data : null;
    },
};

export const getSubmissionInstruction = <T>(contract: SubmissionContract<T>) =>
    `After completing the required research, call ${contract.name} exactly once with the final result. Do not return the result as plain text.`;

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
    tools: [toGeminiFunctionTool(contract)],
    toolConfig: {
        functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: [contract.name],
        },
    },
});

const parseArguments = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;
    return safeParseJson(value);
};

export const parseStructuredSubmission = <T>(
    response: any,
    protocol: SubmissionProtocol,
    contract: SubmissionContract<T>,
): T | null => {
    if (protocol === 'openai') {
        const call = response?.output?.find(
            (item: any) => item?.type === 'function_call' && item?.name === contract.name,
        );
        return contract.parse(parseArguments(call?.arguments));
    }

    const call = response?.functionCalls?.find((item: any) => item?.name === contract.name)
        || response?.candidates?.[0]?.content?.parts?.find(
            (part: any) => part?.functionCall?.name === contract.name,
        )?.functionCall;
    return contract.parse(parseArguments(call?.args ?? call?.arguments));
};
