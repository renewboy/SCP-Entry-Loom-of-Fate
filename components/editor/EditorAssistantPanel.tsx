import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '../../utils/i18n';
import { SCPData, Language } from '../../types';
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
}

const EditorAssistantPanel: React.FC<EditorAssistantPanelProps> = ({
    blueprint,
    setBlueprint,
    scpData,
    setScpData,
    onClose,
    isOpen
}) => {
    const { t, language } = useTranslation();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant' | 'system'; content: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentStreamingContent, setCurrentStreamingContent] = useState('');
    const [welcomeStreamingContent, setWelcomeStreamingContent] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const openaiProvider = useRef(new OpenAIProvider());
    const geminiProvider = useRef(new GeminiProvider());
    const sanitizeSchema = {
        ...defaultSchema,
        tagNames: Array.from(new Set([...(defaultSchema.tagNames || []), 'table', 'thead', 'tbody', 'tr', 'th', 'td'])),
        attributes: {
            ...(defaultSchema.attributes || {}),
            table: [...((defaultSchema.attributes as any)?.table || []), 'align'],
            th: [...((defaultSchema.attributes as any)?.th || []), 'align'],
            td: [...((defaultSchema.attributes as any)?.td || []), 'align']
        }
    };
    const markdownComponents = {
        a: ({ href, children }: any) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-scp-accent underline underline-offset-2 hover:text-white">
                {children}
            </a>
        ),
        code: ({ inline, children }: any) => (
            <code className={inline ? "px-1 py-0.5 rounded bg-black/40 border border-gray-800" : ""}>{children}</code>
        ),
        pre: ({ children }: any) => (
            <pre className="p-2 rounded bg-black/40 border border-gray-800 overflow-x-auto">{children}</pre>
        ),
        h1: ({ children }: any) => <h1 className="text-sm font-semibold leading-snug">{children}</h1>,
        h2: ({ children }: any) => <h2 className="text-sm font-semibold leading-snug">{children}</h2>,
        h3: ({ children }: any) => <h3 className="text-xs font-semibold leading-snug">{children}</h3>,
        h4: ({ children }: any) => <h4 className="text-xs font-semibold leading-snug">{children}</h4>,
        p: ({ children }: any) => <p className="leading-[1.65]">{children}</p>,
        ul: ({ children }: any) => <ul className="list-disc pl-5 space-y-1.5">{children}</ul>,
        ol: ({ children }: any) => <ol className="list-decimal pl-5 space-y-1.5">{children}</ol>,
        li: ({ children }: any) => <li className="leading-[1.65]">{children}</li>,
        table: ({ children }: any) => (
            <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-800">{children}</table>
            </div>
        ),
        thead: ({ children }: any) => <thead className="bg-black/30">{children}</thead>,
        tbody: ({ children }: any) => <tbody>{children}</tbody>,
        tr: ({ children }: any) => <tr className="border-b border-gray-800">{children}</tr>,
        th: ({ children }: any) => <th className="border border-gray-800 px-2 py-2 text-left font-semibold leading-[1.4]">{children}</th>,
        td: ({ children }: any) => <td className="border border-gray-800 px-2 py-2 align-top leading-[1.65]">{children}</td>,
    };
    const Markdown = ({ content }: { content: string }) => (
        <div className="space-y-2">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
                components={markdownComponents}
            >
                {content}
            </ReactMarkdown>
        </div>
    );

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, currentStreamingContent]);

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
                setMessages(saved);
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
                case 'update_story_info': {
                    const { storyBackground, ...rest } = args || {};
                    setScpData((prev) => ({
                        ...prev,
                        ...rest,
                        storyDraft: {
                            ...(prev.storyDraft || {}),
                            ...(storyBackground !== undefined ? { storyBackground } : {})
                        }
                    }));
                    return { success: true, message: "Story info updated." };
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
                    setBlueprint((prev: any) => ({
                        ...prev,
                        nodes: (prev.nodes || []).filter((n: any) => n.id !== args.id),
                        edges: (prev.edges || []).filter((e: any) => e.from !== args.id && e.to !== args.id),
                        npcs: (prev.npcs || []).filter((n: any) => n.initialNodeId !== args.id),
                        objectives: (prev.objectives || []).filter((o: any) => o.nodeId !== args.id)
                    }));
                    return { success: true, message: `Node ${args.id} deleted.` };
                }

                case 'connect_nodes': {
                    console.log(`[EditorAssistant] connect_nodes args: ${JSON.stringify(args)}`);
                    setBlueprint((prev: any) => ({
                        ...prev,
                        edges: [...(prev.edges || []), {
                            from: args.fromId,
                            to: args.toId,
                            bidirectional: args.bidirectional ?? true
                        }]
                    }));
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

        const userMsg = { role: 'user' as const, content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        setCurrentStreamingContent('');
        console.log("before streamEditorAssistant call");
        try {
            const config = await getEffectiveAIConfig();
            const provider = config.provider === 'gemini' ? geminiProvider.current : openaiProvider.current;
            console.log(`streamEditorAssistant call with messages:", ${JSON.stringify(userMsg)}, provider: ${config.provider}`);
            
            const stream = provider.streamEditorAssistant(
                [...messages, userMsg],
                { ...scpData, mapBlueprint: blueprint }, // Ensure we pass the LATEST blueprint
                language as Language,
                handleToolCall
            );

            let fullContent = "";

            for await (const chunk of stream) {
                fullContent += chunk;
                setCurrentStreamingContent(fullContent);
            }

            setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
            setCurrentStreamingContent('');

        } catch (error) {
            console.error("Assistant error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: `[ERROR] ${error}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setMessages([]);
        setCurrentStreamingContent('');
    };

    return (
        <div
            className={`absolute top-0 bottom-0 right-80 w-96 ${panelContainerBase} flex flex-col border-l border-[var(--scp-border)] z-20 shadow-2xl transition-transform transition-opacity duration-300 ease-out ${isOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-[calc(100%+20rem)] opacity-0 pointer-events-none'}`}
        >
            {/* Header */}
            <div className={editorPanelHeader}>
                <div className="flex justify-between items-center">
                    <div className={editorPanelTitle}>
                        <span className="animate-pulse mr-2">●</span>
                        {t('editor_assistant.title')}
                    </div>
                    <div className="flex gap-2">
                         <button onClick={handleClear} className="text-[10px] text-gray-500 hover:text-scp-accent uppercase border border-transparent hover:border-scp-accent/30 px-1 rounded">
                            {t('editor_assistant.clear_chat')}
                        </button>
                        <button onClick={onClose} className="text-gray-500 hover:text-white">×</button>
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
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div 
                            className={`max-w-[90%] p-2 rounded text-xs break-words ${
                                msg.role === 'user' 
                                    ? 'bg-scp-accent/20 text-white border border-scp-accent/40' 
                                    : 'bg-[#1a1a1a] text-scp-text border border-gray-800'
                            }`}
                        >
                            {msg.role === 'user' ? (
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            ) : (
                                <Markdown content={msg.content} />
                            )}
                        </div>
                    </div>
                ))}

                {/* Streaming Content */}
                {isLoading && (
                    <div className="flex flex-col items-start">
                        <div className="max-w-[90%] p-2 rounded text-xs break-words bg-[#1a1a1a] text-scp-text border border-gray-800 animate-pulse">
                            {currentStreamingContent ? (
                                <Markdown content={currentStreamingContent} />
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
                        className="w-full bg-[#111] border border-gray-700 p-2 pr-10 text-xs text-white focus:border-scp-accent outline-none font-mono resize-none min-h-[72px]"
                        disabled={isLoading}
                    />
                    <button 
                        type="submit" 
                        disabled={isLoading || !input.trim()}
                        className="absolute right-1 top-1 px-2 text-scp-accent hover:text-white disabled:opacity-30 transition-colors"
                    >
                        ➤
                    </button>
                </form>
            </div>
        </div>
    );
};

export default EditorAssistantPanel;
