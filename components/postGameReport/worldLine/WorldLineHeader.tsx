import React from 'react';
import { Mic } from 'lucide-react';
import type { SCPData } from '../../../types';

interface WorldLineHeaderProps {
  scpData: SCPData | null;
  navItems: Array<{ key: string; label: string; onClick: () => void }>;
  minimizeLabel: string;
  exportLabel: string;
  closeLabel: string;
  generateVideoScriptLabel: string;
  isAudioDramaEnabled: boolean;
  isGeneratingDrama: boolean;
  onGenerateDrama: () => void;
  onMinimize: () => void;
  onExport: () => void;
  onRestart: () => void;
}

const WorldLineHeader: React.FC<WorldLineHeaderProps> = ({
  scpData,
  navItems,
  minimizeLabel,
  exportLabel,
  closeLabel,
  generateVideoScriptLabel,
  isAudioDramaEnabled,
  isGeneratingDrama,
  onGenerateDrama,
  onMinimize,
  onExport,
  onRestart,
}) => {
  return (
    <header className="rp-bar">
      <div className="rp-id"><i />{scpData?.designation}{scpData?.name ? ` · ${scpData.name}` : ''}</div>
      <nav className="rp-nav">
        {navItems.map(item => <button type="button" key={item.key} onClick={item.onClick}>{item.label}</button>)}
      </nav>
      <div className="rp-tools">
        {isAudioDramaEnabled && (
          <button type="button" onClick={onGenerateDrama} disabled={isGeneratingDrama} title={generateVideoScriptLabel}>
            {isGeneratingDrama ? <span className="rp-spin" /> : <Mic size={14} strokeWidth={1.75} />}
            <span className="rp-tool-label">{generateVideoScriptLabel}</span>
          </button>
        )}
        <button type="button" onClick={onExport}>{exportLabel}</button>
      </div>
      <div className="rp-tools rp-win">
        <button type="button" onClick={onMinimize}>{minimizeLabel}</button>
        <button type="button" className="rp-close" onClick={onRestart}>{closeLabel}</button>
      </div>
    </header>
  );
};

export default WorldLineHeader;
