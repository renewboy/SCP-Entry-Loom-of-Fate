import { GameState, SaveGameMetadata } from '../types';
import { compressGameState, createThumbnail, decompressGameState } from '../utils/saveHelpers';

export const ERROR_CODES = {
    SAVE_LIMIT_REACHED: 'SAVE_LIMIT_REACHED'
};

const MAX_SAVES = 10;
const DB_NAME = 'scp_saves';
const DB_VERSION = 3; // Increment version
const STORE_NAME = 'saves';
const CLOUD_STORE_NAME = 'cloud_saves';
const SETTINGS_STORE_NAME = 'settings';

interface IDBSaveGame extends SaveGameMetadata {
  game_state: { compressed: boolean; data: string };
}

const openDB = (): Promise<IDBDatabase> => {
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
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
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
