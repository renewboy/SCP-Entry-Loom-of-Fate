import http from "http";
import { URL } from "url";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
};

const cwd = process.cwd();
loadEnvFile(path.join(cwd, ".env.local"));
loadEnvFile(path.join(cwd, ".env"));

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
const openaiApiKey = process.env.OPENAI_API_KEY || "";
const openaiBaseUrl = process.env.OPENAI_BASE_URL;
const openaiChatModel = process.env.OPENAI_CHAT_MODEL || "";
const openaiImageModel = process.env.OPENAI_IMAGE_MODEL || "";

let geminiClient = null;
const geminiCacheByKey = new Map();

const getGeminiClient = (apiKey) => {
  if (!apiKey) return null;
  if (apiKey === geminiApiKey) {
    if (!geminiClient) {
      geminiClient = new GoogleGenAI({ apiKey });
    }
    return geminiClient;
  }
  return new GoogleGenAI({ apiKey });
};

const parseJsonBody = async (req) => {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
};

const sendJson = (res, statusCode, payload) => {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const applyCors = (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "86400");
};

const startSse = (res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
};

const writeSse = (res, data) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const endSse = (res) => {
  res.write("data: [DONE]\n\n");
  res.end();
};

const stableStringify = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
};

const buildCacheHash = (body) => {
  const input = {
    model: body.model,
    ttl: body.ttl,
    systemInstruction: body.systemInstruction,
    contents: body.contents,
    tools: body.tools,
    toolConfig: body.toolConfig,
  };
  return createHash("sha256").update(stableStringify(input)).digest("hex");
};

const isExpired = (expireTime) => {
  if (!expireTime) return false;
  const ms = Date.parse(expireTime);
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now();
};

const getExpireMs = (expireTime) => {
  const ms = Date.parse(expireTime || "");
  return Number.isNaN(ms) ? 0 : ms;
};

const server = http.createServer(async (req, res) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    if (req.method === "GET" && pathname === "/api/status") {
      return sendJson(res, 200, {
        geminiAvailable: !!geminiApiKey,
        openaiAvailable: !!openaiApiKey,
      });
    }

    if (req.method === "POST" && pathname === "/api/ai/gemini/generate-content") {
      const body = await parseJsonBody(req);
      const effectiveApiKey = body.apiKey || geminiApiKey;
      if (!effectiveApiKey) return sendJson(res, 503, { error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" });
      const client = getGeminiClient(effectiveApiKey);
      const response = await client.models.generateContent({
        model: body.model,
        contents: body.contents,
        config: body.config,
      });
      return sendJson(res, 200, { text: response.text });
    }

    if (req.method === "POST" && pathname === "/api/ai/gemini/cache") {
      const body = await parseJsonBody(req);
      const effectiveApiKey = body.apiKey || geminiApiKey;
      if (!effectiveApiKey) return sendJson(res, 503, { error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" });
      const client = getGeminiClient(effectiveApiKey);
      const cacheHash = buildCacheHash(body);
      const displayName = `cache-${cacheHash}`;
      const cachedEntry = geminiCacheByKey.get(cacheHash);

      if (cachedEntry?.name && !isExpired(cachedEntry.expireTime)) {
        return sendJson(res, 200, { name: cachedEntry.name });
      }
      if (cachedEntry?.name) {
        try {
          const cached = await client.caches.get({ name: cachedEntry.name });
          if (cached?.name && !isExpired(cached.expireTime)) {
            geminiCacheByKey.set(cacheHash, { name: cached.name, expireTime: cached.expireTime });
            return sendJson(res, 200, { name: cached.name });
          }
        } catch (error) {
          geminiCacheByKey.delete(cacheHash);
        }
      }

      try {
        const cachedContents = await client.caches.list({ config: { pageSize: 50 } });
        let candidate = null;
        for await (const cached of cachedContents) {
          if (cached.displayName !== displayName) continue;
          if (isExpired(cached.expireTime)) continue;
          if (!candidate || getExpireMs(cached.expireTime) > getExpireMs(candidate.expireTime)) {
            candidate = cached;
          }
        }
        if (candidate?.name) {
          geminiCacheByKey.set(cacheHash, { name: candidate.name, expireTime: candidate.expireTime });
          return sendJson(res, 200, { name: candidate.name });
        }
      } catch (error) {
      }
      const response = await client.caches.create({
        model: body.model,
        config: {
          displayName,
          ttl: body.ttl,
          systemInstruction: body.systemInstruction,
          contents: body.contents,
          tools: body.tools,
          toolConfig: body.toolConfig,
        },
      });
      console.log(`[GeminiProvider] Created cache: ${JSON.stringify(response)}`);

      if (response?.name) {
        geminiCacheByKey.set(cacheHash, { name: response.name, expireTime: response.expireTime });
      }
      return sendJson(res, 200, { name: response?.name || "" });
    }

    if (req.method === "POST" && pathname === "/api/ai/gemini/count-tokens") {
      const body = await parseJsonBody(req);
      const effectiveApiKey = body.apiKey || geminiApiKey;
      if (!effectiveApiKey) return sendJson(res, 503, { error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" });
      const client = getGeminiClient(effectiveApiKey);
      const response = await client.models.countTokens({
        model: body.model,
        contents: body.contents,
        config: body.config,
      });
      return sendJson(res, 200, {
        totalTokens: response.totalTokens || 0,
        cachedContentTokenCount: response.cachedContentTokenCount || 0,
      });
    }

    if (req.method === "POST" && pathname === "/api/ai/gemini/chat-stream") {
      const body = await parseJsonBody(req);
      const effectiveApiKey = body.apiKey || geminiApiKey;
      if (!effectiveApiKey) return sendJson(res, 503, { error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" });
      const client = getGeminiClient(effectiveApiKey);
      startSse(res);
      const stream = await client.models.generateContentStream({
        model: body.model,
        contents: body.contents || [],
        config: body.config,
      });
      for await (const chunk of stream) {
        if (chunk.text) writeSse(res, chunk.text);
      }
      endSse(res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/gemini/embeddings") {
      const body = await parseJsonBody(req);
      const effectiveApiKey = body.apiKey || geminiApiKey;
      if (!effectiveApiKey) return sendJson(res, 503, { error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" });
      const client = getGeminiClient(effectiveApiKey);
      const response = await client.models.embedContent({
        model: body.model,
        contents: body.texts || [],
      });
      const embeddings = response.embeddings?.map((e) => e.values) || [];
      return sendJson(res, 200, { embeddings });
    }

    if (req.method === "POST" && pathname === "/api/ai/gemini/generate-image") {
      const body = await parseJsonBody(req);
      const effectiveApiKey = body.apiKey || geminiApiKey;
      if (!effectiveApiKey) return sendJson(res, 503, { error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" });
      const client = getGeminiClient(effectiveApiKey);
      const response = await client.models.generateContent({
        model: body.model,
        contents: { parts: [{ text: body.prompt }] },
        config: {
          imageConfig: { aspectRatio: body.aspectRatio },
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
      return sendJson(res, 200, { imageDataUrl });
    }

    if (req.method === "POST" && pathname === "/api/ai/openai/response") {
      const body = await parseJsonBody(req);
      const effectiveApiKey = body.apiKey || openaiApiKey;
      const effectiveBaseUrl = body.baseUrl || openaiBaseUrl;
      if (!effectiveApiKey) return sendJson(res, 503, { error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" });
      const client = new OpenAI({ apiKey: effectiveApiKey, baseURL: effectiveBaseUrl || undefined });
      const response = await client.responses.create({
        model: body.chatModel || openaiChatModel,
        input: body.input,
        tools: body.tools,
        text: body.text,
      });
      return sendJson(res, 200, { output_text: response.output_text });
    }

    if (req.method === "POST" && pathname === "/api/ai/openai/response-stream") {
      const body = await parseJsonBody(req);
      const effectiveApiKey = body.apiKey || openaiApiKey;
      const effectiveBaseUrl = body.baseUrl || openaiBaseUrl;
      if (!effectiveApiKey) return sendJson(res, 503, { error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" });
      const client = new OpenAI({ apiKey: effectiveApiKey, baseURL: effectiveBaseUrl || undefined });
      startSse(res);
      const stream = await client.responses.create({
        model: body.chatModel || openaiChatModel,
        input: body.input,
        tools: body.tools,
        stream: true,
        text: body.text,
      });
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          writeSse(res, event.delta);
        }
      }
      endSse(res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/openai/generate-image") {
      const body = await parseJsonBody(req);
      const effectiveApiKey = body.apiKey || openaiApiKey;
      const effectiveBaseUrl = body.baseUrl || openaiBaseUrl;
      if (!effectiveApiKey) return sendJson(res, 503, { error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" });
      const client = new OpenAI({ apiKey: effectiveApiKey, baseURL: effectiveBaseUrl || undefined });
      const response = await client.images.generate({
        model: body.model || openaiImageModel,
        prompt: body.prompt,
        size: body.size,
      });
      const item = response?.data?.[0];
      const imageDataUrl = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url || null;
      return sendJson(res, 200, { imageDataUrl });
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    return sendJson(res, 500, { error: String(error?.message || error) });
  }
});

const host = process.env.AI_SERVER_HOST || "127.0.0.1";
const port = Number(process.env.AI_SERVER_PORT || "5174");
server.listen(port, host, () => {
  console.log(`[ai-server] http://${host}:${port}`);
});
