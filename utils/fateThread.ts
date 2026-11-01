import { NetworkPoint } from './siteNetwork';

/** The same irregular wobble as the world line thread in the post-game report */
export const threadNoise = (position: number, phase = 0) =>
  Math.sin(position * 0.035 + phase) * 0.55
  + Math.sin(position * 0.083 + 1.7 + phase * 1.3) * 0.3
  + Math.sin(position * 0.21 + 0.4 + phase * 0.7) * 0.15;

const num = (value: number) => value.toFixed(1);

/** A vertical thread through a list of points, quiet right at each point so it meets its pin */
export const threadTrailPath = (points: NetworkPoint[], shake = 3.2) => {
  if (points.length < 2) return '';
  const parts: string[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const direction = Math.sign(b.y - a.y) || 1;
    for (let y = a.y; direction > 0 ? y < b.y : y > b.y; y += direction * 4) {
      const share = (y - a.y) / (b.y - a.y || 1);
      const fade = Math.min(1, Math.abs(y - a.y) / 10, Math.abs(y - b.y) / 10);
      parts.push(`${parts.length ? 'L' : 'M'} ${num(a.x + (b.x - a.x) * share + threadNoise(y) * shake * fade)} ${num(y)}`);
    }
  }
  const last = points[points.length - 1];
  parts.push(`${parts.length ? 'L' : 'M'} ${num(last.x)} ${num(last.y)}`);
  return parts.join(' ');
};

export const threadCurve = (a: NetworkPoint, b: NetworkPoint) => {
  const handle = Math.abs(b.x - a.x) * 0.5;
  return `C ${num(a.x + handle)} ${num(a.y)}, ${num(b.x - handle)} ${num(b.y)}, ${num(b.x)} ${num(b.y)}`;
};

/** Source to the row's left pin, straight behind the row, then on to the core */
export const threadThroughRow = (source: NetworkPoint, left: NetworkPoint, right: NetworkPoint, core: NetworkPoint) =>
  `M ${num(source.x)} ${num(source.y)} ${threadCurve(source, left)} L ${num(right.x)} ${num(right.y)} ${threadCurve(right, core)}`;

/** The short dotted loose end on a row that was not picked, leaning toward the source */
export const threadStubPath = (left: NetworkPoint, sourceY: number, reach = 42) => {
  const lean = sourceY > left.y ? 1 : -1;
  return `M ${num(left.x)} ${num(left.y)} C ${num(left.x - 14)} ${num(left.y)}, ${num(left.x - reach + 10)} ${num(left.y + lean * 8)}, ${num(left.x - reach)} ${num(left.y + lean * 12)}`;
};
