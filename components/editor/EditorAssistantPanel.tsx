import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../utils/i18n';
import { SCPData, Language } from '../../types';
import { OpenAIProvider } from '../../services/ai/providers/openaiProvider';
import { postJson } from '../../services/ai/providers/backendClient';
import { loadSetting, saveSetting } from '../../services/indexedDBService';
import { getEffectiveAIConfig } from '../../services/aiConfigService';
import { editorPanelHeader, editorPanelTitle, panelContainerBase } from './editorStyles';

interface EditorAssistantPanelProps {
    blueprint: any;
    setBlueprint: (blueprint: any) => void;
    scpData: SCPData;
    setScpData: (data: SCPData) => void;
    onClose: () => void;
}

const EditorAssistantPanel: React.FC<EditorAssistantPanelProps> = ({
    blueprint,
    setBlueprint,
    scpData,
    setScpData,
    onClose
}) => {
    const { t, language } = useTranslation();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant' | 'system'; content: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentStreamingContent, setCurrentStreamingContent] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const aiProvider = useRef(new OpenAIProvider());

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, currentStreamingContent]);

    const historyKey = `editor_assistant_history_${scpData.designation || 'default'}`;

    useEffect(() => {
        const loadHistory = async () => {
            const saved = await loadSetting(historyKey);
            if (Array.isArray(saved)) {
                setMessages(saved);
            }
        };
        loadHistory();
    }, [historyKey]);

    useEffect(() => {
        saveSetting(historyKey, messages);
    }, [historyKey, messages]);

    const handleToolCall = async (toolName: string, args: any) => {
        console.log(`[EditorAssistant] Handling tool call: ${toolName}`, args);
        
        // --- Tool Implementation ---
        try {
            switch (toolName) {
                case 'update_map_blueprint':
                    if (args.blueprint) {
                        setBlueprint(args.blueprint);
                        return { success: true, message: "Map blueprint updated successfully." };
                    }
                    return { success: false, message: "Missing blueprint argument." };
                
                case 'update_story_info':
                    setScpData({
                        ...scpData,
                        ...args
                    });
                    return { success: true, message: "Story info updated." };

                case 'add_node': {
                    const newNode = {
                        id: `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                        name: args.name || 'New Node',
                        danger: args.danger || 0,
                        visualHint: args.description || '',
                        layout: { x: 50 + Math.random() * 20, y: 50 + Math.random() * 20 },
                        requires: [],
                        blockedText: ''
                    };
                    setBlueprint((prev: any) => ({
                        ...prev,
                        nodes: [...prev.nodes, newNode]
                    }));
                    return { success: true, nodeId: newNode.id, message: "Node added." };
                }

                case 'update_node': {
                    setBlueprint((prev: any) => ({
                        ...prev,
                        nodes: prev.nodes.map((n: any) => n.id === args.id ? { ...n, ...args } : n)
                    }));
                    return { success: true, message: `Node ${args.id} updated.` };
                }

                case 'delete_node': {
                    setBlueprint((prev: any) => ({
                        ...prev,
                        nodes: prev.nodes.filter((n: any) => n.id !== args.id),
                        edges: prev.edges.filter((e: any) => e.from !== args.id && e.to !== args.id),
                        npcs: prev.npcs.filter((n: any) => n.initialNodeId !== args.id),
                        objectives: prev.objectives.filter((o: any) => o.nodeId !== args.id)
                    }));
                    return { success: true, message: `Node ${args.id} deleted.` };
                }

                case 'connect_nodes': {
                    setBlueprint((prev: any) => ({
                        ...prev,
                        edges: [...prev.edges, {
                            from: args.fromId,
                            to: args.toId,
                            bidirectional: args.bidirectional ?? true
                        }]
                    }));
                    return { success: true, message: "Nodes connected." };
                }

                case 'add_npc': {
                    const newNPC = {
                        id: `npc_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                        name: args.name || 'New NPC',
                        archetype: args.archetype || 'Researcher',
                        initialNodeId: args.initialNodeId
                    };
                    setBlueprint((prev: any) => ({
                        ...prev,
                        npcs: [...prev.npcs, newNPC]
                    }));
                    return { success: true, npcId: newNPC.id, message: "NPC added." };
                }

                case 'update_npc': {
                    setBlueprint((prev: any) => ({
                        ...prev,
                        npcs: prev.npcs.map((n: any) => n.id === args.id ? { ...n, ...args } : n)
                    }));
                    return { success: true, message: `NPC ${args.id} updated.` };
                }

                case 'delete_npc': {
                    setBlueprint((prev: any) => ({
                        ...prev,
                        npcs: prev.npcs.filter((n: any) => n.id !== args.id)
                    }));
                    return { success: true, message: `NPC ${args.id} deleted.` };
                }

                case 'add_objective': {
                    const newObj = {
                        id: `obj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                        title: args.title || 'New Objective',
                        type: args.type || 'MAIN',
                        nodeId: args.nodeId
                    };
                    setBlueprint((prev: any) => ({
                        ...prev,
                        objectives: [...prev.objectives, newObj]
                    }));
                    return { success: true, objectiveId: newObj.id, message: "Objective added." };
                }

                case 'update_objective': {
                    setBlueprint((prev: any) => ({
                        ...prev,
                        objectives: prev.objectives.map((o: any) => o.id === args.id ? { ...o, ...args } : o)
                    }));
                    return { success: true, message: `Objective ${args.id} updated.` };
                }

                case 'delete_objective': {
                    setBlueprint((prev: any) => ({
                        ...prev,
                        objectives: prev.objectives.filter((o: any) => o.id !== args.id)
                    }));
                    return { success: true, message: `Objective ${args.id} deleted.` };
                }

                case 'web_search': {
                    const query = args?.query || '';
                    if (!query) {
                        return { success: false, message: "Missing query." };
                    }
                    const config = await getEffectiveAIConfig();
                    const systemPrompt = 'You are an SCP Foundation editor assistant. Search the given query, prioritize authoritative sources, and return concise key points and conclusions.';
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

        try {
            const stream = aiProvider.current.streamEditorAssistant(
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
        <div className={`absolute top-0 bottom-0 right-80 w-96 ${panelContainerBase} flex flex-col border-l border-[var(--scp-border)] z-20 shadow-2xl`}>
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
                {messages.length === 0 && (
                    <div className="text-center text-gray-600 italic mt-10 px-4 text-xs border border-dashed border-gray-800 py-8 rounded">
                        {t('editor_assistant.welcome')}
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div 
                            className={`max-w-[90%] p-2 rounded text-xs whitespace-pre-wrap ${
                                msg.role === 'user' 
                                    ? 'bg-scp-accent/20 text-white border border-scp-accent/40' 
                                    : 'bg-[#1a1a1a] text-scp-text border border-gray-800'
                            }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}

                {/* Streaming Content */}
                {isLoading && (
                    <div className="flex flex-col items-start">
                        <div className="max-w-[90%] p-2 rounded text-xs whitespace-pre-wrap bg-[#1a1a1a] text-scp-text border border-gray-800 animate-pulse">
                            {currentStreamingContent || t('editor_assistant.thinking')}
                            <span className="inline-block w-2 h-4 ml-1 bg-scp-accent animate-blink align-middle"></span>
                        </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-[var(--scp-border)] bg-[#0a0a0a]">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={t('editor_assistant.placeholder')}
                        className="w-full bg-[#111] border border-gray-700 p-2 pr-10 text-xs text-white focus:border-scp-accent outline-none font-mono"
                        disabled={isLoading}
                    />
                    <button 
                        type="submit" 
                        disabled={isLoading || !input.trim()}
                        className="absolute right-1 top-1 bottom-1 px-2 text-scp-accent hover:text-white disabled:opacity-30 transition-colors"
                    >
                        ➤
                    </button>
                </form>
            </div>
        </div>
    );
};

export default EditorAssistantPanel;
