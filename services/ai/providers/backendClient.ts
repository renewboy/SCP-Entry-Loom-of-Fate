import { aiConfig } from "../../../config/aiConfig";

const buildUrl = (path: string) => `${aiConfig.apiBaseUrl}${path}`;

export const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed: ${response.status}`);
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
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed: ${response.status}`);
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
