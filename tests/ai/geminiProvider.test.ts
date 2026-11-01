import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postJsonMock, streamSseMock } = vi.hoisted(() => ({
  postJsonMock: vi.fn(),
  streamSseMock: vi.fn(),
}));

vi.mock('../../services/ai/providers/backendClient', () => ({
  postJson: postJsonMock,
  streamSse: streamSseMock,
}));

import { GeminiProvider } from '../../services/ai/providers/geminiProvider';

describe('GeminiProvider', () => {
  beforeEach(() => {
    postJsonMock.mockReset();
    streamSseMock.mockReset();
  });

  it('passes the provider base URL to image generation requests', async () => {
    postJsonMock.mockResolvedValueOnce({
      candidates: [{
        content: {
          parts: [{
            inlineData: {
              mimeType: 'image/png',
              data: 'aW1hZ2U=',
            },
          }],
        },
      }],
    });

    const provider = new GeminiProvider({
      apiKey: 'gemini-key',
      baseUrl: 'https://gemini.example.test',
      chatModel: 'gemini-text',
      imageModel: 'gemini-image',
    });

    const references = [{ mimeType: 'image/png' as const, data: 'c3R5bGU=' }];
    await expect(provider.generateImage('draw it', '1:1', 'url', references)).resolves.toBe('data:image/png;base64,aW1hZ2U=');
    expect(postJsonMock).toHaveBeenCalledWith('/api/ai/gemini/generate-image', expect.objectContaining({
      apiKey: 'gemini-key',
      baseUrl: 'https://gemini.example.test',
      model: 'gemini-image',
      referenceImages: references,
    }));
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
      candidates: [{
        content: {
          parts: [{
            functionCall: {
              name: 'submit_profile_candidates',
              args: { candidates },
            },
          }],
        },
      }],
    }).mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: 'Done.' }] } }] });

    const provider = new GeminiProvider({
      apiKey: 'gemini-key',
      baseUrl: 'https://gemini.example.test',
      chatModel: 'gemini-text',
      imageModel: 'gemini-image',
    });

    await expect(provider.generateProfileCandidates('Researcher', 'SCP-173', 'en')).resolves.toEqual(candidates);
    expect(postJsonMock).toHaveBeenCalledWith('/api/ai/gemini/generate-content', expect.objectContaining({
      config: expect.objectContaining({
        toolConfig: {
          functionCallingConfig: {
            mode: 'AUTO',
          },
        },
        tools: [
          expect.objectContaining({
            functionDeclarations: expect.arrayContaining([expect.objectContaining({
              name: 'submit_profile_candidates',
              parameters: expect.objectContaining({
                type: 'OBJECT',
                required: ['candidates'],
              }),
            })]),
          }),
        ],
      }),
    }));
  });

  it('reports each search and what it found while analyzing', async () => {
    const analysis = {
      designation: 'SCP-173', name: 'Name', containmentClass: 'Euclid', role: 'Agent',
      visualDescription: 'v', entityDescription: 'e',
      briefing: { disruptionClass: 'a', riskClass: 'b', containmentProcedures: 'c', description: 'd' },
      storyDraft: { roleDetails: 'r', storyBackground: 's' },
      mapBlueprint: { id: 'm', title: 't', startNodeId: 'n', nodes: [{ id: 'n', name: 'Node', danger: 1, discoverables: [], requires: [], blockedText: '' }], edges: [], npcs: [], objectives: [] },
      npcVisuals: {},
    };
    postJsonMock
      .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ functionCall: { id: 'search-id', name: 'web_search', args: { query: 'SCP-173 class' } } }] } }] })
      .mockResolvedValueOnce({ candidates: [{
        content: { parts: [{ text: 'SCP-173 is a statue.' }] },
        groundingMetadata: { groundingChunks: [{ web: { uri: 'https://redirect/1', title: 'scp-wiki.wikidot.com' } }] },
      }] })
      .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ functionCall: { id: 'submit-id', name: 'submit_scp_analysis', args: analysis } }] } }] })
      .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: 'Done.' }] } }] });
    const progress: unknown[] = [];

    const provider = new GeminiProvider({ apiKey: 'gemini-key', chatModel: 'gemini-text', imageModel: 'gemini-image' });
    await expect(provider.analyzeSCPUrl('SCP-173', 'zh', 'Researcher', 'normal', undefined, undefined, item => progress.push(item))).resolves.toMatchObject({ designation: 'SCP-173' });

    expect(progress).toEqual([
      { type: 'search_start', id: 'search_1', query: 'SCP-173 class' },
      { type: 'search_result', id: 'search_1', text: 'SCP-173 is a statue.', sources: [{ title: 'scp-wiki.wikidot.com', url: 'https://redirect/1' }] },
    ]);
    // The model still reads the findings with their addresses
    const toolResponse = postJsonMock.mock.calls[2][1].contents.at(-1).parts[0].functionResponse.response;
    expect(toolResponse.result).toBe('SCP-173 is a statue.\nhttps://redirect/1');
  });

  it('runs search and repairs empty submissions with the original call signatures', async () => {
    const candidates = Array.from({ length: 3 }, (_, index) => ({
      name: `Agent ${index}`, age: '31', abilities: ['Research'],
      background: 'Foundation analyst.', keywords: ['Archive'],
    }));
    const searchPart = {
      thoughtSignature: 'search-signature',
      functionCall: { id: 'search-id', name: 'web_search', args: { query: 'SCP-6262' } },
    };
    const emptyPart = {
      thoughtSignature: 'submit-signature',
      functionCall: { id: 'submit-id', name: 'submit_profile_candidates', args: {} },
    };
    postJsonMock
      .mockResolvedValueOnce({ candidates: [{ content: { parts: [searchPart] } }] })
      .mockResolvedValueOnce({ candidates: [{ content: { parts: [
        { thought: true, text: 'private reasoning' },
        { text: 'Verified SCP facts: https://scp-wiki.wikidot.com/scp-6262' },
      ] } }] })
      .mockResolvedValueOnce({ candidates: [{ content: { parts: [emptyPart] } }] })
      .mockResolvedValueOnce({ candidates: [{ content: { parts: [{
        functionCall: { name: 'submit_profile_candidates', args: { candidates } },
      }] } }] })
      .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: 'Done.' }] } }] });

    const provider = new GeminiProvider({
      apiKey: 'gemini-key', baseUrl: 'http://127.0.0.1:8317',
      chatModel: 'gemini-text', imageModel: 'gemini-image',
    });
    await expect(provider.generateProfileCandidates('Researcher', 'SCP-6262', 'zh')).resolves.toEqual(candidates);
    const searchRequest = postJsonMock.mock.calls[1][1];
    expect(searchRequest.baseUrl).toBe('http://127.0.0.1:8317');
    expect(searchRequest.config.tools).toEqual([{ googleSearch: {} }]);
    const finalRequest = postJsonMock.mock.calls[3][1];
    expect(finalRequest.contents[1].parts).toEqual([searchPart]);
    expect(finalRequest.contents[2].parts[0].functionResponse).toEqual({
      id: 'search-id', name: 'web_search',
      response: { result: 'Verified SCP facts: https://scp-wiki.wikidot.com/scp-6262' },
    });
    expect(finalRequest.contents[3].parts).toEqual([emptyPart]);
    expect(finalRequest.contents[4].parts[0].functionResponse).toMatchObject({
      id: 'submit-id', name: 'submit_profile_candidates',
      response: { success: false, issues: [expect.stringContaining('candidates')] },
    });
    expect(finalRequest.config).not.toHaveProperty('responseMimeType');
    expect(finalRequest.config).not.toHaveProperty('responseJsonSchema');
  });

  it('propagates API errors instead of returning default characters or empty SCP data', async () => {
    postJsonMock.mockRejectedValue(new Error('upstream unavailable'));
    const provider = new GeminiProvider({
      apiKey: 'key', chatModel: 'gemini-text', imageModel: 'gemini-image',
    });
    await expect(provider.generateProfileCandidates('Researcher', 'SCP-173', 'zh')).rejects.toThrow('upstream unavailable');
    await expect(provider.analyzeSCPUrl('SCP-173', 'zh', 'Researcher')).rejects.toThrow('upstream unavailable');
  });

  it('reuses the Gemini function call id when returning tool results', async () => {
    const streamOf = async function* (chunks: any[]) {
      for (const chunk of chunks) yield chunk;
    };
    streamSseMock
      .mockImplementationOnce(() => streamOf([{
        candidates: [{
          content: {
            parts: [{
              thoughtSignature: 'signature',
              functionCall: {
                id: 'call-123',
                name: 'multi_step',
                args: { steps: [] },
              },
            }],
          },
        }],
      }]))
      .mockImplementationOnce(() => streamOf([{
        candidates: [{
          content: {
            parts: [{ text: '修改已完成。' }],
          },
        }],
      }]));

    const provider = new GeminiProvider({
      apiKey: 'gemini-key',
      baseUrl: 'https://gemini.example.test',
      chatModel: 'gemini-text',
      imageModel: 'gemini-image',
    });
    const events = [];
    for await (const event of provider.streamEditorAssistant(
      [{ kind: 'user', content: '扩充地图' }],
      {
        designation: 'SCP-173',
        name: 'Test',
        containmentClass: 'Euclid',
        role: 'Researcher',
      },
      'zh',
      vi.fn().mockResolvedValue({ success: true }),
    )) {
      events.push(event);
    }

    const secondRequest = streamSseMock.mock.calls[1][1];
    expect(secondRequest.contents.at(-1)).toEqual({
      role: 'user',
      parts: [{
        functionResponse: {
          id: 'call-123',
          name: 'multi_step',
          response: { success: true },
        },
      }],
    });
    expect(events).toContainEqual({ type: 'assistant_delta', delta: '修改已完成。' });
  });
});
