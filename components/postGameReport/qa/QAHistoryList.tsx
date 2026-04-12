import React from 'react';
import type { QAPair } from '../../../types';

interface QAHistoryListProps {
  qaHistory: QAPair[];
}

const QAHistoryList: React.FC<QAHistoryListProps> = ({ qaHistory }) => {
  if (!qaHistory.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      {qaHistory.map((qa, index) => (
        <div key={`${qa.timestamp}-${index}`} className="space-y-2 animate-in fade-in slide-in-from-left-2">
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
  );
};

export default QAHistoryList;
