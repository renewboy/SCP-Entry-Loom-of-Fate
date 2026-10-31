import { describe, expect, it } from 'vitest';
import { dwellFor, parseTurn, restoreChoiceNumber, splitForSubtitle, toCharTokens, visualLength } from '../../utils/beats';

const TURN = `## 第六回合：人员宿舍区（废弃）

"一定。"

这两个字从你嘴里吐出时干脆利落，像签合同一样。你甚至对自己的流畅感到一丝微不可察的厌恶——十二年来你对太多人说过类似的话，有些你兑现了，有些没有。但她不需要知道这些。

[@npc_qin_luoyi: 档案库可以从宿舍区这边走过去，不需要经过指挥中心。但你还差一张Alpha安保卡。萧惟然身上有，他基本不离开指挥中心——那里是他的巢穴。还有一件事，反模因实验室里有台机器一直在运转。]

你将U盘收入内袋，拉好拉链。

[#DOC: title="研究员日记（末页）" style="handwritten"]第██天。他们说这是最后一轮。

如果有人看到这页纸——求你，别进那台机器的房间。[/#DOC]

你合上日记，表情没有变化。

**副线任务已激活：营救被困调查员秦洛仪**

[#PSI]你的视网膜像被冰针刺穿。[/#PSI]

---

1. **前往去污消毒通道方向。** 你需要Alpha安保卡。

2. 尝试从宿舍区侧通道前往幽灵档案库。

[VISUAL: dark corridor][STABILITY: 87][LOC: node_residential_wing]
[MAP_UPDATE: {"updateObjectives": [{"id": "obj_a", "progress": 15}]}]`;

const INTRO = `I'll research SCP-5866.

---

# SCP 档案：命运织机

## 任务简报

- **目标**：SCP-5866

- **项目等级**：Thaumiel

- **特殊收容措施**：
SCP-5866被收容于一处不存在于任何官方记录中的设施内。

GPS信号在三十七分钟前彻底消失。

1. 推开半掩的舱门，进入设施

[STABILITY: 100]`;

describe('parseTurn', () => {
  it('按叙述、对白、文档、系统提示、感官侵入切出节拍', () => {
    const { beats, options } = parseTurn(TURN, { id: 'm1' });
    const kinds = beats.map(b => b.kind);
    expect(kinds[0]).toBe('narr');
    expect(kinds).toContain('npc');
    expect(kinds).toContain('media');
    expect(kinds).toContain('system');
    expect(kinds).toContain('psi');
    expect(beats.find(b => b.kind === 'system')?.text).toBe('副线任务已激活：营救被困调查员秦洛仪');
    expect(beats.find(b => b.kind === 'media')?.media).toMatchObject({ type: 'DOC', attrs: { title: '研究员日记（末页）', style: 'handwritten' } });
    expect(beats.every(b => b.id.startsWith('m1:'))).toBe(true);
    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({ title: '前往去污消毒通道方向。', detail: '你需要Alpha安保卡。' });
    expect(options[1].fill).toBe('尝试从宿舍区侧通道前往幽灵档案库。');
  });

  it('控制标签和标题不会出现在节拍里', () => {
    const text = parseTurn(TURN).beats.map(b => b.text).join('');
    expect(text).not.toMatch(/VISUAL|STABILITY|LOC:|MAP_UPDATE|第六回合/);
  });

  it('长对白拆成多拍，每拍都不超过两行字幕', () => {
    const npc = parseTurn(TURN).beats.filter(b => b.kind === 'npc');
    expect(npc.length).toBeGreaterThan(1);
    npc.forEach(b => {
      expect(b.npcId).toBe('npc_qin_luoyi');
      expect(visualLength(b.text)).toBeLessThanOrEqual(64);
    });
  });

  it('开局把要点列表合成一张简报，开场白单独成拍', () => {
    const { beats, options } = parseTurn(INTRO, { intro: true, id: 'intro' });
    expect(beats[0].kind).toBe('media');
    expect(beats[0].media?.type).toBe('DOSSIER');
    expect(beats[0].media?.items).toHaveLength(3);
    expect(beats[1]).toMatchObject({ kind: 'narr', text: 'GPS信号在三十七分钟前彻底消失。' });
    expect(options).toHaveLength(1);
  });

  it('要点之间只换一行时也按条切开', () => {
    const source = `- **目标**：SCP-7250
- **项目等级**：Keter
- **特殊收容措施**：
全部封存。

GPS信号消失了。`;
    const { beats } = parseTurn(source, { intro: true });
    expect(beats[0].media?.items).toEqual(['**目标**：SCP-7250', '**项目等级**：Keter', '**特殊收容措施**：全部封存。']);
    expect(beats[1].text).toBe('GPS信号消失了。');
  });

  it('普通回合里的要点当作叙述，不是任务简报', () => {
    const { beats } = parseTurn('你看到两样东西：\n\n- 一把钥匙\n- 一张门禁卡\n\n你拿走了钥匙。');
    expect(beats.map(beat => beat.kind)).toEqual(['narr', 'narr', 'narr', 'narr']);
    expect(beats[1].text).toBe('一把钥匙');
  });

  describe('结构化简报', () => {
    const briefing = {
      fields: [{ label: '目标', value: 'SCP-173' }, { label: '项目等级', value: 'Euclid' }],
      sections: [
        { label: '特殊收容措施', value: '锁'.repeat(280) },
        { label: '项目描述', value: '雕'.repeat(340) },
        { label: '角色简介', value: '你是调查员。' },
      ],
    };
    const opening = '---\n\n[VISUAL: a corridor]\n\n你推开门。\n\n1. **继续** 往前走\n\n[STABILITY: 100]';

    it('排在开场前面并分页，字段表只在第一页', () => {
      const { beats, options } = parseTurn(opening, { intro: true, id: 'intro', briefing });
      const pages = beats.filter(beat => beat.kind === 'media');
      expect(pages).toHaveLength(2);
      expect(pages[0].media?.fields).toHaveLength(2);
      expect(pages[0].media?.attrs.page).toBe('1/2');
      expect(pages[1].media?.fields).toEqual([]);
      expect(pages[1].media?.sections?.map(section => section.label)).toEqual(['项目描述', '角色简介']);
      expect(beats[2]).toMatchObject({ kind: 'narr', text: '你推开门。' });
      expect(options).toHaveLength(1);
    });

    it('模型还在检索时简报已经可以读', () => {
      const { beats } = parseTurn("I'll research SCP-173.", { intro: true, id: 'intro', streaming: true, briefing });
      expect(beats).toHaveLength(2);
    });

    it('流式过程中已放出的拍不会变', () => {
      const final = parseTurn(opening, { intro: true, id: 'intro', briefing }).beats;
      for (let cut = 1; cut < opening.length; cut += 2) {
        const partial = parseTurn(opening.slice(0, cut), { intro: true, id: 'intro', streaming: true, briefing }).beats;
        partial.forEach((beat, index) => expect(beat).toEqual(final[index]));
      }
    });

    it('模型把简报又写一遍时不重复显示', () => {
      const { beats } = parseTurn('---\n\n- **目标**：SCP-173\n\n你推开门。', { intro: true, briefing });
      expect(beats.filter(beat => beat.kind === 'media')).toHaveLength(2);
      expect(beats.map(beat => beat.text).join('')).not.toContain('**目标**');
    });

    it('过长的段落按句子断到下一页，后续页不重复小标题', () => {
      const long = { fields: [], sections: [{ label: '项目描述', value: '这是一句很长的描述内容。'.repeat(60) }] };
      const pages = parseTurn('', { intro: true, briefing: long }).beats;
      expect(pages.length).toBeGreaterThan(1);
      expect(pages[0].media?.sections?.[0].label).toBe('项目描述');
      expect(pages[1].media?.sections?.[0].label).toBe('');
    });
  });

  it('长简报按页拆成多拍，回看里仍是完整的一份', () => {
    const long = '长'.repeat(300);
    const source = `---\n\n- **甲**：${long}\n\n- **乙**：${long}\n\n- **丙**：短\n\n正文。`;
    const { beats, blocks } = parseTurn(source, { intro: true });
    const pages = beats.filter(beat => beat.media?.type === 'DOSSIER');
    expect(pages).toHaveLength(2);
    expect(pages[0].media?.attrs.page).toBe('1/2');
    expect(pages[1].media?.items).toHaveLength(2);
    const log = blocks.find(block => block.kind === 'media');
    expect(log?.kind === 'media' && log.media.items).toHaveLength(3);
  });

  it('未闭合的介质标签在定稿时不会把标记显示给玩家', () => {
    const { beats } = parseTurn('你看到一张纸。\n\n[#DOC: title="残页"]只剩半句');
    expect(beats.map(b => b.text).join('')).not.toContain('[#DOC');
  });

  it('流式时已放出的节拍不会因为后续文本而改变', () => {
    for (const [source, intro] of [[TURN, false], [INTRO, true]] as const) {
      const final = parseTurn(source, { intro, id: 'x' }).beats;
      let previous = 0;
      for (let cut = 1; cut < source.length; cut += 3) {
        const partial = parseTurn(source.slice(0, cut), { intro, id: 'x', streaming: true }).beats;
        expect(partial.length).toBeGreaterThanOrEqual(previous);
        partial.forEach((beat, index) => expect(beat).toEqual(final[index]));
        previous = partial.length;
      }
    }
  });

  it('流式时不会露出写到一半的标签', () => {
    const cuts = ['你推开门。\n\n[@npc_a: 别', '你推开门。\n\n[#DOC: title="x"]第一段\n\n第二', '你推开门。\n\n[STABI', '你推开门。\n\n[MAP_UPDATE: {"a": ['];
    cuts.forEach(text => {
      const { beats } = parseTurn(text, { streaming: true });
      expect(beats.map(b => b.text)).toEqual(['你推开门。']);
    });
  });

  it('开局在分隔线出现前不放出任何内容', () => {
    expect(parseTurn("I'll research SCP-5866.\n\nLet me search", { intro: true, streaming: true }).beats).toEqual([]);
  });
});

describe('splitForSubtitle', () => {
  it('英文按句切开并保留完整单词', () => {
    const text = 'You push the door open. The corridor beyond it is dark and smells of formaldehyde, and something is breathing at the far end of it. You raise your flashlight and take one careful step forward into the dark.';
    const parts = splitForSubtitle(text, 62, 'en');
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(text);
  });

  it('没有句号的长句按逗号切', () => {
    const text = '你沿着走廊一直向前走，经过第一扇门，经过第二扇门，经过一排废弃的储物柜，经过墙上那些已经褪色的警示标语，经过一盏还在闪烁的应急灯，最后停在一扇没有把手的门前';
    const parts = splitForSubtitle(text);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join('')).toBe(text);
    parts.forEach(part => expect(visualLength(part)).toBeLessThanOrEqual(62));
  });
});

describe('辅助函数', () => {
  it('粗体标记转换成逐字片段', () => {
    expect(toCharTokens('a**b**c')).toEqual([{ ch: 'a', bold: false }, { ch: 'b', bold: true }, { ch: 'c', bold: false }]);
  });

  it('停留时长随长度增加且有上下限', () => {
    expect(dwellFor({ kind: 'narr', text: '短' })).toBe(1600);
    expect(dwellFor({ kind: 'narr', text: '长'.repeat(400) })).toBe(6500);
    expect(dwellFor({ kind: 'narr', text: '长'.repeat(400) }, true)).toBe(140);
  });
});

describe('restoreChoiceNumber', () => {
  it('turns an option number into the option it stands for', () => {
    expect(restoreChoiceNumber(' 2 ', TURN)).toBe('尝试从宿舍区侧通道前往幽灵档案库。');
  });

  it('keeps anything that is not a known option', () => {
    expect(restoreChoiceNumber('打开门', TURN)).toBe('打开门');
    expect(restoreChoiceNumber('9', TURN)).toBe('9');
    expect(restoreChoiceNumber('1', undefined)).toBe('1');
  });
});
