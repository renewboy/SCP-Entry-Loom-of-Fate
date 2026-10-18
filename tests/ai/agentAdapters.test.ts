import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GeminiAgentAdapter,
  OpenAIChatAgentAdapter,
  OpenAIResponsesAgentAdapter,
} from '../../services/ai/agentAdapters';
import type { AgentModelAdapter, AgentTurn } from '../../services/ai/agentLoop';

const { postJsonMock, streamSseMock } = vi.hoisted(() => ({
  postJsonMock: vi.fn(), streamSseMock: vi.fn(),
}));
vi.mock('../../services/ai/providers/backendClient', () => ({
  postJson: postJsonMock, streamSse: streamSseMock,
}));

const chunks = async function* <T>(values: T[]) { yield* values; };
const readTurn = async <H>(adapter: AgentModelAdapter<H>) => {
  const stream = adapter.generate([]);
  const deltas: string[] = [];
  let next = await stream.next();
  while (next.done === false) {
    deltas.push(next.value.delta);
    next = await stream.next();
  }
  return { turn: next.value as AgentTurn<H>, deltas };
};
const request = { path: '/test', buildRequest: (history: readonly unknown[]) => ({ history }) };

describe('agent protocol adapters', () => {
  beforeEach(() => {
    postJsonMock.mockReset();
    streamSseMock.mockReset();
  });

  it('preserves every Gemini signature and part boundary while hiding thought text', async () => {
    const parts = [
      { thought: true, text: 'Private reasoning' },
      { text: 'Working.', thoughtSignature: 'text-signature' },
      { thoughtSignature: 'call-signature', functionCall: { id: 'a', name: 'edit', args: { id: 1 } } },
      { functionCall: { id: 'b', name: 'edit', args: { id: 2 } } },
    ];
    streamSseMock.mockImplementation(() => chunks([{ candidates: [{ content: { parts } }] }]));
    const adapter = new GeminiAgentAdapter({ ...request, stream: true });
    const result = await readTurn(adapter);
    expect(result.deltas).toEqual(['Working.']);
    expect(result.turn.history).toEqual([{ role: 'model', parts }]);
    expect(result.turn.calls.map(call => call.id)).toEqual(['a', 'b']);
    expect(adapter.encodeToolResults(result.turn.calls.map(call => ({ call, output: { success: true } })))).toEqual([{
      role: 'user', parts: ['a', 'b'].map(id => ({
        functionResponse: { id, name: 'edit', response: { success: true } },
      })),
    }]);
  });

  it('keeps generated legacy Gemini call IDs consistent across model and tool history', async () => {
    postJsonMock.mockResolvedValue({ candidates: [{ content: { parts: [{ functionCall: { name: 'edit', args: {} } }] } }] });
    const adapter = new GeminiAgentAdapter(request);
    const { turn } = await readTurn(adapter);
    const id = turn.calls[0].id;
    expect(turn.history[0].parts?.[0].functionCall?.id).toBe(id);
    expect(adapter.encodeToolResults([{ call: turn.calls[0], output: 'ok' }])[0].parts?.[0].functionResponse)
      .toEqual({ id, name: 'edit', response: { result: 'ok' } });
  });

  it.each(['SAFETY', 'MAX_TOKENS'])('rejects Gemini generation with finish reason %s', async finishReason => {
    postJsonMock.mockResolvedValue({ candidates: [{ finishReason, content: { parts: [] } }] });
    await expect(readTurn(new GeminiAgentAdapter(request))).rejects.toThrow(finishReason);
  });

  it('aggregates interleaved OpenAI chat function argument fragments by index', async () => {
    streamSseMock.mockImplementation(() => chunks([
      { choices: [{ delta: { tool_calls: [
        { index: 0, id: 'a', function: { name: 'edit', arguments: '{"id":' } },
        { index: 1, id: 'b', function: { name: 'edit', arguments: '{"id":' } },
      ] } }] },
      { choices: [{ delta: { tool_calls: [
        { index: 1, function: { arguments: '2}' } },
        { index: 0, function: { arguments: '1}' } },
      ] }, finish_reason: 'tool_calls' }] },
    ]));
    const adapter = new OpenAIChatAgentAdapter({ ...request, stream: true });
    const { turn } = await readTurn(adapter);
    expect(turn.calls).toEqual([
      { id: 'a', name: 'edit', arguments: '{"id":1}' },
      { id: 'b', name: 'edit', arguments: '{"id":2}' },
    ]);
    expect(adapter.encodeToolResults([{ call: turn.calls[1], output: { success: true } }])).toEqual([
      { role: 'tool', tool_call_id: 'b', content: '{"success":true}' },
    ]);
  });

  it('rejects incomplete OpenAI chat calls instead of inventing request IDs', async () => {
    streamSseMock.mockImplementation(() => chunks([{ choices: [{ delta: { tool_calls: [
      { index: 0, function: { name: 'edit', arguments: '{}' } },
    ] } }] }]));
    await expect(readTurn(new OpenAIChatAgentAdapter({ ...request, stream: true }))).rejects.toThrow('incomplete function call');
  });

  it('preserves Responses reasoning and uses call_id for result correlation', async () => {
    const output = [
      { type: 'reasoning', id: 'reason', encrypted_content: 'opaque', summary: [] },
      { type: 'function_call', id: 'item', call_id: 'response-call', name: 'edit', arguments: '{"id":7}' },
    ];
    postJsonMock.mockResolvedValue({ status: 'completed', output });
    const adapter = new OpenAIResponsesAgentAdapter(request);
    const { turn } = await readTurn(adapter);
    expect(turn.history).toEqual(output);
    expect(adapter.encodeToolResults([{ call: turn.calls[0], output: { success: true } }])).toEqual([
      { type: 'function_call_output', call_id: 'response-call', output: '{"success":true}' },
    ]);
  });

  it('does not duplicate streamed Responses text when the completed output arrives', async () => {
    streamSseMock.mockImplementation(() => chunks([
      { type: 'response.output_text.delta', delta: 'Done.' },
      { type: 'response.completed', response: { status: 'completed', output_text: 'Done.', output: [] } },
    ]));
    const { turn, deltas } = await readTurn(new OpenAIResponsesAgentAdapter({ ...request, stream: true }));
    expect(turn.text).toBe('Done.');
    expect(deltas).toEqual(['Done.']);
  });

  it('rejects failed Responses events and streams missing a completed response', async () => {
    streamSseMock.mockImplementationOnce(() => chunks([
      { type: 'response.failed', response: { error: { message: 'upstream failed' } } },
    ])).mockImplementationOnce(() => chunks([{ type: 'response.output_text.delta', delta: 'partial' }]));
    const adapter = new OpenAIResponsesAgentAdapter({ ...request, stream: true });
    await expect(readTurn(adapter)).rejects.toThrow('upstream failed');
    await expect(readTurn(adapter)).rejects.toThrow('without a completed response');
  });

  it('passes cancellation through both JSON and SSE transports', async () => {
    const controller = new AbortController();
    postJsonMock.mockResolvedValue({ candidates: [] });
    streamSseMock.mockImplementation(() => chunks([{ candidates: [] }]));
    const json = new GeminiAgentAdapter(request).generate([], controller.signal);
    const sse = new GeminiAgentAdapter({ ...request, stream: true }).generate([], controller.signal);
    await json.next();
    await sse.next();
    expect(postJsonMock).toHaveBeenCalledWith('/test', { history: [] }, { signal: controller.signal });
    expect(streamSseMock).toHaveBeenCalledWith('/test', { history: [] }, { signal: controller.signal });
  });
});
