import React from 'react';
import type { PrintableNpc, TimelineEvent } from '../types';
import WorldLineTimelineCard from './WorldLineTimelineCard';

interface WorldLineTimelineProps {
  events: TimelineEvent[];
  printableNpcs?: PrintableNpc[];
  npcImages?: Record<string, string>;
  nodeIdLabel: string;
  t: (key: string) => string;
}

const WorldLineTimeline: React.FC<WorldLineTimelineProps> = ({ events, printableNpcs, npcImages, nodeIdLabel, t }) => {
  return (
    <>
      <div className="absolute left-4 md:left-1/2 top-10 bottom-10 w-0.5 bg-gradient-to-b from-scp-term via-scp-gray to-scp-accent opacity-30"></div>
      <div className="space-y-12 mb-20">
        {events.map((event, index) => (
          <WorldLineTimelineCard
            key={event.id}
            event={event}
            index={index}
            timelineLength={events.length}
            printableNpcs={printableNpcs}
            npcImages={npcImages}
            nodeIdLabel={nodeIdLabel}
            t={t}
          />
        ))}
      </div>
    </>
  );
};

export default WorldLineTimeline;
