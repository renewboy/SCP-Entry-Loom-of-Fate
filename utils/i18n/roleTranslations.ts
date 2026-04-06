import type { Language } from './languages/types';

export const ROLE_TRANSLATIONS: Record<string, Record<Language, string>> = {
  '研究员': { zh: '研究员', en: 'Researcher', ja: '研究員' },
  'D级人员': { zh: 'D级人员', en: 'D-Class Personnel', ja: 'Dクラス職員' },
  '机动特遣队(MTF)': { zh: '机动特遣队(MTF)', en: 'Mobile Task Force (MTF)', ja: '機動部隊 (MTF)' },
  '平民': { zh: '平民', en: 'Civilian', ja: '民間人' },
  'SCP项目本身': { zh: 'SCP项目本身', en: 'SCP Object Itself', ja: 'SCPオブジェクトそのもの' },
  '站点主管': { zh: '站点主管', en: 'Site Director', ja: 'サイト管理官' },
  'O5议会成员': { zh: 'O5议会成员', en: 'O5 Council Member', ja: 'O5評議会メンバー' },
  '伦理委员会成员': { zh: '伦理委员会成员', en: 'Ethics Committee Member', ja: '倫理委員会メンバー' },
  '管理员': { zh: '管理员', en: 'The Administrator', ja: '管理者' },
  '安保部人员': { zh: '安保部人员', en: 'Security Personnel', ja: '警備職員' },
  '情报部人员': { zh: '情报部人员', en: 'Intelligence Agent', ja: '情報部エージェント' },
  '医疗部/医务官': { zh: '医疗部/医务官', en: 'Medical Officer', ja: '医療担当官' },
  '工程师/技术员': { zh: '工程师/技术员', en: 'Engineer/Technician', ja: '技術者 / エンジニア' },
  '模因/信息危害研究员': { zh: '模因/信息危害研究员', en: 'Memetics Researcher', ja: 'ミーム / 情報災害研究員' },
  '时间异常特工（时序部）': { zh: '时间异常特工（时序部）', en: 'Temporal Agent', ja: '時間異常エージェント (時序部門)' },
  '内部事务部(IA)调查员': { zh: '内部事务部(IA)调查员', en: 'Internal Affairs Agent', ja: '内部監査部 (IA) 調査官' },
  'GOC（全球超自然联盟）特工': { zh: 'GOC（全球超自然联盟）特工', en: 'GOC Operative', ja: 'GOC 工作員' },
  '蛇之手成员': { zh: '蛇之手成员', en: "Serpent's Hand Member", ja: '蛇の手の構成員' },
  '破碎之神教会信徒': { zh: '破碎之神教会信徒', en: 'Church of the Broken God', ja: '壊れた神の教会信徒' },
  'MC&D成员': { zh: 'MC&D成员', en: 'MC&D Member', ja: 'MC&D メンバー' },
  '安德森机器人技师': { zh: '安德森机器人技师', en: 'Anderson Robotics Tech', ja: 'アンダーソン・ロボティクス技師' },
  '加工厂成员': { zh: '加工厂成员', en: 'The Factory Operative', ja: '工場の工作員' },
  '深红之王教派成员': { zh: '深红之王教派成员', en: 'Scarlet King Cultist', ja: '深紅の王の狂信者' },
  '现实扭曲者': { zh: '现实扭曲者', en: 'Reality Bender', ja: '現実改変者' },
  '异常人类': { zh: '异常人类', en: 'Anomalous Human', ja: '異常人間' },
  '叙事层级实体': { zh: '叙事层级实体', en: 'Narrative Entity', ja: '物語階層実体' },
  '信息危害实体': { zh: '信息危害实体', en: 'Infohazard Entity', ja: '情報災害実体' },
  '异常事件目击者': { zh: '异常事件目击者', en: 'Witness', ja: '異常事案の目撃者' },
  '记者/调查员': { zh: '记者/调查员', en: 'Journalist', ja: '記者 / 調査員' },
  '政府特勤/合作机构': { zh: '政府特勤/合作机构', en: 'Gov Agent', ja: '政府特務 / 協力機関' },
  '私人武装/佣兵': { zh: '私人武装/佣兵', en: 'Mercenary', ja: '私設武装 / 傭兵' },
  '自定义': { zh: '自定义', en: 'Custom', ja: 'カスタム' }
};

export const getRoleTranslation = (role: string, language: Language) => {
  return ROLE_TRANSLATIONS[role]?.[language] || role;
};
