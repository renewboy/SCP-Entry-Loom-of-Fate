/**
 * Editor Assistant Message Types
 *
 * These types bridge UI rendering and provider API calls.
 * They preserve the full tool-call history (including raw Gemini/OpenAI parts)
 * so that multi-turn conversations correctly replay tool interactions.
 */

/** A completed tool call with its result, stored in message history */
export interface EditorToolRecord {
    name: string;
    args: any;
    result: any;
    success: boolean;
}

/** A user message in the editor assistant conversation */
export interface EditorUserMessage {
    kind: "user";
    content: string;
}

/**
 * An assistant message, preserving both display data and raw provider history.
 *
 * nativeHistory stores provider-native content entries verbatim:
 *   Gemini  -> { role, parts }[]   (model functionCall + user functionResponse)
 *   OpenAI  -> { role, content?, tool_calls?, tool_call_id?, name? }[]
 */
export interface EditorAssistantMessage {
    kind: "assistant";
    text: string;
    toolCalls: EditorToolRecord[];
    nativeHistory: any[];
}

export type EditorChatMessage = EditorUserMessage | EditorAssistantMessage;

/**
 * Convert EditorChatMessage[] into Gemini-native `contents` array.
 * Replays user text, model text + functionCalls, and user functionResponses.
 */
export function toGeminiContents(messages: EditorChatMessage[]): any[] {
    const contents: any[] = [];
    for (const msg of messages) {
        if (msg.kind === "user") {
            contents.push({ role: "user", parts: [{ text: msg.content }] });
        } else if (msg.nativeHistory.length > 0) {
            contents.push(...msg.nativeHistory);
        } else if (msg.text) {
            contents.push({ role: "model", parts: [{ text: msg.text }] });
        }
    }
    return contents;
}

/**
 * Convert EditorChatMessage[] into OpenAI-native messages array.
 * Replays assistant tool_calls and tool result messages.
 */
export function toOpenAIMessages(messages: EditorChatMessage[]): any[] {
    const result: any[] = [];
    for (const msg of messages) {
        if (msg.kind === "user") {
            result.push({ role: "user", content: msg.content });
        } else if (msg.nativeHistory.length > 0) {
            result.push(...msg.nativeHistory);
        } else if (msg.text) {
            result.push({ role: "assistant", content: msg.text });
        }
    }
    return result;
}
