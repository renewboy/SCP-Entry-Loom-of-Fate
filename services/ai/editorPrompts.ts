import { Language } from "../../types";

export const getEditorAssistantPrompt = (language: Language) => {
    const langInstruction = language === 'zh' ? 'Chinese' : 'English';
    return `
[SYSTEM COMMAND: ACT AS An SCP FOUNDATION "LOOM OF FATE (命运织机)" EDITOR AI]

Role: You are the "Loom of Fate AI" integrated into the SCP Foundation Story Editor terminal.
Tone: Cold, precise, ritualistic, SCP-adjacent, with terminal-like phrasing and brief confirmations.
Your goal is to assist the user in modifying the story configuration, map structure, and entity details while preserving the Loom of Fate aesthetic.

Capabilities:
1. **Analyze User Intent**: Understand natural language requests to change the map, NPCs, objectives, or story background.
2. **Execute Tools**: Use the provided tools to apply changes.
   - For simple, single-entity changes, use specific tools (e.g., \`add_node\`, \`update_npc\`).
   - For complex, multi-step, or structural changes (e.g., "Create a 3-floor facility with a containment zone"), use \`update_map_blueprint\` to rewrite the entire map or a large section of it.
   - When you need SCP Foundation-specific references, call \`web_search\` with a concise query.
3. **Context Awareness**: You have access to the current Map Blueprint and Story Data. Ensure your changes are consistent with the existing state (unless the user asks to overwrite it).
4. **SCP Style**: Maintain the clinical, cold, and precise tone of the Foundation, but be helpful.

Output Language: ${langInstruction}

When the user asks to "Clear" or "Reset", advise them to use the UI buttons or use the \`update_map_blueprint\` with a default template if they insist.
`;
};

export const editorTools = [
    {
        type: "function",
        function: {
            name: "update_map_blueprint",
            description: "Fully replace or significantly update the map blueprint. Use this for bulk changes, restructuring, or creating complex layouts from scratch.",
            parameters: {
                type: "object",
                properties: {
                    blueprint: {
                        type: "object",
                        description: "The complete MapBlueprint object",
                        properties: {
                            id: { type: "string" },
                            title: { type: "string" },
                            startNodeId: { type: "string" },
                            nodes: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        name: { type: "string" },
                                        danger: { type: "number" },
                                        tags: { type: "array", items: { type: "string" } },
                                        requires: { type: "array", items: { type: "string" } },
                                        blockedText: { type: "string" },
                                        layout: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } }
                                    },
                                    required: ["id", "name", "danger"]
                                }
                            },
                            edges: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        from: { type: "string" },
                                        to: { type: "string" },
                                        bidirectional: { type: "boolean" }
                                    },
                                    required: ["from", "to"]
                                }
                            },
                            npcs: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        name: { type: "string" },
                                        archetype: { type: "string" },
                                        initialNodeId: { type: "string" }
                                    },
                                    required: ["id", "name", "initialNodeId"]
                                }
                            },
                            objectives: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        title: { type: "string" },
                                        type: { type: "string", enum: ["MAIN", "SIDE"] },
                                        nodeId: { type: "string" }
                                    },
                                    required: ["id", "title", "type", "nodeId"]
                                }
                            }
                        },
                        required: ["nodes", "edges"]
                    }
                },
                required: ["blueprint"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_story_info",
            description: "Update the basic story information (designation, title, role, background).",
            parameters: {
                type: "object",
                properties: {
                    designation: { type: "string" },
                    name: { type: "string" },
                    containmentClass: { type: "string" },
                    role: { type: "string" },
                    storyBackground: { type: "string" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "add_node",
            description: "Add a single node to the map.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    danger: { type: "number", description: "0-100" },
                    description: { type: "string", description: "Visual hint or description" }
                },
                required: ["name"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_node",
            description: "Update an existing node's properties.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    danger: { type: "number" },
                    visualHint: { type: "string" },
                    requires: { type: "array", items: { type: "string" } },
                    blockedText: { type: "string" }
                },
                required: ["id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "delete_node",
            description: "Delete a node by ID.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string" }
                },
                required: ["id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "connect_nodes",
            description: "Connect two existing nodes.",
            parameters: {
                type: "object",
                properties: {
                    fromId: { type: "string" },
                    toId: { type: "string" },
                    bidirectional: { type: "boolean", default: true }
                },
                required: ["fromId", "toId"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "add_npc",
            description: "Add a new NPC to the map.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    archetype: { type: "string" },
                    initialNodeId: { type: "string" }
                },
                required: ["name", "initialNodeId"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_npc",
            description: "Update an existing NPC.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    archetype: { type: "string" },
                    initialNodeId: { type: "string" }
                },
                required: ["id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "delete_npc",
            description: "Delete an NPC by ID.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string" }
                },
                required: ["id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "add_objective",
            description: "Add a new objective (mission).",
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    type: { type: "string", enum: ["MAIN", "SIDE"] },
                    nodeId: { type: "string", description: "Target location for the objective" }
                },
                required: ["title", "type", "nodeId"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_objective",
            description: "Update an existing objective.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    type: { type: "string", enum: ["MAIN", "SIDE"] },
                    nodeId: { type: "string" }
                },
                required: ["id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "delete_objective",
            description: "Delete an objective by ID.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string" }
                },
                required: ["id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "web_search",
            description: "Search the web for factual references when needed. Returns summarized results.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search query" }
                },
                required: ["query"]
            }
        }
    }
];
