# SCP Entry: Loom of Fate 架构设计文档

## 1. 项目概述
SCP Entry: Loom of Fate 是一个基于 SCP 基金会世界观的生成式文本冒险游戏。其核心体验是：玩家输入 SCP 编号与角色，系统通过 AI 生成非线性叙事与可交互选项，并以“休谟场稳定性”作为全局压力量表驱动剧情与视听反馈。项目定位与特性定义见 [README.md](README.md)。

---

## 2. 系统上下文（System Context）
- 玩家（浏览器端）与 UI：React SPA，终端风格界面为主。入口与全局状态切换见 [GameScreen.tsx](components/GameScreen.tsx) 与 [StartScreen.tsx](components/StartScreen.tsx)。  
- AI 叙事引擎：Prompt 规则与标签协议集中在 [prompts.ts](services/ai/prompts.ts)（含地图机制、结局判定、输出标签等）。  
- 存储层：本地 IndexedDB 与云端 Supabase 的存档协作由 [SaveLoadModal.tsx](components/SaveLoadModal.tsx) 触发。  
- 音视频系统：稳定性触发的视效由 [StabilityMonitor.tsx](components/game/StabilityMonitor.tsx) 与 [VisualEffects.tsx](components/game/VisualEffects.tsx) 协作驱动；BGM/SFX 静态资源位于 [public/bgm](public/bgm) 与 [public/sfx](public/sfx)。  
- 主题系统：全局主题色、字体、Tailwind 扩展、CSS 变量由 [index.html](index.html) 定义，并在运行中动态改写。

---

## 3. 运行时主流程（End-to-End）
### 3.1 开局流
- 玩家在 [StartScreen.tsx](components/StartScreen.tsx) 输入 SCP 与角色，调用分析服务生成 SCPData（含地图蓝图）。  
- 使用流式叙事在首个 chunk 到达时立即切换到 PLAYING，初始化地图/NPC/目标/库存/首条叙事消息。  
- 根据设置异步生成背景图与实体图，并为开局叙事生成视觉图（如存在 VISUAL tag）。

### 3.2 回合流
- 玩家输入由 [GameScreen.tsx](components/GameScreen.tsx) 发起 `sendAction` 流式请求。  
- AI 返回文本流，前端持续拼接、实时渲染。结束后解析标签：
  - [STABILITY]：更新稳定性  
  - [ENDING]：触发游戏结束流程  
  - [LOC] / [MAP_UPDATE]：更新地图与 NPC/任务状态  
  - [VISUAL]：触发场景插图生成  
- 稳定性驱动视觉与音频异常，详见 [StabilityMonitor.tsx](components/game/StabilityMonitor.tsx) 与 [VisualEffects.tsx](components/game/VisualEffects.tsx)。

### 3.3 结局流与回顾
- 结局判定后进入 Game Over，打开 World Line Tree 界面。  
- [WorldLineTree.tsx](components/WorldLineTree.tsx) 负责生成事后报告、问答回响、PDF 导出、New Game+ 遗产选择。  
- 评估报告与统计视图在 [GameReviewReport.tsx](components/GameReviewReport.tsx)。

---

## 4. 模块分层与职责

### 4.1 UI/交互层
- **开局界面**：角色选择、输入、随机 SCP、设置与读档入口。[StartScreen.tsx](components/StartScreen.tsx)  
- **游戏主屏**：回合循环、消息流、稳定性、图像生成控制、存档入口。[GameScreen.tsx](components/GameScreen.tsx)  
- **世界线树**：回合回放、AAR、Q&A、导出与 New Game+。[WorldLineTree.tsx](components/WorldLineTree.tsx)  
- **地图面板**：图结构布局与邻接判断、门禁与目标状态提示。[MapPanel.tsx](components/game/MapPanel.tsx)  
- **侧栏容器**：左右滑出式固定面板布局。[SidePanel.tsx](components/common/SidePanel.tsx)

### 4.2 AI/规则层
- **Prompt 与协议**：输出格式、稳定性规则、结局判定、地图机制统一定义。[prompts.ts](services/ai/prompts.ts)

### 4.3 视觉与音效层
- **稳定性驱动的视觉干扰**：闪烁、干扰、记忆回响、色彩错位。[VisualEffects.tsx](components/game/VisualEffects.tsx)  
- **稳定性监控组件**：波形、相位与临界音效触发。[StabilityMonitor.tsx](components/game/StabilityMonitor.tsx)

### 4.4 存储与同步层
- **本地/云存档交互**：本地 IndexedDB + 云存档（含登录/合并/冲突处理）。[SaveLoadModal.tsx](components/SaveLoadModal.tsx)

### 4.5 i18n 层
- 轻量语言 Provider + 持久化 + 角色名翻译入口。[provider.tsx](utils/i18n/provider.tsx) [persistence.ts](utils/i18n/persistence.ts) [i18n/index.ts](utils/i18n/index.ts)

### 4.6 主题与样式层
- Tailwind 扩展、色板与 CSS 变量：统一为 SCP 视觉风格提供基色与特效。  
  入口：[index.html](index.html)

---

## 5. 关键数据模型（概念）
- **GameState**（全局）：包含状态机（IDLE/PLAYING/GAME_OVER）、messages、stability、map、npcs、objectives、inventory、legacy 等。核心编排见 [GameScreen.tsx](components/GameScreen.tsx)。  
- **SCPData**：由开局分析产生，包含 `designation/name/containmentClass` 与 `mapBlueprint` 等。由 [StartScreen.tsx](components/StartScreen.tsx) 使用。  
- **MapBlueprint + Runtime Map**：蓝图为静态节点/边/门禁与任务配置；运行态记录当前节点与已发现集合。[MapPanel.tsx](components/game/MapPanel.tsx)  
- **消息流**：narrator/user 交替，narrator 带 stabilitySnapshot 与可选 imageUrl。[GameScreen.tsx](components/GameScreen.tsx)

---

## 6. 核心业务机制

### 6.1 休谟场稳定性（Hume Stability）
- 定义、阶段与系统标签规则由 [prompts.ts](services/ai/prompts.ts) 约束。  
- UI 侧将稳定性映射为主题色与视觉干扰强度：[GameScreen.tsx](components/GameScreen.tsx) [StabilityMonitor.tsx](components/game/StabilityMonitor.tsx) [VisualEffects.tsx](components/game/VisualEffects.tsx)

### 6.2 地图与任务系统
- AI 生成地图蓝图（nodes/edges/npcs/objectives）由 Prompt 规则约束。[prompts.ts](services/ai/prompts.ts)  
- 运行态的门禁、邻接、NPC 分布与任务进度渲染在 [MapPanel.tsx](components/game/MapPanel.tsx)

### 6.3 事后报告与导出
- 回合统计、稳定性曲线、AAR 结构渲染见 [GameReviewReport.tsx](components/GameReviewReport.tsx)。  
- PDF 导出与世界线回溯编排见 [WorldLineTree.tsx](components/WorldLineTree.tsx)。

---

## 7. 存档与同步策略
- 本地与云存档由 [SaveLoadModal.tsx](components/SaveLoadModal.tsx) 统一入口，支持：
  - 本地读写  
  - 云端登录/同步  
  - 时间戳冲突处理  
  - IndexedDB 缓存云列表  
- i18n 语言偏好持久化为设置项，详见 [persistence.ts](utils/i18n/persistence.ts)。

---

## 8. 主题系统与音频资产
- **主题**：全局色板、字体与动画由 [index.html](index.html) 定义，运行时根据稳定性动态更新 accent 变量（由 GameScreen 注入到 CSS 变量）。  
- **音频**：BGM 与 SFX 资源位于 [public/bgm](public/bgm) 与 [public/sfx](public/sfx)，并由稳定性监控与反馈系统触发播放节奏（UI 侧见 [StabilityMonitor.tsx](components/game/StabilityMonitor.tsx))。

---

## 9. 国际化（i18n）
- 轻量 Context + 字典树查找 + 参数插值；语言在 IndexedDB 中持久化。  
- 入口与实现：[i18n/index.ts](utils/i18n/index.ts) [provider.tsx](utils/i18n/provider.tsx) [persistence.ts](utils/i18n/persistence.ts)

---

## 10. 扩展点与风险
- **Prompt 规则扩展**：新增结局、标签或地图规则时优先在 [prompts.ts](services/ai/prompts.ts) 进行一致性调整。  
- **模块替换**：AI Provider、云存档后端可替换，但需保持输出协议与标签解析一致。  
- **性能与体验**：流式消息 + 图片生成并行，需注意带宽与延迟；低稳定性视觉特效需关注弱性能设备。  
- **安全与合规**：API Key 使用环境变量与用户输入模式；存档与用户身份依赖云端认证策略。

---

## 11. 结论
该项目架构以“AI 叙事协议 + 前端状态编排 + 稳定性驱动的多模态反馈”为主轴。通过 Start → Game → Review 的链路串联核心玩法，并以地图、稳定性、存档、国际化作为可扩展支点，实现 SCP 风格的高沉浸文本冒险体验。