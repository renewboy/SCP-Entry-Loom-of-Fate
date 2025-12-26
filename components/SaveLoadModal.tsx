
import React, { useEffect, useState } from 'react';
import { useTranslation } from '../utils/i18n';
import { SaveGameMetadata, saveGame, loadGames, loadGameFull, deleteSaveGame } from '../services/supabaseService';
import { GameState } from '../types';
import ConfirmationModal from './ConfirmationModal';

interface SaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'save' | 'load';
  currentGameState?: GameState;
  onLoadGame: (gameState: GameState) => void;
}

const SaveLoadModal: React.FC<SaveLoadModalProps> = ({ isOpen, onClose, mode, currentGameState, onLoadGame }) => {
  const { t } = useTranslation();
  const [saves, setSaves] = useState<SaveGameMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Confirmation Modal State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'overwrite' | 'delete' | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSaves();
    }
  }, [isOpen]);

  const fetchSaves = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await loadGames();
    if (error) {
      setError(t('save_load.load_error') + ': ' + error.message);
    } else {
      setSaves(data || []);
    }
    setLoading(false);
  };

  const executeSave = async (overwriteId?: string) => {
    if (!currentGameState) return;
    setLoading(true);
    setError(null);
    const { error } = await saveGame(currentGameState, overwriteId);
    if (error) {
      setError(t('save_load.save_error') + ': ' + error.message);
    } else {
      // Refresh list
      await fetchSaves();
    }
    setLoading(false);
  };

  const executeDelete = async (id: string) => {
    setLoading(true);
    const { error } = await deleteSaveGame(id);
    if (error) {
      setError(t('save_load.delete_error') + ': ' + error.message);
    } else {
      await fetchSaves();
    }
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
    const { data: fullState, error } = await loadGameFull(save.id);
    if (error || !fullState) {
        setError(t('save_load.load_error') + ': ' + (error?.message || 'Data missing'));
        setLoading(false);
        return;
    }
    onLoadGame(fullState);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-mono">
      {/* CRT Scanline Effect Overlay - Red tint for accent */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 0, 0, 0.02), rgba(0, 0, 255, 0.06))',
          backgroundSize: '100% 2px, 3px 100%'
      }}></div>

      <div className="bg-black border border-scp-accent/50 w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden group/modal z-10">
        
        {/* Terminal Header */}
        <div className="bg-black h-14 w-full flex items-center justify-between px-6 border-b border-scp-gray relative z-10">
           <div className="flex items-center gap-4">
             <div className="flex gap-1">
                <div className="w-3 h-3 bg-scp-accent rounded-full animate-pulse"></div>
                <div className="w-3 h-3 border border-scp-gray rounded-full"></div>
                <div className="w-3 h-3 border border-scp-gray rounded-full"></div>
             </div>
             <div className="flex flex-col justify-center">
                <span className="font-report text-2xl tracking-widest text-scp-text uppercase shadow-black drop-shadow-md text-shadow-sm leading-none">
                  {mode === 'save' ? 'SAVE GAME' : 'LOAD GAME'}
                </span>
             </div>
           </div>
           <button 
             onClick={onClose} 
             className="text-gray-400 hover:text-white transition-colors text-2xl border border-gray-600/50 hover:border-white rounded-sm w-8 h-8 flex items-center justify-center"
           >
             ×
           </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar relative z-10 bg-black">
          {error && (
            <div className="mb-6 p-4 border border-scp-accent bg-scp-accent/10 text-scp-accent font-mono text-sm flex flex-col gap-2">
              <div className="font-bold border-b border-scp-accent/30 pb-1">&gt;&gt; SYSTEM ERROR &lt;&lt;</div>
              <div>{error}</div>
            </div>
          )}

          {loading && (
             <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                <div className="w-12 h-12 border-2 border-scp-gray border-t-scp-accent rounded-full animate-spin mb-4"></div>
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
            {mode === 'save' && (
              <button
                onClick={() => handleSaveClick()}
                disabled={loading}
                className="w-full p-4 border border-dashed border-scp-gray hover:border-scp-accent hover:bg-scp-gray/10 text-scp-text/60 hover:text-scp-text font-mono transition-all flex items-center justify-between group/btn"
              >
                <span className="flex items-center gap-4">
                    <span className="text-2xl group-hover/btn:text-scp-accent transition-colors">+</span>
                    <div className="flex flex-col items-start">
                        <span className="tracking-widest text-lg uppercase font-bold font-report shadow-black drop-shadow-md text-shadow-sm leading-none">{t('save_load.create_new')}</span>
                    </div>
                </span>
              </button>
            )}

            {saves.map((save, index) => (
              <div key={save.id} className="group relative bg-scp-gray/10 border border-scp-gray/30 hover:border-scp-accent/50 transition-all duration-200 hover:bg-scp-gray/20">
                {/* Selection Indicator */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-scp-accent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="p-3 flex gap-4 relative z-10">
                  {/* Index Number */}
                  <div className="hidden sm:flex flex-col justify-center items-center w-8 text-scp-text/30 font-bold text-xl border-r border-scp-gray/20 mr-2">
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

                  <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                     <div className="font-mono text-scp-text text-sm tracking-wide font-bold truncate">
                       <span className="opacity-50 mr-2 text-scp-accent">ID:</span>
                       {save.summary ? save.summary : 'UNKNOWN_DATA_FRAGMENT'}
                     </div>
                     
                     <div className="flex items-center gap-4 text-[10px] font-mono text-scp-text/60 uppercase tracking-wider">
                        <span>{new Date(save.created_at).toLocaleDateString()}</span>
                        <span>{new Date(save.created_at).toLocaleTimeString()}</span>
                     </div>

                     <div className="flex gap-3 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        {mode === 'load' && (
                          <button
                            onClick={() => handleLoad(save)}
                            className="text-scp-text hover:text-white text-xs uppercase px-3 py-1 border border-scp-gray hover:border-scp-text transition-colors bg-scp-gray/20"
                          >
                            {t('save_load.load_btn')}
                          </button>
                        )}
                        {mode === 'save' && (
                          <button
                            onClick={() => handleSaveClick(save.id)}
                            className="text-scp-accent hover:text-white hover:bg-scp-accent text-xs uppercase px-3 py-1 border border-scp-accent/50 transition-colors"
                          >
                            {t('save_load.overwrite')}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteClick(save.id)}
                          className="text-scp-accent hover:text-white hover:bg-scp-accent text-xs uppercase px-3 py-1 border border-scp-accent/50 transition-colors ml-auto"
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
      </div>
    </div>

    <ConfirmationModal
        isOpen={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmAction}
        title={confirmAction === 'overwrite' ? t('save_load.overwrite') : t('save_load.delete')}
        message={confirmAction === 'overwrite' ? t('save_load.confirm_overwrite') : t('save_load.confirm_delete')}
    />
    </>
  );
};

export default SaveLoadModal;
