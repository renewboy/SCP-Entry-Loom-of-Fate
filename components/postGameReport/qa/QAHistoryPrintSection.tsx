import React from 'react';
import type { QAPair } from '../../../types';

interface QAHistoryPrintSectionProps {
  qaHistory: QAPair[];
  title: string;
}

const QAHistoryPrintSection: React.FC<QAHistoryPrintSectionProps> = ({ qaHistory, title }) => {
  if (!qaHistory.length) {
    return null;
  }

  return (
    <div className="relative pl-10 break-inside-avoid mt-10">
      <div className="absolute left-[9px] top-4 w-2.5 h-2.5 rounded-full bg-purple-500 border-2 border-scp-dark z-10"></div>
      <div className="mb-2">
        <span className="inline-block bg-scp-dark border border-purple-500/50 text-purple-500 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm">
          &gt; {title}
        </span>
      </div>

      <div className="game-review-report w-full border border-scp-gray/30 bg-black/40 p-6 font-mono text-gray-300 relative">
        <h3 className="text-sm text-scp-text font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-purple-500 block"></span>
          {title}
        </h3>
        <div className="space-y-4">
          {qaHistory.map((qa, index) => (
            <div
              key={`${qa.timestamp}-${index}`}
              className="space-y-2 break-inside-avoid border-b border-scp-gray/20 pb-4 last:border-b-0 last:pb-0"
            >
              <div className="flex gap-2">
                <span className="font-bold font-mono text-xs text-scp-accent">Q:</span>
                <p className="text-xs font-mono italic text-gray-200">{qa.question}</p>
              </div>
              <div className="flex gap-2 pl-4 border-l border-scp-gray/30">
                <span className="font-bold font-mono text-xs text-scp-term">A:</span>
                <p className="text-xs text-gray-400 font-mono leading-relaxed">{qa.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QAHistoryPrintSection;
