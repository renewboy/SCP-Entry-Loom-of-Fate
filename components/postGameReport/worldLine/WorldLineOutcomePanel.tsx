import React from 'react';
import type { EndingDisplayConfig } from '../types';

interface WorldLineOutcomePanelProps {
  config: EndingDisplayConfig;
  archivedLabel: string;
}

const WorldLineOutcomePanel: React.FC<WorldLineOutcomePanelProps> = ({ config, archivedLabel }) => {
  return (
    <div className={`${config.bg} ${config.border} border p-4 text-center rounded max-w-md backdrop-blur-sm shadow-lg w-full scp-window`}>
      <h3 className={`font-report text-xl ${config.color} mb-2 uppercase`}>{config.title}</h3>
      <p className="font-mono text-xs text-gray-300">
        {config.text}
        <br />
        {archivedLabel}
      </p>
    </div>
  );
};

export default WorldLineOutcomePanel;
