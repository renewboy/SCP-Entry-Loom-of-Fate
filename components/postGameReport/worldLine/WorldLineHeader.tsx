import React from 'react';
import { Mic } from 'lucide-react';
import type { SCPData } from '../../../types';

interface WorldLineHeaderProps {
  scpData: SCPData | null;
  title: string;
  projectLabel: string;
  finalReportLabel: string;
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
  title,
  projectLabel,
  finalReportLabel,
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
    <div className="sticky top-0 z-20 bg-scp-dark/80 border-b border-scp-gray p-4 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 backdrop-blur-md shadow-lg shrink-0 scp-window-header">
      <div>
        <h2 className="font-report text-xl md:text-2xl text-scp-term text-shadow-green">{title}</h2>
        <p className="font-mono text-[10px] text-gray-500">
          {projectLabel}: {scpData?.designation} // {finalReportLabel}
        </p>
      </div>
      <div className="flex w-full sm:w-auto justify-between sm:justify-end gap-2 md:gap-3">
        {isAudioDramaEnabled && (
          <button
            onClick={onGenerateDrama}
            disabled={isGeneratingDrama}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 border border-scp-gray text-scp-term font-mono text-xs hover:border-scp-term hover:bg-scp-term/10 transition-colors shadow-lg"
            title="GENERATE AUDIO DRAMA"
          >
            {isGeneratingDrama ? (
              <span className="w-3 h-3 border-2 border-scp-term border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <Mic className="w-4 h-4" />
            )}
            <span className="hidden lg:inline">{generateVideoScriptLabel}</span>
          </button>
        )}
        <button
          onClick={onMinimize}
          className="px-2 sm:px-3 py-1 sm:py-1.5 border border-scp-gray text-scp-text font-mono text-[11px] sm:text-xs hover:border-scp-term hover:text-scp-term transition-colors shadow-lg min-h-[36px]"
          title="MINIMIZE"
        >
          {minimizeLabel}
        </button>
        <button
          onClick={onExport}
          className="px-2 sm:px-3 py-1 sm:py-1.5 border border-scp-gray text-scp-text font-mono text-[11px] sm:text-xs hover:border-scp-term hover:text-scp-term transition-colors shadow-lg min-h-[36px]"
        >
          {exportLabel}
        </button>
        <button
          onClick={onRestart}
          className="px-3 sm:px-4 py-1 sm:py-1.5 bg-scp-text text-black font-mono text-[11px] sm:text-xs hover:bg-white transition-colors shadow-lg font-bold min-h-[36px]"
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
};

export default WorldLineHeader;
