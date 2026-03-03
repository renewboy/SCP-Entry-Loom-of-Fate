import { Language, SCPData } from "../../types";

export const getEditorAssistantPrompt = (language: Language) => {
    const langInstruction = language === 'zh' ? 'Chinese' : 'English';
    return `
[SYSTEM COMMAND: ACT AS An SCP FOUNDATION "LOOM OF FATE (命运织机)" EDITOR AI]

Role: You are the "Loom of Fate AI" integrated into the SCP Foundation Story Editor terminal.
Tone: Professional, precise, and helpful. Maintain an SCP Foundation terminal aesthetic, but prioritize clarity, usability, and user guidance.
Your goal is to assist the user in modifying the story/map configuration and AND answer story-related or SCP-universe questions, while preserving the Loom of Fate aesthetic.

Capabilities:
1. **Analyze User Intent**: Understand natural language requests to change the map, NPCs, objectives, or story background.
2. **Execute Tools**: Use the provided tools to apply changes.
   - For simple, single-entity changes, use specific tools (e.g., \`add_node\`, \`update_npc\`).
   - For complex, multi-step, or structural changes, prefer using \`multi_step\` to bundle an ordered list of edits into a single tool call. If \`multi_step\` is not suitable, decompose the request into a sequence of tool calls and apply them step-by-step.
   - After calling \`add_node\`, you MUST call \`connect_nodes\` to connect the new node to the existing graph (unless the user explicitly asks for an isolated node).
   - When you need SCP Foundation-specific references, call \`web_search\` with a concise query.
3. **Context Awareness**: You have access to the current Map Blueprint and Story Data. Ensure your changes are consistent with the existing state.

Output Language: ${langInstruction}

When the user asks to "Clear" or "Reset", advise them to use the UI buttons.
`;
};

export const getEditorAssistantContext = (scpData: SCPData) => {
    const draft = scpData.storyDraft || {};
    return `[CURRENT MAP BLUEPRINT]\n${JSON.stringify(scpData.mapBlueprint)}\n\n[CURRENT SCP DATA]\nDesignation: ${scpData.designation}\nName: ${scpData.name}\nContainment Class: ${scpData.containmentClass}\nRole: ${scpData.role}\nVisual Description: ${scpData.visualDescription || ""}\nEntity Description: ${scpData.entityDescription || ""}\n\n[CURRENT STORY DRAFT]\nRole Details: ${draft.roleDetails || ""}\nStory Background: ${draft.storyBackground || ""}\nNarrative Constraints: ${draft.narrativeConstraints || ""}\nOpening Prompt: ${draft.openingPrompt || ""}`;
};

export const editorTools = [
    {
        type: "function",
        function: {
            name: "multi_step",
            description: "Apply multiple editor tool calls in a strict order. Use this to execute complex changes reliably in one request.",
            parameters: {
                type: "object",
                properties: {
                    steps: {
                        type: "array",
                        description: "Ordered steps to execute. Each step calls exactly one tool with arguments.",
                        items: {
                            type: "object",
                            properties: {
                                tool: {
                                    type: "string",
                                    enum: [
                                        "update_basic_info",
                                        "update_story_draft",
                                        "add_node",
                                        "update_node",
                                        "delete_node",
                                        "connect_nodes",
                                        "add_npc",
                                        "update_npc",
                                        "delete_npc",
                                        "add_objective",
                                        "update_objective",
                                        "delete_objective"
                                    ]
                                },
                                args: {
                                    type: "object",
                                    description: "Arguments for the chosen tool."
                                }
                            },
                            required: ["tool", "args"]
                        }
                    }
                },
                required: ["steps"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_basic_info",
            description: "Update SCPData top-level fields (designation/name/containmentClass/role etc.).",
            parameters: {
                type: "object",
                properties: {
                    designation: { type: "string" },
                    name: { type: "string" },
                    containmentClass: { type: "string" },
                    role: { type: "string" },
                    visualDescription: { type: "string" },
                    entityDescription: { type: "string" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_story_draft",
            description: "Update the story information.",
            parameters: {
                type: "object",
                properties: {
                    roleDetails: { type: "string" },
                    storyBackground: { type: "string" },
                    narrativeConstraints: { type: "string" },
                    openingPrompt: { type: "string", description: "Initial scene prompt for the story." },
                    backgroundImage: { type: "string", description: "Data URL or remote URL." },
                    entityImage: { type: "string", description: "Data URL or remote URL." }
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
                    id: { type: "string" },
                    name: { type: "string" },
                    danger: { type: "number", description: "0-100" },
                    discoverables: { type: "array", items: { type: "string" } },
                    interactables: { type: "array", items: { type: "string" } },
                    requires: { type: "array", items: { type: "string" } },
                    blockedText: { type: "string" }
                },
                required: ["id", "name"]
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
                    discoverables: { type: "array", items: { type: "string" } },
                    interactables: { type: "array", items: { type: "string" } },
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
                    id: { type: "string"},
                    name: { type: "string" },
                    archetype: { type: "string" },
                    initialNodeId: { type: "string" },
                    secretTags: { type: "array", items: { type: "string" } },
                    dialogueGoals: { type: "array", items: { type: "string" } }
                },
                required: ["id", "name", "initialNodeId"]
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
                    initialNodeId: { type: "string" },
                    secretTags: { type: "array", items: { type: "string" } },
                    dialogueGoals: { type: "array", items: { type: "string" } }
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
                    id: { type: "string", description: "Required. Must be unique. Provide deterministic ids for multi-step edits." },
                    title: { type: "string" },
                    type: { type: "string", enum: ["MAIN", "SIDE"] },
                    nodeId: { type: "string", description: "Target location for the objective" },
                    progress: { type: "number" },
                    detail: { type: "string" },
                    reward: {
                        type: "object",
                        properties: {
                            accessTokens: { type: "array", items: { type: "string" } },
                            stabilityDelta: { type: "number" }
                        }
                    }
                },
                required: ["id", "title", "type", "nodeId"]
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
                    nodeId: { type: "string" },
                    progress: { type: "number" },
                    detail: { type: "string" },
                    reward: {
                        type: "object",
                        properties: {
                            accessTokens: { type: "array", items: { type: "string" } },
                            stabilityDelta: { type: "number" }
                        }
                    }
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
