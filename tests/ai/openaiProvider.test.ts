import { beforeEach, describe, expect, it, vi } from 'vitest';

const postJsonMock = vi.hoisted(() => vi.fn());
const streamSseMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/ai/providers/backendClient', () => ({
  postJson: postJsonMock,
  streamSse: streamSseMock,
}));

import { OpenAIProvider } from '../../services/ai/providers/openaiProvider';

describe('OpenAIProvider', () => {
  beforeEach(() => {
    postJsonMock.mockReset();
    streamSseMock.mockReset();
  });

  it('forwards style reference pixels with the composed image prompt', async () => {
    postJsonMock.mockResolvedValueOnce({ data: [{ b64_json: 'aW1hZ2U=' }] });
    const provider = new OpenAIProvider({ apiKey: 'local', baseUrl: 'http://127.0.0.1:8317/v1', chatModel: 'text', imageModel: 'gpt-image-2' });
    const references = [{ mimeType: 'image/jpeg' as const, data: 'c3R5bGU=' }];
    await expect(provider.generateImage('composed prompt', '1:1', 'url', references)).resolves.toBe('data:image/png;base64,aW1hZ2U=');
    expect(postJsonMock).toHaveBeenCalledWith('/api/ai/openai/generate-image', expect.objectContaining({ prompt: 'composed prompt', referenceImages: references, model: 'gpt-image-2' }));
  });

  it('submits researched profile candidates through the shared function contract', async () => {
    const candidates = Array.from({ length: 3 }, (_, index) => ({
      name: `Agent ${index}`,
      age: '31',
      abilities: ['Research'],
      background: 'Foundation analyst.',
      keywords: ['Archive'],
    }));
    postJsonMock.mockResolvedValueOnce({
      output: [{
        type: 'function_call',
        call_id: 'submit-profiles',
        name: 'submit_profile_candidates',
        arguments: JSON.stringify({ candidates }),
      }],
    }).mockResolvedValueOnce({ status: 'completed', output: [], output_text: 'Done.' });

    const provider = new OpenAIProvider({
      apiKey: 'local',
      baseUrl: 'http://127.0.0.1:8317/v1',
      chatModel: 'gpt-6.1-sol',
      imageModel: 'gpt-image-2.5-flare',
    });

    await expect(provider.generateProfileCandidates('Researcher', 'SCP-173', 'en')).resolves.toEqual(candidates);
    const request = postJsonMock.mock.calls[0][1];
    expect(request.text).toEqual({ verbosity: 'high' });
    expect(request.reasoning).toEqual({ effort: 'medium' });
    expect(request.tools).toEqual(expect.arrayContaining([
      { type: 'web_search' },
      expect.objectContaining({
        type: 'function',
        name: 'submit_profile_candidates',
      }),
    ]));
  });

  it('does not send an incompatible thinking field for SCP analysis', async () => {
    const analysis = {
      designation: 'SCP-5035',
      name: 'The Freedman',
      containmentClass: 'Euclid',
      role: 'Researcher',
      visualDescription: 'dark archive',
      entityDescription: 'anomalous record',
      storyDraft: { roleDetails: 'Foundation analyst', storyBackground: 'A sealed archive.' },
      briefing: { disruptionClass: '', riskClass: '', containmentProcedures: 'Keep sealed.', description: 'A record.' },
      mapBlueprint: {
        id: 'test-map', title: 'Archive', startNodeId: 'node_archive',
        nodes: [{ id: 'node_archive', name: 'Archive', danger: 10, discoverables: [], requires: [], blockedText: '' }],
        edges: [], npcs: [], objectives: [],
      },
      npcVisuals: {},
    };
    postJsonMock.mockResolvedValueOnce({
      output: [{
        type: 'function_call',
        call_id: 'submit-analysis',
        name: 'submit_scp_analysis',
        arguments: JSON.stringify(analysis),
      }],
    }).mockResolvedValueOnce({ status: 'completed', output: [], output_text: 'Done.' });

    const provider = new OpenAIProvider({
      apiKey: 'local',
      baseUrl: 'http://127.0.0.1:8317/v1',
      chatModel: 'gpt-6.1-sol',
      imageModel: 'gpt-image-2.5-flare',
    });

    await expect(provider.analyzeSCPUrl('SCP-5035', 'en', 'Researcher')).resolves.toMatchObject(analysis);
    const request = postJsonMock.mock.calls[0][1];
    expect(request).not.toHaveProperty('thinking');
    expect(request.text).toEqual({ verbosity: 'high' });
    expect(request.reasoning).toEqual({ effort: 'medium' });
    expect(request.tools).toEqual(expect.arrayContaining([
      { type: 'web_search' },
      expect.objectContaining({
        type: 'function',
        name: 'submit_scp_analysis',
      }),
    ]));
  });

  describe('analysis progress', () => {
    const analysis = {
      designation: 'SCP-5035', name: 'Name', containmentClass: 'Keter', role: 'Agent',
      visualDescription: 'v', entityDescription: 'e',
      briefing: { disruptionClass: 'a', riskClass: 'b', containmentProcedures: 'c', description: 'd' },
      storyDraft: { roleDetails: 'r', storyBackground: 's' },
      mapBlueprint: { id: 'm', title: 't', startNodeId: 'n', nodes: [{ id: 'n', name: 'Node', danger: 1, discoverables: [], requires: [], blockedText: '' }], edges: [], npcs: [], objectives: [] },
      npcVisuals: {},
    };
    const provider = () => new OpenAIProvider({ apiKey: 'local', baseUrl: 'http://127.0.0.1:8317/v1', chatModel: 'gpt-6.1-sol', imageModel: 'gpt-image-2.5-flare' });

    it('reports searches and a growing draft from the stream', async () => {
      const args = JSON.stringify(analysis);
      const submitted = { type: 'function_call', id: 'item-1', call_id: 'submit', name: 'submit_scp_analysis', arguments: args };
      const nowSpy = vi.spyOn(Date, 'now');
      let clock = 0;
      nowSpy.mockImplementation(() => (clock += 1000));
      streamSseMock
        .mockImplementationOnce(async function* () {
          yield { type: 'response.output_item.added', item: { type: 'web_search_call', id: 'ws-1' } };
          yield { type: 'response.output_item.done', item: { type: 'web_search_call', id: 'ws-1', action: { query: 'SCP-5035', sources: [{ url: 'https://scp-wiki.wikidot.com/scp-5035' }] } } };
          yield { type: 'response.output_item.added', item: { type: 'function_call', id: 'item-1', name: 'submit_scp_analysis' } };
          yield { type: 'response.function_call_arguments.delta', item_id: 'item-1', delta: args.slice(0, 40) };
          yield { type: 'response.function_call_arguments.delta', item_id: 'item-1', delta: args.slice(40) };
          yield { type: 'response.completed', response: { status: 'completed', output: [submitted] } };
        })
        .mockImplementationOnce(async function* () {
          yield { type: 'response.completed', response: { status: 'completed', output: [], output_text: 'Done.' } };
        });
      const progress: any[] = [];

      await expect(provider().analyzeSCPUrl('SCP-5035', 'en', 'Researcher', 'normal', undefined, undefined, item => progress.push(item))).resolves.toMatchObject({ designation: 'SCP-5035' });

      nowSpy.mockRestore();
      expect(streamSseMock.mock.calls[0][0]).toBe('/api/ai/openai/response-stream');
      expect(postJsonMock).not.toHaveBeenCalled();
      expect(progress[0]).toEqual({ type: 'search_start', id: 'ws-1', query: '' });
      expect(progress[1]).toEqual({ type: 'search_result', id: 'ws-1', query: 'SCP-5035', sources: [{ title: 'https://scp-wiki.wikidot.com/scp-5035', url: 'https://scp-wiki.wikidot.com/scp-5035' }] });
      const drafts = progress.filter(item => item.type === 'draft');
      expect(drafts[0].data.designation).toBe('SCP-5035');
      expect(drafts[drafts.length - 1].data).toEqual(analysis);
    });

    it('falls back to a plain request when the endpoint cannot stream it', async () => {
      streamSseMock.mockImplementationOnce(async function* () {
        yield { type: 'response.output_text.delta', delta: 'x' };
      });
      postJsonMock.mockResolvedValueOnce({
        output: [{ type: 'function_call', call_id: 'submit', name: 'submit_scp_analysis', arguments: JSON.stringify(analysis) }],
      }).mockResolvedValueOnce({ status: 'completed', output: [], output_text: 'Done.' });

      await expect(provider().analyzeSCPUrl('SCP-5035', 'en', 'Researcher', 'normal', undefined, undefined, () => null)).resolves.toMatchObject({ designation: 'SCP-5035' });
      expect(postJsonMock.mock.calls[0][0]).toBe('/api/ai/openai/response');
    });
  });
});
