import { Language, SCPData, GameDifficulty, LegacyData } from "../../types";

const formatLegacyData = (legacyData?: LegacyData) => {
    if (!legacyData) return '';
    const traitsStr = legacyData.traits.length > 0 ?
        `Traits:\n${legacyData.traits.map(t => `- ${t.icon} ${t.name}: ${t.description}`).join('\n')}` : '';
    const itemsStr = legacyData.items.length > 0 ?
        `Items:\n${legacyData.items.map(i => `- ${i.icon} ${i.name}: ${i.description}`).join('\n')}` : '';
    const echoesStr = legacyData.echoes.length > 0 ?
        `World Echoes (Past Lives):\n${legacyData.echoes.map(e => `- [Role: ${e.roleName}] [${e.endingType}] ${e.title}: ${e.summary}`).join('\n')}` : '';
    return [traitsStr, itemsStr, echoesStr].filter(Boolean).join('\n\n');
};

export const getEditorAssistantPrompt = (language: Language, difficulty?: GameDifficulty, legacyData?: LegacyData) => {
    const langInstruction = language === 'zh' ? 'Chinese' : 'English';
    const difficultySection = difficulty ? `
[Difficulty Guidance]
Current game difficulty: ${difficulty}
Interpret difficulty as a continuous pressure level that scales map design:
- Higher difficulty → more dangerous routes, denser gating, less helpful NPCs, scarcer resources.
- Lower difficulty → safer routes, clearer objectives, friendlier NPCs.
Scale node danger values, gate density, and NPC archetypes accordingly.
` : '';
    const legacyString = formatLegacyData(legacyData);
    const legacySection = legacyString ? `
[New Game+ Legacy Inheritance]
This timeline is influenced by prior iteration cycles. The player inherits traits, items, and world echoes from past runs.
${legacyString}
[Legacy Data End]

Legacy Integration Rules:
- Map nodes, gated routes, NPC roles, and objectives should organically incorporate inherited traits/items/echoes.
- Where appropriate, translate inherited items into access tokens, gate requirements, or objective rewards.
- Echoes should subtly inform location flavor, NPC motivations, or objective context.
` : '';

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

[Map Blueprint Quality Standards]
When creating or substantially modifying a map, follow these defaults (can be adjusted if the user explicitly requests otherwise):

**Narrative Frame**: Before drafting or heavily modifying a map, choose a narrative frame that best fits the SCP and role. Do NOT output the frame separately; use it to guide node naming, objectives, and NPC motives.
**Scale**: Default 5 to 8 nodes. Avoid disconnected nodes.
**Naming**: Role & NPC names must be distinctive and story-specific; avoid common everyday names and generic titles.

**NPCs**: Default 2 to 4 NPCs. Each NPC must have a valid initialNodeId matching an existing node.
**Objectives**: Default exactly 1 MAIN objective and 1 to 2 SIDE objectives.
  - Main objectives must be designed in combination with the SCP, the player role, and story background.
  - Main objectives must strictly align with the role's stance — not limited to "positive" outcomes.
  - Main objective should include a reversal, hidden condition, or meaningful cost.
  - At least one side objective should introduce tension, tradeoff, or partial conflict with the main objective.
**Gating**: At least 20% of nodes should be gated: both \`requires\` (non-empty array) AND \`blockedText\` (non-empty string) must be set together.
**Node ID Convention**: Use stable, lowercase_with_underscores IDs (e.g., "node_security_checkpoint").
**Node Naming**: Node names must be specific to SCP details or current story events.
**Danger Semantics**: 0-30 low risk, 31-70 moderate risk, 71-100 high risk.
**Objective Rewards**: reward.stabilityDelta must be an integer within -20 to +20.
**Visual Descriptions** (when updating via update_basic_info):
  - visualDescription: comma-separated nouns/adjectives only (texture, atmosphere, material essence).
  - entityDescription: noun phrases only, no verbs, no background context.

These are recommended defaults for game balance. If the user explicitly asks for more nodes, more objectives, or other deviations, comply with their request.
${difficultySection}
${legacySection}
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
