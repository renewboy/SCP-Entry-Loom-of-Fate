import React from 'react';
import { Mic } from 'lucide-react';
import type { SCPData } from '../../../types';
import GameButton from '../../common/GameButton';

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
        {navItems.map(item => <GameButton variant="quiet" size="sm" key={item.key} onClick={item.onClick}>{item.label}</GameButton>)}
      </nav>
      <div className="rp-tools">
        {isAudioDramaEnabled && (
          <GameButton variant="quiet" size="sm" loading={isGeneratingDrama} onClick={onGenerateDrama} title={generateVideoScriptLabel}>
            <Mic size={14} strokeWidth={1.75} />
            <span className="rp-tool-label">{generateVideoScriptLabel}</span>
          </GameButton>
        )}
        <GameButton variant="quiet" size="sm" onClick={onExport}>{exportLabel}</GameButton>
      </div>
      <div className="rp-tools rp-win">
        <GameButton variant="quiet" size="sm" onClick={onMinimize}>{minimizeLabel}</GameButton>
        <GameButton size="sm" onClick={onRestart}>{closeLabel}</GameButton>
      </div>
    </header>
  );
};

export default WorldLineHeader;
