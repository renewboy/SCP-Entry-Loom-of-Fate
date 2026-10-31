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
    <>
      {qaHistory.map((qa, index) => (
        <div key={`${qa.timestamp}-${index}`} className="qa-pair">
          <div className="qa-q"><span>Q</span><p>{qa.question}</p></div>
          <div className="qa-a"><span>A</span><p>{qa.answer}</p></div>
        </div>
      ))}
    </>
  );
};

export default QAHistoryList;
