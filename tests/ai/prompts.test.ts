import { describe, expect, it } from 'vitest';
import { getAnalyzeSCPPrompt, getContextPrompt, getStartGamePrompt, getSystemInstruction } from '../../services/ai/prompts';

describe('ai prompts', () => {
  it('系统指令通过模板输出目标语言', () => {
    const prompt = getSystemInstruction('研究员', 'zh');
    expect(prompt).toContain('语言：中文');
    expect(prompt).toContain('[休谟场稳定性]');
  });

  it('上下文提示支持前后锚点注入', () => {
    const prompt = getContextPrompt(
      '检查主控室',
      82,
      4,
      'zh',
      '曾经有人在这里失踪。',
      '当前位置: 主控室',
      {
        anchorBefore: ['[作者注释] 优先强调监控盲区。'],
        anchorAfter: ['[输出约束] 不要泄露内部ID。']
      }
    );

    expect(prompt).toContain('[前置上下文锚点]');
    expect(prompt).toContain('[作者注释] 优先强调监控盲区。');
    expect(prompt).toContain('[后置上下文锚点]');
    expect(prompt).toContain('[输出约束] 不要泄露内部ID。');
    expect(prompt).toContain('[记忆回响]');
    expect(prompt).toContain('[地图状态]');
  });

  it('分析提示通过模板保留遗产与档案信息', () => {
    const prompt = getAnalyzeSCPPrompt('SCP-173', 'zh', '研究员', 'normal', {
      traits: [{ id: 't1', name: '冷静', description: '面对异常保持镇定', effectType: 'POSITIVE', icon: '🧠' }],
      items: [],
      echoes: [],
      runCount: 1
    });

    expect(prompt).toContain('User Input: SCP-173');
    expect(prompt).toContain('Player Role: 研究员');
    expect(prompt).toContain('Traits:');
    expect(prompt).toContain('冷静');
    expect(prompt).toContain('4) Rewrite role and generate story draft fields');
    expect(prompt).toContain('If the user input role is a generic title like "Civilian", or "Researcher", change it to specific named identity.');
    expect(prompt).toContain('"role": "string in Chinese"');
  });

  it('开局提示通过模板保留地图和补充设定', () => {
    const prompt = getStartGamePrompt(
      '机动特遣队',
      'SCP-173',
      'Euclid',
      'zh',
      'hard',
      undefined,
      {
        id: 'bp_1',
        title: 'site',
        startNodeId: 'node_gate',
        nodes: [{ id: 'node_gate', name: '闸门', danger: 10, discoverables: [], requires: [], blockedText: '', layout: { x: 0, y: 0 } }],
        edges: [],
        npcs: [],
        objectives: []
      },
      {
        roleDetails: '你是先遣侦察员',
        storyBackground: '设施刚刚失联',
        narrativeConstraints: '',
        openingPrompt: ''
      },
      {
        npc_researcher_01: 'Pale senior researcher, silver-rimmed glasses, lab coat, tired eyes',
        npc_guard_01: 'Heavily armored guard, black visor, compact rifle, scarred jaw'
      }
    );

    expect(prompt).toContain('玩家角色：机动特遣队');
    expect(prompt).toContain('[补充设定]');
    expect(prompt).toContain('[地图蓝图]');
    expect(prompt).toContain('[NPC视觉参考]');
    expect(prompt).toContain('npc_researcher_01');
    expect(prompt).toContain('silver-rimmed glasses');
    expect(prompt).toContain('SCP-173');
  });
});
