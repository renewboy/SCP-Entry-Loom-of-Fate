
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-scp-dark border-2 border-scp-term w-full max-w-2xl shadow-[0_0_30px_rgba(51,255,0,0.2)] flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="bg-scp-term/20 h-10 w-full flex items-center justify-between px-4 border-b border-scp-term">
           <span className="font-mono text-scp-term font-bold tracking-widest uppercase">
             {mode === 'save' ? t('save_load.save') : t('save_load.load')}
           </span>
           <button onClick={onClose} className="text-scp-term hover:text-white font-mono text-xl">×</button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar relative">
          {error && (
            <div className="mb-4 p-2 border border-red-500 bg-red-500/10 text-red-500 font-mono text-xs">
              {error}
            </div>
          )}

          {loading && (
             <div className="absolute inset-0 bg-black/50 z-10 flex flex-col items-center justify-center backdrop-blur-sm">
                <div className="w-12 h-12 border-4 border-scp-term border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(51,255,0,0.5)] mb-2"></div>
                <div className="font-mono text-scp-term animate-pulse text-shadow-green">{t('save_load.loading')}</div>
             </div>
          )}

          {!loading && saves.length === 0 && (
            <div className="text-center font-mono text-gray-500 py-8">{t('save_load.no_saves')}</div>
          )}

          <div className="space-y-3">
            {mode === 'save' && (
              <button
                onClick={() => handleSaveClick()}
                disabled={loading}
                className="w-full p-4 border border-dashed border-scp-term/50 hover:border-scp-term hover:bg-scp-term/10 text-scp-term font-mono transition-all flex items-center justify-center gap-2 group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">+</span>
                <span>{t('save_load.create_new')}</span>
              </button>
            )}

            {saves.map((save) => (
              <div key={save.id} className="p-4 border border-scp-gray/30 bg-black/40 hover:border-scp-term transition-colors flex justify-between items-center group">
                <div className="flex-1">
                  <div className="font-mono text-scp-term text-sm mb-1">{save.summary || 'Unknown Save'}</div>
                  <div className="font-mono text-gray-500 text-xs">
                    {new Date(save.created_at).toLocaleString()} • {t('save_load.turn')} {save.turn_count ?? '?'}
                  </div>
                </div>
                <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                  {mode === 'load' && (
                    <button
                      onClick={() => handleLoad(save)}
                      className="px-3 py-1 bg-scp-term/20 border border-scp-term text-scp-term hover:bg-scp-term hover:text-black font-mono text-xs transition-colors"
                    >
                      {t('save_load.load_btn')}
                    </button>
                  )}
                  {mode === 'save' && (
                    <button
                      onClick={() => handleSaveClick(save.id)}
                      className="px-3 py-1 bg-yellow-500/20 border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black font-mono text-xs transition-colors"
                    >
                      {t('save_load.overwrite')}
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteClick(save.id)}
                    className="px-3 py-1 border border-red-900 text-red-700 hover:bg-red-900/20 hover:text-red-500 font-mono text-xs transition-colors"
                  >
                    {t('save_load.delete')}
                  </button>
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
