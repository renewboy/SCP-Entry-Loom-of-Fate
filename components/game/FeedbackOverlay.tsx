import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { GameState, GameStatus } from '../../types';
import { useTranslation } from '../../utils/i18n';

interface FeedbackOverlayProps {
  gameState: GameState;
}

const NOTICE_MS = 2000;

const FeedbackOverlay: React.FC<FeedbackOverlayProps> = ({ gameState }) => {
  const { t } = useTranslation();
  const previousStatus = useRef(gameState.status);
  const [isSavedNoticeVisible, setSavedNoticeVisible] = useState(false);

  useEffect(() => {
    const leftEditor = previousStatus.current === GameStatus.STORY_EDITOR
      && (gameState.status === GameStatus.TACTICAL_PREVIEW || gameState.status === GameStatus.IDLE);
    previousStatus.current = gameState.status;
    if (!leftEditor) return;
    setSavedNoticeVisible(true);
    const timer = setTimeout(() => setSavedNoticeVisible(false), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [gameState.status]);

  if (!isSavedNoticeVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[150] overflow-hidden flex flex-col items-center justify-start pt-24 scp-ui">
      <div className="w-full max-w-md bg-black/80 border-l-4 border-l-scp-alert text-scp-alert/80 p-4 shadow-lg backdrop-blur-md animate-in slide-in-from-top-4 fade-in flex justify-between items-start">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest opacity-70 mb-1">[SYSTEM] {t('game.system_msg')}</div>
          <div className="text-sm font-bold font-mono tracking-wider">{t('map_editor.auto_saved')}</div>
        </div>
        <CheckCircle2 className="w-5 h-5 opacity-50" />
      </div>
    </div>
  );
};

export default FeedbackOverlay;
