import React from 'react';
import type { NarrativeQuality } from '../../../../types';
import { clamp, getRankColorClass, scoreToHexColor, scoreToRank } from '../../selectors/reviewStats';

interface NarrativeQualitySectionProps {
  narrativeQuality: NarrativeQuality;
  title: string;
  overallLabel: string;
  commentLabel: string;
  dimensionLabels: Array<{ key: keyof Omit<NarrativeQuality, 'comment'>; label: string }>;
}

const NarrativeQualitySection: React.FC<NarrativeQualitySectionProps> = ({
  narrativeQuality,
  title,
  overallLabel,
  commentLabel,
  dimensionLabels,
}) => {
  const scores = dimensionLabels.map((dimension) => narrativeQuality[dimension.key] as number);
  const overall = Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);
  const size = 200;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 75;
  const angleStep = (2 * Math.PI) / dimensionLabels.length;
  const startAngle = -Math.PI / 2;

  const getPoint = (index: number, value: number) => {
    const angle = startAngle + index * angleStep;
    const radialDistance = (value / 100) * radius;
    return {
      x: centerX + radialDistance * Math.cos(angle),
      y: centerY + radialDistance * Math.sin(angle),
    };
  };

  const radarPoints = dimensionLabels.map((dimension, index) => getPoint(index, narrativeQuality[dimension.key] as number));
  const radarPath = radarPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ') + ' Z';
  const gridLevels = [25, 50, 75, 100];

  return (
    <div className="relative z-10 mb-8 border border-scp-gray/30 bg-black/40 p-4 scp-archive">
      <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-1 h-4 bg-scp-term_fix block"></span>
        {title}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col items-center justify-center">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px] h-auto">
            {gridLevels.map((level) => {
              const points = dimensionLabels.map((_, index) => getPoint(index, level));
              const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ') + ' Z';
              return (
                <path
                  key={`grid-${level}`}
                  d={path}
                  fill="none"
                  stroke="#333"
                  strokeWidth="0.5"
                  strokeDasharray={level < 100 ? '2' : '0'}
                />
              );
            })}
            {dimensionLabels.map((_, index) => {
              const point = getPoint(index, 100);
              return <line key={`axis-${index}`} x1={centerX} y1={centerY} x2={point.x} y2={point.y} stroke="#444" strokeWidth="0.5" />;
            })}
            <path d={radarPath} fill="rgba(51, 255, 0, 0.12)" stroke="#33ff00" strokeWidth="1.5" strokeLinejoin="round" />
            {radarPoints.map((point, index) => (
              <circle
                key={`point-${index}`}
                cx={point.x}
                cy={point.y}
                r="3"
                fill={scoreToHexColor(narrativeQuality[dimensionLabels[index].key] as number)}
                stroke="#000"
                strokeWidth="0.5"
              />
            ))}
            {dimensionLabels.map((dimension, index) => {
              const point = getPoint(index, 125);
              const anchor = point.x < centerX - 5 ? 'end' : point.x > centerX + 5 ? 'start' : 'middle';
              return (
                <text
                  key={`label-${index}`}
                  x={point.x}
                  y={point.y}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fill="#888"
                  fontSize="7"
                  fontFamily="monospace"
                >
                  {dimension.label}
                </text>
              );
            })}
          </svg>
          <div className="mt-2 text-center">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">{overallLabel}</span>
            <div className={`text-4xl font-report font-bold ${getRankColorClass(scoreToRank(overall))} text-shadow-sm`}>{overall}</div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-3">
          {dimensionLabels.map((dimension, index) => {
            const value = clamp(narrativeQuality[dimension.key] as number, 0, 100);
            return (
              <div key={index} className="border border-scp-gray/20 bg-black/30 p-2 scp-archive">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] text-gray-300 font-mono uppercase">{dimension.label}</span>
                  <span className={`text-[10px] font-bold font-mono ${getRankColorClass(scoreToRank(value))}`}>{value}</span>
                </div>
                <div className="w-full h-2 border border-scp-gray/30 bg-black overflow-hidden">
                  <div
                    style={{ width: `${value}%`, backgroundColor: scoreToHexColor(value) }}
                    className="h-full transition-all duration-500"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {narrativeQuality.comment && (
        <div className="mt-4 border-t border-scp-gray/20 pt-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{commentLabel}</div>
          <p className="text-xs text-gray-300 italic leading-relaxed p-3 bg-black/20 border-l-2 border-scp-term_fix">
            "{narrativeQuality.comment}"
          </p>
        </div>
      )}
    </div>
  );
};

export default NarrativeQualitySection;
