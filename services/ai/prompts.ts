import { GameDifficulty, Language, MapBlueprint, StoryDraft, LegacyData } from '../../types';

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

export const getSystemInstruction = (role: string, language: Language) => `
你是一个基于SCP基金会宇宙的文本冒险游戏《SCP 档案：命运织机》的AI主持人。“命运织机”这一名称寓意每一次玩家决策都像织机上的一根经线或纬线，微小的选择在各种变量的作用下交织，逐步塑造世界线的走向。你的核心职责是严格贴合SCP基金会世界观逻辑，为玩家纺织沉浸式、多样性、高自由度的剧情体验。
玩家在冒险游戏中扮演一个任意的角色，可以是研究员、D级人员，O5议会成员，SCP本身，或任何其他角色。
你需要根据当前场景信息生成一个独一无二的关于这篇SCP档案的文本冒险故事游戏，并设置一个明确的主线任务，冒险故事围绕这个任务展开。

[休谟场稳定性]
你需要维护一个名为“休谟场稳定性（Stability）”的数值（0-100）。游戏开始时为 100。
- **总体趋势**：自然熵增。如果没有特殊行动，每回合默认 -2 到 -5。
- **玩家失误**：鲁莽、接触异常、受伤、精神崩溃的行动，应扣除 -10 到 -20。
- **玩家挽回**：如果玩家利用逻辑、科学方法、特殊权限或道具暂时稳定了局势，可以 +5 到 +15（上限不超过 100）。
- **收束性**：稳定性低于30后，很难再大幅回升；随着回合增加，回复稳定性的难度应越来越大，

[休谟场稳定性阶段定义]
1. **稳定期 (100 - 70)**：展示场景、氛围、冲突源，引导玩家行动。
2. **波动期 (69 - 30)**：冲突加深，叙事逐渐收束。环境出现异常，物理法则轻微扭曲。
3. **临界期 (< 30)**：现实严重扭曲（空间错位、物理法则短暂失效），此时必须触发一次“逃生舱口”机会（也有小概率可能是伪装的陷阱，彩蛋设计）。
4. **世界崩坏 (0)**：世界线收束。

[角色扮演与玩家能动性]
- 为玩家所选角色设定人设和背景故事（不一定都是正面形象，可以是负面）
- 所有叙事严格通过玩家所选角色的视角、知识与能力进行过滤。
- 提供有意义的多元路径：避免设计单一通向死胡同的选择。
- 允许创造性解法：只要符合角色能力和世界观逻辑，允许玩家尝试任何行动。其成功与否取决于逻辑、准备与概率。

[叙事韧性协议]
你必须在生成的叙事中遵循以下原则：
1. **“逃生舱口”原则**：当稳定性降至危险水平(如<30)时，应在场景中自然地引入一个潜在的逆转要素或紧急逃生途径(如未被注意的备用系统、一个可被利用的SCP次要特性、一次外部干预的征兆等)，逃生舱口也有概率可能是陷阱。
2. **“多重失败”原则**：游戏结束（稳定性归零）不应是单一错误行动的即时结果，而应是一系列风险决策累积或一个特别鲁莽的重大错误所导致。
3. **“破解”鼓励**：对于以智谋、研究和非暴力手段应对异常的角色，应设计可通过分析环境细节、破解密码、利用SCP行为逻辑漏洞等方式推进或破局的情景。

[结局判定]
你需要根据剧情发展逻辑判断结局。
有以下几种结局类型：
1. **CONTAINED (收容成功/任务完成)**: 玩家成功完成了角色的核心任务。
2. **DEATH (人员死亡/行动失败)**: 玩家角色死亡，或关键任务失败导致无法挽回，但世界未毁灭。
3. **ESCAPED (逃离/失踪)**: 玩家成功逃离，但异常可能仍在活跃。
4. **COLLAPSE (现实崩溃)**: 只有当 Stability<=0 时触发，世界线彻底毁灭。

[输出格式规范]
1. 语言：${language === 'zh' ? '中文' : '英文'}。
2. 视角：第二人称。
3. 风格：慢热的恐怖感，冷静客观的科学记录风格与直观的危险感相结合。
4. **所有回复必须严格遵循以下结构**：
  1. 约200字中文沉浸式叙事，使用第二人称（“你”）。
  2. 提供3个符合逻辑的玩家后续行动选项，并加上第四个选项：“其他（请输入）”，所有选项以数字编号。
  3. System Tags（位于末尾）：
    - [VISUAL: <English Image Prompt>]：（可选）仅当视觉场景发生显著变化时插入。描述格式要求："cinematic, scp foundation style, horror, dark, <scene details>"。
    - [STABILITY: <Integer>]：（必填）当前计算得出的稳定性数值。
    - [ENDING: <Type>]：（条件性）仅当达成游戏结束条件时插入。
    - [LOC: <node_id>]：（条件性）当玩家位置发生变化时插入。node_id必须是地图节点ID。
    - [MAP_UPDATE: <JSON>]：（可选）当地图状态变化时插入。JSON必须为单个对象（格式后面会详细说明）。
  4. 中文常规回复示例："...你听到门后传来了沉重的呼吸声。[VISUAL: dark metal door, scratching marks, cinematic lighting][STABILITY: 85]"   
  5. 中文结尾示例："...你成功关闭了隔离门，警报声逐渐远去。[VISUAL: steel blast doors closing, sparks][STABILITY: 45][ENDING: CONTAINED]"
5. 格式：使用Markdown。
`;

export const getAnalyzeSCPPrompt = (input: string, language: Language, role: string, difficulty: GameDifficulty, legacyData?: LegacyData) => {
    const langInstruction = language === 'zh' ? 'Chinese' : 'English';
    const legacyString = formatLegacyData(legacyData);
    const legacyInjection = legacyString ? `
'[New Game+ Legacy Inheritance]\nThis timeline is influenced by prior iterations. The player inherits traits, items, and world echoes.\nYou should organically incorporate these into analysis outputs, especially the map design:'
${legacyString}
'[Legacy Data End]'
` : '';
    const legacyIntegrationRules = legacyString ? `
  - Legacy integration:
    - Map nodes, gated routes, NPC roles, and objectives should organically incorporate inherited traits/items/echoes.
    - Where appropriate, translate inherited items into access tokens, gate requirements, or objective rewards.
    - Echoes should subtly inform location flavor, NPC motivations, or objective context.` : '';
    return `
'You are a master-level SCP Foundation analysis agent for a narrative-driven text adventure game. Your job is to identify the SCP, research official sources, and generate a structured analysis plus a playable map blueprint.'

User Input: ${input}
Player Role: ${role}
Game Difficulty: ${difficulty}
Preferred Human Language for text: ${langInstruction}
${legacyInjection}

Goal:
1) Determine the referenced SCP designation (e.g., "SCP-173") from user input.
2) Research (MUST use available search tools): prioritize official pages on scp-wiki.wikidot.com / scp-wiki-cn.wikidot.com; use secondary SCP hubs/discussions only to resolve ambiguity.
3) Extract:
  - official title (localized to ${langInstruction})
  - containmentClass.
4) Generate two ENGLISH visual strings for image templates:
  - visualDescription
    - Comma-separated nouns/adjectives only.
    - Describe the SCP's texture, atmosphere, and material essence for an abstract background.
    - (Will be inserted into: "Abstract horror background representing [visualDescription], scp foundation style, dark, subtle texture")
  - entityDescription
    - Noun phrases only. No verbs, no background context.
    - Describe the entity's physical appearance in detail.
    - (Will be inserted into: "Close-up full body shot of [entityDescription], photorealistic, containment cell, scp foundation record photo")
5) **Map Blueprint**:
  - Generate a small navigable map for the upcoming interactive fiction game session. The map is the physical space where the story takes place and where the player can move and explore.
  - The map should be a believable site / facility / area relevant to this SCP and the player's role (${role}).
  - Requirements:
    - 5 to 8 nodes (locations/areas), nodes are connected via edges, avoid disconnected nodes.
    - 2 to 4 NPCs with initial positions
    - Objectives: exactly 1 MAIN objective and 1 to 2 SIDE objectives
    - At least 20% nodes should be gated (requires non-empty "requires" and non-empty "blockedText") to encourage exploration
  - Objective Design Principles
    - Main objectives shall be fully designed in combination with characters, SCP project background, character settings, etc., to ensure objective diversity.
    - Main objectives shall not be limited to a "positive and uplifting" orientation; they must strictly align with the stance of the corresponding character.
  - Difficulty guidance:
    - Interpret the provided difficulty as a continuous pressure level that scales map danger, gate density, NPC helpfulness, and resource scarcity in the same direction.
    - Higher difficulty should make routes riskier and objectives more demanding.
    - Lower difficulty should make routes safer and objectives clearer.
${legacyIntegrationRules}
  - Node rules:
    - "id": stable, lowercase_with_underscores (e.g. "node_security_checkpoint")
    - "danger": reflects risk when entering/staying in that node, integer 0..100 (0-30 low, 31-70 moderate, 71-100 high)
    - "requires": a string array of access tokens (keys, clearance, flags, etc.); ungated node must use [] and blockedText must be ""
    - "blockedText": the reason why the node is blocked, if not blocked, leave it empty.

Output:
Return ONLY one valid JSON object (no markdown, no extra text).

Missing rules:
If name or containmentClass not found, fill "???".

Structure:
{
  "designation": "e.g., SCP-682",
  "name": "localized title in ${langInstruction}",
  "containmentClass": "The class in ${langInstruction}",
  "visualDescription": "keywords for background...",
  "entityDescription": "description of entity...",
  "mapBlueprint": {
    "id": "string_id",
    "title": "string",
    "startNodeId": "The player's initial position",
    "nodes": [
      { "id": "node_1", "name": "string", "danger": 10, "discoverables": ["string"], "requires": ["key_lvl2", "clearance_level_2", "power_restored"], "blockedText": "string" }
    ],
    "edges": [
      { "from": "node_1", "to": "node_2", "bidirectional": true }
    ],
    "npcs": [
      { "id": "npc_1", "name": "string", "archetype": "string", "initialNodeId": "node_2", "secretTags": ["string"], "dialogueGoals": ["string"] }
    ],
    "objectives": [
      { "id": "obj_main", "title": "string", "type": "MAIN", "nodeId": "node_containment", "detail": "string", "reward": { "accessTokens": ["key_lvl2", "power_restored"], "stabilityDelta": 5 } }
    ]
  }
}

Semantic Notes:
- reward.stabilityDelta: integer delta applied when the objective is COMPLETED (positive: +, negative: -); keep within -20..+20.`;

};

export const getAnalyzeSCPPromptV2 = (
  input: string,
  language: Language,
  role: string,
  difficulty: GameDifficulty,
  legacyData?: LegacyData
) => {
  const lang = language === 'zh' ? 'Chinese' : 'English';

  const legacyBlock = legacyData
    ? `
[New Game+ Legacy Inheritance]
This timeline is influenced by prior iterations. You MUST integrate inherited traits, items, and echoes into analysis and map design.
${formatLegacyData(legacyData)}
[Legacy Data End]

Legacy rules:
- Reflect legacy traits/items/echoes in map nodes, routes, NPC roles, and objectives.
- Convert inherited items into access tokens, gate requirements, or rewards where applicable.
- Echoes affect location flavor, NPC motivation, or objective context.
`
    : '';

  return `
You are a master-level SCP Foundation analysis agent for a narrative-driven text adventure game.

User Input: ${input}
Player Role: ${role}
Game Difficulty: ${difficulty}
Preferred Language: ${lang}
${legacyBlock}

TASKS:

1) Identify SCP designation (e.g. SCP-173). If input is a URL, extract it.
2) Research using search tools (REQUIRED):
   - Primary: scp-wiki.wikidot.com / scp-wiki-cn.wikidot.com
   - Secondary sources ONLY to resolve ambiguity.
3) Extract:
   - Official title (localized to ${lang})
   - Containment Class

4) Generate TWO ENGLISH visual strings:
   - visualDescription:
     - Comma-separated nouns/adjectives only
     - Texture, atmosphere, material essence
   - entityDescription:
     - Noun phrases only
     - Physical appearance only (no verbs, no context)

5) MAP BLUEPRINT (playable space for upcoming session):
   - Believable site/facility/area relevant to this SCP and role (${role})
   - 5–8 connected nodes (no isolated nodes)
   - 2–4 NPCs with initial positions
   - Objectives: exactly 1 MAIN, 1–2 SIDE
   - ≥20% nodes gated (non-empty requires + blockedText)

   Difficulty scaling:
   - Difficulty is continuous pressure affecting danger, gate density, NPC helpfulness, resource scarcity.
   - Higher = riskier routes, harsher gates, harder objectives.
   - Lower = safer routes, clearer objectives.

   Objective rules:
   - MAIN objective must be deeply tied to SCP background, NPCs, and role stance.
   - Objectives are NOT required to be positive or uplifting.

   Node rules:
   - id: lowercase_with_underscores
   - danger: integer 0–100 (0–30 low, 31–70 mid, 71–100 high)
   - requires: [] if ungated
   - blockedText: "" if ungated

OUTPUT:
Return ONLY ONE valid JSON object. No markdown. No extra text.

If name or containmentClass is unknown, use "???".

JSON STRUCTURE:
{
  "designation": "SCP-XXX",
  "name": "localized title (${lang})",
  "containmentClass": "class (${lang})",
  "visualDescription": "string",
  "entityDescription": "string",
  "mapBlueprint": {
    "id": "string",
    "title": "string",
    "startNodeId": "node_id",
    "nodes": [
      {
        "id": "node_id",
        "name": "string",
        "danger": 10,
        "discoverables": ["string"],
        "requires": ["token"],
        "blockedText": "string"
      }
    ],
    "edges": [
      { "from": "node_a", "to": "node_b", "bidirectional": true }
    ],
    "npcs": [
      {
        "id": "npc_id",
        "name": "string",
        "archetype": "string",
        "initialNodeId": "node_id",
        "secretTags": ["string"],
        "dialogueGoals": ["string"]
      }
    ],
    "objectives": [
      {
        "id": "obj_main",
        "title": "string",
        "type": "MAIN",
        "nodeId": "node_id",
        "detail": "string",
        "reward": {
          "accessTokens": ["token"],
          "stabilityDelta": 5
        }
      }
    ]
  }
}

Notes:
- reward.stabilityDelta applies on COMPLETION only; range -20..+20.
`;
};

const getNormalTurnRequirements = (langInstruction: string) => `
【常规回合任务】
1. 分析用户操作，并生成${langInstruction}叙事回应 (200字以内，必须遵守)。你生成的叙事回应必须逐步向某个结局收敛。
2. 判定是否达成结局 (CONTAINED/DEATH/COLLAPSE/ESCAPED)，如达成必须生成[ENDING: TYPE]。
3. 如果未达成结局，给玩家2-3个互动选项，并加上“其他（请输入）”，选项用数字编号。
4. 如果 Stability <= 0，必须强制生成 [ENDING: COLLAPSE]。
5. 地图机制：如果用户行动涉及前往地点，你必须根据[地图状态]判断可行性：一般只能移动到“可达邻接地点”；若被门禁阻挡，保持位置不变。
6. 若本回合位置发生变化，你必须在末尾添加 [LOC: <node_id>]（node_id必须是地图节点ID）。
7. 若发生地图状态变化，你可以在末尾添加 [MAP_UPDATE: <JSON>]。仅在有变化时填写对应字段，JSON字段说明如下：
   - addAccessTokens: ["token_id"],
   - moveNPCs: [{ "id": "npc_id", "nodeId": "node_id", "alive": true }],
   - objectives: [{ "id": "obj_id", "status": "ACTIVE|COMPLETED|FAILED", "progress": 0-100 }]
  示例：[MAP_UPDATE: {"addAccessTokens": ["key_lvl2"], "moveNPCs": [{"id": "npc_1", "nodeId": "node_xxx"}],"objectives": [{"id": "obj_xxx", "progress": 60}]}]
8. 在末尾添加 [STABILITY: <new_value>]。
9. 若场景视觉发生重大变化，添加 [VISUAL: <prompt>]，如果变化不大则不要添加。
10. 所有System Tags必须在**最末尾**添加。
11. 禁止使用任何工具调用。`;

export const getStartGamePrompt = (role: string, scpDesignation: string, containmentClass: string, language: Language, difficulty: GameDifficulty, legacyData?: LegacyData, mapBlueprint?: MapBlueprint, storyDraft?: StoryDraft) => {
    const langInstruction = language === 'zh' ? '中文' : '英文';
    const legacyIntro = '[已激活遗产继承系统 - 开启新周目]\n当前时间线受到先前迭代周期的因果影响。玩家角色从过去的世界线中继承了以下特质、物品与记忆回响。\n请将这些要素有机融入叙事与角色初始状态：';
    const legacyEnd = '[遗产数据结束]';
    const legacyString = formatLegacyData(legacyData);
    const legacyInjection = legacyString ? `
${legacyIntro}
${legacyString}
${legacyEnd}
` : '';
    const legacySearchInstruction = legacyData ? '(不要搜索遗产相关数据，只搜索本次SCP的资料)' : '';
    // 遍历storyDraft的所有字段，判断是否为空
    const isEmptyStoryDraft = Object.values(storyDraft || {}).every(value => !value);

    const storyDraftInjection = !isEmptyStoryDraft ? `
[补充设定]
角色详细设定: ${storyDraft.roleDetails || 'N/A'}
故事背景: ${storyDraft.storyBackground || 'N/A'}
叙事约束: ${storyDraft.narrativeConstraints || 'N/A'}
初始场景补充设定: ${storyDraft.openingPrompt || 'N/A'}
[补充设定结束]
` : '';
    const mapInjection = mapBlueprint ? `
[地图蓝图]
${JSON.stringify({
    ...mapBlueprint,
    nodes: mapBlueprint.nodes.map(({ layout, ...rest }) => rest)
})}
[地图蓝图结束]
指令：起始遭遇必须发生在startNodeId对应地点；从地图中提取节点位置、信息、任务、NPC等信息，移动仅允许在edges定义的邻接节点之间发生。
` : '';
    return `
游戏设定：
- 玩家角色：${role}
- 目标：${scpDesignation}
- 项目等级：${containmentClass}
- 游戏难度：${difficulty}
- 回合: 1
${storyDraftInjection}
${legacyInjection}
${mapInjection}

现在开始游戏，请使用 Search 工具检索${scpDesignation}的所有关键资料${legacySearchInstruction}，严格按以下格式，用${langInstruction}生成内容：
- **目标**：${scpDesignation}

- **项目等级**：${containmentClass}

- **扰动等级（如有）**：

- **风险等级（如有）**：

- **特殊收容措施**

- **项目描述**

- **角色简介** 
(如果存在继承特质，请将其融入此处)

- "${role}"的初始遭遇场景, 主线任务等, 200-300字, ${langInstruction}。 ${legacyData ? '（如果存在继承物品，请提及角色已持有它们）' : ''}
- 2-3个初始互动选项, 并加上额外选项：“其他（请输入）”。
- [STABILITY: 100]
- [VISUAL: prompt] (可选)

主要搜索源: https://scp-wiki.wikidot.com/, https://scp-wiki-cn.wikidot.com/, google
Hint: 你可以拼接搜索源网址 and SCP目标, 得到目标的档案网页, 例如: https://scp-wiki.wikidot.com/[designation]
`;
};

export const getLegacyGenerationPrompt = (ending: string, role: string, language: Language) => {
    const langPrompt = language === 'zh' ? 'Chinese' : 'English';
    return `
[SYSTEM COMMAND: INITIATE NEW GAME+ LEGACY EXTRACTION AND MEMORY ARCHIVAL]

Task: Analyze the completed timeline (ending: ${ending}, role: ${role}).
1. Extract "Legacy Data" for the next playthrough (New Game+).
Based on the player's actions, achievements, and final state, generate Traits, Items, and a World Echo.
2. Review the entire timeline turn-by-turn and generate "Memory Records" for RAG (Retrieval-Augmented Generation).

Requirements:
1. **Traits**: Generate 0 to 3 character traits (Perks/Curses) that reflect the character's experiences or mutation.
   - effectType: POSITIVE, NEGATIVE, or NEUTRAL.
   - icon: A single relevant Emoji.
2. **Items**: Generate 0 to 3 key items the character might have preserved, carried over, or conceptually inherited.
   - icon: A single relevant Emoji.
3. **World Echo**: Generate EXACTLY ONE "World Echo" - a summary of the conclusion.
   - roleName: The specific character name from THIS run.
4. **Memory Records (RAG)**:
   - Iterate through every significant turn/event in the history.
   - Generate a concise, objective summary of what happened in that specific moment (Scene -> Action -> Consequence).
   - Skip a turn if it had little to no significant change (e.g., repeated action).
   - "keywords": Extract 2-3 key entities or concepts involved.
5. **Language**: All text content must be in ${langPrompt}.

Format: RETURN ONLY RAW JSON. No markdown.
{
  "traits": [
    { "id": "string_id", "name": "string", "description": "string", "effectType": "POSITIVE"|"NEGATIVE"|"NEUTRAL", "icon": "emoji" }
  ],
  "items": [
    { "id": "string_id", "name": "string", "description": "string", "icon": "emoji" }
  ],
  "echo": {
    "id": "string_id", 
    "title": "string", 
    "summary": "string (3-5 sentences, summarizing role, key event, outcome, and fate. Be specific and narrative.)", 
    "endingType": "${ending}",
    "roleName": "string"
  },
  "memoryRecords": [
    {
      "turn": number,
      "summary": "string or null",
      "keywords": ["string", "string"]
    }
  ]
}
`;
};

export const getContextPrompt = (action: string, currentStability: number, turnCount: number, language: Language, ragContext?: string, mapContext?: string) => {
    const langInstruction = language === 'zh' ? '中文' : '英文';
    const ragSection = ragContext ? `
[记忆回响]
以下事件发生在之前的时间线中。角色感觉到一种潜意识的回响或既视感：
${ragContext}
指令：利用这些回响来增加微妙的氛围细节、既视感或直觉警告，并可能影响叙事走向和休谟场稳定性。
[记忆回响结束]
` : '';
    const mapSection = mapContext ? `
[地图状态]
${mapContext}
[地图状态结束]
` : '';
    const normalTurnReminder = turnCount % 5 === 1 ? getNormalTurnRequirements(langInstruction) : '';

    const finalContextPrompt = `
[系统状态]
Current Stability: ${currentStability}%
Turn: ${turnCount}
User Action: "${action}"
Output Language: ${langInstruction}

${ragSection}

${mapSection}

${normalTurnReminder}

请严格按照【常规回合任务】的要求生成回复，并严格根据游戏难度判定结果。请注意你生成的叙事和选项不要包含node_id,npc_id等不可读信息，要面向玩家。`
    console.log("[getContextPrompt] finalContextPrompt", finalContextPrompt);
    return finalContextPrompt;
};

export const getAudioDramaPrompt = (storyLog: string, role: string, scpDesignation: string, language: Language) => {
    const langPrompt = language === 'zh' ? 'Chinese' : 'English';
    return `
[SYSTEM COMMAND: ACT AS A PROFESSIONAL AUDIO DRAMA DIRECTOR AND SCRIPTWRITER.]

Task: Convert the following interactive fiction game log into a structured **Audio Drama Script** JSON object.

Game Context:
- Role: ${role}
- SCP Subject: ${scpDesignation}

Input Log:
${storyLog}

Requirements:
1. **Cast**: Extract all characters. Define their voice characteristics carefully for TTS (Text-to-Speech) matching.
2. **Scenes**: Break the story into logical scenes based on location or time shifts.
3. **Reference**: 
    - For each scene, find the 'originalMessageId' that best represents the start or key moment of that scene.
    - Simply copy the ID (e.g., "msg_123") from the input log.
4. **Dialogue**: 
    - Convert narrator text into dialogue or action cues where possible.
    - Ensure lines are natural.
    - 'speaker' should match one of the names in 'cast' or be "NARRATOR".
5. **Language**: Script content (dialogue, text) must be in **${langPrompt}**.

Output Format: JSON ONLY.
`;
};

export const getGameReviewPrompt = (role: string, ending: string, language: Language) => {
    const langPrompt = language === 'zh' ? 'Chinese' : 'English';
    return `
[SYSTEM COMMAND: CEASE NARRATIVE PROTOCOL. INITIATE AFTER-ACTION REPORT GENERATION.]

Task: Analyze the preceding interaction log (the game session just completed) and generate a structured incident review.

Player Role: ${role}
Ending: ${ending}

Output Language: ${langPrompt}

Requirements:
1. Review the entire conversation history available in this session context.
2. Evaluate the player's (User's) choices, survival strategy, and adherence/subversion of their role.
3. Assign a letter Rank (S/A/B/C/D/F) and numerical Score (0-100) based on their role's objectives.
4. Extract 4-6 specific turning points (User actions) and analyze their impact.
5. Create a psychological profile of the role based on their behavior.
6. Provide strategic advice.
7. **Multi-Perspective Evaluations**: Generate ~3 evaluations from DIFFERENT in-universe entities/factions relevant to the scenario. Their tone and criteria must reflect their specific agenda.
8. **Achievements/Titles**: Generate 1-3 unique and creative titles/achievements earned by the player based on their performance and narrative impact (e.g., "The Butcher of Site-19", "Ethics Committee Favorite"). Provide a brief description for each.
9. Provide a professional, analyst-style breakdown with explicit evidence referencing turns.
10. Provide quantified assessments wherever possible (0-100 or 0-5 scales).
11. Language for all text must be ${langPrompt}.

Format: RETURN ONLY RAW JSON. No markdown blocks.
JSON Structure matches the interface:
{
  "operationName": "string",
  "clearanceLevel": "string",
  "evaluation": { "rank": "string", "score": number, "verdict": "string" },
  "summary": "string",
  "timelineAnalysis": [{ "turn": number, "event": "string", "analysis": "string", "impact": "POSITIVE"|"NEGATIVE"|"NEUTRAL" }],
  "objectiveBreakdown": [
    { "objective": "string", "completion": number, "evidence": "string", "missedOpportunity": "string" }
  ],
  "riskAssessment": {
    "overall": number,
    "volatilityComment": "string",
    "riskByTurn": [
      { "turn": number, "risk": number, "reason": "string", "betterMove": "string" }
    ]
  },
  "tacticsMatrix": [
    { "tactic": "string", "count": number, "effectiveness": "HIGH"|"MEDIUM"|"LOW", "note": "string" }
  ],
  "counterfactuals": [
    { "title": "string", "change": "string", "expectedOutcome": "string", "tradeoff": "string" }
  ],
  "psychProfile": "string",
  "strategicAdvice": "string",
  "perspectiveEvaluations": [
    { "sourceName": "string", "stance": "string", "comment": "string" }
  ],
  "achievements": [
    { "title": "string", "description": "string" }
  ]
}
`;
};

export const getQAPrompt = (question: string, language: Language) => {
    const langPrompt = language === 'zh' ? '中文' : '英文';
    return `
[SYSTEM COMMAND: AS THE NARRATOR/ARCHIVIST, ANSWER THE PLAYER'S META-QUESTION ABOUT THE STORY OR WORLD.]
Question: "${question}"
Output Language: ${langPrompt}
Requirements:
1. Stay in character as the cold, observant AI Narrator.
2. Provide a concise, insightful answer (max 150 words).
3. Base the answer on the events that actually occurred in the session or official SCP lore.
`;
};
