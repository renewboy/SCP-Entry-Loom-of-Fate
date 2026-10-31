import { useEffect, useState } from 'react';
import { GameState } from '../types';

export type PresentedState = Pick<GameState, 'stability' | 'map' | 'objectives' | 'inventory' | 'npcs'>;

const snapshot = (gameState: GameState): PresentedState => ({
  stability: gameState.stability,
  map: gameState.map,
  objectives: gameState.objectives,
  inventory: gameState.inventory,
  npcs: gameState.npcs
});

/**
 * The model reports stability, objectives and location at the end of its reply,
 * long before the player has read that far. The stage shows this snapshot instead
 * of the live state, and it only moves on once the turn has been read. A location
 * that arrives before the first beat passes straight through so the turn can open on it.
 */
export function useStagePresentation(gameState: GameState, reading: boolean, beforeFirstBeat: boolean) {
  const [presented, setPresented] = useState<PresentedState>(() => snapshot(gameState));
  const { stability, map, objectives, inventory, npcs } = gameState;

  useEffect(() => {
    if (reading) return;
    setPresented({ stability, map, objectives, inventory, npcs });
  }, [reading, stability, map, objectives, inventory, npcs]);

  useEffect(() => {
    if (!beforeFirstBeat) return;
    setPresented(prev => (prev.map === map ? prev : { ...prev, map }));
  }, [beforeFirstBeat, map]);

  return presented;
}
