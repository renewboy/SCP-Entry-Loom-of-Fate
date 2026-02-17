import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai";
import OpenAI from "npm:openai";

const getCorsHeaders = (origin: string | null) => {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || "";
  const allowed = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin = origin && allowed.length > 0 ? (allowed.includes(origin) ? origin : "*") : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    "Access-Control-Max-Age": "86400",
  };
};

const jsonResponse = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const readJson = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

const normalizePath = (pathname: string) => {
  if (pathname.startsWith("/functions/v1/api")) {
    const trimmed = pathname.slice("/functions/v1/api".length);
    return trimmed.length ? trimmed : "/";
  }
  return pathname;
};

const normalizeContents = (contents: any) => {
  if (!contents) return [];
  if (typeof contents === "string") {
    return [{ role: "user", parts: [{ text: contents }] }];
  }
  return contents;
};

const stableStringify = (value: any): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
};

const toHex = (buffer: ArrayBuffer) => {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const buildCacheHash = async (body: any) => {
  const input = {
    model: body.model,
    ttl: body.ttl,
    systemInstruction: body.systemInstruction,
    contents: body.contents,
    tools: body.tools,
    toolConfig: body.toolConfig,
  };
  const data = new TextEncoder().encode(stableStringify(input));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
};

const isExpired = (expireTime?: string) => {
  if (!expireTime) return false;
  const ms = Date.parse(expireTime);
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now();
};

const getExpireMs = (expireTime?: string) => {
  const ms = Date.parse(expireTime || "");
  return Number.isNaN(ms) ? 0 : ms;
};

const sseResponse = (origin: string | null) => {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    ...getCorsHeaders(origin),
  });
  const write = (data: unknown) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  const close = async () => {
    await writer.write(encoder.encode("data: [DONE]\n\n"));
    await writer.close();
  };
  return { response: new Response(stream.readable, { headers }), write, close };
};

let geminiClient: GoogleGenAI | null = null;
const geminiCacheByKey = new Map<string, { name: string; expireTime?: string }>();

const getGeminiClient = (apiKey: string) => {
  if (!apiKey) return null;
  if (apiKey === (Deno.env.get("GEMINI_API_KEY") || Deno.env.get("API_KEY"))) {
    if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey });
    return geminiClient;
  }
  return new GoogleGenAI({ apiKey });
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathname = normalizePath(url.pathname);
  const path = pathname.startsWith("/api") ? pathname : pathname;
  const body = req.method === "POST" ? await readJson(req) : {};

  const geminiKey = (body as any).apiKey || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("API_KEY") || "";
  const openaiKey = (body as any).apiKey || Deno.env.get("OPENAI_API_KEY") || "";
  const openaiBaseUrl = (body as any).baseUrl || Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";
  const openaiChatModel = Deno.env.get("OPENAI_CHAT_MODEL") || "";
  const openaiImageModel = Deno.env.get("OPENAI_IMAGE_MODEL") || "";

  try {
    if (req.method === "GET" && path === "/api/status") {
      return jsonResponse(
        { geminiAvailable: !!(Deno.env.get("GEMINI_API_KEY") || Deno.env.get("API_KEY")), openaiAvailable: !!Deno.env.get("OPENAI_API_KEY") },
        200,
        corsHeaders,
      );
    }

    if (req.method === "POST" && path === "/api/ai/gemini/cache") {
      if (!geminiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = getGeminiClient(geminiKey);
      if (!client) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const cacheHash = await buildCacheHash(body);
      const displayName = `cache-${cacheHash}`;
      const cachedEntry = geminiCacheByKey.get(cacheHash);
      if (cachedEntry?.name && !isExpired(cachedEntry.expireTime)) {
        return jsonResponse({ name: cachedEntry.name }, 200, corsHeaders);
      }
      if (cachedEntry?.name) {
        try {
          const cached = await client.caches.get({ name: cachedEntry.name });
          if (cached?.name && !isExpired(cached.expireTime)) {
            geminiCacheByKey.set(cacheHash, { name: cached.name, expireTime: cached.expireTime });
            return jsonResponse({ name: cached.name }, 200, corsHeaders);
          }
        } catch {
          geminiCacheByKey.delete(cacheHash);
        }
      }
      try {
        const cachedContents = await client.caches.list({ config: { pageSize: 50 } });
        let candidate: { name?: string; expireTime?: string } | null = null;
        for await (const cached of cachedContents) {
          if (cached.displayName !== displayName) continue;
          if (isExpired(cached.expireTime)) continue;
          if (!candidate || getExpireMs(cached.expireTime) > getExpireMs(candidate.expireTime)) {
            candidate = cached;
          }
        }
        if (candidate?.name) {
          geminiCacheByKey.set(cacheHash, { name: candidate.name, expireTime: candidate.expireTime });
          return jsonResponse({ name: candidate.name }, 200, corsHeaders);
        }
      } catch {
      }
      const response = await client.caches.create({
        model: (body as any).model,
        config: {
          displayName,
          ttl: (body as any).ttl,
          systemInstruction: (body as any).systemInstruction,
          contents: (body as any).contents,
          tools: (body as any).tools,
          toolConfig: (body as any).toolConfig,
        },
      });
      if (response?.name) {
        geminiCacheByKey.set(cacheHash, { name: response.name, expireTime: response.expireTime });
      }
      return jsonResponse({ name: response?.name || "" }, 200, corsHeaders);
    }

    if (req.method === "POST" && path === "/api/ai/gemini/generate-content") {
      if (!geminiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = getGeminiClient(geminiKey);
      if (!client) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const response = await client.models.generateContent({
        model: (body as any).model,
        contents: normalizeContents((body as any).contents),
        config: (body as any).config,
      });
      return jsonResponse({ text: response.text }, 200, corsHeaders);
    }

    if (req.method === "POST" && path === "/api/ai/gemini/count-tokens") {
      if (!geminiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = getGeminiClient(geminiKey);
      if (!client) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const response = await client.models.countTokens({
        model: (body as any).model,
        contents: normalizeContents((body as any).contents),
        config: (body as any).config,
      });
      return jsonResponse(
        { totalTokens: response.totalTokens || 0, cachedContentTokenCount: response.cachedContentTokenCount || 0 },
        200,
        corsHeaders,
      );
    }

    if (req.method === "POST" && path === "/api/ai/gemini/chat-stream") {
      if (!geminiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = getGeminiClient(geminiKey);
      if (!client) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const { response, write, close } = sseResponse(origin);
      (async () => {
        const stream = await client.models.generateContentStream({
          model: (body as any).model,
          contents: normalizeContents((body as any).contents),
          config: (body as any).config,
        });
        for await (const chunk of stream) {
          if (chunk.text) await write(chunk.text);
        }
        await close();
      })();
      return response;
    }

    if (req.method === "POST" && path === "/api/ai/gemini/embeddings") {
      if (!geminiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = getGeminiClient(geminiKey);
      if (!client) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const texts: string[] = (body as any).texts || [];
      const response = await client.models.embedContent({
        model: (body as any).model,
        contents: texts,
      });
      const embeddings = response.embeddings?.map((e) => e.values) || [];
      return jsonResponse({ embeddings }, 200, corsHeaders);
    }

    if (req.method === "POST" && path === "/api/ai/gemini/generate-image") {
      if (!geminiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = getGeminiClient(geminiKey);
      if (!client) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const response = await client.models.generateContent({
        model: (body as any).model,
        contents: { parts: [{ text: (body as any).prompt || "" }] },
        config: {
          imageConfig: { aspectRatio: (body as any).aspectRatio },
        },
      });
      const parts = response.candidates?.[0]?.content?.parts || [];
      let imageDataUrl = null;
      for (const part of parts) {
        if (part.inlineData) {
          imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
      return jsonResponse({ imageDataUrl }, 200, corsHeaders);
    }

    if (req.method === "POST" && path === "/api/ai/openai/response") {
      if (!openaiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = new OpenAI({ apiKey: openaiKey, baseURL: openaiBaseUrl || undefined });
      const response = await client.responses.create({
        model: (body as any).chatModel || openaiChatModel,
        input: (body as any).input,
        tools: (body as any).tools,
        text: (body as any).text,
      });
      return jsonResponse({ output_text: response.output_text }, 200, corsHeaders);
    }

    if (req.method === "POST" && path === "/api/ai/openai/response-stream") {
      if (!openaiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = new OpenAI({ apiKey: openaiKey, baseURL: openaiBaseUrl || undefined });
      const { response, write, close } = sseResponse(origin);
      (async () => {
        const stream = await client.responses.create({
          model: (body as any).chatModel || openaiChatModel,
          input: (body as any).input,
          tools: (body as any).tools,
          stream: true,
          text: (body as any).text,
        });
        for await (const event of stream) {
          if (event.type === "response.output_text.delta") {
            await write(event.delta || "");
          }
        }
        await close();
      })();
      return response;
    }

    if (req.method === "POST" && path === "/api/ai/openai/generate-image") {
      if (!openaiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = new OpenAI({ apiKey: openaiKey, baseURL: openaiBaseUrl || undefined });
      const response = await client.images.generate({
        model: (body as any).model || openaiImageModel,
        prompt: (body as any).prompt,
        size: (body as any).size,
      });
      const item = response?.data?.[0];
      const imageDataUrl = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url || null;
      return jsonResponse({ imageDataUrl }, 200, corsHeaders);
    }

    return jsonResponse({ error: "Not found" }, 404, corsHeaders);
  } catch (error) {
    return jsonResponse({ error: String((error as any)?.message || error) }, 500, corsHeaders);
  }
});
