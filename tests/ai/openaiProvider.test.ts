import { beforeEach, describe, expect, it, vi } from 'vitest';

const postJsonMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/ai/providers/backendClient', () => ({
  postJson: postJsonMock,
  streamSse: vi.fn(),
}));

import { OpenAIProvider } from '../../services/ai/providers/openaiProvider';

describe('OpenAIProvider', () => {
  beforeEach(() => {
    postJsonMock.mockReset();
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
});
