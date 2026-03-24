import { Language } from '../types';

export const SCP_10042_LOF_ARCHIVE = {
  id: "SCP-10042-LOF",
  class: "Keter",

  special_containment_procedures: {
    zh: `SCP-10042-LOF 的所有物理载体（包括服务器、存储介质及运行实例）必须存放于 Site-19 的专用高安全性异常收容室（收容室-10042-α）内。该收容室需配备法拉第笼与单向数据二极管，确保与外部网络完全隔离。任何对 SCP-10042-LOF 的访问必须经由经特殊改装的只读终端进行，且仅限持有 4/10042-LOF 级权限的人员，并至少有两位 3 级研究人员全程监督。

所有与 SCP-10042-LOF 的交互记录（包括视频、音频及系统生成的日志）须在交互结束后 24 小时内提交至 RAISA 进行分析。系统生成的任何导出文档（包括 PDF 格式的“事故报告”）必须经模因危害筛查后方可存档；严禁将此类文档带出指定研究区域。

参与 SCP-10042-LOF 实验的人员（下称“操作员”）必须在实验前接受全面的心理评估，并在实验后接受为期一周的跟踪观察。若出现异常记忆残留、行为改变或声称听到“世界回响”者，应立即启动记忆强化程序并接受长期心理治疗。

任何尝试在未经授权的设备上复制 SCP-10042-LOF 或其衍生版本的行为将被视为收容突破，并由 MTF-Omega-7 (“蛛网猎人”) 负责追踪并清除所有相关副本。`,

    en: `All physical substrates of SCP-10042-LOF (including servers, storage media, and running instances) must be stored within the dedicated high-security anomalous containment chamber at Site-19 (Containment Chamber-10042-Alpha). The chamber must be equipped with Faraday cages and unidirectional data diodes to ensure complete isolation from external networks. Any access to SCP-10042-LOF must occur via specially modified read-only terminals and is restricted to personnel with Level 4/10042-LOF clearance, with at least two Level 3 researchers supervising the entire session.

All interaction records with SCP-10042-LOF (including video, audio, and system-generated logs) must be submitted to RAISA for analysis within 24 hours after the session concludes. Any documents exported by the system (including PDF “Incident Reports”) must undergo memetic hazard screening before archival; such documents are strictly prohibited from leaving designated research areas.

Personnel participating in SCP-10042-LOF experiments (hereafter referred to as “operators”) must undergo comprehensive psychological evaluation prior to testing and a one-week observation period afterward. Individuals exhibiting anomalous memory residues, behavioral changes, or claims of hearing “World Echoes” must immediately undergo memory reinforcement procedures and long-term psychological treatment.

Any attempt to copy SCP-10042-LOF or derivative versions onto unauthorized devices will be considered a containment breach. Mobile Task Force Omega-7 (“Web Hunters”) is authorized to track and eliminate all related copies.`
  },

  description: {
    zh: `SCP-10042-LOF 是一套自称为“命运织机”（Loom of Fate）的交互式软件系统，外观模仿复古终端界面，并带有动态 CRT 扫描线、粒子特效及程序化音频反馈。其异常性质不限于界面本身，而在于其能够基于操作员输入的任意异常编号（如 SCP-███）或相关描述，实时生成一个完整的、可交互的非线性叙事体验（下称“叙事场”）。

在叙事场中，操作员将以第一人称视角参与一系列事件，其行动选择将直接影响叙事走向及最终结局。SCP-10042-LOF 表现出的叙事生成能力远超当前已知的任何自然语言处理模型，其生成的文本、情节及角色行为具有高度连贯性与适应性，且能调用大量基金会内部文档信息（尽管这些信息并未存储于其可见数据库中）。

SCP-10042-LOF 的异常效应不仅限于虚拟叙事。长期或多次接触可能导致操作员出现现实感知偏差、记忆植入（称为“记忆锚定效应”）以及情感固着。此效应可通过其“多周目遗产”机制累积，且可能通过导出的“事故报告”或口头描述在未直接接触 SCP-10042-LOF 的个体间传播，具有潜在模因危害风险。`,

    en: `SCP-10042-LOF is an interactive software system that self-identifies as “Loom of Fate.” Its interface resembles a retro terminal display featuring dynamic CRT scanlines, particle effects, and procedural audio feedback. Its anomalous nature does not lie solely in its interface but in its ability to generate a complete, interactive, nonlinear narrative experience (hereafter referred to as a “Narrative Field”) in real time based on any anomalous designation (e.g., SCP-███) or related description entered by the operator.

Within a Narrative Field, the operator participates in events from a first-person perspective. Their choices directly influence narrative progression and eventual outcomes. The narrative generation capability of SCP-10042-LOF significantly exceeds that of any currently known natural language processing model; the generated text, plots, and character behaviors demonstrate high coherence and adaptability, and can reference extensive internal Foundation documentation (despite such data not existing within its visible database).

The anomalous effects of SCP-10042-LOF are not limited to virtual narrative. Prolonged or repeated exposure may cause deviations in reality perception, implanted memories (referred to as the “Memory Anchoring Effect”), and emotional fixation. This effect can accumulate through its “New Game+ Legacy” mechanism and may spread to individuals who have never directly interacted with SCP-10042-LOF through exported “Incident Reports” or verbal descriptions, representing a potential memetic hazard.`
  },

  features: [
    {
      id: "10042-LOF-1",
      name: { en: "Infinite Narrative Generation", zh: "无限叙事生成" },
      desc: {
        zh: "SCP-10042-LOF 能够基于任意输入的异常标识或自然语言描述生成一个独特的、非重复的叙事场景，包含完整环境、角色、威胁与目标，并呈现出跨文档语义整合与动态情节规划特征。",
        en: "SCP-10042-LOF can generate a unique, non-repeating narrative scenario based on any anomalous identifier or natural language description, including full environments, characters, threats, and objectives, demonstrating cross-document semantic integration and dynamic plot planning."
      }
    },
    {
      id: "10042-LOF-2",
      name: { en: "Multi-Perspective Roleplay", zh: "多视角角色扮演" },
      desc: {
        zh: "操作员可选择不同身份（研究员、D级人员、机动特遣队等），不同身份将在相同初始条件下经历截然不同的叙事分支。",
        en: "Operators may select different identities (Researcher, D-Class personnel, Mobile Task Force member, etc.), each producing entirely different narrative branches under identical starting conditions."
      }
    },
    {
      id: "10042-LOF-3",
      name: { en: "Entity Profile Augmentation", zh: "实体档案增强" },
      desc: {
        zh: "系统会生成角色画像，包含背景、性格与动机，并在叙事过程中持续影响操作员与 NPC 的互动。",
        en: "The system generates a character profile containing background, personality traits, and motivations that influence interactions with NPCs throughout the narrative."
      }
    },
    {
      id: "10042-LOF-4",
      name: { en: "Tactical Preview and Map Topology", zh: "战术预览与地图拓扑" },
      desc: {
        zh: "系统会在叙事开始前展示节点化地图，并允许通过“故事编辑器”对地图结构进行有限修改。",
        en: "Before the narrative begins, the system presents a node-based map that can be partially modified through the built-in “Story Editor.”"
      }
    },
    {
      id: "10042-LOF-5",
      name: { en: "Hume Field Stability Mechanism", zh: "休谟场稳定性机制" },
      desc: {
        zh: "界面持续显示稳定性读数，若读数下降将出现 glitch 效应并最终触发“现实崩溃”。",
        en: "The interface displays a continuous stability reading; decreasing stability produces glitch effects and may ultimately trigger a 'reality collapse' event."
      }
    },
    {
      id: "10042-LOF-6",
      name: { en: "New Game+ Legacy", zh: "多周目遗产" },
      desc: {
        zh: "系统会记录特质、物品与“世界回响”，并允许在新叙事中继承最多五项。",
        en: "The system records traits, items, and 'World Echoes' and allows up to five to be inherited in subsequent narrative sessions."
      }
    },
    {
      id: "10042-LOF-7",
      name: { en: "After Action Review", zh: "深度行动后报告" },
      desc: {
        zh: "叙事结束后自动生成详尽的 AAR，包括评分、心理分析及外部组织评价。",
        en: "Upon narrative completion, SCP-10042-LOF generates a detailed AAR containing ratings, psychological analysis, and simulated evaluations from external organizations."
      }
    },
    {
      id: "10042-LOF-8",
      name: { en: "Free Interrogation", zh: "自由质询环节" },
      desc: {
        zh: "操作员可在有限次数内向系统询问叙事中的隐藏信息或未解之谜。",
        en: "Operators may ask the system a limited number of questions regarding hidden lore or unresolved narrative elements."
      }
    },
    {
      id: "10042-LOF-9",
      name: { en: "Archive Export and Cloud Synchronization", zh: "档案导出与云端存档" },
      desc: {
        zh: "叙事记录可导出为 PDF“事故报告”，并支持云端存档与跨设备恢复。",
        en: "Narrative records can be exported as PDF 'Incident Reports' and stored through cloud synchronization across devices."
      }
    },
    {
      id: "10042-LOF-10",
      name: { en: "Immersive Sensory Feedback", zh: "沉浸式感官反馈" },
      desc: {
        zh: "界面集成 CRT 扫描线、粒子文字与程序化音频，可诱发生理性紧张反应。",
        en: "The interface integrates CRT scanlines, particle text, and procedural audio capable of inducing physiological tension."
      }
    },
    {
      id: "10042-LOF-11",
      name: { en: "Bilingual Support", zh: "双语支持" },
      desc: {
        zh: "系统能够以中文与英文生成叙事，并保持语义一致性。",
        en: "The system can generate narratives in both Chinese and English while maintaining semantic consistency."
      }
    }
  ],

  warning: {
    zh: "SCP-10042-LOF 相关文档可能具有模因危害。阅读后若出现记忆混淆、情绪异常或“世界回响”体验，请立即向 RAISA 报告。",
    en: "Documents related to SCP-10042-LOF may contain memetic hazards. If memory confusion, emotional anomalies, or 'World Echo' experiences occur after reading, immediately report to RAISA."
  }
};

export const BOOT_LOG_LINES = {
  bios: [
    "BIOS CHECK... OK",
    "LOADING KERNEL... OK",
    "MOUNTING VFS... OK",
    "INIT GRAPHICS... OK"
  ],
  connect: [
    "ESTABLISHING SECURE UPLINK...",
    "HANDSHAKE: SITE-19 [ENCRYPTED]",
    "VERIFYING CLEARANCE LEVEL 4...",
    "ACCESS GRANTED"
  ],
  loading: [
    "DECRYPTING ARCHIVE 10042...",
    "LOADING NARRATIVE ENGINE...",
    "SYNCING NEURAL LINK...",
    "READY"
  ]
};
