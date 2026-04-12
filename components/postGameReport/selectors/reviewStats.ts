import type { Message } from '../../../types';
import type { SessionStats } from '../types';

export const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

const average = (values: number[]): number => (values.length ? sum(values) / values.length : 0);

const variance = (values: number[]): number => {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  return average(values.map((value) => (value - mean) ** 2));
};

export const computeSessionStats = (
  messages: Message[] = [],
  stabilityHistory: number[] = [],
): SessionStats => {
  const stability = (stabilityHistory.length > 0 ? stabilityHistory : [100]).map((value) => clamp(value, 0, 100));
  const deltas = stability.length >= 2 ? stability.slice(1).map((value, index) => value - stability[index]) : [];
  const stabilityMin = stability.reduce((minimum, value) => Math.min(minimum, value), stability[0] ?? 100);
  const stabilityMax = stability.reduce((maximum, value) => Math.max(maximum, value), stability[0] ?? 100);
  const stabilityAvg = average(stability);
  const largestDrop = deltas.length ? Math.min(...deltas) : 0;
  const largestRecovery = deltas.length ? Math.max(...deltas) : 0;
  const volatility = Math.sqrt(variance(deltas));

  let stableCount = 0;
  let fluctuatingCount = 0;
  let criticalCount = 0;

  stability.forEach((value) => {
    if (value > 70) {
      stableCount += 1;
    } else if (value > 30) {
      fluctuatingCount += 1;
    } else {
      criticalCount += 1;
    }
  });

  const totalPhaseCount = stableCount + fluctuatingCount + criticalCount;
  const stablePct = totalPhaseCount ? stableCount / totalPhaseCount : 0;
  const fluctuatingPct = totalPhaseCount ? fluctuatingCount / totalPhaseCount : 0;
  const criticalPct = totalPhaseCount ? criticalCount / totalPhaseCount : 0;

  const narratorTurns: Array<{
    userChars: number;
    narratorChars: number;
    hasVisual: boolean;
  }> = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.sender !== 'narrator') {
      continue;
    }

    const previousMessage = messages[index - 1];
    const userText = previousMessage?.sender === 'user' ? previousMessage.content : '';
    narratorTurns.push({
      userChars: userText.length,
      narratorChars: message.content.length,
      hasVisual: Boolean(message.imageUrl),
    });
  }

  const userMessages = messages.filter((message) => message.sender === 'user');
  const narratorMessages = messages.filter((message) => message.sender === 'narrator');
  const userCharsPerTurn = narratorTurns.map((turn) => turn.userChars).filter((_, index) => index !== 0);
  const narratorCharsPerTurn = narratorTurns.map((turn) => turn.narratorChars).filter((_, index) => index !== 0);

  return {
    stability,
    deltas,
    stabilityMin,
    stabilityMax,
    stabilityAvg,
    largestDrop,
    largestRecovery,
    volatility,
    phase: {
      stablePct,
      fluctuatingPct,
      criticalPct,
      stableCount,
      fluctuatingCount,
      criticalCount,
    },
    engagement: {
      turns: Math.max(0, narratorTurns.length - 1),
      userMessages: userMessages.length,
      narratorMessages: narratorMessages.length,
      userTotalChars: sum(userMessages.map((message) => message.content.length)),
      narratorTotalChars: sum(narratorMessages.map((message) => message.content.length)),
      visualsCount: narratorTurns.filter((turn) => turn.hasVisual).length,
      avgUserCharsPerTurn: average(userCharsPerTurn),
      avgNarratorCharsPerTurn: average(narratorCharsPerTurn),
      userCharsPerTurn,
      narratorCharsPerTurn,
    },
  };
};

export const scoreToRank = (score: number): string => {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
};

export const getRankColorClass = (rank: string): string => {
  switch (rank.toUpperCase()) {
    case 'S':
      return 'text-yellow-400';
    case 'A':
      return 'text-scp-term_fix';
    case 'B':
      return 'text-blue-400';
    case 'C':
      return 'text-gray-400';
    case 'D':
      return 'text-orange-500';
    case 'F':
      return 'text-red-600';
    default:
      return 'text-gray-200';
  }
};

export const scoreToHexColor = (score: number): string => {
  switch (scoreToRank(score)) {
    case 'S':
      return '#facc15';
    case 'A':
      return '#33ff00';
    case 'B':
      return '#60a5fa';
    case 'C':
      return '#9ca3af';
    case 'D':
      return '#f97316';
    case 'F':
      return '#dc2626';
    default:
      return '#e5e7eb';
  }
};

export const getImpactColorClass = (impact: string): string => {
  switch (impact) {
    case 'POSITIVE':
      return 'text-scp-term_fix border-scp-term_fix';
    case 'NEGATIVE':
      return 'text-red-500 border-red-500';
    default:
      return 'text-gray-400 border-gray-500';
  }
};
