import React from 'react';

type SettingsRangeProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

const SettingsRange: React.FC<SettingsRangeProps> = ({ label, value, onChange, min = 0, max = 1, step = 0.05, unit = '%' }) => {
  const displayValue = unit === '%' ? `${Math.round(value * 100)}${unit}` : `${value}${unit}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-400 font-mono uppercase tracking-wider">
        <span>{label}</span>
        <span>{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="scp-range w-full focus-visible:outline-none"
      />
    </div>
  );
};

export default SettingsRange;
