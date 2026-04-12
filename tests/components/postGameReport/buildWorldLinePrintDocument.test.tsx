import { describe, expect, it } from 'vitest';
import { buildWorldLinePrintDocument } from '../../../components/postGameReport/export/buildWorldLinePrintDocument';

const translations: Record<string, string> = {
  'i18n.locale': 'en-US',
  'report.header_title': 'Incident Report',
  'report.item': 'Item',
  'report.name': 'Name',
  'report.class': 'Class',
  'report.date': 'Date',
  'report.attachment': 'Attachment',
  'report.node_id': 'Node',
  'report.scp_motto': 'Secure. Contain. Protect.',
  'report.confidential': 'Confidential',
  'report.review_title': 'Review',
  'report.qa_title': 'Q&A',
  'report.dept_analytics': 'Analytics',
  'report.perf_eval': 'Performance',
  'report.score': 'Score',
  'report.summary': 'Summary',
  'report.narrative_quality': 'Narrative Craft Assessment',
  'report.nq_overall': 'Overall',
  'report.nq_comment': 'Comment',
  'report.nq_world_consistency': 'World',
  'report.nq_imagery': 'Imagery',
  'report.nq_npc_depth': 'NPC',
  'report.nq_pacing': 'Pacing',
  'report.nq_interactivity': 'Interactivity',
  'report.nq_equivalent_exchange': 'Exchange',
  'report.key_moments': 'Key Moments',
  'report.turn': 'Turn',
  'report.impact_pos': 'Positive',
  'report.impact_neg': 'Negative',
  'report.impact_neu': 'Neutral',
  'report.psych_profile': 'Psych',
  'report.strat_advice': 'Strategy',
  'game.narrative_media.psi_pressure_label': 'Psi Pressure',
};

const t = (key: string) => translations[key] || key;

describe('buildWorldLinePrintDocument', () => {
  it('拼接时间线、Review 和 QA 区块到最终 HTML', () => {
    const html = buildWorldLinePrintDocument({
      t,
      backgroundImage: null,
      scpData: {
        designation: 'SCP-173',
        name: 'The Sculpture',
        containmentClass: 'Euclid',
        role: 'Researcher',
      },
      timelineEvents: [
        {
          id: 'n1',
          trigger: 'INITIAL CONTAINMENT',
          response: 'The lights fail. [STABILITY: 44]',
          stability: 44,
        },
      ],
      printableNpcs: [],
      qaHistory: [
        { question: 'What happened?', answer: 'Reality folded inward.', timestamp: 1 },
      ],
      gameReview: {
        operationName: 'Operation Lattice',
        clearanceLevel: 'Level 3',
        evaluation: {
          rank: 'A',
          score: 88,
          verdict: 'Contained',
        },
        summary: 'Summary body',
        timelineAnalysis: [
          {
            turn: 3,
            event: 'Anchor deployed',
            analysis: 'Stabilized the corridor.',
            impact: 'POSITIVE',
          },
          {
            turn: 4,
            event: 'Door breach',
            analysis: 'Escalated local risk.',
            impact: 'NEGATIVE',
          },
        ],
        narrativeQuality: {
          worldConsistency: 82,
          imagery: 77,
          npcDepth: 73,
          pacing: 80,
          interactivity: 75,
          equivalentExchange: 79,
          comment: 'Tense and coherent.',
        },
        psychProfile: 'Calm under pressure.',
        strategicAdvice: 'Keep anchors ready.',
        perspectiveEvaluations: [],
        achievements: [],
      },
      stabilityHistory: [100, 44],
      messages: [],
    });

    expect(html).toContain('Incident Report');
    expect(html).toContain('SCP-173');
    expect(html).toContain('INITIAL CONTAINMENT');
    expect(html).toContain('Operation Lattice');
    expect(html).toContain('Narrative Craft Assessment');
    expect(html).toContain('Positive');
    expect(html).toContain('Negative');
    expect(html).toContain('.game-review-report .text-scp-term_fix');
    expect(html).toContain('.game-review-report .text-red-500');
    expect(html).toContain('What happened?');
    expect(html).toContain('Reality folded inward.');
    expect(html).not.toContain('[STABILITY: 44]');
  });
});
