import React from 'react';

export interface NpcDialogueSegment {
  type: 'text' | 'npc';
  content: string;
  npcId?: string;
}

export const extractNpcDialogues = (children: React.ReactNode): NpcDialogueSegment[] | null => {
  const childrenArray = React.Children.toArray(children);
  const text = childrenArray.map(child => (typeof child === 'string' ? child : '')).join('');
  if (!text.includes('[@')) return null;

  const regex = /\[@([^\]:：]+)[:：]\s*([\s\S]*?)\]/g;
  const segments: NpcDialogueSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }
    segments.push({
      type: 'npc',
      npcId: match[1],
      content: match[2].trim()
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return segments.length ? segments : null;
};
