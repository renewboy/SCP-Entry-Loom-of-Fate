import { GameState, SaveGameMetadata, GlobalSettings, MapBlueprint, StoryDraft, SCPData } from '../types';
import { compressGameState, createThumbnail, decompressGameState } from '../utils/saveHelpers';

export const ERROR_CODES = {
    SAVE_LIMIT_REACHED: 'SAVE_LIMIT_REACHED'
};

const MAX_SAVES = 10;
const DB_NAME = 'scp_saves';
const DB_VERSION = 6;
const STORE_NAME = 'saves';
const CLOUD_STORE_NAME = 'cloud_saves';
const SETTINGS_STORE_NAME = 'settings';
const RAG_STORE_NAME = 'rag_memories';
const GLOBAL_SETTINGS_KEY = 'global_settings';
const EDITING_SCP_DATA_KEY = 'editing_scp_data';

const DEFAULT_SETTINGS: GlobalSettings = {
    enableSceneImages: false,
    enableBackgroundImages: true,
    enableEntityImages: true,
    difficulty: 'normal',
    bgmVolume: 0.8,
    sfxVolume: 1,
    skipTacticalPrep: false
};

interface IDBSaveGame extends SaveGameMetadata {
  game_state: { compressed: boolean; data: string };
}

export interface RagMemoryRecord {
  id: string;
  timeline_id: string;
  scp_number: string;
  content: string;
  embedding: number[];
  role: string;
  turn_number: number;
  tags?: any;
  created_at: string;
}

const openDB = (): Promise<IDBDatabase> => {
// ... existing openDB implementation
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CLOUD_STORE_NAME)) {
        db.createObjectStore(CLOUD_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(RAG_STORE_NAME)) {
        const store = db.createObjectStore(RAG_STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_timeline', 'timeline_id', { unique: false });
        store.createIndex('by_timeline_scp', ['timeline_id', 'scp_number'], { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// ... existing functions ...

export const saveGlobalSettings = async (settings: GlobalSettings): Promise<void> => {
    return saveSetting(GLOBAL_SETTINGS_KEY, settings);
};

export const loadGlobalSettings = async (): Promise<GlobalSettings> => {
    const settings = await loadSetting(GLOBAL_SETTINGS_KEY);
    if (!settings) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...settings };
};

export const saveEditingSCPData = async (data: SCPData | null): Promise<void> => {
    // Save all data to a single key
    return saveSetting(EDITING_SCP_DATA_KEY, data);
};

export const loadEditingSCPData = async (): Promise<SCPData | null> => {
    return loadSetting(EDITING_SCP_DATA_KEY);
};

export const clearEditingSCPData = async (): Promise<void> => {
    return saveSetting(EDITING_SCP_DATA_KEY, null);
};

export const saveGame = async (gameState: GameState, id?: string, createdAtOverride?: string): Promise<{ data: any; error: any }> => {
  try {
    const db = await openDB();
    const saveId = id || crypto.randomUUID();
    
    // ... (rest of function)
    if (!id) {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const countRequest = store.count();
        
        await new Promise((resolve, reject) => {
            countRequest.onsuccess = resolve;
            countRequest.onerror = reject;
        });
        
        if (countRequest.result >= MAX_SAVES) {
             const error: any = new Error('Save limit reached');
             error.code = ERROR_CODES.SAVE_LIMIT_REACHED;
             return { data: null, error };
        }
    }

    // Proper Limit Enforcement: Get all metadata, sort by date, delete excess if needed
    if (!id) {
        const loadTx = db.transaction(STORE_NAME, 'readonly');
        const loadStore = loadTx.objectStore(STORE_NAME);
        const allSavesRequest = loadStore.getAll();
        
        const allSaves = await new Promise<IDBSaveGame[]>((resolve, reject) => {
            allSavesRequest.onsuccess = () => resolve(allSavesRequest.result);
            allSavesRequest.onerror = () => reject(allSavesRequest.error);
        });

        if (allSaves.length >= MAX_SAVES) {
             const error: any = new Error('Save limit reached');
             error.code = ERROR_CODES.SAVE_LIMIT_REACHED;
             return { data: null, error };
        }
    }
    
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

    const payload: IDBSaveGame = {
      id: saveId,
      created_at: createdAtOverride || new Date().toISOString(),
      summary,
      turn_count: gameState.turnCount,
      background_thumbnail: thumbnail || undefined,
      game_state: compressedState,
      is_cloud_synced: false // Default to false, will be updated by sync logic
    };

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(payload);

      request.onsuccess = () => {
        resolve({ data: payload, error: null });
      };

      request.onerror = () => {
        resolve({ data: null, error: request.error });
      };
    });
  } catch (error) {
    return { data: null, error };
  }
};

export const updateCloudSyncStatus = async (id: string, status: boolean): Promise<void> => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const item: IDBSaveGame = await new Promise((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        if (item) {
            item.is_cloud_synced = status;
            await new Promise((resolve, reject) => {
                const req = store.put(item);
                req.onsuccess = () => resolve(null);
                req.onerror = () => reject(req.error);
            });
        }
    } catch (e) {
        console.error("Failed to update sync status", e);
    }
};

export const loadGames = async (): Promise<{ data: SaveGameMetadata[] | null; error: any }> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result as IDBSaveGame[];
        // Sort by created_at desc
        const sorted = result.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        // Remove game_state to match metadata interface
        const metadata = sorted.map(({ game_state, ...rest }) => rest);
        resolve({ data: metadata, error: null });
      };

      request.onerror = () => {
        resolve({ data: null, error: request.error });
      };
    });
  } catch (error) {
    return { data: null, error };
  }
};

export const loadGameFull = async (id: string): Promise<{ data: GameState | null; error: any }> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as IDBSaveGame;
        if (result && result.game_state) {
          try {
            const gameState = decompressGameState(result.game_state);
            resolve({ data: gameState, error: null });
          } catch (e) {
            resolve({ data: null, error: e });
          }
        } else {
          resolve({ data: null, error: null });
        }
      };

      request.onerror = () => {
        resolve({ data: null, error: request.error });
      };
    });
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteSaveGame = async (id: string): Promise<{ error: any }> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve({ error: null });
      };

      request.onerror = () => {
        resolve({ error: request.error });
      };
    });
  } catch (error) {
    return { error };
  }
};

// --- Cloud List Caching ---

export const saveCloudSavesList = async (saves: SaveGameMetadata[]): Promise<void> => {
    try {
        const db = await openDB();
        const tx = db.transaction(CLOUD_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CLOUD_STORE_NAME);
        
        // Clear old cache first? Or merge? 
        // User wants "list stored in IndexedDB". If we get a full list, we should probably replace.
        // But for efficiency, clear and add all is okay for small lists.
        await new Promise((resolve, reject) => {
            store.clear().onsuccess = resolve;
            store.clear().onerror = reject;
        });

        for (const save of saves) {
            store.put(save);
        }
        
        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(null);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("Failed to cache cloud saves", e);
    }
};

export const getCloudSavesList = async (userId?: string): Promise<SaveGameMetadata[]> => {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(CLOUD_STORE_NAME, 'readonly');
            const store = tx.objectStore(CLOUD_STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => {
                const results = req.result as SaveGameMetadata[];
                if (userId) {
                    resolve(results.filter(save => save.user_id === userId));
                } else {
                    resolve(results);
                }
            };
            req.onerror = () => resolve([]);
        });
    } catch (e) {
        return [];
    }
};

export const clearCloudSavesCache = async (): Promise<void> => {
    try {
        const db = await openDB();
        const tx = db.transaction(CLOUD_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CLOUD_STORE_NAME);
        await new Promise((resolve, reject) => {
            const req = store.clear();
            req.onsuccess = () => resolve(null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("Failed to clear cloud saves cache", e);
    }
};

export const addCloudSaveToCache = async (save: SaveGameMetadata): Promise<void> => {
    try {
        const db = await openDB();
        const tx = db.transaction(CLOUD_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CLOUD_STORE_NAME);
        await new Promise((resolve, reject) => {
            const req = store.put(save);
            req.onsuccess = () => resolve(null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("Failed to add cloud save to cache", e);
    }
};

export const removeCloudSaveFromCache = async (id: string): Promise<void> => {
    try {
        const db = await openDB();
        const tx = db.transaction(CLOUD_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CLOUD_STORE_NAME);
        await new Promise((resolve, reject) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve(null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("Failed to remove cloud save from cache", e);
    }
};

export const saveSetting = async (key: string, value: any): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE_NAME);
    await new Promise((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve(null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error(`Failed to save setting ${key}`, e);
  }
};

export const loadSetting = async (key: string): Promise<any> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SETTINGS_STORE_NAME, 'readonly');
      const store = tx.objectStore(SETTINGS_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(req.result ? req.result.value : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.error(`Failed to load setting ${key}`, e);
    return null;
  }
};

const cosineSimilarity = (a: number[], b: number[]) => {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < len; i += 1) {
        const av = a[i];
        const bv = b[i];
        dot += av * bv;
        na += av * av;
        nb += bv * bv;
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

const readAllByIndex = async <T>(db: IDBDatabase, storeName: string, indexName: string, key: IDBValidKey | IDBKeyRange) => {
    return new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const req = index.getAll(key);
        req.onsuccess = () => resolve((req.result || []) as T[]);
        req.onerror = () => reject(req.error);
    });
};

const deleteByIndex = async (db: IDBDatabase, storeName: string, indexName: string, key: IDBValidKey | IDBKeyRange) => {
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const cursorReq = index.openCursor(key);
        cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) {
                resolve();
                return;
            }
            cursor.delete();
            cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
    });
};

export const archiveLocalMemories = async (memories: Omit<RagMemoryRecord, 'id' | 'created_at'>[]): Promise<{ error: any }> => {
    try {
        if (!Array.isArray(memories) || memories.length === 0) return { error: null };
        const db = await openDB();
        const { timeline_id, scp_number } = memories[0];
        if (!timeline_id || !scp_number) return { error: null };

        await deleteByIndex(db, RAG_STORE_NAME, 'by_timeline_scp', [timeline_id, scp_number]);

        const payload: RagMemoryRecord[] = memories.map(m => ({
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            ...m
        }));

        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(RAG_STORE_NAME, 'readwrite');
            const store = tx.objectStore(RAG_STORE_NAME);
            payload.forEach(item => store.put(item));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        return { error: null };
    } catch (error) {
        return { error };
    }
};

export const deleteLocalMemoriesByTimelineId = async (timelineId: string): Promise<{ error: any }> => {
    try {
        if (!timelineId) return { error: null };
        const db = await openDB();
        await deleteByIndex(db, RAG_STORE_NAME, 'by_timeline', timelineId);
        return { error: null };
    } catch (error) {
        return { error };
    }
};

export const loadLocalMemoriesByTimelineId = async (timelineId: string): Promise<{ data: RagMemoryRecord[] | null; error: any }> => {
    try {
        if (!timelineId) return { data: [], error: null };
        const db = await openDB();
        const items = await readAllByIndex<RagMemoryRecord>(db, RAG_STORE_NAME, 'by_timeline', timelineId);
        return { data: items, error: null };
    } catch (error) {
        return { data: null, error };
    }
};

export const duplicateLocalMemories = async (oldTimelineId: string, newTimelineId: string): Promise<{ error: any }> => {
    try {
        if (!oldTimelineId || !newTimelineId) return { error: null };
        const db = await openDB();
        const oldItems = await readAllByIndex<RagMemoryRecord>(db, RAG_STORE_NAME, 'by_timeline', oldTimelineId);
        if (!oldItems.length) return { error: null };
        const newItems: RagMemoryRecord[] = oldItems.map(item => ({
            ...item,
            id: crypto.randomUUID(),
            timeline_id: newTimelineId,
            created_at: new Date().toISOString()
        }));
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(RAG_STORE_NAME, 'readwrite');
            const store = tx.objectStore(RAG_STORE_NAME);
            newItems.forEach(item => store.put(item));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        return { error: null };
    } catch (error) {
        return { error };
    }
};

export const searchLocalMemories = async (
    queryEmbedding: number[],
    timelineId: string,
    threshold = 0.75,
    limit = 3
): Promise<{ data: RagMemoryRecord[] | null; error: any }> => {
    try {
        if (!timelineId || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
            return { data: [], error: null };
        }
        const db = await openDB();
        const items = await readAllByIndex<RagMemoryRecord>(db, RAG_STORE_NAME, 'by_timeline', timelineId);
        if (!items.length) return { data: [], error: null };

        const scored = items.map(item => ({
            item,
            score: Array.isArray(item.embedding) ? cosineSimilarity(queryEmbedding, item.embedding) : 0
        }));

        const filtered = scored
            .filter(x => x.score >= threshold)
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.max(0, limit))
            .map(x => x.item);

        return { data: filtered, error: null };
    } catch (error) {
        return { data: null, error };
    }
};
