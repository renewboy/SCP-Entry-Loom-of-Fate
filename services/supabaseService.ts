
import { createClient } from '@supabase/supabase-js';
import { GameState } from '../types';
import pako from 'pako';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Key is missing. Save/Load functionality will be disabled.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export interface SaveGameMetadata {
  id: string;
  created_at: string;
  summary?: string;
  turn_count?: number;
}

export interface SaveGame extends SaveGameMetadata {
  game_state: GameState;
}

// Helper to compress data
const compressGameState = (gameState: GameState): { compressed: boolean; data: string } => {
  const jsonString = JSON.stringify(gameState);
  const compressed = pako.deflate(jsonString);
  
  // Optimize: Use chunk-based processing (32KB chunks)
  // 1. Prevents "Maximum call stack size exceeded" error by avoiding massive spread operators.
  // 2. Significantly faster than byte-by-byte looping.
  // 3. Allows the JS engine (V8) to utilize internal vectorized/SIMD optimizations for bulk string creation.
  const CHUNK_SIZE = 0x8000; 
  const chunks = [];
  for (let i = 0; i < compressed.length; i += CHUNK_SIZE) {
    chunks.push(String.fromCharCode.apply(null, compressed.subarray(i, i + CHUNK_SIZE) as any));
  }
  
  const base64 = btoa(chunks.join(''));
  return { compressed: true, data: base64 };
};

// Helper to decompress data
const decompressGameState = (data: any): GameState => {
  if (data && data.compressed && typeof data.data === 'string') {
    try {
      // Decode Base64 to Uint8Array
      const charData = atob(data.data);
      const uint8Array = new Uint8Array(charData.length);
      for (let i = 0; i < charData.length; i++) {
        uint8Array[i] = charData.charCodeAt(i);
      }
      const decompressed = pako.inflate(uint8Array, { to: 'string' });
      return JSON.parse(decompressed);
    } catch (e) {
      console.error("Failed to decompress game state:", e);
      throw new Error("Corrupted save data");
    }
  }
  // Fallback for legacy uncompressed saves
  return data as GameState;
};

export const saveGame = async (gameState: GameState, id?: string): Promise<{ data: any; error: any }> => {
  // Construct a summary for the save
  const summary = `Turn ${gameState.turnCount} - ${gameState.scpData?.designation || 'Unknown SCP'} - ${gameState.role}`;

  const compressedState = compressGameState(gameState);

  const payload = { 
    game_state: compressedState,
    summary: summary,
    turn_count: gameState.turnCount,
    ...(id ? { id, created_at: new Date().toISOString() } : {})
  };

  const { data, error } = await supabase
    .from('save_games')
    .upsert([payload])
    .select('id, created_at, summary, turn_count'); // Return minimal data

  return { data, error };
};

export const loadGames = async (): Promise<{ data: SaveGameMetadata[] | null; error: any }> => {
  const { data, error } = await supabase
    .from('save_games')
    .select('id, created_at, summary, turn_count') // Only select metadata
    .order('created_at', { ascending: false });

  return { data, error };
};

export const loadGameFull = async (id: string): Promise<{ data: GameState | null; error: any }> => {
  const { data, error } = await supabase
    .from('save_games')
    .select('game_state')
    .eq('id', id)
    .single();

  if (error) return { data: null, error };
  
  if (data && data.game_state) {
      const gameState = decompressGameState(data.game_state);
      return { data: gameState, error: null };
  }

  return { data: null, error: null };
};

export const deleteSaveGame = async (id: string): Promise<{ error: any }> => {
  const { error } = await supabase
    .from('save_games')
    .delete()
    .eq('id', id);

  return { error };
};
