import React from 'react';
import { RuntimeNPCState } from '../types';

export interface NpcDialogueMatch {
  npcId: string;
  contentNodes: React.ReactNode[];
}

export const extractNpcDialogue = (children: React.ReactNode, npcs?: RuntimeNPCState[]): NpcDialogueMatch | null => {
  const childrenArray = React.Children.toArray(children);
  const startChildIndex = childrenArray.findIndex(
    (child) => typeof child === 'string' && child.match(/^\[@([^\]:：]+)[:：]\s*/)
  );

  if (startChildIndex === -1) return null;

  const startChild = childrenArray[startChildIndex];
  if (typeof startChild !== 'string') return null;

  const match = startChild.match(/^\[@([^\]:：]+)[:：]\s*(.*)/);
  if (!match) return null;

  const npcId = match[1];
  const newChildrenArray = childrenArray.slice(startChildIndex);
  newChildrenArray[0] = match[2];

  const lastIndex = newChildrenArray.length - 1;
  const lastChild = newChildrenArray[lastIndex];

  if (typeof lastChild === 'string' && lastChild.trim().endsWith(']')) {
    newChildrenArray[lastIndex] = lastChild.trim().slice(0, -1);
  } else if (typeof lastChild === 'string' && lastChild.endsWith(']')) {
    newChildrenArray[lastIndex] = lastChild.slice(0, -1);
  }

  if (newChildrenArray.length === 1 && typeof newChildrenArray[0] === 'string') {
    if (newChildrenArray[0].endsWith(']')) {
      newChildrenArray[0] = newChildrenArray[0].slice(0, -1);
    }
  }

  return { npcId, contentNodes: newChildrenArray };
};
