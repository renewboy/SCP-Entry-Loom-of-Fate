import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useTranslation } from '../../utils/i18n';
import { SCPData, Language } from '../../types';
import { EditorChatMessage, EditorAssistantMessage, EditorToolRecord } from '../../services/ai/editorAssistantTypes';
import { OpenAIProvider } from '../../services/ai/providers/openaiProvider';
import { GeminiProvider } from '../../services/ai/providers/geminiProvider';
import { postJson } from '../../services/ai/providers/backendClient';
import { loadSetting, saveSetting } from '../../services/indexedDBService';
import { getEffectiveAIConfig } from '../../services/aiConfigService';
import { applyLayoutToBlueprint } from '../../utils/mapLayout';
import { editorPanelHeader, editorPanelTitle, panelContainerBase } from './editorStyles';

interface EditorAssistantPanelProps {
    blueprint: any;
    setBlueprint: React.Dispatch<React.SetStateAction<any>>;
    scpData: SCPData;
    setScpData: React.Dispatch<React.SetStateAction<SCPData>>;
    onClose: () => void;
    isOpen: boolean;
    isMobile?: boolean;
}

const SANITIZE_SCHEMA = {
    ...defaultSchema,
    tagNames: Array.from(new Set([...(defaultSchema.tagNames || []), 'table', 'thead', 'tbody', 'tr', 'th', 'td'])),
    attributes: {
        ...(defaultSchema.attributes || {}),
        table: [...((defaultSchema.attributes as any)?.table || []), 'align'],
        th: [...((defaultSchema.attributes as any)?.th || []), 'align'],
        td: [...((defaultSchema.attributes as any)?.td || []), 'align']
    }
};

const MARKDOWN_COMPONENTS = {
    h1: ({ children }: any) => <h1 className="text-lg font-bold my-3 pb-1 border-b border-gray-700">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-base font-bold my-2 pb-1 border-b border-gray-800">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-sm font-bold my-2">{children}</h3>,
    h4: ({ children }: any) => <h4 className="text-sm font-semibold my-1">{children}</h4>,
    hr: () => <hr className="my-4 border-gray-700" />,
    blockquote: ({ children }: any) => <blockquote className="border-l-2 border-scp-accent pl-3 my-2 text-gray-400 italic">{children}</blockquote>,
    a: ({ href, children }: any) => (
        <a href={href} target="_blank" rel="noreferrer" className="text-scp-accent underline underline-offset-2 hover:text-white">
            {children}
        </a>
    ),
    code: ({ className, children }: any) => {
        const text = Array.isArray(children) ? children.join('') : String(children ?? '');
        const isBlock = Boolean(className && String(className).includes('language-')) || text.includes('\n');
        if (isBlock) {
            return <code className="font-mono text-xs text-gray-200">{children}</code>;
        }
        return <code className="px-1.5 py-0.5 mx-0.5 rounded bg-black/40 border border-gray-700 font-mono text-[0.9em]">{children}</code>;
    },
    pre: ({ children }: any) => (
        <pre className="my-3 p-3 rounded bg-black/40 border border-gray-800 overflow-x-auto">{children}</pre>
    ),
    p: ({ children }: any) => <p className="leading-relaxed my-2">{children}</p>,
    ul: ({ children }: any) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
    li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
    table: ({ children }: any) => (
        <div className="overflow-x-auto my-4 rounded border border-gray-800">
            <table className="w-full text-left border-collapse bg-black/20">{children}</table>
        </div>
    ),
    thead: ({ children }: any) => <thead className="bg-white/5">{children}</thead>,
    tbody: ({ children }: any) => <tbody className="divide-y divide-gray-800">{children}</tbody>,
    tr: ({ children }: any) => <tr className="hover:bg-white/5 transition-colors">{children}</tr>,
    th: ({ children }: any) => <th className="px-3 py-2 text-xs font-bold text-gray-300 border-b border-gray-700">{children}</th>,
    td: ({ children }: any) => <td className="px-3 py-2 text-xs text-gray-400 border-r border-gray-800 last:border-r-0">{children}</td>,
};

const Markdown = React.memo(({ content }: { content: string }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
        components={MARKDOWN_COMPONENTS}
    >
        {content}
    </ReactMarkdown>
));

interface ToolCallCardData {
    callId: string;
    name: string;
    state: "running" | "success" | "error";
    args?: any;
    result?: any;
    error?: string;
    startTime: number;
    endTime?: number;
}

type AssistantBlock =
    | { kind: 'text'; content: string }
    | { kind: 'tool'; data: ToolCallCardData };

/**
 * UI display message type.
 * User messages are simple text.
 * Assistant messages have blocks (text + tool cards) for rendering,
 * PLUS the full EditorAssistantMessage data for provider history replay.
 */
type ChatMessage =
    | { kind: 'user'; content: string }
    | { kind: 'assistant'; blocks: AssistantBlock[]; editorMsg: EditorAssistantMessage };

const ToolCard = ({ data }: { data: ToolCallCardData }) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const duration = data.endTime ? data.endTime - data.startTime : 0;
    
    return (
        <div className="my-2 border border-[var(--scp-border)] rounded bg-black/30 overflow-hidden text-xs font-mono">
            <button
                type="button"
                className="w-full flex items-center justify-between px-2 py-1.5 bg-black/40 hover:bg-black/60 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className={`inline-block w-2 h-2 rounded-sm flex-shrink-0 ${
                            data.state === 'error'
                                ? 'bg-red-500'
                                : data.state === 'running'
                                  ? 'bg-scp-accent'
                                  : 'bg-green-500'
                        }`}
                    />
                    <span className="text-[10px] tracking-widest uppercase text-gray-500 flex-shrink-0">{t('editor_assistant.tool_called')}</span>
                    <span className="font-semibold tracking-wider uppercase text-scp-text truncate">{data.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 flex-shrink-0">
                    {data.state !== 'running' && <span>{duration}ms</span>}
                    <span className="text-gray-600">{expanded ? '▾' : '▸'}</span>
                </div>
            </button>
            
            {expanded && (
                <div className="p-2 border-t border-[var(--scp-border)] bg-black/40 space-y-2">
                    <div>
                        <div className="text-[10px] text-gray-500 mb-0.5">ARGS</div>
                        <pre className="overflow-x-auto text-gray-300 p-2 bg-black/50 border border-gray-800 rounded">
                            {JSON.stringify(data.args, null, 2)}
                        </pre>
                    </div>
                    {data.result && (
                        <div>
                            <div className="text-[10px] text-gray-500 mb-0.5">RESULT</div>
                            <pre className="overflow-x-auto text-gray-300 p-2 bg-black/50 border border-gray-800 rounded">
                                {JSON.stringify(data.result, null, 2)}
                            </pre>
                        </div>
                    )}
                    {data.error && (
                        <div>
                            <div className="text-[10px] text-red-500 mb-0.5">ERROR</div>
                            <pre className="overflow-x-auto text-red-400 p-2 bg-black/50 border border-gray-800 rounded whitespace-pre-wrap">
                                {data.error}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const EditorAssistantPanel: React.FC<EditorAssistantPanelProps> = ({
    blueprint,
    setBlueprint,
    scpData,
    setScpData,
    onClose,
    isOpen,
    isMobile = false
}) => {
    const { t, language } = useTranslation();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentBlocks, setCurrentBlocks] = useState<AssistantBlock[]>([]);
    const [welcomeStreamingContent, setWelcomeStreamingContent] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const openaiProvider = useRef(new OpenAIProvider());
    const geminiProvider = useRef(new GeminiProvider());

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, currentBlocks]);

    useEffect(() => {
        if (!isOpen) return;
        if (isLoading) return;
        if (messages.length !== 0) return;

        const full = t('editor_assistant.welcome') || '';
        setWelcomeStreamingContent('');
        let index = 0;

        const timer = window.setInterval(() => {
            index += 1;
            setWelcomeStreamingContent(full.slice(0, index));
            if (index >= full.length) {
                window.clearInterval(timer);
            }
        }, 18);

        return () => window.clearInterval(timer);
    }, [isOpen, isLoading, messages.length, t]);

    const historyKey = `editor_assistant_history_${scpData.designation || 'default'}`;

    const historyLoadedRef = useRef(false);

    useEffect(() => {
        const loadHistory = async () => {
            historyLoadedRef.current = false;
            const saved = await loadSetting(historyKey);
            if (Array.isArray(saved)) {
                const converted: ChatMessage[] = saved
                    .filter((m: any) => m?.kind === 'user' || m?.kind === 'assistant')
                    .map((m: any) => m as ChatMessage);
                setMessages(converted);
            }
            historyLoadedRef.current = true;
        };
        loadHistory();
    }, [historyKey]);

    useEffect(() => {
        if (!historyLoadedRef.current) return;
        saveSetting(historyKey, messages);
    }, [historyKey, messages]);

    const handleToolCall = async (toolName: string, args: any) => {
        console.log(`[EditorAssistant] Handling tool call: ${toolName}`, args);
        
        // --- Tool Implementation ---
        try {
            switch (toolName) {
                case 'update_basic_info': {
                    const { storyDraft: _storyDraft, mapBlueprint: _mapBlueprint, ...rest } = args || {};
                    setScpData((prev) => ({
                        ...prev,
                        ...rest
                    }));
                    return { success: true, message: "SCP data updated." };
                }

                case 'update_story_draft': {
                    const rest = args || {};
                    setScpData((prev) => ({
                        ...prev,
                        storyDraft: {
                            ...(prev.storyDraft || {}),
                            ...rest
                        }
                    }));
                    return { success: true, message: "Story draft updated." };
                }

                case 'multi_step': {
                    const steps = Array.isArray(args?.steps) ? args.steps : [];

                    if (steps.length === 0) {
                        return { success: false, message: "Missing steps." };
                    }
                    if (steps.some((s: any) => s?.tool === 'multi_step')) {
                        return { success: false, message: "Nested multi_step is not allowed." };
                    }
                    const results: any[] = [];
                    for (const step of steps) {
                        const tool = step?.tool;
                        const stepArgs = step?.args ?? {};
                        if (typeof tool !== 'string') {
                            results.push({ success: false, message: "Invalid step.tool" });
                            continue;
                        }
                        console.log(`[EditorAssistant] multi_step for tool ${tool} with args: ${JSON.stringify(stepArgs)}`);
                        // eslint-disable-next-line no-await-in-loop
                        const result = await handleToolCall(tool, stepArgs);
                        results.push({ tool, result });
                    }
                    return { success: true, results };
                }

                case 'add_node': {
                    console.log(`[EditorAssistant] add_node args: ${JSON.stringify(args)}`);
                    const requestedId = typeof args?.id === 'string' ? args.id.trim() : '';
                    if (!requestedId) {
                        return { success: false, message: "Missing required field: id" };
                    }
                    if (typeof args?.name !== 'string' || !args.name.trim()) {
                        return { success: false, message: "Missing required field: name" };
                    }
                    const nodeId = requestedId;
                    const baseNode = {
                        id: nodeId,
                        name: args.name,
                        danger: args.danger ?? 0,
                        tags: Array.isArray(args.tags) ? args.tags : [],
                        discoverables: Array.isArray(args.discoverables) ? args.discoverables : [],
                        interactables: Array.isArray(args.interactables) ? args.interactables : [],
                        visualHint: args.visualHint ?? '',
                        requires: Array.isArray(args.requires) ? args.requires : [],
                        blockedText: args.blockedText ?? ''
                    };
                    const newNode = baseNode;
                    let errorMessage: string | null = null;
                    setBlueprint((prev: any) => {
                        const nodes = Array.isArray(prev?.nodes) ? prev.nodes : [];
                        if (nodes.some((n: any) => n?.id === nodeId)) {
                            errorMessage = `Node id already exists: ${nodeId}`;
                            return prev;
                        }
                        const nextBlueprint = {
                            ...prev,
                            startNodeId: prev?.startNodeId || nodeId,
                            nodes: [...nodes, newNode],
                            edges: Array.isArray(prev?.edges) ? prev.edges : [],
                            npcs: Array.isArray(prev?.npcs) ? prev.npcs : [],
                            objectives: Array.isArray(prev?.objectives) ? prev.objectives : []
                        };
                        return applyLayoutToBlueprint(nextBlueprint, { width: 720, height: 420, useExistingLayout: true });
                    });
                    if (errorMessage) {
                        return { success: false, message: errorMessage };
                    }
                    return { success: true, nodeId: newNode.id, message: "Node added." };
                }

                case 'update_node': {
                    const { layout: _layout, ...rest } = args || {};
                    console.log(`[EditorAssistant] update_node args: ${JSON.stringify(args)}`);
                    setBlueprint((prev: any) => ({
                        ...prev,
                        nodes: (prev.nodes || []).map((n: any) => n.id === rest.id ? { ...n, ...rest } : n)
                    }));
                    return { success: true, message: `Node ${args.id} updated.` };
                }

                case 'delete_node': {
                    console.log(`[EditorAssistant] delete_node args: ${JSON.stringify(args)}`);
                    setBlueprint((prev: any) => {
                        const updated = {
                            ...prev,
                            nodes: (prev.nodes || []).filter((n: any) => n.id !== args.id),
                            edges: (prev.edges || []).filter((e: any) => e.from !== args.id && e.to !== args.id),
                            npcs: (prev.npcs || []).filter((n: any) => n.initialNodeId !== args.id),
                            objectives: (prev.objectives || []).filter((o: any) => o.nodeId !== args.id)
                        };
                        return applyLayoutToBlueprint(updated, { width: 720, height: 420, useExistingLayout: false });
                    });
                    return { success: true, message: `Node ${args.id} deleted.` };
                }

                case 'connect_nodes': {
                    console.log(`[EditorAssistant] connect_nodes args: ${JSON.stringify(args)}`);
                    setBlueprint((prev: any) => {
                        const updated = {
                            ...prev,
                            edges: [...(prev.edges || []), {
                                from: args.fromId,
                                to: args.toId,
                                bidirectional: args.bidirectional ?? true
                            }]
                        };
                        return applyLayoutToBlueprint(updated, { width: 720, height: 420, useExistingLayout: false });
                    });
                    return { success: true, message: "Nodes connected." };
                }

                case 'add_npc': {
                    console.log(`[EditorAssistant] add_npc args: ${JSON.stringify(args)}`);
                    const requestedId = typeof args?.id === 'string' ? args.id.trim() : '';
                    if (!requestedId) {
                        return { success: false, message: "Missing required field: id" };
                    }
                    if (typeof args?.name !== 'string' || !args.name.trim()) {
                        return { success: false, message: "Missing required field: name" };
                    }
                    if (typeof args?.initialNodeId !== 'string' || !args.initialNodeId.trim()) {
                        return { success: false, message: "Missing required field: initialNodeId" };
                    }
                    const npcId = requestedId;
                    const newNPC = {
                        id: npcId,
                        name: args.name,
                        archetype: args.archetype ?? 'Researcher',
                        initialNodeId: args.initialNodeId,
                        secretTags: Array.isArray(args.secretTags) ? args.secretTags : [],
                        dialogueGoals: Array.isArray(args.dialogueGoals) ? args.dialogueGoals : []
                    };
                    let errorMessage: string | null = null;
                    setBlueprint((prev: any) => {
                        const npcs = Array.isArray(prev?.npcs) ? prev.npcs : [];
                        if (npcs.some((n: any) => n?.id === npcId)) {
                            errorMessage = `NPC id already exists: ${npcId}`;
                            return prev;
                        }
                        return {
                            ...prev,
                            npcs: [...npcs, newNPC]
                        };
                    });
                    if (errorMessage) {
                        return { success: false, message: errorMessage };
                    }
                    return { success: true, npcId: newNPC.id, message: "NPC added." };
                }

                case 'update_npc': {
                    console.log(`[EditorAssistant] update_npc args: ${JSON.stringify(args)}`);
                    setBlueprint((prev: any) => ({
                        ...prev,
                        npcs: (prev.npcs || []).map((n: any) => n.id === args.id ? { ...n, ...args } : n)
                    }));
                    return { success: true, message: `NPC ${args.id} updated.` };
                }

                case 'delete_npc': {
                    console.log(`[EditorAssistant] delete_npc args: ${JSON.stringify(args)}`);
                    setBlueprint((prev: any) => ({
                        ...prev,
                        npcs: (prev.npcs || []).filter((n: any) => n.id !== args.id)
                    }));
                    return { success: true, message: `NPC ${args.id} deleted.` };
                }

                case 'add_objective': {
                    console.log(`[EditorAssistant] add_objective args: ${JSON.stringify(args)}`);
                    const requestedId = typeof args?.id === 'string' ? args.id.trim() : '';
                    if (!requestedId) {
                        return { success: false, message: "Missing required field: id" };
                    }
                    if (typeof args?.title !== 'string' || !args.title.trim()) {
                        return { success: false, message: "Missing required field: title" };
                    }
                    if (typeof args?.nodeId !== 'string' || !args.nodeId.trim()) {
                        return { success: false, message: "Missing required field: nodeId" };
                    }
                    const newObj = {
                        id: requestedId,
                        title: args.title,
                        type: args.type || 'MAIN',
                        nodeId: args.nodeId,
                        ...(args.progress !== undefined ? { progress: args.progress } : {}),
                        ...(args.detail !== undefined ? { detail: args.detail } : {}),
                        ...(args.reward !== undefined ? { reward: args.reward } : {})
                    };
                    let errorMessage: string | null = null;
                    setBlueprint((prev: any) => {
                        const objectives = Array.isArray(prev?.objectives) ? prev.objectives : [];
                        if (objectives.some((o: any) => o?.id === newObj.id)) {
                            errorMessage = `Objective id already exists: ${newObj.id}`;
                            return prev;
                        }
                        return {
                            ...prev,
                            objectives: [...objectives, newObj]
                        };
                    });
                    if (errorMessage) {
                        return { success: false, message: errorMessage };
                    }
                    return { success: true, objectiveId: newObj.id, message: "Objective added." };
                }

                case 'update_objective': {
                    console.log(`[EditorAssistant] update_objective args: ${JSON.stringify(args)}`);
                    setBlueprint((prev: any) => ({
                        ...prev,
                        objectives: (prev.objectives || []).map((o: any) => o.id === args.id ? { ...o, ...args } : o)
                    }));
                    return { success: true, message: `Objective ${args.id} updated.` };
                }

                case 'delete_objective': {
                    console.log(`[EditorAssistant] delete_objective args: ${JSON.stringify(args)}`);
                    setBlueprint((prev: any) => ({
                        ...prev,
                        objectives: (prev.objectives || []).filter((o: any) => o.id !== args.id)
                    }));
                    return { success: true, message: `Objective ${args.id} deleted.` };
                }

                case 'web_search': {
                    console.log(`[EditorAssistant] web_search args: ${JSON.stringify(args)}`);
                    const query = args?.query || '';
                    if (!query) {
                        return { success: false, message: "Missing query." };
                    }
                    const config = await getEffectiveAIConfig();
                    const systemPrompt = 'You are an SCP Foundation editor assistant. Search the given query, prioritize authoritative sources, and return concise key points and conclusions.';

                    if (config.provider === 'gemini') {
                        const response = await postJson<any>("/api/ai/gemini/generate-content", {
                            apiKey: config.gemini.apiKey,
                            model: config.gemini.chatModel,
                            contents: [{ role: "user", parts: [{ text: query }] }],
                            config: {
                                systemInstruction: systemPrompt,
                                tools: [{ googleSearch: {} }],
                            },
                        });
                        const outputText = response?.candidates?.[0]?.content?.parts?.[0]?.text
                            || JSON.stringify(response);
                        return { success: true, results: outputText };
                    }

                    const response = await postJson<any>("/api/ai/openai/response", {
                        apiKey: config.openai.apiKey,
                        baseUrl: config.openai.baseUrl,
                        chatModel: config.openai.chatModel,
                        input: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: query }
                        ],
                        tools: [{ type: "web_search" }]
                    });
                    const outputText = response?.output_text
                        || response?.choices?.[0]?.message?.content
                        || JSON.stringify(response);
                    return { success: true, results: outputText };
                }
                
                default:
                    return { success: false, message: `Unknown tool: ${toolName}` };
            }
        } catch (e) {
            console.error("Tool execution error:", e);
            return { success: false, message: `Error executing tool: ${e}` };
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = { kind: 'user', content: input };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);
        setCurrentBlocks([]);

        try {
            const config = await getEffectiveAIConfig();
            const provider = config.provider === 'gemini' ? geminiProvider.current : openaiProvider.current;
            
            // Convert UI ChatMessage[] to EditorChatMessage[] for provider
            // This preserves full tool-call history via editorMsg.nativeHistory
            const editorMessages: EditorChatMessage[] = newMessages.map(m => {
                if (m.kind === 'user') return { kind: 'user' as const, content: m.content };
                return m.editorMsg;
            });
            
            const stream = provider.streamEditorAssistant(
                editorMessages,
                { ...scpData, mapBlueprint: blueprint },
                language as Language,
                handleToolCall
            );

            let blocks: AssistantBlock[] = [];
            let fullText = "";
            const completedToolRecords: EditorToolRecord[] = [];
            let nativeHistory: any[] = [];

            const addText = (delta: string) => {
                if (!delta) return;
                fullText += delta;
                const last = blocks[blocks.length - 1];
                if (last && last.kind === 'text') {
                    last.content += delta;
                } else {
                    blocks.push({ kind: 'text', content: delta });
                }
                setCurrentBlocks([...blocks]);
            };

            const upsertTool = (data: ToolCallCardData) => {
                const idx = blocks.findIndex(b => b.kind === 'tool' && b.data.callId === data.callId);
                if (idx >= 0) {
                    const existing = (blocks[idx] as any).data as ToolCallCardData;
                    blocks[idx] = { kind: 'tool', data: { ...existing, ...data } };
                } else {
                    blocks.push({ kind: 'tool', data });
                }
                setCurrentBlocks([...blocks]);
            };

            for await (const event of stream) {
                if (typeof event === 'string') {
                    addText(event);
                    continue;
                }
                
                if (event.type === 'assistant_delta') {
                    addText(event.delta);
                } else if (event.type === 'turn_complete') {
                    // Capture the native history for accurate replay in future turns
                    nativeHistory = event.nativeHistory || [];
                } else if (event.type === 'tool_call') {
                    if (event.state === 'start') {
                        upsertTool({
                            callId: event.callId,
                            name: event.name,
                            state: 'running',
                            args: event.args,
                            startTime: event.startTime
                        });
                    } else if (event.state === 'result') {
                        const existing = blocks.find(b => b.kind === 'tool' && b.data.callId === event.callId);
                        upsertTool({
                            callId: event.callId,
                            name: event.name,
                            state: 'success',
                            args: existing && existing.kind === 'tool' ? existing.data.args : undefined,
                            result: event.result,
                            endTime: event.endTime,
                            startTime: existing && existing.kind === 'tool' ? existing.data.startTime : Date.now()
                        });
                        // Record completed tool call
                        completedToolRecords.push({
                            name: event.name,
                            args: existing && existing.kind === 'tool' ? existing.data.args : {},
                            result: event.result,
                            success: true
                        });
                    } else if (event.state === 'error') {
                        const existing = blocks.find(b => b.kind === 'tool' && b.data.callId === event.callId);
                        upsertTool({
                            callId: event.callId,
                            name: event.name,
                            state: 'error',
                            args: existing && existing.kind === 'tool' ? existing.data.args : undefined,
                            error: event.error,
                            endTime: event.endTime,
                            startTime: existing && existing.kind === 'tool' ? existing.data.startTime : Date.now()
                        });
                        // Record failed tool call
                        completedToolRecords.push({
                            name: event.name,
                            args: existing && existing.kind === 'tool' ? existing.data.args : {},
                            result: { error: event.error },
                            success: false
                        });
                    }
                }
            }

            // Build the EditorAssistantMessage with full native history
            const editorMsg: EditorAssistantMessage = {
                kind: 'assistant',
                text: fullText,
                toolCalls: completedToolRecords,
                nativeHistory
            };

            setMessages(prev => [
                ...prev, 
                { 
                    kind: 'assistant',
                    blocks,
                    editorMsg
                }
            ]);
            setCurrentBlocks([]);

        } catch (error) {
            console.error("Assistant error:", error);
            const errText = `[ERROR] ${error}`;
            setMessages(prev => [...prev, { kind: 'assistant', blocks: [{ kind: 'text', content: errText }], editorMsg: { kind: 'assistant', text: errText, toolCalls: [], nativeHistory: [] } }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setMessages([]);
        setCurrentBlocks([]);
    };

    return (
        <div
            className={isMobile 
                ? `fixed inset-x-0 top-0 bottom-14 z-[300] flex flex-col bg-[var(--scp-bg)] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none hidden'}`
                : `absolute top-0 bottom-0 right-80 w-96 ${panelContainerBase} flex flex-col border-l border-[var(--scp-border)] z-20 shadow-2xl transition-transform transition-opacity duration-300 ease-out ${isOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-[calc(100%+20rem)] opacity-0 pointer-events-none'}`
            }
        >
            {/* Header */}
            <div className={editorPanelHeader}>
                <div className="flex justify-between items-center">
                    <div className={editorPanelTitle}>
                        <span className="animate-pulse mr-2">●</span>
                        {t('editor_assistant.title')}
                    </div>
                    <div className="flex gap-2">
                         <button onClick={handleClear} className={`text-[10px] text-gray-500 hover:text-scp-accent uppercase border border-transparent hover:border-scp-accent/30 px-1 rounded ${isMobile ? 'min-h-[44px] min-w-[44px]' : ''}`}>
                            {t('editor_assistant.clear_chat')}
                        </button>
                        <button onClick={onClose} className={`text-gray-500 hover:text-white ${isMobile ? 'min-h-[44px] min-w-[44px] text-xl' : ''}`}>×</button>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm custom-scrollbar bg-black/40">
                {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-start">
                        <div className="max-w-[90%] p-2 rounded text-xs break-words bg-[#1a1a1a] text-scp-text border border-gray-800">
                            <Markdown content={welcomeStreamingContent} />
                            {welcomeStreamingContent.length < (t('editor_assistant.welcome') || '').length && (
                                <span className="inline-block w-2 h-4 ml-1 bg-scp-accent animate-blink align-middle"></span>
                            )}
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.kind === 'user' ? 'items-end' : 'items-start'}`}>
                        <div 
                            className={`max-w-[90%] p-2 rounded text-xs break-words ${
                                msg.kind === 'user' 
                                    ? 'bg-scp-accent/20 text-white border border-scp-accent/40' 
                                    : 'bg-[#1a1a1a] text-scp-text border border-gray-800'
                            }`}
                        >
                            {msg.kind === 'user' ? (
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            ) : (
                                <div className="space-y-2">
                                    {msg.blocks.map((b, i) => (
                                        b.kind === 'text'
                                            ? <Markdown key={`t-${i}`} content={b.content} />
                                            : <ToolCard key={b.data.callId} data={b.data} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Streaming Content */}
                {isLoading && (
                    <div className="flex flex-col items-start">
                        <div className="max-w-[90%] p-2 rounded text-xs break-words bg-[#1a1a1a] text-scp-text border border-gray-800 animate-pulse">
                            {currentBlocks.length > 0 ? (
                                <div className="space-y-2">
                                    {currentBlocks.map((b, i) => (
                                        b.kind === 'text'
                                            ? <Markdown key={`ct-${i}`} content={b.content} />
                                            : <ToolCard key={b.data.callId} data={b.data} />
                                    ))}
                                </div>
                            ) : (
                                t('editor_assistant.thinking')
                            )}
                            
                            <span className="inline-block w-2 h-4 ml-1 bg-scp-accent animate-blink align-middle"></span>
                        </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-[var(--scp-border)] bg-[#0a0a0a]">
                <form onSubmit={handleSubmit} className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        placeholder={t('editor_assistant.placeholder')}
                        className={`w-full bg-[#111] border border-gray-700 p-2 pr-10 ${isMobile ? 'text-base min-h-[80px]' : 'text-xs min-h-[72px]'} text-white focus:border-scp-accent outline-none font-mono resize-none`}
                        disabled={isLoading}
                    />
                    <button 
                        type="submit" 
                        disabled={isLoading || !input.trim()}
                        className={`absolute right-1 top-1 px-2 text-scp-accent hover:text-white disabled:opacity-30 transition-colors ${isMobile ? 'min-h-[44px] min-w-[44px]' : ''}`}
                    >
                        ➤
                    </button>
                </form>
            </div>
        </div>
    );
};

export default EditorAssistantPanel;
