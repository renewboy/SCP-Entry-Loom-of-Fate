import { createClient, User } from '@supabase/supabase-js';
import { GameState, SaveGameMetadata } from '../types';
import { compressGameState, createThumbnail, decompressGameState } from '../utils/saveHelpers';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://kyeypgnhavzyibyhqulf.supabase.co';
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5ZXlwZ25oYXZ6eWlieWhxdWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODEzMjksImV4cCI6MjA4MjA1NzMyOX0.LZf3Zok3HWZjLcduGXGbCZunL5XSaYkri12bp-SLNBg';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const SANDBOX_USER_ID = '00000000-0000-0000-0000-000000000000';
const SANDBOX_STORAGE_KEY = 'scp_sandbox_auth';

export const loginAsSandboxUser = () => {
    localStorage.setItem(SANDBOX_STORAGE_KEY, 'true');
};

export const isSandboxUser = () => {
    return localStorage.getItem(SANDBOX_STORAGE_KEY) === 'true';
};

// --- Auth Functions ---

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  return { error };
};

// --- Memory / RAG System ---

export const archiveMemories = async (memories: {
    timeline_id: string;
    scp_number: string;
    content: string;
    embedding: number[];
    role: string;
    turn_number: number;
    tags?: any;
}[]): Promise<{ error: any }> => {
    // Check if user is logged in or sandbox
    const { data: { user } } = await supabase.auth.getUser();
    const isSandbox = isSandboxUser();

    if (!user && !isSandbox) {
        console.log("[Supabase] User not logged in - skipping memory archive (RAG requires cloud)");
        return { error: null };
    }

    if (memories.length === 0) return { error: null };

    // Get the timeline_id and scp_number from the first memory (assume batch is for same game)
    const { timeline_id, scp_number } = memories[0];

    // --- Deduplication Strategy: Delete existing memories for this specific SCP run ---
    console.log(`[Supabase] Cleaning up existing memories for Timeline ${timeline_id} / ${scp_number}...`);
    
    // Note: 'user_id' is handled by RLS, but for Sandbox we might need to be careful?
    // RLS policy: (auth.uid() = user_id OR user_id = SANDBOX_ID)
    // So simple delete should work for the current user's data.
    const { error: deleteError } = await supabase
        .from('memories')
        .delete()
        .eq('timeline_id', timeline_id)
        .eq('scp_number', scp_number); // Only delete memories for this specific SCP in this timeline

    if (deleteError) {
         console.warn("[Supabase] Failed to clean up old memories (might be first run):", deleteError);
         // Continue anyway, it might just be no rows found (though delete usually doesn't error on 0 rows)
    }

    let payload: any[] = memories;
    if (isSandbox) {
        console.log("[Supabase] Archiving memories for Sandbox User");
        payload = memories.map(m => ({ ...m, user_id: SANDBOX_USER_ID }));
    }

    const { error } = await supabase
        .from('memories')
        .insert(payload);

    if (error) {
        console.error("[Supabase] Failed to archive memories:", error);
    }

    return { error };
};

export const duplicateMemories = async (oldTimelineId: string, newTimelineId: string): Promise<{ error: any }> => {
    // Check if user is logged in or sandbox
    const { data: { user } } = await supabase.auth.getUser();
    const isSandbox = isSandboxUser();

    if (!user && !isSandbox) {
        return { error: null };
    }

    // 1. Fetch memories from old timeline
    // Note: We need to fetch ALL memories, so we might need pagination if there are many.
    // For now, assume < 1000 memories (Supabase default limit is 1000).
    const { data: oldMemories, error: fetchError } = await supabase
        .from('memories')
        .select('*')
        .eq('timeline_id', oldTimelineId);

    if (fetchError || !oldMemories || oldMemories.length === 0) {
        return { error: fetchError };
    }

    console.log(`[Supabase] Duplicating ${oldMemories.length} memories from ${oldTimelineId} to ${newTimelineId}`);

    // 2. Prepare new payload with new timeline_id
    const newMemories = oldMemories.map(m => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, created_at, ...rest } = m; // Remove system fields
        return {
            ...rest,
            timeline_id: newTimelineId,
            user_id: isSandbox ? SANDBOX_USER_ID : (user?.id || rest.user_id)
        };
    });

    // 3. Insert into new timeline
    const { error: insertError } = await supabase
        .from('memories')
        .insert(newMemories);

    if (insertError) {
        console.error("[Supabase] Failed to duplicate memories:", insertError);
    }

    return { error: insertError };
};

export const searchMemories = async (
    queryEmbedding: number[], 
    timelineId: string, 
    threshold = 0.75, 
    limit = 3
): Promise<{ data: any[] | null; error: any }> => {
    // Check if user is logged in or sandbox
    const { data: { user } } = await supabase.auth.getUser();
    const isSandbox = isSandboxUser();

    if (!user && !isSandbox) {
        // Not logged in -> cannot access RAG
        return { data: [], error: null };
    }
    console.log("[Supabase] Searching memories for timeline:", timelineId);
    // Call the RPC function 'match_memories'
    const { data, error } = await supabase.rpc('match_memories', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
        filter_timeline_id: timelineId
    });
    if (error) {
        console.error("[Supabase] Failed to search memories:", error);
        return { data: null, error };
    }

    return { data, error: null };
};

export const signOut = async () => {
  if (isSandboxUser()) {
      localStorage.removeItem(SANDBOX_STORAGE_KEY);
      return { error: null };
  }
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async (): Promise<User | null> => {
  if (isSandboxUser()) {
      return {
          id: SANDBOX_USER_ID,
          email: 'sandbox@ai.studio',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString()
      } as User;
  }
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// --- Save/Load Logic ---

export const saveGame = async (gameState: GameState, id?: string, userId?: string, createdAtOverride?: string): Promise<{ data: any; error: any }> => {
  // Construct a summary for the save
  const summary = `Turn ${gameState.turnCount}\n${gameState.scpData?.designation || 'Unknown SCP'} - ${gameState.role}`;

  const compressedState = compressGameState(gameState);
  
  let thumbnail = null;
  if (gameState.backgroundImage) {
      try {
        thumbnail = await createThumbnail(gameState.backgroundImage);
      } catch (e) {
        console.warn("Failed to create thumbnail", e);
      }
  }

  // Note: user_id is automatically handled by RLS (auth.uid() default)
  // However, for UPSERT to work with RLS policies that check (auth.uid() = user_id),
  // we must sometimes explicitly include user_id if the default isn't picking it up 
  // or if the policy requires the new row to explicitly match.
  const { data: { user } } = await supabase.auth.getUser();
  const targetUserId = userId || user?.id;
  
  const payload = { 
    game_state: compressedState,
    summary: summary,
    turn_count: gameState.turnCount,
    background_thumbnail: thumbnail,
    user_id: targetUserId, // Explicitly set user_id
    ...(id ? { id, created_at: createdAtOverride || new Date().toISOString() } : {})
  };

  const { data, error } = await supabase
    .from('save_games')
    .upsert([payload])
    .select('id, created_at, summary, turn_count, background_thumbnail');

  return { data, error };
};

export const loadGames = async (userId?: string): Promise<{ data: SaveGameMetadata[] | null; error: any }> => {
  // RLS ensures users only see their own saves
  let query = supabase
    .from('save_games')
    .select('id, created_at, summary, turn_count, background_thumbnail, user_id')
    .order('created_at', { ascending: false });
    
  if (userId) {
      query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (data) {
      // Mark these as cloud saves
      return { 
          data: data.map(d => ({ ...d, is_cloud_synced: true })), 
          error 
      };
  }

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
