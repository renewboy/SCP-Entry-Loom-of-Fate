import type { Content, GenerateContentResponse, Part } from '@google/genai';
import type { ChatCompletionChunk, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type {
    Response as OpenAIResponse,
    ResponseInputItem,
    ResponseOutputItem,
    ResponseStreamEvent,
} from 'openai/resources/responses/responses';
import type {
    AgentModelAdapter,
    AgentTextDelta,
    AgentToolCall,
    AgentToolResponse,
    AgentTurn,
} from './agentLoop';
import { postJson, streamSse } from './providers/backendClient';

export interface AgentHttpRequest<HistoryEntry> {
    readonly path: string;
    readonly stream?: boolean;
    readonly buildRequest: (history: readonly HistoryEntry[]) => unknown;
}

type AgentTransport<HistoryEntry, Response> =
    (history: readonly HistoryEntry[], signal?: AbortSignal) => AsyncIterable<Response>;

export class AgentModelError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AgentModelError';
    }
}

const createTransport = <HistoryEntry, Response>(
    request: AgentHttpRequest<HistoryEntry>,
): AgentTransport<HistoryEntry, Response> => {
    if (request.stream) {
        return (history, signal) => streamSse<Response>(request.path, request.buildRequest(history), { signal });
    }
    return async function* (history, signal) {
        const body = request.buildRequest(history);
        yield signal
            ? await postJson<Response>(request.path, body, { signal })
            : await postJson<Response>(request.path, body);
    };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

const toolOutput = (output: unknown): Record<string, unknown> =>
    isRecord(output) ? output : { result: output ?? null };

type GeminiResponse = Pick<GenerateContentResponse, 'candidates' | 'promptFeedback'>;

export class GeminiAgentAdapter implements AgentModelAdapter<Content> {
    private readonly transport: AgentTransport<Content, GeminiResponse>;

    constructor(request: AgentHttpRequest<Content>) {
        this.transport = createTransport(request);
    }

    async *generate(history: readonly Content[], signal?: AbortSignal): AsyncGenerator<AgentTextDelta, AgentTurn<Content>> {
        const parts: Part[] = [];
        let text = '';
        for await (const response of this.transport(history, signal)) {
            const candidate = response.candidates?.[0];
            const failure = response.promptFeedback?.blockReason
                || (candidate?.finishReason && candidate.finishReason !== 'STOP' ? candidate.finishReason : undefined);
            if (failure) throw new AgentModelError(`Gemini generation failed: ${failure}`);
            for (const part of candidate?.content?.parts || []) {
                // Native parts, including signatures, retain their order and boundaries.
                parts.push(part);
                if (!part.thought && part.text) {
                    text += part.text;
                    yield { type: 'assistant_delta', delta: part.text };
                }
            }
        }
        const calls: AgentToolCall[] = [];
        const nativeParts = parts.map(part => {
            const call = part.functionCall;
            if (!call) return part;
            if (!call.name) throw new AgentModelError('Gemini returned a function call without a name');
            const id = call.id || `call_${crypto.randomUUID()}`;
            calls.push({ id, name: call.name, arguments: call.args });
            return call.id ? part : { ...part, functionCall: { ...call, id } };
        });
        return { text, calls, history: nativeParts.length ? [{ role: 'model', parts: nativeParts }] : [] };
    }

    encodeToolResults(results: readonly AgentToolResponse[]): Content[] {
        return [{
            role: 'user',
            parts: results.map(({ call, output }) => ({
                functionResponse: { id: call.id, name: call.name, response: toolOutput(output) },
            })),
        }];
    }
}

interface ChatFunctionCall {
    id?: string;
    name: string;
    arguments: string;
}

export class OpenAIChatAgentAdapter implements AgentModelAdapter<ChatCompletionMessageParam> {
    private readonly transport: AgentTransport<ChatCompletionMessageParam, ChatCompletionChunk>;

    constructor(request: AgentHttpRequest<ChatCompletionMessageParam>) {
        this.transport = createTransport(request);
    }

    async *generate(
        history: readonly ChatCompletionMessageParam[],
        signal?: AbortSignal,
    ): AsyncGenerator<AgentTextDelta, AgentTurn<ChatCompletionMessageParam>> {
        const accumulated = new Map<number, ChatFunctionCall>();
        let text = '';
        for await (const chunk of this.transport(history, signal)) {
            const choice = chunk.choices?.[0];
            if (!choice) continue;
            if (choice.finish_reason && !['stop', 'tool_calls'].includes(choice.finish_reason)) {
                throw new AgentModelError(`OpenAI chat generation failed: ${choice.finish_reason}`);
            }
            if (choice.delta.content) {
                text += choice.delta.content;
                yield { type: 'assistant_delta', delta: choice.delta.content };
            }
            for (const fragment of choice.delta.tool_calls || []) {
                const call = accumulated.get(fragment.index) || { name: '', arguments: '' };
                call.id = fragment.id || call.id;
                call.name += fragment.function?.name || '';
                call.arguments += fragment.function?.arguments || '';
                accumulated.set(fragment.index, call);
            }
        }
        const calls = [...accumulated.values()].map(call => {
            if (!call.id || !call.name) throw new AgentModelError('OpenAI chat returned an incomplete function call');
            return { id: call.id, name: call.name, arguments: call.arguments };
        });
        const entries: ChatCompletionMessageParam[] = text || calls.length ? [{
            role: 'assistant',
            content: text || null,
            ...(calls.length ? {
                tool_calls: calls.map(call => ({
                    type: 'function',
                    id: call.id,
                    function: { name: call.name, arguments: call.arguments },
                })),
            } : {}),
        }] : [];
        return { text, calls, history: entries };
    }

    encodeToolResults(results: readonly AgentToolResponse[]): ChatCompletionMessageParam[] {
        return results.map(({ call, output }) => ({
            role: 'tool', tool_call_id: call.id, content: JSON.stringify(output ?? null),
        }));
    }
}

export type ResponsesHistoryEntry = ResponseInputItem | ResponseOutputItem;

const responseText = (response: OpenAIResponse): string =>
    response.output_text || response.output.filter(item => item.type === 'message')
        .flatMap(item => item.content).filter(part => part.type === 'output_text')
        .map(part => part.text).join('');

export class OpenAIResponsesAgentAdapter implements AgentModelAdapter<ResponsesHistoryEntry> {
    private readonly transport: AgentTransport<ResponsesHistoryEntry, OpenAIResponse | ResponseStreamEvent>;

    constructor(request: AgentHttpRequest<ResponsesHistoryEntry>) {
        this.transport = createTransport(request);
    }

    async *generate(
        history: readonly ResponsesHistoryEntry[],
        signal?: AbortSignal,
    ): AsyncGenerator<AgentTextDelta, AgentTurn<ResponsesHistoryEntry>> {
        let completed: OpenAIResponse | undefined;
        let text = '';
        for await (const response of this.transport(history, signal)) {
            if (!('type' in response)) {
                completed = response;
                continue;
            }
            switch (response.type) {
                case 'response.output_text.delta':
                    text += response.delta;
                    yield { type: 'assistant_delta', delta: response.delta };
                    break;
                case 'response.completed':
                    completed = response.response;
                    break;
                case 'response.failed':
                case 'response.incomplete':
                    throw new AgentModelError(response.response.error?.message || `OpenAI generation failed: ${response.type}`);
                case 'error':
                    throw new AgentModelError(response.message);
            }
        }
        if (!completed) throw new AgentModelError('OpenAI Responses stream ended without a completed response');
        if (completed.error || (completed.status && completed.status !== 'completed')) {
            throw new AgentModelError(completed.error?.message || `OpenAI generation failed: ${completed.status}`);
        }
        if (!text) {
            text = responseText(completed);
            if (text) yield { type: 'assistant_delta', delta: text };
        }
        const calls = completed.output.filter(item => item.type === 'function_call').map((call): AgentToolCall => {
            if (!call.call_id || !call.name) throw new AgentModelError('OpenAI Responses returned an incomplete function call');
            return { id: call.call_id, name: call.name, arguments: call.arguments };
        });
        return { text, calls, history: completed.output };
    }

    encodeToolResults(results: readonly AgentToolResponse[]): ResponsesHistoryEntry[] {
        return results.map(({ call, output }) => ({
            type: 'function_call_output', call_id: call.id, output: JSON.stringify(output ?? null),
        }));
    }
}
