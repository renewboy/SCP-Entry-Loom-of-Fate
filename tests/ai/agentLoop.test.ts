import { describe, expect, it, vi } from 'vitest';
import {
  AgentLoopError,
  completeAgentLoop,
  createToolRegistry,
  runAgentLoop,
  type AgentModelAdapter,
  type AgentToolHandler,
  type AgentTurn,
} from '../../services/ai/agentLoop';

const turn = (history: string, calls: AgentTurn<string>['calls'] = [], text = ''): AgentTurn<string> => ({
  history: [history], calls, text,
});
const call = (name: string, args: unknown = {}, id = name) => ({ id, name, arguments: args });
const scriptedAdapter = (turns: AgentTurn<string>[]): AgentModelAdapter<string> => {
  const remaining = [...turns];
  return {
    generate: vi.fn(async function* () {
      const next = remaining.shift();
      if (!next) throw new Error('Unexpected additional model request');
      if (next.text) yield { type: 'assistant_delta' as const, delta: next.text };
      return next;
    }),
    encodeToolResults: results => results.map(({ call, output }) => `tool:${call.id}:${JSON.stringify(output)}`),
  };
};

describe('protocol-independent agent loop', () => {
  it('stops at the first model turn without tool calls and never repeats its input', async () => {
    const adapter = scriptedAdapter([turn('model:done', [], 'Done.')]);
    const events = [];
    for await (const event of runAgentLoop({ adapter, history: ['task'], tools: new Map() })) events.push(event);
    expect(adapter.generate).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toEqual({ type: 'turn_complete', nativeHistory: ['model:done'] });
    await expect(completeAgentLoop({
      adapter: scriptedAdapter([turn('model:no-submission', [], 'Done.')]),
      history: ['task'], tools: new Map(),
    })).rejects.toMatchObject({ code: 'MISSING_RESULT' });
  });

  it('returns a typed submission only after the model consumes the tool result and stops', async () => {
    const adapter = scriptedAdapter([
      turn('model:submit', [call('submit', { id: 7 })]),
      turn('model:done', [], 'Done.'),
    ]);
    const initialHistory = ['task'];
    const tools = new Map<string, AgentToolHandler<{ id: number }>>([
      ['submit', async () => ({ output: { success: true }, result: { id: 7 } })],
    ]);
    await expect(completeAgentLoop({ adapter, history: initialHistory, tools })).resolves.toEqual({ id: 7 });
    expect(adapter.generate).toHaveBeenCalledTimes(2);
    expect(vi.mocked(adapter.generate).mock.calls[1][0]).toEqual([
      'task', 'model:submit', 'tool:submit:{"success":true}',
    ]);
    expect(initialHistory).toEqual(['task']);
  });

  it('feeds validation failures back and lets the model decide how to repair them', async () => {
    const adapter = scriptedAdapter([
      turn('model:invalid', [call('submit', {})]),
      turn('model:valid', [call('submit', { id: 7 })]),
      turn('model:done', [], 'Done.'),
    ]);
    const tools = new Map<string, AgentToolHandler<number>>([
      ['submit', async args => {
        if (typeof args.id !== 'number') {
          throw Object.assign(new Error('id is required'), { issues: ['id: Required'] });
        }
        return { output: { success: true }, result: args.id };
      }],
    ]);
    await expect(completeAgentLoop({ adapter, history: ['task'], tools })).resolves.toBe(7);
    const secondInput = vi.mocked(adapter.generate).mock.calls[1][0];
    expect(secondInput.at(-1)).toBe('tool:submit:{"success":false,"error":"id is required","issues":["id: Required"]}');
    expect(secondInput.filter(entry => entry === 'task')).toHaveLength(1);
  });

  it('never executes unknown tools or malformed argument payloads', async () => {
    const adapter = scriptedAdapter([
      turn('model:calls', [call('edit', '{"id":'), call('unknown'), call('edit', [])]),
      turn('model:done', [], 'Done.'),
    ]);
    const handler = vi.fn().mockResolvedValue({ output: { success: true } });
    const events = [];
    for await (const event of runAgentLoop({ adapter, history: [], tools: new Map([['edit', handler]]) })) events.push(event);
    expect(handler).not.toHaveBeenCalled();
    expect(events.filter(event => event.type === 'tool_call' && event.state === 'error')).toHaveLength(3);
  });

  it('reports unsuccessful tool outputs as failures and preserves execution order', async () => {
    const adapter = scriptedAdapter([
      turn('model:calls', [call('edit', { id: 1 }, 'a'), call('edit', { id: 2 }, 'b')]),
      turn('model:done', [], 'Done.'),
    ]);
    const seen: unknown[] = [];
    const tools = createToolRegistry(['edit'], async (_name, args) => {
      seen.push(args.id);
      return { output: { success: false, message: 'Denied' } };
    });
    const events = [];
    for await (const event of runAgentLoop({ adapter, history: [], tools })) events.push(event);
    expect(seen).toEqual([1, 2]);
    expect(events.filter(event => event.type === 'tool_call' && event.state === 'error')).toHaveLength(2);
  });

  it('propagates cancellation during tool execution without calling the next tool', async () => {
    const controller = new AbortController();
    const adapter = scriptedAdapter([turn('model:calls', [call('edit', {}, 'a'), call('edit', {}, 'b')])]);
    const handler = vi.fn(async (_args, signal?: AbortSignal) => {
      controller.abort(new Error('cancelled'));
      signal?.throwIfAborted();
      return { output: {} };
    });
    await expect(completeAgentLoop({
      adapter, history: [], tools: new Map([['edit', handler]]), signal: controller.signal,
    })).rejects.toThrow('cancelled');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('closes the model generator when the UI stops consuming the stream', async () => {
    const closed = vi.fn();
    const adapter: AgentModelAdapter<string> = {
      async *generate() {
        try {
          yield { type: 'assistant_delta', delta: 'partial' };
          return turn('model:done', [], 'partial');
        } finally { closed(); }
      },
      encodeToolResults: () => [],
    };
    const stream = runAgentLoop({ adapter, history: [], tools: new Map() });
    await stream.next();
    await stream.return(undefined);
    expect(closed).toHaveBeenCalledOnce();
  });

  it('validates resource limits and tool registration before execution', async () => {
    const adapter = scriptedAdapter([turn('model:a', [call('edit')]), turn('model:b', [call('edit')])]);
    const tools = createToolRegistry(['edit'], async () => ({ output: {} }));
    await expect(completeAgentLoop({ adapter, history: [], tools, maxSteps: 2 }))
      .rejects.toMatchObject({ code: 'ROUND_LIMIT' });
    await expect(completeAgentLoop({ adapter, history: [], tools, maxSteps: 0 }))
      .rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
    expect(() => createToolRegistry(['edit', 'edit'], async () => ({ output: {} }))).toThrow(AgentLoopError);
  });

  it('propagates model failures and rejects empty model turns', async () => {
    const error = new Error('upstream unavailable');
    const adapter = scriptedAdapter([]);
    vi.mocked(adapter.generate).mockImplementation(async function* () { throw error; });
    await expect(completeAgentLoop({ adapter, history: [], tools: new Map() })).rejects.toBe(error);
    await expect(completeAgentLoop({
      adapter: scriptedAdapter([turn('model:empty')]), history: [], tools: new Map(),
    })).rejects.toMatchObject({ code: 'EMPTY_RESPONSE' });
  });
});
