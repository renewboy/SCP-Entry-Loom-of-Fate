
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Language } from '../types';

export const translations = {
  zh: {
    meta: {
      title: "SCP 档案：命运织机",
    },
    app: {
      switch_lang: "EN",
      appendix: "附录 A",
      footer: "控制. 收容. 保护. // 终端_ID: 8829-AZ"
    },
    start: {
      loading_msgs: [
        "正在接入命运织机主干协议…",
        "命运纺线器启动中，请稍候…",
        "正在同步因果线程…",
        "正在加载织机节点：档案谓词解析中…",
        "命运织机核心编织模块初始化…"
      ],
      scp_archive: "SCP 档案",
      fate_loom: "命运织机",
      error_prefix: "[错误]: ",
      error_conn: "连接基金会数据库失败。请验证您的API密钥权限或SCP编号是否正确。",
      error_api: "API密钥验证失败。请重试。",
      label_url: "SCP数据库链接或编号",
      placeholder_url: "例如: SCP-173, SCP-682, 或Wiki链接...",
      label_role: "分配人员角色",
      label_custom: "定义你的实体/角色...",
      placeholder_custom: "定义你的实体/角色...",
      btn_start: "纺织命运 (INITIATE WEAVE)",
      loading_access: "正在访问SCP数据库...",
      loading_retrieved: "已检索档案: {designation}. 正在解密...",
      role_custom_opt: "> 自定义..."
    },
    game: {
      settings: "设置",
      stability_label: "Hume Field Stability",
      stability: "稳定性",
      stable: "稳定 (STABLE)",
      fluctuating: "波动 (FLUCTUATING)",
      critical: "极度危险 (CRITICAL)",
      archive_access: "档案访问",
      role: "角色",
      class: "项目等级",
      turn: "回合",
      view_report: "查看报告",
      terminate: "终止编织",
      alert_integrity: "[警报] 现实帷幕结构完整性严重受损。织机检测到不可逆的因果纠缠。建议立即启动紧急阻断程序。",
      action_log: "_ 行动日志",
      visual_log: "视觉记录",
      generating: "正在生成叙事...",
      input_placeholder: "你打算怎么做？",
      input_placeholder_ended: "连接已中断...",
      btn_execute: "执行",
      ending_reached: "结局达成",
      expand: "展开详情",
      minimize_br: "[ _ 最小化 ]",
      auto_archiving: "正在自动归档至世界线图谱...",
      cancel_en: "取消 (CANCEL)",
      enter_now: "立即进入 (ENTER NOW)",
      archiving_aborted: "⚠ 自动归档已中止。请手动操作。",
      access_logs: "访问世界线图谱",
      review_logs: "回顾行动日志",
      other_instruct: "其他（请输入）",
      err_offline: "⚠️ [纺锤脱机] 命运织机同步中断。当前因果线程无响应，请尝试重连或强制剪断链接。",
      err_timeout: "⚠️ [连接超时] 响应时间过长。已自动恢复输入，请重试。"
    },
    endings: {
      contained: { title: "CONTAINMENT RESTORED", subtitle: "收容措施已重建 // 任务完成" },
      death: { title: "PERSONNEL LOST", subtitle: "生命体征停止 // 任务失败" },
      escaped: { title: "SUBJECT ESCAPED", subtitle: "人员下落不明 // 离开封锁区" },
      collapse: { title: "REALITY FAILURE", subtitle: "因果律完整性归零 // 终端连接断开" },
      unknown: { title: "UNKNOWN OUTCOME", subtitle: "数据丢失 // 状态不明" }
    },
    modal: {
      title: "确认终止",
      message: "检测到强制脱出请求。该操作将导致当前编织的“世界线图谱”完全崩解，所有未观测的因果数据将永久丢失。确认终止连接并执行记忆消除？",
      cancel: "取消 (CANCEL)",
      confirm: "确认执行 (EXECUTE)",
      warning: "WARNING: MEMETIC HAZARD"
    },
    report: {
      title: "世界线因果图谱",
      project: "PROJECT",
      final_report: "FINAL_REPORT",
      minimize: "_ 最小化",
      export: "导出档案 (PDF)",
      close: "关闭",
      item: "ITEM #",
      name: "NAME",
      class: "CLASS",
      date: "DATE",
      node_id: "NODE_ID",
      attachment: "ATTACHMENT",
      confidential: "CONFIDENTIALITY LEVEL 4 // DO NOT DISTRIBUTE",
      scp_motto: "SECURE. CONTAIN. PROTECT.",
      header_title: "SCP FOUNDATION // INCIDENT REPORT",
      outcome_titles: {
        CONTAINED: "收容重建",
        DEATH: "人员阵亡",
        ESCAPED: "收容失效 / 人员逃离",
        COLLAPSE: "现实崩溃",
        UNKNOWN: "未知结局"
      },
      outcome_texts: {
        CONTAINED: "已恢复标准收容协议。事故报告已提交。",
        DEATH: "已检测到生命体征停止。正在启动清洁程序。",
        ESCAPED: "目标已离开监控区域。MTF已出动。",
        COLLAPSE: "因果律完整性归零。时间线已锁定。",
        UNKNOWN: "数据错误。"
      },
      archived: "该迭代已被归档。",
      generate_review: "生成深度复盘",
      generating_review: "正在分析数据...",
      review_title: "行动后报告 (AAR)",
      dept_analytics: "分析部门 // DEPT. OF ANALYTICS",
      perf_eval: "综合表现评估",
      score: "评分",
      rank: "等级",
      verdict: "最终裁定",
      summary: "行动摘要",
      key_moments: "关键转折点分析",
      psych_profile: "人员心理侧写",
      strat_advice: "战略建议与备注",
      perspectives: "外部关注组织评价",
      turn: "回合",
      impact_pos: "正面",
      impact_neg: "负面",
      impact_neu: "中立",
      stability_chart: "休谟场稳定性趋势",
      achievements: "获得称号 / 成就",
      qa_title: "自由质询环节",
      qa_placeholder: "提问关于本次游戏的细节...",
      qa_btn: "提交质询",
      qa_loading: "正在同步因果解释...",
      qa_remaining: "剩余质询次数",
      qa_finished: "质询环节已关闭",
    },
    save_load: {
      save: "保存游戏",
      load: "读取游戏",
      save_success: "游戏保存成功",
      save_error: "保存失败",
      load_error: "读取失败",
      delete_error: "删除失败",
      no_saves: "暂无存档",
      save_title: "存档列表",
      create_new: "新建存档",
      delete: "删除",
      load_btn: "读取",
      overwrite: "覆盖",
      loading: "加载中...",
      confirm_overwrite: "确认覆盖当前进度？",
      confirm_delete: "确认删除该存档？此操作不可逆。",
      turn: "回合"
    }
  },
  en: {
    meta: {
      title: "SCP Entry: Loom of Fate",
    },
    app: {
      switch_lang: "中文",
      appendix: "Appendix A",
      footer: "SECURE. CONTAIN. PROTECT. // TERMINAL_ID: 8829-AZ"
    },
    start: {
      loading_msgs: [
        "Connecting to Loom of Fate Backbone Protocol...",
        "Initializing Fate Spindle, please wait...",
        "Synchronizing Causal Threads...",
        "Loading Loom Nodes: Parsing Entry Predicates...",
        "Loom of Fate Core Weave Module Initializing..."
      ],
      scp_archive: "SCP Entry",
      fate_loom: "Loom of Fate",
      error_prefix: "[ERROR]: ",
      error_conn: "Failed to connect to Foundation Database. Verify API Key permissions or SCP designation.",
      error_api: "API Key verification failed. Please try again.",
      label_url: "SCP Database Link or Designation",
      placeholder_url: "e.g., SCP-173, SCP-682, or Wiki Link...",
      label_role: "Assign Personnel Role",
      label_custom: "Define your Entity/Role...",
      placeholder_custom: "Define your Entity/Role...",
      btn_start: "INITIATE WEAVE",
      loading_access: "Accessing SCP Database...",
      loading_retrieved: "ENTRY Retrieved: {designation}. Decrypting...",
      role_custom_opt: "> Custom..."
    },
    game: {
      settings: "Settings",
      stability_label: "Hume Field Stability",
      stability: "Stability",
      stable: "STABLE",
      fluctuating: "FLUCTUATING",
      critical: "CRITICAL",
      archive_access: "ENTRY ACCESS",
      role: "Role",
      class: "Class",
      turn: "Turn",
      view_report: "VIEW REPORT",
      terminate: "TERMINATE",
      alert_integrity: "[ALERT] Reality Veil structural integrity compromised. Irreversible causal entanglement detected. Emergency severing recommended.",
      action_log: "_ ACTION LOG",
      visual_log: "VISUAL RECORD",
      generating: "Generating Narrative...",
      input_placeholder: "What is your course of action?",
      input_placeholder_ended: "Connection Severed...",
      btn_execute: "EXECUTE",
      ending_reached: "ENDING REACHED",
      expand: "EXPAND DETAILS",
      minimize_br: "[ _ MINIMIZE ]",
      auto_archiving: "Auto-archiving to World Line Graph...",
      cancel_en: "CANCEL",
      enter_now: "ENTER NOW",
      archiving_aborted: "⚠ Auto-archiving aborted. Manual action required.",
      access_logs: "ACCESS WORLD LINE GRAPH",
      review_logs: "REVIEW LOGS",
      other_instruct: "Other (Please specify)",
      err_offline: "⚠️ [SPINDLE OFFLINE] Loom of Fate sync interrupted. Causal thread unresponsive. Reconnect or sever link.",
      err_timeout: "⚠️ [CONNECTION TIMEOUT] Response took too long. Input restored. Please retry."
    },
    endings: {
      contained: { title: "CONTAINMENT RESTORED", subtitle: "Procedures Restored // Mission Accomplished" },
      death: { title: "PERSONNEL LOST", subtitle: "Vital Signs Ceased // Mission Failed" },
      escaped: { title: "SUBJECT ESCAPED", subtitle: "Subject MIA // Left Containment Zone" },
      collapse: { title: "REALITY FAILURE", subtitle: "Causal Integrity Zero // Terminal Disconnected" },
      unknown: { title: "UNKNOWN OUTCOME", subtitle: "Data Lost // Status Unknown" }
    },
    modal: {
      title: "CONFIRM TERMINATION",
      message: "Forced extraction request detected. This action will cause the current 'World Line Graph' to dissolve completely. All unobserved causal data will be permanently lost. Confirm termination and execute amnestic protocol?",
      cancel: "CANCEL",
      confirm: "EXECUTE",
      warning: "WARNING: MEMETIC HAZARD"
    },
    report: {
      title: "WORLD LINE CAUSAL GRAPH",
      project: "PROJECT",
      final_report: "FINAL_REPORT",
      minimize: "_ MINIMIZE",
      export: "EXPORT ENTRY (PDF)",
      close: "CLOSE",
      item: "ITEM #",
      name: "NAME",
      class: "CLASS",
      date: "DATE",
      node_id: "NODE_ID",
      attachment: "ATTACHMENT",
      confidential: "CONFIDENTIALITY LEVEL 4 // DO NOT DISTRIBUTE",
      scp_motto: "SECURE. CONTAIN. PROTECT.",
      header_title: "SCP FOUNDATION // INCIDENT REPORT",
      outcome_titles: {
        CONTAINED: "CONTAINMENT RESTORED",
        DEATH: "PERSONNEL LOST",
        ESCAPED: "CONTAINMENT BREACH / ESCAPED",
        COLLAPSE: "REALITY FAILURE",
        UNKNOWN: "UNKNOWN OUTCOME"
      },
      outcome_texts: {
        CONTAINED: "Standard containment procedures restored. Incident report submitted.",
        DEATH: "Vital signs cessation detected. Cleaning protocol initiated.",
        ESCAPED: "Target has left surveillance area. MTF deployed.",
        COLLAPSE: "Causal integrity zero. Timeline locked.",
        UNKNOWN: "Data Error."
      },
      archived: "This iteration has been archived.",
      generate_review: "GENERATE AAR",
      generating_review: "ANALYZING DATA...",
      review_title: "AFTER ACTION REPORT (AAR)",
      dept_analytics: "DEPT. OF ANALYTICS",
      perf_eval: "PERFORMANCE EVALUATION",
      score: "SCORE",
      rank: "RANK",
      verdict: "FINAL VERDICT",
      summary: "EXECUTIVE SUMMARY",
      key_moments: "KEY TURNING POINTS",
      psych_profile: "PSYCHOLOGICAL PROFILE",
      strat_advice: "STRATEGIC NOTES",
      perspectives: "EXTERNAL GOI/ENTITY EVALUATIONS",
      turn: "TURN",
      impact_pos: "POSITIVE",
      impact_neg: "NEGATIVE",
      impact_neu: "NEUTRAL",
      stability_chart: "Hume Field Stability Trend",
      achievements: "TITLES / ACHIEVEMENTS",
      qa_title: "FREE Q&A SESSION",
      qa_placeholder: "Ask about game details...",
      qa_btn: "SUBMIT",
      qa_loading: "SYNCING CAUSAL EXPLANATION...",
      qa_remaining: "REMAINING QUESTIONS",
      qa_finished: "Q&A SESSION CLOSED",
    },
    save_load: {
      save: "Save Game",
      load: "Load Game",
      save_success: "Game Saved Successfully",
      save_error: "Save Failed",
      load_error: "Load Failed",
      delete_error: "Delete Failed",
      no_saves: "No Saves Found",
      save_title: "Save Files",
      create_new: "Create New Save",
      delete: "Delete",
      load_btn: "Load",
      overwrite: "Overwrite",
      loading: "Loading...",
      confirm_overwrite: "Overwrite current progress?",
      confirm_delete: "Delete this save? This action is irreversible.",
      turn: "Turn"
    }
  }
};

export const ROLE_TRANSLATIONS: Record<string, string> = {
  '研究员': 'Researcher',
  'D级人员': 'D-Class Personnel',
  '机动特遣队(MTF)': 'Mobile Task Force (MTF)',
  '平民': 'Civilian',
  'SCP项目本身': 'SCP Object Itself',
  '站点主管': 'Site Director',
  'O5议会成员': 'O5 Council Member',
  '伦理委员会成员': 'Ethics Committee Member',
  '管理员（The Administrator）': 'The Administrator',
  '安保部人员': 'Security Personnel',
  '情报部人员': 'Intelligence Agent',
  '医疗部/医务官': 'Medical Officer',
  '工程师/技术员': 'Engineer/Technician',
  '模因/信息haz研究员': 'Memetics Researcher',
  '时间异常特工（时序部）': 'Temporal Agent',
  '内部事务部(IA)调查员': 'Internal Affairs Agent',
  'GOC（全球超自然联盟）特工': 'GOC Operative',
  '蛇之手成员': 'Serpent\'s Hand Member',
  '破碎之神教会信徒': 'Church of the Broken God',
  'MC&D成员': 'MC&D Member',
  '安德森机器人技师': 'Anderson Robotics Tech',
  '加工厂成员': 'The Factory Operative',
  '深红之王教派成员': 'Scarlet King Cultist',
  '现实扭曲者': 'Reality Bender',
  '异常人类': 'Anomalous Human',
  '叙事层级实体': 'Narrative Entity',
  '信息危害实体': 'Infohazard Entity',
  '异常事件目击者': 'Witness',
  '记者/调查员': 'Journalist',
  '政府特勤/合作机构': 'Gov Agent',
  '私人武装/佣兵': 'Mercenary',
  '自定义': 'Custom'
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (path: string, params?: Record<string, string | number>) => {
    const keys = path.split('.');
    let value: any = translations[language];
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key as keyof typeof value];
      } else {
        return path;
      }
    }

    if (typeof value === 'string' && params) {
      return value.replace(/{(\w+)}/g, (_, k) => params[k] !== undefined ? String(params[k]) : `{${k}}`);
    }

    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
