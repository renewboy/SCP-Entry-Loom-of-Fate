import React, { useState } from 'react';
import { useElementSize } from '../shared/useElementSize';

export interface ChartPoint {
  value: number;
  /** Shown in the hover tooltip */
  label: string;
  note?: string;
}

const TIP_WIDTH = 170;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

const ChartTip: React.FC<{ point: ChartPoint; x: number; width: number }> = ({ point, x, width }) => (
  <div className="chart-tip" style={{ left: clamp(x + 10, 0, Math.max(0, width - TIP_WIDTH)) }}>
    <b>{point.label}</b> {point.value}
    {point.note && <><br />{point.note}</>}
  </div>
);

export const StabilityLineChart: React.FC<{ points: ChartPoint[]; ariaLabel: string }> = ({ points, ariaLabel }) => {
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);
  const pad = { left: 30, right: 8, top: 10, bottom: 20 };
  const xOf = (index: number) => pad.left + (width - pad.left - pad.right) * (index / Math.max(1, points.length - 1));
  const yOf = (value: number) => pad.top + (height - pad.top - pad.bottom) * (1 - value / 100);
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${xOf(index).toFixed(1)} ${yOf(point.value).toFixed(1)}`).join(' ');
  const active = hovered === null ? null : points[hovered];

  return (
    <div
      className="chart"
      ref={ref}
      onPointerMove={event => {
        const box = event.currentTarget.getBoundingClientRect();
        const share = (event.clientX - box.left - pad.left) / Math.max(1, width - pad.left - pad.right);
        setHovered(clamp(Math.round(share * (points.length - 1)), 0, points.length - 1));
      }}
      onPointerLeave={() => setHovered(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
          {[100, 70, 30, 0].map(value => (
            <React.Fragment key={value}>
              <line className="grid" x1={pad.left} x2={width - pad.right} y1={yOf(value)} y2={yOf(value)} />
              <text className="axis" x={pad.left - 8} y={yOf(value) + 3.5} textAnchor="end">{value}</text>
            </React.Fragment>
          ))}
          <path className="area" d={`${line} L ${xOf(points.length - 1)} ${yOf(0)} L ${xOf(0)} ${yOf(0)} Z`} />
          <path className="line" d={line} />
          {hovered !== null && active && (
            <>
              <line className="cross" x1={xOf(hovered)} x2={xOf(hovered)} y1={pad.top} y2={yOf(0)} />
              <circle className="dot" cx={xOf(hovered)} cy={yOf(active.value)} r={4} />
            </>
          )}
        </svg>
      )}
      {hovered !== null && active && <ChartTip point={active} x={xOf(hovered)} width={width} />}
    </div>
  );
};

export const ValueBarChart: React.FC<{ points: ChartPoint[]; diverging?: boolean; ariaLabel: string }> = ({ points, diverging = false, ariaLabel }) => {
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);
  const pad = { left: 30, right: 6, top: 8, bottom: 8 };
  const peak = Math.max(1, ...points.map(point => Math.abs(point.value)));
  const low = diverging ? Math.min(0, ...points.map(point => point.value), -1) : 0;
  const high = diverging ? Math.max(0, ...points.map(point => point.value)) : peak;
  const yOf = (value: number) => pad.top + (height - pad.top - pad.bottom) * ((high - value) / Math.max(1, high - low));
  const step = (width - pad.left - pad.right) / Math.max(1, points.length);
  const barWidth = clamp(step - 2, 3, 18);
  const edge = diverging && Math.abs(low) >= high ? low : high;
  const active = hovered === null ? null : points[hovered];

  return (
    <div className="chart short" ref={ref} onPointerLeave={() => setHovered(null)}>
      {width > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
          <line className="grid" x1={pad.left} x2={width - pad.right} y1={yOf(0)} y2={yOf(0)} />
          <text className="axis" x={pad.left - 8} y={yOf(0) + 3.5} textAnchor="end">0</text>
          <text className="axis" x={pad.left - 8} y={yOf(edge) + (edge < 0 ? 0 : 7)} textAnchor="end">{edge}</text>
          {points.map((point, index) => {
            const zero = yOf(0);
            const end = yOf(point.value);
            return (
              <React.Fragment key={index}>
                <rect className={`bar ${point.value < 0 ? 'neg' : 'pos'}`} x={pad.left + step * index + (step - barWidth) / 2} y={Math.min(zero, end)} width={barWidth} height={Math.max(1, Math.abs(end - zero))} />
                <rect className="bar-hit" x={pad.left + step * index} y={0} width={step} height={height} onPointerEnter={() => setHovered(index)} />
              </React.Fragment>
            );
          })}
        </svg>
      )}
      {hovered !== null && active && <ChartTip point={active} x={pad.left + step * hovered} width={width} />}
    </div>
  );
};
