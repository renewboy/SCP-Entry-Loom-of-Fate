export type AgentStreamEvent =
    | { type: "assistant_delta"; delta: string }
    | { type: "tool_call"; callId: string; name: string; args: any; state: "start"; startTime: number }
    | { type: "tool_call"; callId: string; name: string; state: "result"; result: any; endTime: number }
    | { type: "tool_call"; callId: string; name: string; state: "error"; error: string; endTime: number }
    | { type: "turn_complete"; nativeHistory: any[] };
