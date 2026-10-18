import type { AgentStreamEvent } from './streamProtocol';

export type AgentArguments = Readonly<Record<string, unknown>>;
export type AgentTextDelta = Extract<AgentStreamEvent, { type: 'assistant_delta' }>;

export interface AgentToolCall {
    readonly id: string;
    readonly name: string;
    readonly arguments: unknown;
}

export interface AgentTurn<HistoryEntry> {
    readonly history: readonly HistoryEntry[];
    readonly calls: readonly AgentToolCall[];
    readonly text: string;
}

export interface AgentToolResponse {
    readonly call: AgentToolCall;
    readonly output: unknown;
}

export interface AgentModelAdapter<HistoryEntry> {
    generate(history: readonly HistoryEntry[], signal?: AbortSignal): AsyncGenerator<AgentTextDelta, AgentTurn<HistoryEntry>>;
    encodeToolResults(results: readonly AgentToolResponse[]): readonly HistoryEntry[];
}

export interface AgentToolExecution<Result = unknown> {
    readonly output: unknown;
    readonly result?: Result;
}

export type AgentToolHandler<Result = unknown> =
    (args: AgentArguments, signal?: AbortSignal) => Promise<AgentToolExecution<Result>>;

export interface AgentLoopOptions<HistoryEntry, Result = unknown> {
    readonly adapter: AgentModelAdapter<HistoryEntry>;
    readonly history: readonly HistoryEntry[];
    readonly tools: ReadonlyMap<string, AgentToolHandler<Result>>;
    readonly maxSteps?: number;
    readonly signal?: AbortSignal;
}

export class AgentLoopError extends Error {
    constructor(
        readonly code: 'INVALID_OPTIONS' | 'EMPTY_RESPONSE' | 'ROUND_LIMIT' | 'MISSING_RESULT',
        message: string,
    ) {
        super(message);
        this.name = 'AgentLoopError';
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

const parseArguments = (value: unknown): AgentArguments => {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
    if (!isRecord(parsed)) throw new Error('Tool arguments must be an object');
    return parsed;
};

const toolFailure = (error: unknown) => ({
    success: false,
    error: error instanceof Error ? error.message : String(error),
    ...(isRecord(error) && Array.isArray(error.issues) ? { issues: error.issues } : {}),
});

export const createToolRegistry = <Result = unknown>(
    names: readonly string[],
    execute: (name: string, args: AgentArguments, signal?: AbortSignal) => Promise<AgentToolExecution<Result>>,
): ReadonlyMap<string, AgentToolHandler<Result>> => {
    if (new Set(names).size !== names.length) {
        throw new AgentLoopError('INVALID_OPTIONS', 'Tool names must be unique');
    }
    return new Map(names.map((name): [string, AgentToolHandler<Result>] => [
        name, (args, signal) => execute(name, args, signal),
    ]));
};

/** Runs model-directed tool rounds. All native protocol handling belongs to the adapter. */
export async function* runAgentLoop<HistoryEntry, Result = unknown>(
    options: AgentLoopOptions<HistoryEntry, Result>,
): AsyncGenerator<AgentStreamEvent, Result | undefined> {
    const maxSteps = options.maxSteps ?? 20;
    if (!Number.isSafeInteger(maxSteps) || maxSteps < 1) {
        throw new AgentLoopError('INVALID_OPTIONS', 'maxSteps must be a positive safe integer');
    }
    const history = [...options.history];
    const nativeHistory: HistoryEntry[] = [];
    const tools = new Map(options.tools);
    let result: Result | undefined;
    let lastFailure: string | undefined;

    for (let step = 0; step < maxSteps; step += 1) {
        options.signal?.throwIfAborted();
        const turn = yield* options.adapter.generate([...history], options.signal);
        history.push(...turn.history);
        nativeHistory.push(...turn.history);
        if (!turn.calls.length) {
            if (!turn.text.trim() && result === undefined) {
                throw new AgentLoopError('EMPTY_RESPONSE', 'Agent returned no text or tool calls');
            }
            yield { type: 'turn_complete', nativeHistory };
            return result;
        }

        const responses: AgentToolResponse[] = [];
        for (const call of turn.calls) {
            options.signal?.throwIfAborted();
            let args: AgentArguments | undefined;
            let parsingError: unknown;
            try {
                args = parseArguments(call.arguments);
            } catch (error) {
                parsingError = error;
            }
            yield {
                type: 'tool_call', callId: call.id, name: call.name,
                args: args ?? call.arguments, state: 'start', startTime: Date.now(),
            };
            let output: unknown;
            try {
                if (args === undefined) throw parsingError;
                const handler = tools.get(call.name);
                if (!handler) throw new Error(`Unknown tool ${call.name}; allowed tools: ${[...tools.keys()].join(', ')}`);
                const execution = await handler(args, options.signal);
                options.signal?.throwIfAborted();
                if (isRecord(execution.output) && execution.output.success === false) {
                    throw new Error(String(execution.output.message || execution.output.error || 'Tool execution failed'));
                }
                output = execution.output;
                if (execution.result !== undefined) result = execution.result;
                yield {
                    type: 'tool_call', callId: call.id, name: call.name,
                    state: 'result', result: output, endTime: Date.now(),
                };
            } catch (error) {
                options.signal?.throwIfAborted();
                const failure = toolFailure(error);
                lastFailure = failure.error;
                output = failure;
                yield {
                    type: 'tool_call', callId: call.id, name: call.name,
                    state: 'error', error: failure.error, endTime: Date.now(),
                };
            }
            responses.push({ call, output });
        }
        const entries = options.adapter.encodeToolResults(responses);
        history.push(...entries);
        nativeHistory.push(...entries);
    }
    throw new AgentLoopError('ROUND_LIMIT', `Agent exceeded ${maxSteps} tool rounds${lastFailure ? `: ${lastFailure}` : ''}`);
}

export const completeAgentLoop = async <HistoryEntry, Result>(
    options: AgentLoopOptions<HistoryEntry, Result>,
): Promise<Result> => {
    const agent = runAgentLoop(options);
    let next = await agent.next();
    while (!next.done) next = await agent.next();
    if (next.value === undefined) {
        throw new AgentLoopError('MISSING_RESULT', 'Agent stopped without a valid submission');
    }
    return next.value;
};
