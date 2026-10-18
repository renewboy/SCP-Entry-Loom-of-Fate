import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/supabaseService', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}));
vi.mock('../../config/aiConfig', () => ({ aiConfig: { apiBaseUrl: 'http://localhost:5174' } }));

import { streamSse } from '../../services/ai/providers/backendClient';

const collect = async () => {
  const chunks = [];
  for await (const chunk of streamSse('/test', {})) chunks.push(chunk);
  return chunks;
};

describe('AI streaming transport', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses split UTF-8 and CRLF events through the completion marker', async () => {
    const bytes = new TextEncoder().encode('data: {"text":"你好"}\r\n\r\ndata: [DONE]\r\n\r\n');
    const response = new Response(new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(collect()).resolves.toEqual([{ text: '你好' }]);
  });

  it('propagates errors sent after the stream has started', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      'data: {"text":"partial"}\n\ndata: {"error":{"message":"upstream disconnected"}}\n\n',
    )));
    await expect(collect()).rejects.toThrow('upstream disconnected');
  });

  it('rejects a truncated stream instead of committing partial output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('data: {"text":"partial"}\n\n')));
    await expect(collect()).rejects.toThrow('AI stream closed before completion');
  });
});
