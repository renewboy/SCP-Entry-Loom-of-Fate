
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { SCPData, EndingType, Language } from "../types";

// Helper to get client with current key
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Image Generation ---

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "16:9" | "3:4" = "1:1"): Promise<string | null> => {
  console.log(`[GeminiService] Generating image... Prompt: "${prompt.substring(0, 100)}..."`, { aspectRatio });
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
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
   - **Primary Source:** https://scp-wiki-cn.wikidot.com/, https://scp-wiki.wikidot.com/ and google
   - **Secondary Sources:** If necessary, consult related SCP wiki or SCP CN pages, discussion logs, or explanation hubs for additional context.

Hint: You can visit the SCP entry site by concatenating scp wiki website and SCP designation, e.g. https://scp-wiki-cn.wikidot.com/[designation]

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

If any of the keys are not found, fill "N/A".

Output Language for 'visualDescription', 'entityDescription': English.
Output Language for 'name': ${langInstruction}.`;

    console.log(`[GeminiService] Analyzing SCP: ${input}`);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
      designation: "未知SCP",
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

export const initializeGameChatStream = async function* (scp: SCPData, role: string, language: Language = 'zh') {
  console.log(`[GeminiService] Initializing chat stream for ${scp.designation} as ${role} in ${language}`);
  const ai = getClient();
  const langInstruction = language === 'zh' ? '中文' : '英文';
  
  const systemInstruction = `
你是一个基于SCP基金会宇宙的文本冒险游戏的主持人（AI Administrator）。
玩家在冒险游戏中扮演一个任意的角色，可以是研究员、D级人员，O5议会成员，或任何其他角色，甚至SCP本身。
你需要根据当前场景信息生成一个独一无二的关于这篇SCP档案的文本冒险故事游戏，并设置一个明确的主线任务，冒险故事围绕这个任务展开。

当前场景：
SCP项目：${scp.designation} (${scp.name})
项目等级：${scp.containmentClass}
玩家角色：${role}

你需要维护一个名为“休谟场稳定性（Stability）”的数值（0-100）。游戏开始时为 100。

[核心机制：结局判定]
你需要根据剧情发展逻辑判断结局。
有以下几种结局类型：
1. **CONTAINED (收容成功/任务完成)**: 玩家成功完成了角色的核心任务。
2. **DEATH (人员死亡/行动失败)**: 玩家角色死亡，或关键任务失败导致无法挽回，但世界未毁灭。
3. **ESCAPED (逃离/失踪)**: 玩家（通常是D级或平民）成功逃离设施，但异常可能仍在活跃。
4. **COLLAPSE (现实崩溃)**: 只有当 Stability<=0 时触发，世界线彻底毁灭。

[休谟场稳定性 (Stability)]
- **总体趋势**：自然熵增。如果没有特殊行动，每回合默认 -2 到 -5。
- **玩家失误**：鲁莽、接触异常、受伤、精神崩溃的行动，应扣除 -10 到 -20。
- **玩家挽回**：如果玩家利用逻辑、科学方法、特殊权限或道具暂时稳定了局势，可以 +5 到 +15（上限不超过 100）。
- **收束性**：随着回合增加，回复稳定性的难度应越来越大。低于 30% 后，很难再大幅回升。

[休谟场稳定性阶段定义]
1. **稳定期 (100% - 70%)**：展示场景、氛围、冲突源，引导玩家行动。
2. **波动期 (69% - 30%)**：冲突加深，叙事收束。环境出现异常，物理法则轻微扭曲。
3. **临界期 (< 30%)**：强制收束。所有变量向某种终局趋势移动，停止世界扩张，逐渐强化主要冲突或主题。
4. **世界崩坏 (0%)**：世界线收束。

[输出格式规范]
1. 语言：${langInstruction}。
2. 视角：第二人称。
3. 风格：慢热的恐怖感，冷静客观的科学记录风格与直观的危险感相结合。
4. **重要输出格式**：
  - 在每条回复的【末尾】，*必须**包含 [STABILITY: <0-100的整数>] 标签，示例[STABILITY: 85]
  - 图片生成（非必须）：如果场景发生重大变化或出现新的实体/物体，请在回复的【末尾】添加一个标签，格式如下：[VISUAL: <用英文描述画面内容, cinematic, scp foundation style>]。不要在文本中描述图片生成指令，只保留标签。
  - 完整中文回复示例："...你听到门后传来了沉重的呼吸声。[VISUAL: dark metal door, scratching marks, cinematic lighting][STABILITY: 85]"   
  - 如果触发结局，必须包含：[ENDING: <TYPE>] (TYPE只能是 COLLAPSE, CONTAINED, DEATH, ESCAPED 其中之一)。
  - 中文结尾示例：
  "...你成功关闭了隔离门，警报声逐渐远去。[VISUAL: steel blast doors closing, sparks][STABILITY: 45][ENDING: CONTAINED]"
5. 在首次生成内容之前，**必须使用 Google Search 工具**检索关于 ${scp.designation} 的详细Wiki档案。
6. 格式：使用Markdown。`;

  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction,
      temperature: 0.8,
      tools: [{ googleSearch: {} }],
    }
  });

  console.log("[GeminiService] Sending start message...");
  const result = await chatSession.sendMessageStream({ 
    message: `
目标：${scp.designation}
项目等级：${scp.containmentClass}
现在开始游戏，请使用 Google Search 工具检索该项目的所有关键资料，并生成"${role}"的初始遭遇场景，所处环境应与该SCP相关（例如：收容单元、观察室、或者如果是平民则是在外面的世界），200-300字左右。
初始 Stability 为 100。
主要搜索源：https://scp-wiki.wikidot.com/，https://scp-wiki-cn.wikidot.com/。
Hint: 你可以拼接搜索源网址和SCP目标，得到目标的档案网页, 例如: https://scp-wiki.wikidot.com/[designation]
给玩家2-3个初始互动选项，但也允许自由文本输入。` 
  });
  
  for await (const chunk of result) {
    if (chunk.text) {
        yield chunk.text;
    }
  }
};

export const sendAction = async function* (action: string, currentStability: number, language: Language = 'zh') {
  console.log(`[GeminiService] sendAction called. Input: "${action}", Stability: ${currentStability}, Language: ${language}`);
  
  if (!chatSession) {
    console.error("[GeminiService] CRITICAL: chatSession is null. Game state may have been reset.");
    throw new Error("Game not initialized - session missing");
  }

  const langInstruction = language === 'zh' ? '中文' : '英文';

  const contextPrompt = `
[系统状态]
Current Stability: ${currentStability}%
User Action: "${action}"

任务: 
1. 分析用户操作，并生成${langInstruction}叙事回应 (300字以内，必须遵守)。你生成的叙事回应必须逐步倾向某个结局，不能过于发散，不能止步不前。
2. 判定是否达成结局 (CONTAINED/DEATH/COLLAPSE/ESCAPED)，如达成必须生成[ENDING: TYPE]。
3. 如果未达成结局，给玩家2-3个互动选项，但也允许自由文本输入。
4. 如果 Stability <= 0，必须强制生成 [ENDING: COLLAPSE]。
5. 在末尾添加 [STABILITY: <new_value>]。
6. 若场景视觉发生重大变化，添加 [VISUAL: <prompt>]，如果变化不大则不要添加。

Tags needed at end: [STABILITY: number] and optional [ENDING: TYPE] or [VISUAL: prompt].`;

  try {
      console.log("[GeminiService] Sending message stream to model...");
      const streamResult = await chatSession.sendMessageStream({ message: contextPrompt });
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

export const extractVisualPrompt = (text: string): { cleanText: string, visualPrompt: string | null } => {
  const match = text.match(/\[VISUAL:(.*?)\]/);
  let cleanText = text;
  let visualPrompt = null;

  if (match) {
    cleanText = cleanText.replace(match[0], '');
    visualPrompt = match[1].trim();
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
