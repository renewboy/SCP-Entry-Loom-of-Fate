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

  it('submits researched profile candidates through the shared function contract', async () => {
    const candidates = [{
      name: 'Agent Test',
      age: '31',
      abilities: ['Research'],
      background: 'Foundation analyst.',
      keywords: ['Archive'],
    }];
    postJsonMock.mockResolvedValue({
      output: [{
        type: 'function_call',
        name: 'submit_profile_candidates',
        arguments: JSON.stringify({ candidates }),
      }],
    });

    const provider = new OpenAIProvider({
      apiKey: 'local',
      baseUrl: 'http://127.0.0.1:8317/v1',
      chatModel: 'gpt-6.1-sol',
      imageModel: 'gpt-image-2.5-flare',
    });

    await expect(provider.generateProfileCandidates('Researcher', 'SCP-173', 'en')).resolves.toEqual(candidates);
    const request = postJsonMock.mock.calls[0][1];
    expect(request).not.toHaveProperty('text');
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
    };
    postJsonMock.mockResolvedValue({
      output: [{
        type: 'function_call',
        name: 'submit_scp_analysis',
        arguments: JSON.stringify(analysis),
      }],
    });

    const provider = new OpenAIProvider({
      apiKey: 'local',
      baseUrl: 'http://127.0.0.1:8317/v1',
      chatModel: 'gpt-6.1-sol',
      imageModel: 'gpt-image-2.5-flare',
    });

    await expect(provider.analyzeSCPUrl('SCP-5035', 'en', 'Researcher')).resolves.toMatchObject(analysis);
    const request = postJsonMock.mock.calls[0][1];
    expect(request).not.toHaveProperty('thinking');
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
