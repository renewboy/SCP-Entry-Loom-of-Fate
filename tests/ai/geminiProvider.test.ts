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
    postJsonMock.mockResolvedValue({
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

    await expect(provider.generateImage('draw it')).resolves.toBe('data:image/png;base64,aW1hZ2U=');
    expect(postJsonMock).toHaveBeenCalledWith('/api/ai/gemini/generate-image', expect.objectContaining({
      apiKey: 'gemini-key',
      baseUrl: 'https://gemini.example.test',
      model: 'gemini-image',
    }));
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
    });

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
            mode: 'ANY',
            allowedFunctionNames: ['submit_profile_candidates'],
          },
        },
        tools: [
          expect.objectContaining({
            functionDeclarations: [expect.objectContaining({
              name: 'submit_profile_candidates',
              parameters: expect.objectContaining({
                type: 'OBJECT',
                required: ['candidates'],
              }),
            })],
          }),
        ],
      }),
    }));
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
