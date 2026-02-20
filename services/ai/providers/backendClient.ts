import { aiConfig } from "../../../config/aiConfig";
import { dispatchAIConfigMissing } from "../../events";
import { supabase } from "../../supabaseService";

const buildUrl = (path: string) => `${aiConfig.apiBaseUrl}${path}`;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZXlwZ25oYXZ6eWlieWhxdWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODEzMjksImV4cCI6MjA4MjA1NzMyOX0.LZf3Zok3HWZjLcduGXGbCZunL5XSaYkri12bp-SLNBg";
const signingSecret = import.meta.env?.VITE_SIGNING_SECRET || "";

const toHex = (buffer: ArrayBuffer) => {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const signPayload = async (payload: unknown) => {
  if (!signingSecret) return {};
  const timestamp = Date.now().toString();
  const data = `${timestamp}.${JSON.stringify(payload)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return {
    "x-timestamp": timestamp,
    "x-signature": toHex(signature),
  };
};

export const getRequestHeaders = async () => {
  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (supabaseAnonKey) {
    headers.Authorization = `Bearer ${supabaseAnonKey}`;
  }
  if (accessToken) {
    headers["X-Client-Authorization"] = `Bearer ${accessToken}`;
  }
  return headers;
};

export class AIConfigMissingError extends Error {
  constructor(message: string = "AI_CONFIG_MISSING") {
    super(message);
    this.name = "AIConfigMissingError";
  }
}

const parseErrorResponse = async (response: Response): Promise<Error> => {
  const text = await response.text().catch(() => "");
  try {
    const json = JSON.parse(text);
    if (json.code === "AI_CONFIG_MISSING" || json.error === "AI_CONFIG_MISSING") {
      const error = new AIConfigMissingError();
      dispatchAIConfigMissing();
      return error;
    }
    return new Error(json.error || json.message || text || `Request failed: ${response.status}`);
  } catch {
    return new Error(text || `Request failed: ${response.status}`);
  }
};

export const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const headers = {
    ...(await getRequestHeaders()),
    ...(await signPayload(body)),
  };
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return response.json() as Promise<T>;
};

export async function* streamSse<T>(path: string, body: unknown): AsyncGenerator<T> {
  const headers = {
    ...(await getRequestHeaders()),
    ...(await signPayload(body)),
  };
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    throw await parseErrorResponse(response);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const lines = part.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        yield JSON.parse(data) as T;
      }
    }
  }
}
