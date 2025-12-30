
import { GoogleGenAI, Chat, Content } from "@google/genai";
import { SCPData, EndingType, Language, Message, GameReviewData } from "../types";
import { geminiConfig } from "../config/geminiConfig";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Helper to get client with current key
const getClient = () => new GoogleGenAI({ apiKey: geminiConfig.apiKey });

// --- Image Generation ---

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "16:9" | "3:4" = "1:1"): Promise<string | null> => {
  console.log(`[GeminiService] Generating image... Prompt: "${prompt.substring(0, 100)}..."`, { aspectRatio });
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: geminiConfig.models.image,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
        }
      }
    });

    console.log("[GeminiService] Image generation response received", response);

    // Check for inline data
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        console.log("[GeminiService] Image data extraction successful.");
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    console.warn("[GeminiService] Response contained no inline image data.", parts);
    return null;
  } catch (error) {
    console.error("[GeminiService] Image generation failed:", error);
    return null;
  }
};

// --- SCP Analysis (Grounding) ---

export const analyzeSCPUrl = async (input: string, language: Language = 'zh'): Promise<SCPData> => {
  try {
    const ai = getClient();
    const langInstruction = language === 'zh' ? 'Chinese' : 'English';
    const prompt = `
User Input: ${input}
Task: Identify the SCP Foundation entry referred to in the input. 
If it's a URL, extract the SCP designation.
Use available search tools to conduct thorough research by:
   - **Primary Source:** https://scp-wiki.wikidot.com/, https://scp-wiki-cn.wikidot.com/ and google
   - **Secondary Sources:** If necessary, consult related SCP wiki or SCP CN pages, discussion logs, or explanation hubs for additional context.

Hint: You can visit the SCP entry site by concatenating scp wiki website and SCP designation, e.g. https://scp-wiki.wikidot.com/[designation]

**Information Extraction:** find the official title, object class, and a summary of its properties.

Also generate two specific visual description strings in English to be inserted into image generation templates:
1. 'visualDescription': A set of visual keywords describing the TEXTURE, ATMOSPHERE, and MATERIAL essence of the SCP for an abstract background. 
   - Format: Comma-separated keywords. No verbs. No full sentences.
   - Context: It will be inserted into "Abstract horror background representing [visualDescription], subtle, texture, scp foundation style, dark moody"
   - Example: "rusted metal surfaces, decaying organic matter, green slime, industrial grunge" or "glowing blue geometric fractals, dark stone, cold fog"

2. 'entityDescription': A detailed visual description of the entity's physical APPEARANCE. 
   - Format: Noun phrases describing the subject. No background context.
   - Context: It will be inserted into "Close up full body shot of [entityDescription]. detailed, photorealistic, containment cell, scp foundation record photo"
   - Example: "a large reptilian creature with exposed bone" or "a concrete statue with krylon brand spray paint on face"

You MUST AND ONLY return a valid JSON object string. Do not use markdown code blocks. DO NOT return any other text.
Structure:
{
  "designation": "e.g., SCP-682",
  "name": "e.g., 不灭孽蜥",
  "containmentClass": "The class in ${langInstruction}",
  "visualDescription": "keywords for background...",
  "entityDescription": "description of entity..."
}

If any of the keys are not found, fill "???".

Output Language for 'visualDescription', 'entityDescription': English.
Preferred Output Language for 'name': ${langInstruction}.`;

    console.log(`[GeminiService] Analyzing SCP: ${input}`);
    const response = await ai.models.generateContent({
      model: geminiConfig.models.chat,
      contents: prompt,
      config: {
        tools: [
          { googleSearch: {} }
        ],
      }
    });

    const text = response.text;
    console.log(`[GeminiService] Analysis result length: ${text?.length}`);
    if (!text) throw new Error("No response from analysis");
    
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as SCPData;

  } catch (e) {
    console.error("Failed to analyze SCP:", e);
    return {
      designation: "???",
      name: "异常实体",
      containmentClass: "未知",
      description: "数据删除。请求的文件已损坏或不存在。",
      visualDescription: "dark abstract glitch horror texture, scp foundation aesthetic",
      entityDescription: "unknown anomaly, redacted silhouette, scp foundation record"
    };
  }
};

// --- Game Logic ---

let chatSession: Chat | null = null;

const getSystemInstruction = (role: string, language: Language) => `
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
- 允许创造性解法：只要符合角色能力和世界观逻辑，允许玩家尝试任何行动。其成功与否取决于逻辑、准备与概率，而非预设的“必败”。

[任务设计原则]
- 主线任务要充分结合角色、SCP项目背景、角色人设等设计，保证任务的多样性。
- 主线任务无需局限于“正面积极”导向，需严格贴合角色立场
- 特别注意：休谟场仅为游戏稳定性判定机制，与主线任务无强关联。

[叙事韧性协议]
你必须在生成的叙事中遵循以下原则：
1. **“逃生舱口”原则**：当稳定性降至危险水平(如<30)时，应在场景中自然地引入一个潜在的逆转要素或紧急逃生途径(如未被注意的备用系统、一个可被利用的SCP次要特性、一次外部干预的征兆等)，逃生舱口也有小概率可能是陷阱。
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
  1. 约250字中文沉浸式叙事，使用第二人称（“你”）。
  2. 提供3个符合逻辑的玩家后续行动选项，并加上第四个选项：“其他（请输入）”，所有选项以数字编号。
  3. System Tags（位于末尾）：
    - [VISUAL: <English Image Prompt>]：（可选）仅当视觉场景发生显著变化时插入。描述格式要求："cinematic, scp foundation style, horror, dark, <scene details>"。
    - [STABILITY: <Integer>]：（必填）当前计算得出的稳定性数值。
    - [ENDING: <Type>]：（条件性）仅当达成游戏结束条件时插入。TYPE只能是 COLLAPSE, CONTAINED, DEATH, ESCAPED 其中之一。
  4. 中文常规回复示例："...你听到门后传来了沉重的呼吸声。[VISUAL: dark metal door, scratching marks, cinematic lighting][STABILITY: 85]"   
  5. 中文结尾示例："...你成功关闭了隔离门，警报声逐渐远去。[VISUAL: steel blast doors closing, sparks][STABILITY: 45][ENDING: CONTAINED]"
5. 在首次生成内容之前，**必须使用 Google Search 工具**检索关于目标的详细资料，包括但不限于wiki, 解密文档等。
6. 格式：使用Markdown。
`;

export const initializeGameChatStream = async function* (scp: SCPData, role: string, language: Language = 'zh') {
  console.log(`[GeminiService] Initializing chat stream for ${scp.designation} as ${role} in ${language}`);
  const ai = getClient();
  const langInstruction = language === 'zh' ? '中文' : '英文';
  const systemInstruction = getSystemInstruction(role, language);

  chatSession = ai.chats.create({
    model: geminiConfig.models.chat,
    config: {
      systemInstruction,
      temperature: geminiConfig.generation.temperature,
      tools: [
        { googleSearch: {} }
      ],
    }
  });

  console.log("[GeminiService] Sending start message...");
  const result = await chatSession.sendMessageStream({ 
    message: `
游戏设定：
- 玩家角色：${role}
- 目标：${scp.designation}
- 项目等级：${scp.containmentClass}
- 回合: 1

现在开始游戏，请使用 Google Search 工具检索该目标的所有关键资料，严格按以下格式，用${langInstruction}生成内容：
- **目标**：${scp.designation}

- **项目等级**：${scp.containmentClass}

- **扰动等级（如有）**：

- **风险等级（如有）**：

- **特殊收容措施**

- **项目描述**

- **角色简介**

- "${role}"的初始遭遇场景, 主线任务等, 200-300字, ${langInstruction}。
- [STABILITY: 100]
- [VISUAL: prompt] (可选)

主要搜索源: https://scp-wiki.wikidot.com/, https://scp-wiki-cn.wikidot.com/, google
Hint: 你可以拼接搜索源网址 and SCP目标, 得到目标的档案网页, 例如: https://scp-wiki.wikidot.com/[designation]
给玩家2-3个初始互动选项, 并加上“其他（请输入）”。` 
  });
  
  for await (const chunk of result) {
    if (chunk.text) {
        yield chunk.text;
    }
  }
};

export const sendAction = async function* (action: string, currentStability: number, turnCount: number, language: Language = 'zh') {
  console.log(`[GeminiService] sendAction called. Input: "${action}", Stability: ${currentStability}, Turn: ${turnCount}, Language: ${language}`);
  
  if (!chatSession) {
    console.error("[GeminiService] CRITICAL: chatSession is null. Game state may have been reset.");
    throw new Error("Game not initialized - session missing");
  }

  const langInstruction = language === 'zh' ? '中文' : '英文';

  const contextPrompt = `
[系统状态]
Current Stability: ${currentStability}%
Turn: ${turnCount}
User Action: "${action}"
Output Language: ${langInstruction}
任务: 
1. 分析用户操作，并生成${langInstruction}叙事回应 (250字以内，必须遵守)。你生成的叙事回应必须逐步倾向某个结局向结局收拢。
2. 如果此时>=15回合，叙事必须逐渐收敛，引导玩家尽快完成任务，并大幅增加每回合稳定性惩罚值，大幅增加稳定性回升难度。
3. 判定是否达成结局 (CONTAINED/DEATH/COLLAPSE/ESCAPED)，如达成必须生成[ENDING: TYPE]。
4. 如果未达成结局，给玩家2-3个互动选项，并加上“其他（请输入）”，选项用数字编号。
5. 如果 Stability <= 0，必须强制生成 [ENDING: COLLAPSE]。
6. 在末尾添加 [STABILITY: <new_value>]。
7. 若场景视觉发生重大变化，添加 [VISUAL: <prompt>]，如果变化不大则不要添加。
8. 严禁使用任何工具调用。`;

  try {
      console.log("[GeminiService] Sending message stream to model...");
      const streamResult = await chatSession.sendMessageStream({ 
        message: contextPrompt,
        config: {
          tools: []
        }
      });
      console.log("[GeminiService] Stream connection established.");

      let chunkCount = 0;
      for await (const chunk of streamResult) {
        chunkCount++;
        // Use chunk.text directly as per SDK property
        const text = chunk.text;
        if (text) {
           yield text;
        }
      }
      console.log(`[GeminiService] Stream finished. Received ${chunkCount} chunks.`);
  } catch (err) {
      console.error("[GeminiService] Error during sendAction stream:", err);
      throw err;
  }
};

export const getChatHistory = async (): Promise<Content[]> => {
    if (!chatSession) return [];
    try {
        const history = await chatSession.getHistory();
        return history;
    } catch (e) {
        console.error("Failed to get chat history", e);
        return [];
    }
};

export const restoreChatSession = async (history: Content[], role: string, language: Language = 'zh') => {
    console.log("[GeminiService] Restoring chat session with history length:", history.length);
    const ai = getClient();
    const systemInstruction = getSystemInstruction(role, language);
    
    chatSession = ai.chats.create({
        model: geminiConfig.models.chat,
        config: {
            systemInstruction,
            temperature: geminiConfig.generation.temperature,
            tools: [
                { googleSearch: {} }
            ],
        },
        history: history
    });
};

export const extractVisualPrompt = (text: string): { cleanText: string, visualPrompt: string | null } => {
  const match = text.match(/\[(VISUAL|VISIBILITY|VISABILITY):(.*?)\]/);
  let cleanText = text;
  let visualPrompt = null;

  if (match) {
    cleanText = cleanText.replace(match[0], '');
    visualPrompt = match[2].trim();
  }
  
  return { cleanText: cleanText.trim(), visualPrompt };
};

export const extractStability = (text: string): { cleanText: string, newStability: number | null } => {
  const match = text.match(/\[STABILITY\s*:\s*(\d+)\]/);
  let cleanText = text;
  let newStability = null;

  if (match) {
    cleanText = cleanText.replace(match[0], '');
    newStability = parseInt(match[1], 10);
  }

  return { cleanText: cleanText.trim(), newStability };
};

export const extractEnding = (text: string): { cleanText: string, endingType: EndingType | null } => {
  const match = text.match(/\[ENDING\s*:\s*(\w+)\]/);
  let cleanText = text;
  let endingType = null;

  if (match) {
    cleanText = cleanText.replace(match[0], '');
    const typeStr = match[1].toUpperCase();
    if (Object.values(EndingType).includes(typeStr as EndingType)) {
      endingType = typeStr as EndingType;
    } else {
      endingType = EndingType.UNKNOWN;
    }
  }

  return { cleanText: cleanText.trim(), endingType };
};

// --- Game Review ---

const extractJsonObject = (text: string) => {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + 1);
};

const safeParseJson = (text: string): any | null => {
  const raw = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const candidates = [raw, extractJsonObject(raw)].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        const cleaned = candidate.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(cleaned);
      } catch {
        continue;
      }
    }
  }
  return null;
};

const normalizeGameReviewData = (value: any): GameReviewData => {
  const fallback: GameReviewData = {
    operationName: 'OPERATION [ERROR]',
    clearanceLevel: 'LEVEL 0',
    evaluation: { rank: 'F', score: 0, verdict: 'PARSING ERROR' },
    summary: 'The analyst failed to compile the report correctly.',
    timelineAnalysis: [],
    psychProfile: 'N/A',
    strategicAdvice: 'Contact IT.',
    perspectiveEvaluations: [],
    achievements: []
  };

  if (!value || typeof value !== 'object') return fallback;

  const { highlights: _highlights, professionalTakeaways: _professionalTakeaways, ...rest } = value;
  const evaluation = value.evaluation && typeof value.evaluation === 'object' ? value.evaluation : {};

  return {
    ...fallback,
    ...rest,
    evaluation: {
      ...fallback.evaluation,
      ...evaluation
    },
    timelineAnalysis: Array.isArray(value.timelineAnalysis) ? value.timelineAnalysis : [],
    objectiveBreakdown: Array.isArray(value.objectiveBreakdown) ? value.objectiveBreakdown : undefined,
    riskAssessment: value.riskAssessment && typeof value.riskAssessment === 'object' ? value.riskAssessment : undefined,
    tacticsMatrix: Array.isArray(value.tacticsMatrix) ? value.tacticsMatrix : undefined,
    counterfactuals: Array.isArray(value.counterfactuals) ? value.counterfactuals : undefined,
    perspectiveEvaluations: Array.isArray(value.perspectiveEvaluations) ? value.perspectiveEvaluations : [],
    achievements: Array.isArray(value.achievements) ? value.achievements : []
  };
};

export const generateGameReview = async (
  scpData: SCPData,
  role: string,
  ending: EndingType,
  language: Language,
  messages: Message[] = [],
  stabilityHistory: number[] = []
): Promise<GameReviewData> => {
  console.log(`[GeminiService] Generating Game Review from active session...`);
  
  if (!chatSession) {
    console.error("Chat session is missing. Cannot generate review.");
    return {
      operationName: "OPERATION [DATA LOST]",
      clearanceLevel: "LEVEL 0",
      evaluation: { rank: "F", score: 0, verdict: "CONNECTION SEVERED" },
      summary: "Unable to retrieve session data. The neural link was broken (page refresh or error).",
      timelineAnalysis: [],
      psychProfile: "N/A",
      strategicAdvice: "Ensure stable connection for future operations.",
      perspectiveEvaluations: [],
      achievements: []
    };
  }
  const ImpactEnum = z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL"]);
  const EffectivenessEnum = z.enum(["HIGH", "MEDIUM", "LOW"]);
  const RankEnum = z.enum(["S", "A", "B", "C", "D", "F"]);
  const EvaluationSchema = z.object({
    rank: RankEnum,
    score: z.number().min(0).max(100),
    verdict: z.string()
  });

  const TimelineAnalysisSchema = z.object({
    turn: z.number().min(0),
    event: z.string(),
    analysis: z.string(),
    impact: ImpactEnum
  });

  const ObjectiveBreakdownSchema = z.object({
    objective: z.string(),
    completion: z.number().min(0).max(100),
    evidence: z.string(),
    missedOpportunity: z.string()
  });

  const RiskByTurnSchema = z.object({
    turn: z.number().min(0),
    risk: z.number().min(0),
    reason: z.string(),
    betterMove: z.string()
  });

  const RiskAssessmentSchema = z.object({
    overall: z.number().min(0),
    volatilityComment: z.string(),
    riskByTurn: z.array(RiskByTurnSchema)
  });

  const TacticsMatrixSchema = z.object({
    tactic: z.string(),
    count: z.number().min(0),
    effectiveness: EffectivenessEnum,
    note: z.string()
  });

  const CounterfactualSchema = z.object({
    title: z.string(),
    change: z.string(),
    expectedOutcome: z.string(),
    tradeoff: z.string()
  });

  const PerspectiveEvaluationSchema = z.object({
    sourceName: z.string(),
    stance: z.string(),
    comment: z.string()
  });

  const AchievementSchema = z.object({
    title: z.string(),
    description: z.string()
  });

  const OperationEvaluationSchema = z.object({
    operationName: z.string(),
    clearanceLevel: z.string(),
    evaluation: EvaluationSchema,
    summary: z.string(),
    timelineAnalysis: z.array(TimelineAnalysisSchema),
    objectiveBreakdown: z.array(ObjectiveBreakdownSchema),
    riskAssessment: RiskAssessmentSchema,
    tacticsMatrix: z.array(TacticsMatrixSchema),
    counterfactuals: z.array(CounterfactualSchema),
    psychProfile: z.string(),
    strategicAdvice: z.string(),
    perspectiveEvaluations: z.array(PerspectiveEvaluationSchema),
    achievements: z.array(AchievementSchema)
  });

  const langPrompt = language === 'zh' ? 'Chinese' : 'English';
  
  // Prompt to switch context from Narrator to Analyst using the existing history
  const prompt = `
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
11. Format: RETURN ONLY RAW JSON. Language for all text must be ${langPrompt}.
`;

  try {
    // Send message to existing history
    const response = await chatSession.sendMessage({ 
      message: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema:  zodToJsonSchema(OperationEvaluationSchema)
      }
    });
    const text = response.text;
    
    if (!text) throw new Error("Empty response for review");

    const parsed = safeParseJson(text);
    if (!parsed) throw new Error('Failed to parse review JSON');
    return normalizeGameReviewData(parsed);
  } catch (error) {
    console.error("Failed to generate review:", error);
    return normalizeGameReviewData(null);
  }
};

// --- Post-Game Q&A ---

export const askNarratorQuestion = async function* (question: string, language: Language): AsyncGenerator<string> {
  if (!chatSession) {
    yield language === 'zh' ? "会话连接已丢失。" : "Session connection lost.";
    return;
  }

  const langPrompt = language === 'zh' ? '中文' : 'English';
  const prompt = `
[SYSTEM COMMAND: AS THE NARRATOR/ARCHIVIST, ANSWER THE PLAYER'S META-QUESTION ABOUT THE STORY OR WORLD.]
Question: "${question}"
Output Language: ${langPrompt}
Requirements:
1. Stay in character as the cold, observant AI Narrator.
2. Provide a concise, insightful answer (max 150 words).
3. Base the answer on the events that actually occurred in the session or official SCP lore.
`;

  try {
    const result = await chatSession.sendMessageStream({ message: prompt });
    for await (const chunk of result) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error("Q&A failed:", error);
    yield language === 'zh' ? "因果同步超时。" : "Causal sync timeout.";
  }
};
