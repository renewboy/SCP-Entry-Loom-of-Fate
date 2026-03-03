import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai";
import OpenAI from "npm:openai";
import { createClient } from "npm:@supabase/supabase-js";

const getCorsHeaders = (origin: string | null) => {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || "";
  console.log(`getCorsHeaders ALLOWED_ORIGINS: ${raw}`);
  const allowed = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin = origin && allowed.length > 0 ? (allowed.includes(origin) ? origin : "*") : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-timestamp, x-signature, X-Client-Authorization",
    "Access-Control-Max-Age": "86400",
  };
};

const jsonResponse = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const getAllowedOrigins = () => {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || "";
  console.log(`getAllowedOrigins ALLOWED_ORIGINS: ${raw}`);
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

const isOriginAllowed = (origin: string | null, allowed: string[]) => {
  if (!allowed.length) return true;
  if (!origin) return false;
  return allowed.some((value) => {
    if (value.startsWith(".")) {
      return origin.endsWith(value);
    }
    return origin === value;
  });
};

const readBody = async (req: Request) => {
  const text = await req.text();
  if (!text) return { text: "", json: {} as any };
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: {} as any };
  }
};

const normalizePath = (pathname: string) => {
  if (pathname.startsWith("/functions/v1/api")) {
    const trimmed = pathname.slice("/functions/v1/api".length);
    return trimmed.length ? trimmed : "/";
  }
  return pathname;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

const getSupabaseAdmin = () => {
  if (!supabaseAdmin && supabaseUrl && supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }
  return supabaseAdmin;
};

const rateLimitWindowSeconds = Number(Deno.env.get("RATE_LIMIT_WINDOW_SECONDS") || "60");
const rateLimitMaxRequests = Number(Deno.env.get("RATE_LIMIT_MAX_REQUESTS") || "30");
const dailyQuotaAnon = Number(Deno.env.get("AI_DAILY_QUOTA_ANON") || "300");
const dailyQuotaUser = Number(Deno.env.get("AI_DAILY_QUOTA_USER") || "100");
const limitsEnabled = (Deno.env.get("AI_LIMITS_ENABLED") || "true") !== "false";
const ttlSeconds = Number(Deno.env.get("SIGNING_TTL_SECONDS") || "30");

const rateLimitState = new Map<string, { count: number; resetAt: number }>();

const checkRateLimit = (key: string) => {
  const now = Date.now();
  const resetAt = now + rateLimitWindowSeconds * 1000;
  const entry = rateLimitState.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitState.set(key, { count: 1, resetAt });
    return true;
  }
  const next = entry.count + 1;
  rateLimitState.set(key, { count: next, resetAt: entry.resetAt });
  return next <= rateLimitMaxRequests;
};


const ANON_SUBJECT = "00000000-0000-0000-0000-000000000000";
const getSubject = (userId: string | null) => (userId ? `user:${userId}` : `anon:${ANON_SUBJECT}`);

const getToday = () => new Date().toISOString().slice(0, 10);

const incrementUsage = async (subject: string) => {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin.rpc("increment_ai_usage", {
    p_day: getToday(),
    p_subject: subject,
  });
  if (error) return null;
  return Number(data || 0);
};

const getUsageCount = async (subject: string) => {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("ai_usage_daily")
    .select("count")
    .eq("day", getToday())
    .eq("subject", subject)
    .maybeSingle();
  if (error) return null;
  return Number(data?.count || 0);
};

const checkQuotaExceeded = async (subject: string, isUser: boolean) => {
  if (!getSupabaseAdmin()) {
    return { ok: false, error: "USAGE_STORE_UNAVAILABLE", status: 500 };
  }
  const count = await getUsageCount(subject);
  const limit = isUser ? dailyQuotaUser : dailyQuotaAnon;
  if (count !== null && count >= limit) {
    return { ok: false, error: "DAILY_QUOTA_EXCEEDED", status: 429 };
  }
  return { ok: true, status: 200 };
};

const resolveUserId = async (req: Request) => {
  const clientAuth = req.headers.get("x-client-authorization") || "";
  const authHeader = clientAuth || req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || token === supabaseAnonKey) return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data?.user?.id || null;
};

const toHex = (buffer: ArrayBuffer) => {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const hmacSign = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(signature);
};

const validateSignature = async (req: Request, bodyText: string) => {
  const secret = Deno.env.get("VITE_SIGNING_SECRET") || "";
  if (!secret) return true;
  const timestamp = req.headers.get("x-timestamp") || "";
  const signature = req.headers.get("x-signature") || "";
  if (!timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() - ts) > ttlSeconds * 1000) return false;
  const expected = await hmacSign(secret, `${timestamp}.${bodyText}`);
  return expected === signature;
};

const stableStringify = (value: any): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
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

let geminiClient: any = null;
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
  const { text: bodyText, json: body } = req.method === "POST" ? await readBody(req) : { text: "", json: {} };
  const allowedOrigins = getAllowedOrigins();
  if (!isOriginAllowed(origin, allowedOrigins)) {
    return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403, corsHeaders);
  }
  if (req.method === "POST") {
    const signatureValid = await validateSignature(req, bodyText);
    if (!signatureValid) {
      return jsonResponse({ error: "INVALID_SIGNATURE" }, 401, corsHeaders);
    }
  }

  const userId = await resolveUserId(req);
  const subject = getSubject(userId);
  const isAiRoute = path.startsWith("/api/ai/");
  const isStatusRoute = path === "/api/status";
  const headerApiKey = req.headers.get("apikey") || "";
  const hasUserApiKey = !!((body as any)?.apiKey || headerApiKey);
  const shouldCheckQuota = limitsEnabled && !hasUserApiKey;

  if (isStatusRoute && shouldCheckQuota) {
    const quota = await checkQuotaExceeded(subject, !!userId);
    if (!quota.ok) {
      return jsonResponse({ error: quota.error }, quota.status, corsHeaders);
    }
  }

  if (limitsEnabled && isAiRoute && !hasUserApiKey) {
    if (!checkRateLimit(subject)) {
      return jsonResponse({ error: "RATE_LIMITED" }, 429, corsHeaders);
    }
    if (!getSupabaseAdmin()) {
      return jsonResponse({ error: "USAGE_STORE_UNAVAILABLE" }, 500, corsHeaders);
    }
    const count = await incrementUsage(subject);
    const limit = userId ? dailyQuotaUser : dailyQuotaAnon;
    if (count !== null && count > limit) {
      return jsonResponse({ error: "DAILY_QUOTA_EXCEEDED" }, 429, corsHeaders);
    }
  }

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
      const response = await client.models.generateContent(body);
      return jsonResponse(response, 200, corsHeaders);
    }

    if (req.method === "POST" && path === "/api/ai/gemini/count-tokens") {
      if (!geminiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = getGeminiClient(geminiKey);
      if (!client) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const response = await client.models.countTokens(body);
      return jsonResponse(response, 200, corsHeaders);
    }

    if (req.method === "POST" && path === "/api/ai/gemini/chat-stream") {
      if (!geminiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = getGeminiClient(geminiKey);
      if (!client) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const { response, write, close } = sseResponse(origin);
      (async () => {
        const stream = await client.models.generateContentStream(body);
        for await (const chunk of stream) {
          await write(chunk);
        }
        await close();
      })();
      return response;
    }

    if (req.method === "POST" && path === "/api/ai/gemini/embeddings") {
      if (!geminiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = getGeminiClient(geminiKey);
      if (!client) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const response = await client.models.embedContent(body);
      return jsonResponse(response, 200, corsHeaders);
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
      return jsonResponse(response, 200, corsHeaders);
    }

    const {
      apiKey,
      baseUrl,
      chatModel,
      ...resBody
    } = body;
    
    if (req.method === "POST" && path === "/api/ai/openai/response") {
      if (!openaiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = new OpenAI({ apiKey: openaiKey, baseURL: openaiBaseUrl || undefined });
      const response = await client.responses.create({
        model: chatModel || openaiChatModel,
        ...resBody,
      });
      return jsonResponse(response, 200, corsHeaders);
    }

    if (req.method === "POST" && path === "/api/ai/openai/response-stream") {
      if (!openaiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = new OpenAI({ apiKey: openaiKey, baseURL: openaiBaseUrl || undefined });
      const { response, write, close } = sseResponse(origin);
      (async () => {
        const stream = await client.responses.create({
          model: chatModel || openaiChatModel,
          ...resBody,
          stream: true,
        });
        for await (const event of stream) {
          await write(event);
        }
        await close();
      })();
      return response;
    }

    if (req.method === "POST" && path === "/api/ai/openai/chat-completion-stream") {
      if (!openaiKey) return jsonResponse({ error: "AI_CONFIG_MISSING", code: "AI_CONFIG_MISSING" }, 503, corsHeaders);
      const client = new OpenAI({ apiKey: openaiKey, baseURL: openaiBaseUrl || undefined });
      const { response, write, close } = sseResponse(origin);
      (async () => {
        const stream = await client.chat.completions.create({
          model: chatModel || openaiChatModel,
          messages: resBody.input,
          tools: resBody.tools,
          stream: true,
        });
        for await (const event of stream) {
          await write(event);
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
        ...resBody,
      });
      return jsonResponse(response, 200, corsHeaders);
    }

    return jsonResponse({ error: "Not found" }, 404, corsHeaders);
  } catch (error) {
    console.log("api error: ", error);
    return jsonResponse(error, 500, corsHeaders);
  }
});
