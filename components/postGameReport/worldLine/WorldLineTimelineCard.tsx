import React from 'react';
import MessageContent from '../../shared/MessageContent';
import type { PrintableNpc, TimelineEvent } from '../types';

interface WorldLineTimelineCardProps {
  event: TimelineEvent;
  index: number;
  timelineLength: number;
  printableNpcs?: PrintableNpc[];
  npcImages?: Record<string, string>;
  nodeIdLabel: string;
  t: (key: string) => string;
}

const WorldLineTimelineCard: React.FC<WorldLineTimelineCardProps> = ({
  event,
  index,
  timelineLength,
  printableNpcs,
  npcImages,
  nodeIdLabel,
  t,
}) => {
  return (
    <div className={`relative flex flex-col md:flex-row gap-8 items-center ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
      <div className="absolute left-4 md:left-1/2 -translate-x-[18px] md:-translate-x-1/2 -top-6 z-10 bg-scp-dark border border-scp-gray/50 px-2 py-1 rounded text-[10px] font-mono text-scp-accent max-w-[200px] truncate text-center shadow-lg">
        {event.trigger}
      </div>

      <div
        className={`absolute left-4 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 z-10 ${
          index === timelineLength - 1 ? 'bg-red-500 border-red-900 animate-pulse' : 'bg-scp-term border-scp-dark'
        }`}
      ></div>

      <div className="w-full md:w-[45%] pl-10 md:pl-0">
        <div className="bg-black/80 border border-scp-gray/30 p-4 rounded hover:border-scp-term/50 transition-colors group backdrop-blur-sm scp-window">
          {event.image && (
            <div className="mb-3 overflow-hidden rounded border border-scp-gray/20">
              <img
                src={event.image}
                alt="Evidence"
                className="w-full h-32 object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
              />
            </div>
          )}
          <div className="max-h-24 overflow-hidden group-hover:max-h-80 group-hover:overflow-y-auto overscroll-contain pr-1 transition-[max-height] duration-500">
            <MessageContent
              content={event.response}
              t={t}
              className="font-mono text-xs text-gray-400 space-y-2 [&_p]:my-0 [&_ul]:my-1 [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:pl-5 [&_li]:my-0.5"
              npcs={printableNpcs}
              npcImages={npcImages}
              stability={event.stability}
            />
          </div>
          <span className="text-[9px] text-scp-gray mt-2 block font-mono">
            {nodeIdLabel}: {event.id.slice(-6)}
          </span>
        </div>
      </div>
      <div className="hidden md:block w-[45%]"></div>
    </div>
  );
};

export default WorldLineTimelineCard;
