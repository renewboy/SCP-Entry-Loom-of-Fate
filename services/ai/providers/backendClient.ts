import { aiConfig } from "../../../config/aiConfig";
import { dispatchAIConfigMissing } from "../../events";

const buildUrl = (path: string) => `${aiConfig.apiBaseUrl}${path}`;

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
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return response.json() as Promise<T>;
};

export async function* streamSse<T>(path: string, body: unknown): AsyncGenerator<T> {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
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
