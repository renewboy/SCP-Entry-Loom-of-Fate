import React, { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../utils/i18n';
import * as IDB from '../services/indexedDBService';
import * as Cloud from '../services/supabaseService';
import { flushStagedRagMemoriesToTimeline } from '../services/ragStaging';
import { SaveGameMetadata } from '../types';
import { GameState, GameStatus } from '../types';
import ConfirmationModal from './ConfirmationModal';
import CrtSurface from './common/CrtSurface';
import { User } from '@supabase/supabase-js';
import { ERROR_CODES } from '../services/indexedDBService';
import { useViewport } from '../hooks/useViewport';

interface SaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'save' | 'load';
  currentGameState?: GameState;
  onLoadGame: (gameState: GameState) => void;
  onSaveComplete?: (id: string) => void;
}

const SaveLoadModal: React.FC<SaveLoadModalProps> = ({ isOpen, onClose, mode, currentGameState, onLoadGame, onSaveComplete }) => {
  const { t } = useTranslation();
  const locale = t('i18n.locale') as string;
  const { isMobile } = useViewport();
  const [activeTab, setActiveTab] = useState<'local' | 'cloud'>('local'); // We'll use this just for login view state now
  const [saves, setSaves] = useState<SaveGameMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);

  // Confirmation Modal State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'overwrite' | 'delete' | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  const [limitAlertOpen, setLimitAlertOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkAuthAndFetch();
    }
  }, [isOpen]);

  // Auto-refresh when user logs in/out
  // We need to be careful not to create loops. 
  // fetchSaves handles both local and cloud, so re-running it on user change is correct.
  useEffect(() => {
      if (isOpen) {
          fetchSaves();
      }
  }, [user]);

  useEffect(() => {
    if (!isOpen || !user) return;

    const channel = Cloud.supabase
      .channel('public:save_games')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'save_games', filter: `user_id=eq.${user.id}` },
        async () => {
          const { data: freshCloudData } = await Cloud.loadGames(user.id);
          if (freshCloudData) {
            await IDB.saveCloudSavesList(freshCloudData);
            fetchSaves(user);
          }
        }
      )
      .subscribe();

    return () => {
      Cloud.supabase.removeChannel(channel);
    };
  }, [isOpen, user]);

  const checkAuthAndFetch = async () => {
      let currentUser = await Cloud.getCurrentUser();

      // Auto-login for AI Studio if not already logged in
      if (isAIStudio && !currentUser) {
           Cloud.loginAsSandboxUser();
           currentUser = await Cloud.getCurrentUser();
      }

      setUser(currentUser);
      // Explicitly fetch saves regardless of user state change
      // This ensures local saves are loaded even if user remains null
      fetchSaves(currentUser);
  };

  // Check for AI Studio environment
  const isAIStudio = window.location.hostname.includes('ai.studio') || 
                     window.location.hostname.includes('googleusercontent.com') ||
                     (window as any).aistudio !== undefined;

  const handleLogin = async () => {
      if (isAIStudio) {
          // Sandbox Login
          Cloud.loginAsSandboxUser();
          const sandboxUser = await Cloud.getCurrentUser();
          setUser(sandboxUser);
          fetchSaves(sandboxUser);
          return;
      }
      setLoading(true);
      const { error } = await Cloud.signInWithGoogle();
      if (error) {
          setError("Login failed: " + error.message);
          setLoading(false);
      }
  };

  const handleLogout = async () => {
      setLoading(true);
      await Cloud.signOut();
      await IDB.clearCloudSavesCache(); // Clear cache on logout to prevent leakage
      setUser(null);
      // fetchSaves will re-run and show only local
      setLoading(false);
  };

  const handleManualRefresh = async () => {
      if (!user) return;
      setLoading(true);
      
      try {
        const { data: cloudData, error: cloudError } = await Cloud.loadGames(user.id);
        
        if (cloudError) {
            setError(t('save_load.load_error') + ': ' + cloudError.message);
        } else if (cloudData) {
            await IDB.saveCloudSavesList(cloudData);
            await fetchSaves();
        }
      } catch (e) {
          console.error("Manual refresh failed", e);
      } finally {
          setLoading(false);
      }
  };

  const fetchSaves = async (overrideUser?: User | null) => {
    const currentUser = overrideUser === undefined ? user : overrideUser;
    
    setLoading(true);
    setError(null);
    
    // 1. Load Local Saves
    const { data: localData, error: localError } = await IDB.loadGames();
    if (localError) {
        setError(t('save_load.load_error') + ': ' + localError.message);
        setLoading(false);
        return;
    }

    let allSaves = localData || [];

    // 2. If logged in, Load Cloud Saves & Merge/Sync
    if (currentUser) {
        // Try loading from IndexedDB cache first
        let cachedCloudSaves = await IDB.getCloudSavesList(currentUser.id);

        // If cache is empty, fetch from cloud initially
        if (cachedCloudSaves.length === 0) {
             const { data: cloudData, error: cloudError } = await Cloud.loadGames(currentUser.id);
             if (cloudData) {
                 cachedCloudSaves = cloudData;
                 await IDB.saveCloudSavesList(cloudData);
             }
        }
        
        const finalCloudData = cachedCloudSaves;
        
        // Map cloud saves for easy lookup (even if empty, we need the map)
        const cloudMap = new Map(finalCloudData.map(s => [s.id, s]));
        
        // Lists for sync
        const toUpload: SaveGameMetadata[] = [];
        const toDownload: SaveGameMetadata[] = [];
        
        // Update local saves "is_cloud_synced" status and check for conflicts
        allSaves = allSaves.map(local => {
            if (cloudMap.has(local.id)) {
                const cloud = cloudMap.get(local.id)!;
                cloudMap.delete(local.id); // Remove from map
                
                // Conflict Resolution: Compare timestamps
                const localTime = new Date(local.created_at).getTime();
                const cloudTime = new Date(cloud.created_at).getTime();
                
                // Threshold of 1 second (1000ms) to ignore minor differences
                if (Math.abs(localTime - cloudTime) < 1000) {
                    // In sync
                    return { ...local, is_cloud_synced: true };
                } else if (localTime > cloudTime) {
                    // Local is newer -> Upload
                    toUpload.push(local);
                    return { ...local, is_cloud_synced: false };
                } else {
                        // Cloud is newer -> Download
                        // We keep the local entry in list but mark it for download update
                        // The syncCloudToLocal function will overwrite IDB
                        toDownload.push(cloud);
                        return { ...cloud, is_cloud_synced: true }; // Display cloud metadata
                }
            }
            
            // Local only -> Upload
            toUpload.push(local);
            return { ...local, is_cloud_synced: false };
        });

        // Add remaining cloud-only saves -> Download
        const cloudOnly = Array.from(cloudMap.values());
        cloudOnly.forEach(c => toDownload.push(c));
        
        allSaves = [...allSaves, ...cloudOnly];
        
        // Perform Background Sync
        if (toUpload.length > 0) syncLocalToCloud(toUpload);
        if (toDownload.length > 0) {
                // We iterate to avoid blocking the loop too much
                toDownload.forEach(s => syncCloudToLocal(s));
        }
    }

    // Sort combined list by date
    allSaves.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setSaves(allSaves);
    setLoading(false);
  };

    const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
    
    const mirrorLocalMemoriesToCloud = async (timelineId: string) => {
        if (!user || !timelineId) return;
        const { data } = await IDB.loadLocalMemoriesByTimelineId(timelineId);
        const items = data || [];
        if (items.length === 0) return;
        const byScp = new Map<string, typeof items>();
        items.forEach(item => {
            const list = byScp.get(item.scp_number) || [];
            list.push(item);
            byScp.set(item.scp_number, list);
        });
        for (const group of byScp.values()) {
            const { error } = await Cloud.archiveMemories(group);
            if (error) console.error("Failed to mirror local memories to cloud", error);
        }
    };

    const syncCloudMemoriesToLocal = async (timelineId: string) => {
        if (!timelineId) return;
        const { data, error } = await Cloud.loadMemoriesByTimelineId(timelineId);
        if (error) {
            console.error("Failed to load cloud memories", error);
            return;
        }
        const items = (data || []).filter(m => Array.isArray(m.embedding) && m.embedding.length > 0);
        if (items.length === 0) return;
        const byScp = new Map<string, typeof items>();
        items.forEach(item => {
            const list = byScp.get(item.scp_number) || [];
            list.push(item);
            byScp.set(item.scp_number, list);
        });
        for (const group of byScp.values()) {
            const { error: localError } = await IDB.archiveLocalMemories(group.map(m => ({
                timeline_id: timelineId,
                scp_number: m.scp_number || 'UNKNOWN',
                content: m.content,
                embedding: m.embedding as number[],
                role: m.role || 'UNKNOWN',
                turn_number: typeof m.turn_number === 'number' ? m.turn_number : 0,
                tags: m.tags
            })));
            if (localError) console.error("Failed to archive cloud memories to local store", localError);
        }
    };

    const downloadCloudSaveToLocal = async (id: string, createdAt?: string) => {
        const { data: fullState, error } = await Cloud.loadGameFull(id);
        if (fullState && !error) {
            await IDB.saveGame(fullState, id, createdAt);
            await IDB.updateCloudSyncStatus(id, true);
            await syncCloudMemoriesToLocal(id);
        }
        return { data: fullState, error };
    };

    // Sync Logic: Cloud -> Local (Download)
    const syncCloudToLocal = async (cloudSave: SaveGameMetadata) => {
        if (!user) return;
        setSyncingIds(prev => new Set(prev).add(cloudSave.id));
        
        try {
            console.log(`Auto-syncing save ${cloudSave.id} from cloud...`);
            const { data: fullState, error } = await downloadCloudSaveToLocal(cloudSave.id, cloudSave.created_at);
            if (fullState && !error) {
                // Update UI: Mark as synced
                setSaves(prev => prev.map(s => s.id === cloudSave.id ? { ...s, is_cloud_synced: true } : s));
            } else {
                console.error("Failed to download cloud save for sync", error);
            }
        } catch (e) {
            console.error("Sync Cloud->Local failed", e);
        } finally {
             setSyncingIds(prev => {
                const next = new Set(prev);
                next.delete(cloudSave.id);
                return next;
            });
        }
    };

    // Sync Logic: Local -> Cloud (Upload)
    const syncLocalToCloud = async (unsyncedSaves: SaveGameMetadata[]) => {
        if (!user) return;
        
        for (const save of unsyncedSaves) {
            // ... (existing implementation)
            setSyncingIds(prev => new Set(prev).add(save.id));

            // Check if it's actually a local save we can read
            const { data: fullState } = await IDB.loadGameFull(save.id);
            if (fullState) {
                console.log(`Auto-syncing save ${save.id} to cloud...`);
                // Upload using Local Timestamp
                const { error } = await Cloud.saveGame(fullState, save.id, user.id, save.created_at);
                if (!error) {
                    await IDB.updateCloudSyncStatus(save.id, true);
                    const currentSave = saves.find(s => s.id === save.id);
                    await IDB.addCloudSaveToCache({ 
                        ...save, 
                        is_cloud_synced: true,
                        user_id: user.id, // Critical: Ensure cache has user_id so it passes filter
                        // Ensure we keep existing metadata if available, or fallback
                        created_at: currentSave?.created_at || save.created_at,
                        summary: currentSave?.summary || save.summary,
                        turn_count: currentSave?.turn_count || save.turn_count,
                        background_thumbnail: currentSave?.background_thumbnail || save.background_thumbnail
                    });
                    
                    // Update UI state locally to reflect sync
                    setSaves(prev => prev.map(s => s.id === save.id ? { ...s, is_cloud_synced: true } : s));
                    await mirrorLocalMemoriesToCloud(save.id);
                }
            }
            
            // Remove from syncing
            setSyncingIds(prev => {
                const next = new Set(prev);
                next.delete(save.id);
                return next;
            });
        }
    };

  const handleMemoryUpdates = async (overwriteId: string | undefined, savedId: string | undefined, currentSaveId: string | undefined) => {
    if (overwriteId && overwriteId !== currentSaveId) {
      const { error: purgeError } = await Cloud.deleteMemoriesByTimelineId(overwriteId);
      if (purgeError) console.error("Failed to delete memories for overwritten save", purgeError);
      const { error: purgeLocalError } = await IDB.deleteLocalMemoriesByTimelineId(overwriteId);
      if (purgeLocalError) console.error("Failed to delete local memories for overwritten save", purgeLocalError);
    }

    // --- Memory Duplication Logic ---
    // If we created a NEW save (overwriteId is undefined), and the previous game state had a saveId (timelineId),
    // we need to copy the memories from the old timeline to the new timeline.
    if (!overwriteId && currentSaveId && savedId && savedId !== currentSaveId) {
      // It's a "Save As" / Branching operation
      console.log(`[SaveLoadModal] Detected branching save. Duplicating memories from ${currentSaveId} to ${savedId}...`);
      // We do this asynchronously to not block UI
      Cloud.duplicateMemories(currentSaveId, savedId).then(({ error }) => {
        if (error) console.error("Failed to duplicate memories for new save", error);
        else console.log("Memories duplicated successfully.");
      });
      IDB.duplicateLocalMemories(currentSaveId, savedId).then(({ error }) => {
        if (error) console.error("Failed to duplicate local memories for new save", error);
      });
    }
  };

  const executeSave = async (overwriteId?: string) => {
    if (!currentGameState) return;
    setLoading(true);
    setError(null);
    
    // Check if this is a "Save As New" operation (no overwriteId)
    // If so, we are creating a NEW timeline ID (generated by IDB.saveGame or similar)
    // But wait, IDB.saveGame generates a new UUID if ID is missing.
    // The currentGameState.saveId might be the OLD one.
    
    // 1. Save to IDB
    const { data: savedData, error } = await IDB.saveGame(currentGameState, overwriteId);
    
    if (error) {
      if ((error as any).code === ERROR_CODES.SAVE_LIMIT_REACHED || error.message === 'SAVE_LIMIT_REACHED') {
          setLimitAlertOpen(true);
      } else {
          setError(t('save_load.save_error') + ': ' + error.message);
      }
    } else {
      // Notify parent of the save ID
      if (savedData && savedData.id && onSaveComplete) {
          onSaveComplete(savedData.id);
      }

      await handleMemoryUpdates(overwriteId, savedData?.id, currentGameState.saveId);
      if (savedData && savedData.id) {
        const { payload, error: flushError } = await flushStagedRagMemoriesToTimeline(currentGameState.saveId, savedData.id);
        if (flushError) console.error("Failed to flush staged memories to local store", flushError);
      }

      // 2. If logged in, Auto-Sync to Cloud
      if (user && savedData && savedData.id) {
          // Trigger background sync for this specific save
          // We construct a temporary metadata object to pass to syncLocalToCloud
          const newSaveMeta: SaveGameMetadata = {
              id: savedData.id,
              created_at: savedData.created_at,
              summary: savedData.summary,
              turn_count: savedData.turn_count,
              background_thumbnail: savedData.background_thumbnail,
              is_cloud_synced: false
          };
          syncLocalToCloud([newSaveMeta]);
      }
      await fetchSaves();
    }
    setLoading(false);
  };

  const executeDelete = async (id: string) => {
    setLoading(true);
    
    // Delete from both if possible
    await IDB.deleteSaveGame(id);
    if (user) {
        await Cloud.deleteSaveGame(id);
        // Also remove from local cloud cache to prevent "Ghost" saves appearing before next sync
        await IDB.removeCloudSaveFromCache(id);
    }

    await fetchSaves();
    setLoading(false);
  };

  const handleSaveClick = (id?: string) => {
      if (id) {
          // Overwrite needs confirmation
          setTargetId(id);
          setConfirmAction('overwrite');
          setConfirmOpen(true);
      } else {
          // New save, no confirmation needed
          executeSave();
      }
  };

  const handleDeleteClick = (id: string) => {
      setTargetId(id);
      setConfirmAction('delete');
      setConfirmOpen(true);
  };

  const handleConfirmAction = () => {
      if (confirmAction === 'overwrite' && targetId) {
          executeSave(targetId);
      } else if (confirmAction === 'delete' && targetId) {
          executeDelete(targetId);
      }
      setConfirmOpen(false);
      setTargetId(null);
      setConfirmAction(null);
  };

  const handleLoad = async (save: SaveGameMetadata) => {
    setLoading(true);
    
    // 1. Try Local Load
    const { data: localData, error: localError } = await IDB.loadGameFull(save.id);
    
    if (localData && !localError) {
        // Found locally, just load
        // Ensure saveId is injected into GameState
        onLoadGame({ ...localData, saveId: save.id });
        setLoading(false);
        onClose();
        return;
    }

    // 2. If missing locally or error, Try Cloud Load (if logged in or just try anyway)
    // Even if not logged in, maybe we have it in cloud cache? No, Cloud service requires auth for RLS mostly.
    // But if it's in the list, it implies we know about it.
    
    // If we are logged in, try fetching from cloud
    if (user) {
        console.log("Local load failed, trying cloud fallback...");
        const { data: cloudData, error: cloudError } = await downloadCloudSaveToLocal(save.id, save.created_at);
        
        if (cloudData && !cloudError) {
            setError(t('save_load.download_success')); 
            // Ensure saveId is injected into GameState
            onLoadGame({ ...cloudData, saveId: save.id });
            setLoading(false);
            onClose();
            return;
        } else {
             setError(t('save_load.load_error') + ': ' + (cloudError?.message || localError?.message || 'Data missing'));
        }
    } else {
         setError(t('save_load.load_error') + ': ' + (localError?.message || 'Data missing locally'));
    }

    setLoading(false);
  };
  
  const handleSync = async (id: string) => {
      if (!user) {
          setError("Please login to Cloud Storage first");
          setActiveTab('cloud'); // Switch to cloud tab to show login button
          return;
      }

      setLoading(true);
      const { data: fullState, error: loadError } = await IDB.loadGameFull(id);
      if (loadError || !fullState) {
          setError(t('save_load.load_error'));
          setLoading(false);
          return;
      }
      
      const { error: saveError } = await Cloud.saveGame(fullState, id, user.id);
      if (saveError) {
          setError(t('save_load.sync_error') + ': ' + saveError.message);
      } else {
          await IDB.updateCloudSyncStatus(id, true);
          const currentSave = saves.find(s => s.id === id);
           await IDB.addCloudSaveToCache({ 
               id, 
               created_at: currentSave?.created_at || new Date().toISOString(), 
               summary: currentSave?.summary || 'Synced Game', 
               turn_count: fullState.turnCount, 
               background_thumbnail: currentSave?.background_thumbnail || (fullState.backgroundImage || undefined),
               is_cloud_synced: true 
           });
          
          setError(t('save_load.synced_success'));
          setSaves(prev => prev.map(s => s.id === id ? { ...s, is_cloud_synced: true } : s));
          await mirrorLocalMemoriesToCloud(id);
          setTimeout(() => setError(null), 2000);
      }
      setLoading(false);
  };

  if (!isOpen) return null;

  const isInGame = currentGameState?.status === GameStatus.PLAYING;
  const accentClasses = {
    border: isInGame ? 'border-scp-term' : 'border-scp-accent',
    borderSoft: isInGame ? 'border-scp-term/60' : 'border-scp-accent/50',
    text: isInGame ? 'text-scp-term' : 'text-scp-accent',
    bg: isInGame ? 'bg-scp-term' : 'bg-scp-accent',
    hoverBorder: isInGame ? 'hover:border-scp-term' : 'hover:border-scp-accent',
    hoverBorderSoft: isInGame ? 'hover:border-scp-term/60' : 'hover:border-scp-accent/50',
    hoverBg: isInGame ? 'hover:bg-scp-term' : 'hover:bg-scp-accent',
    hoverText: isInGame ? 'hover:text-black' : 'hover:text-white',
    hoverIndicator: isInGame ? 'group-hover/btn:text-scp-term' : 'group-hover/btn:text-scp-accent',
    borderTop: isInGame ? 'border-t-scp-term' : 'border-t-scp-accent'
  };

  const content = (
    <>
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-mono scp-ui">
      <CrtSurface className={`scp-window border-y sm:border ${accentClasses.borderSoft} w-full max-w-3xl shadow-2xl flex flex-col ${isMobile ? 'h-[90dvh] rounded-md' : 'h-[100dvh] sm:h-auto sm:max-h-[85vh]'} relative overflow-hidden group/modal z-10`}>
        
        {/* Header with Login */}
        <div className="bg-black h-14 w-full flex items-center justify-between px-3 sm:px-6 border-b border-scp-gray relative z-20 shrink-0 gap-2 scp-window-header">
           <div className="flex items-center gap-3 min-w-0">
             <div className="flex gap-1 shrink-0">
                <div className={`w-3 h-3 ${accentClasses.bg} rounded-full animate-pulse`}></div>
                <div className="w-3 h-3 border border-scp-gray rounded-full"></div>
                <div className="w-3 h-3 border border-scp-gray rounded-full"></div>
             </div>
             <div className="flex flex-col justify-center min-w-0">
                <span className="font-report text-lg sm:text-2xl tracking-widest text-scp-text uppercase shadow-black drop-shadow-md text-shadow-sm leading-none whitespace-nowrap truncate">
                  {mode === 'save' ? 'SAVE GAME' : 'LOAD GAME'}
                </span>
             </div>
           </div>

           <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Login/User Status Area - Hidden in AI Studio (Sandbox) */}
              {!isAIStudio && (
                  user ? (
                      <div className="flex items-center gap-1 sm:gap-2">
                          <div className="flex flex-col items-end hidden xs:flex">
                              <span className="text-xs text-scp-text font-mono max-w-[80px] sm:max-w-[150px] truncate" title={user.email}>{user.email}</span>
                          </div>
                          
                          <button 
                            onClick={handleManualRefresh}
                            className="text-gray-400 hover:text-white border border-gray-500 hover:border-white p-1.5 transition-colors"
                            title={t('save_load.refresh_cloud') || "Refresh Cloud Saves"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
                            </svg>
                          </button>

                          <button 
                            onClick={handleLogout}
                            className="text-gray-400 hover:text-white border border-gray-500 hover:border-white p-1.5 transition-colors"
                            title="Logout"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                              </svg>
                          </button>
                      </div>
                  ) : (
                    <div className="relative group/login-btn">
                      <button 
                        onClick={handleLogin}
                        className={`text-xs uppercase px-3 py-1 font-bold transition-colors flex items-center gap-2 bg-scp-dark ${accentClasses.border} ${accentClasses.text} ${accentClasses.hoverBg} ${accentClasses.hoverText}`}
                      >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                          <span className="font-mono tracking-wider">LOGIN</span>
                      </button>
                    </div>
                  )
              )}

              {isAIStudio && (
                   <div className="text-[10px] text-green-300 font-mono border border-green-500/30 bg-green-900/10 px-2 py-1 rounded">
                        {t('save_load.aistudio_sandbox_mode') || "Sandbox Mode: Shared Cloud Storage"}
                   </div>
              )}

              <button 
                onClick={onClose} 
                className="text-gray-400 hover:text-white transition-colors text-2xl border border-gray-600/50 hover:border-white rounded-sm w-8 h-8 flex items-center justify-center ml-2"
              >
                ×
              </button>
           </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar relative z-10 bg-black">

          {loading && (
             <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                <div className={`w-12 h-12 border-2 border-scp-gray ${accentClasses.borderTop} rounded-full animate-spin mb-4`}></div>
                <div className="font-mono text-scp-text text-sm tracking-widest animate-pulse">{t('save_load.loading')}</div>
             </div>
          )}

          {!loading && saves.length === 0 && (
            <div className="text-center font-mono text-scp-gray/50 py-20 flex flex-col items-center gap-4 border border-scp-gray/10 border-dashed">
              <div className="text-6xl opacity-20 font-thin">∅</div>
              <p className="tracking-widest uppercase">{t('save_load.no_saves')}</p>
            </div>
          )}

          <div className="space-y-3">
            {mode === 'save' && activeTab === 'local' && (
              <button
                onClick={() => handleSaveClick()}
                disabled={loading}
                className={`w-full p-4 border border-dashed border-scp-gray ${accentClasses.hoverBorder} hover:bg-scp-gray/10 text-scp-text/60 hover:text-scp-text font-mono transition-all flex items-center justify-between group/btn`}
              >
                <span className="flex items-center gap-4">
                    <span className={`text-2xl ${accentClasses.hoverIndicator} transition-colors`}>+</span>
                    <div className="flex flex-col items-start">
                        <span className="tracking-widest text-lg uppercase font-bold font-report shadow-black drop-shadow-md text-shadow-sm leading-none">{t('save_load.create_new')}</span>
                    </div>
                </span>
              </button>
            )}

            {saves.map((save, index) => (
              <div key={save.id} className={`group relative bg-scp-gray/10 border border-scp-gray/30 ${accentClasses.hoverBorderSoft} transition-all duration-200 hover:bg-scp-gray/20`}>
                {/* Selection Indicator */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentClasses.bg} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                
                <div className="p-3 flex gap-3 relative z-10">
                  {/* Index Number */}
                  <div className="hidden sm:flex flex-col justify-center items-center w-6 text-scp-text/30 font-bold text-lg border-r border-scp-gray/20 mr-1 shrink-0">
                      {String(index + 1).padStart(2, '0')}
                  </div>

                  {/* Thumbnail with retro border */}
                  {save.background_thumbnail && (
                    <div className="w-32 h-20 shrink-0 border border-scp-gray/50 relative overflow-hidden bg-black group-hover:border-scp-text transition-colors">
                        <img 
                            src={save.background_thumbnail} 
                            alt="Thumbnail" 
                            className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                        />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                     <div 
                        className="font-mono text-scp-text text-sm tracking-wide font-bold flex items-start gap-2 whitespace-normal break-words line-clamp-2"
                        title={save.summary}
                     >
                       <span className={`opacity-50 ${accentClasses.text} shrink-0`}>ID:</span>
                       <span>{save.summary ? save.summary : 'UNKNOWN_DATA_FRAGMENT'}</span>
                     </div>
                     
                     <div className="flex items-center gap-4 text-[10px] font-mono text-scp-text/60 uppercase tracking-wider">
                        <span>{new Date(save.created_at).toLocaleDateString(locale)}</span>
                        <span>{new Date(save.created_at).toLocaleTimeString(locale)}</span>
                     </div>

                     <div className="flex gap-3 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        {/* Load Button */}
                        {(mode === 'load' || activeTab === 'cloud') && (
                          <button
                            onClick={() => handleLoad(save)}
                            className={`text-xs uppercase px-3 py-1 ${accentClasses.hoverText} ${accentClasses.hoverBg} border ${accentClasses.borderSoft} transition-colors`}
                          >
                            {activeTab === 'cloud' ? t('save_load.load_cloud_saves') : t('save_load.load_btn')}
                          </button>
                        )}
                        
                        {/* Overwrite Button (Local only, Save mode) */}
                        {mode === 'save' && activeTab === 'local' && (
                          <button
                            onClick={() => handleSaveClick(save.id)}
                            className={`text-xs uppercase px-3 py-1 ${accentClasses.hoverText} ${accentClasses.hoverBg} border ${accentClasses.borderSoft} transition-colors`}
                          >
                            {t('save_load.overwrite')}
                          </button>
                        )}
                        
                        {/* Sync Status / Button */}
                        {activeTab === 'local' && user && (
                            syncingIds.has(save.id) ? (
                                <div className="text-[10px] text-blue-400 uppercase tracking-wider flex items-center px-2 py-1 border border-blue-900/30 bg-blue-900/10 select-none gap-2">
                                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                    </svg>
                                    SYNCING
                                </div>
                            ) : save.is_cloud_synced ? (
                                <div className="group/tooltip relative">
                                    <div className="text-blue-400 flex items-center justify-center w-8 h-[26px] border border-blue-900/30 bg-blue-900/10 select-none cursor-help">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
                                        </svg>
                                    </div>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black border border-scp-gray text-[10px] text-scp-text whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
                                        {t('save_load.synced_success')}
                                    </div>
                                </div>
                            ) : (
                                <div className="group/tooltip relative">
                                    <button
                                        onClick={() => handleSync(save.id)}
                                        className="text-scp-text hover:text-white hover:bg-blue-900/30 text-xs uppercase w-8 h-[26px] flex items-center justify-center border border-blue-500/30 hover:border-blue-400 transition-colors"
                                        aria-label={t('save_load.sync_to_cloud')}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="17 8 12 3 7 8"/>
                                            <line x1="12" x2="12" y1="3" y2="15"/>
                                        </svg>
                                    </button>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black border border-scp-gray text-[10px] text-scp-text whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
                                        {t('save_load.sync_to_cloud')}
                                    </div>
                                </div>
                            )
                        )}

                        <button
                          onClick={() => handleDeleteClick(save.id)}
                          className={`text-xs uppercase px-3 py-1 ${accentClasses.hoverText} ${accentClasses.hoverBg} border ${accentClasses.borderSoft} transition-colors ml-auto`}
                        >
                          {t('save_load.delete')}
                        </button>
                     </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CrtSurface>
    </div>

    <ConfirmationModal
        isOpen={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmAction}
        title={confirmAction === 'overwrite' ? t('save_load.overwrite') : t('save_load.delete')}
        message={confirmAction === 'overwrite' ? t('save_load.confirm_overwrite') : t('save_load.confirm_delete')}
    />

    <ConfirmationModal
        isOpen={limitAlertOpen}
        onCancel={() => setLimitAlertOpen(false)}
        onConfirm={() => setLimitAlertOpen(false)}
        title={t('save_load.limit_reached_title')}
        message={t('save_load.limit_reached_message')}
        confirmText={t('save_load.understand')}
        singleButton={true}
    />
    </>
  );

  return createPortal(content, document.body) as ReactNode;
};

export default SaveLoadModal;
