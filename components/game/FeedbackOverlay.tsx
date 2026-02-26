import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, MapPin, Unlock } from 'lucide-react';
import { GameState, GameStatus } from '../../types';
import { playSfx } from '../../services/sfxService';
import { useTranslation } from '../../utils/i18n';

interface FeedbackOverlayProps {
  gameState: GameState;
}

interface Notification {
  id: string;
  type: 'UNLOCK' | 'OBJECTIVE' | 'OBJECTIVE_ADD' | 'OBJECTIVE_DELETE' | 'OBJECTIVE_FAIL' | 'LOCATION' | 'SYSTEM' | 'NPC_MOVE';
  message: string;
  subMessage?: string;
  timestamp: number;
  durationMs: number;
}

const FeedbackOverlay: React.FC<FeedbackOverlayProps> = ({ gameState }) => {
  const { t } = useTranslation();
  const prevGameStateRef = useRef<GameState | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [locationScanActive, setLocationScanActive] = useState(false);
  const [scanLocationName, setScanLocationName] = useState('');

  // Helper to add notification
  const addNotification = (type: Notification['type'], message: string, subMessage?: string, durationMs: number = 4000) => {
    const id = Date.now().toString() + Math.random().toString();
    setNotifications(prev => [...prev, { id, type, message, subMessage, timestamp: Date.now(), durationMs }]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, durationMs);
  };

  useEffect(() => {
    if (!prevGameStateRef.current) {
      prevGameStateRef.current = gameState;
      return;
    }

    const prev = prevGameStateRef.current;
    const curr = gameState;

    if (prev.status === GameStatus.STORY_EDITOR && (curr.status === GameStatus.TACTICAL_PREVIEW || curr.status === GameStatus.IDLE)) {
      addNotification('SYSTEM', t('map_editor.auto_saved'), undefined, 2000);
    }

    // 1. Check Location Change
    if (curr.map?.currentNodeId && prev.map?.currentNodeId !== curr.map.currentNodeId) {
      const node = curr.scpData?.mapBlueprint?.nodes.find(n => n.id === curr.map?.currentNodeId);
      const locationName = node?.name || curr.map.currentNodeId;
      
      setLocationScanActive(true);
      setScanLocationName(locationName);
      playSfx('footstep'); // Or a specific 'scan' sound if available
      
      setTimeout(() => setLocationScanActive(false), 2000);
    }
    
    if (curr.npcs && prev.npcs) {
      const encountered = new Set(curr.encounteredNpcIds || []);
      curr.npcs.forEach(npc => {
        const prevNpc = prev.npcs?.find(p => p.id === npc.id);
        if (!prevNpc) return;
        if (prevNpc.nodeId !== npc.nodeId) {
          const node = curr.scpData?.mapBlueprint?.nodes.find(n => n.id === npc.nodeId);
          const locationName = node?.name || npc.nodeId;
          const displayName = encountered.has(npc.id) ? npc.name : t('npc_panel.masked');
          const displayLocation = encountered.has(npc.id) ? locationName : t('npc_panel.masked');
          addNotification('NPC_MOVE', t('game.npc_move', { name: displayName, location: displayLocation }));
        }
      });
    }

    if (curr.objectives) {
      curr.objectives.forEach(obj => {
        const prevObj = prev.objectives?.find(p => p.id === obj.id);
        if (prevObj && prevObj.status !== 'COMPLETED' && obj.status === 'COMPLETED') {
          addNotification('OBJECTIVE', t('game.objective_completed'), obj.title);
          playSfx('objectiveComplete');
        }
        if (prevObj && prevObj.status !== 'FAILED' && obj.status === 'FAILED') {
          addNotification('OBJECTIVE_FAIL', t('game.objective_failed'), obj.title);
          playSfx('glitch');
        }
      });
    }

    if (curr.objectives) {
      const prevIds = new Set((prev.objectives || []).map(o => o.id));
      curr.objectives.forEach(obj => {
        if (!prevIds.has(obj.id)) {
          addNotification('OBJECTIVE_ADD', t('game.objective_added'), obj.title);
          playSfx('objectiveComplete');
        }
      });
    }

    if (prev.objectives && curr.status === GameStatus.PLAYING) {
      const currIds = new Set((curr.objectives || []).map(o => o.id));
      prev.objectives.forEach(obj => {
        if (!currIds.has(obj.id)) {
          addNotification('OBJECTIVE_DELETE', t('game.objective_deleted'), obj.title);
          playSfx('glitch');
        }
      });
    }

    // 3. Check Unlock (Neighbor unblocked)
    if (curr.map && prev.map && curr.scpData?.mapBlueprint) {
        // Logic: Compare accessible neighbors for the CURRENT node (or previous node if we didn't move)
        // Actually, unlocks usually happen when we are at a location and get a key.
        // So we check if any neighbor of the current node became unblocked.
        
        const currentNodeId = curr.map.currentNodeId;
        const blueprint = curr.scpData.mapBlueprint;
        
        const isBlocked = (targetNodeId: string, inventory: any[]) => {
             const node = blueprint.nodes.find(n => n.id === targetNodeId);
             if (!node) return false;
             
             const inventoryIds = new Set(inventory.map((i: any) => i.id));
             const inventoryTags = new Set(inventory.flatMap((i: any) => i.tags || []));
             const hasToken = (token: string) => inventoryIds.has(token) || inventoryTags.has(token);
             
             const req = Array.isArray(node.requires) ? node.requires : [];
             const missing = req.filter(token => !hasToken(token));
             return missing.length > 0;
        };

        // Find all neighbors
        const neighbors = blueprint.edges
            .filter(e => e.from === currentNodeId || (e.bidirectional && e.to === currentNodeId))
            .map(e => e.from === currentNodeId ? e.to : e.from);

        neighbors.forEach(neighborId => {
            const wasBlocked = isBlocked(neighborId, prev.inventory || []);
            const isNowBlocked = isBlocked(neighborId, curr.inventory || []);

            if (wasBlocked && !isNowBlocked) {
                const neighborNode = blueprint.nodes.find(n => n.id === neighborId);
                const name = neighborNode?.name || neighborId;
                addNotification('UNLOCK', t('game.access_granted'), `>> ${name}`);
                playSfx('doorUnlock');
            }
        });
    }

    prevGameStateRef.current = curr;
  }, [gameState, t]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[150] overflow-hidden flex flex-col items-center justify-start pt-24 scp-ui">
      
      {/* Location Scan Effect */}
      {locationScanActive && (
        <div className="absolute inset-0 z-[140] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-500 animate-in fade-in scp-ui">
           <div className="w-full h-[2px] bg-scp-term/50 absolute top-1/2 -translate-y-1/2 animate-[scan-line_2s_ease-in-out]"></div>
           <div className="text-center">
              <div className="text-scp-term text-xs font-mono tracking-[0.5em] uppercase mb-2 animate-pulse">{t('game.entering_zone')}</div>
              <div className="text-scp-text text-3xl font-report uppercase tracking-widest border-y border-scp-term/30 py-4 px-12 bg-black/60 shadow-[0_0_30px_rgba(52,211,153,0.1)]">
                 {scanLocationName}
              </div>
           </div>
        </div>
      )}

      {/* Notifications Queue */}
      <div className="flex flex-col gap-2 w-full max-w-md items-center">
        {notifications.map(notif => (
          <div 
            key={notif.id}
            className={`
              relative overflow-hidden w-full bg-black/80 border-l-4 p-4 shadow-lg backdrop-blur-md transition-all duration-500 animate-in slide-in-from-top-4 fade-in scp-term_fix
              ${notif.type === 'UNLOCK' ? 'border-l-scp-term_fix text-scp-term_fix' : ''}
              ${notif.type === 'OBJECTIVE' ? 'border-l-amber-500 text-amber-400' : ''}
              ${notif.type === 'OBJECTIVE_ADD' ? 'border-l-emerald-500 text-emerald-400' : ''}
              ${notif.type === 'OBJECTIVE_DELETE' ? 'border-l-slate-500 text-slate-300' : ''}
              ${notif.type === 'OBJECTIVE_FAIL' ? 'border-l-red-600 text-red-400' : ''}
              ${notif.type === 'LOCATION' ? 'border-l-sky-500 text-sky-400' : ''}
              ${notif.type === 'SYSTEM' ? 'border-l-scp-alert text-scp-alert/80' : ''}
              ${notif.type === 'NPC_MOVE' ? 'border-l-scp-term text-scp-term' : ''}
            `}
          >
             <div className="flex justify-between items-start">
                <div>
                   <div className="text-[10px] font-mono uppercase tracking-widest opacity-70 mb-1">
                      [{notif.type}] {t('game.system_msg')}
                   </div>
                   <div className="text-sm font-bold font-mono tracking-wider">
                      {notif.message}
                   </div>
                   {notif.subMessage && (
                       <div className="text-xs font-mono mt-1 opacity-90">
                           {notif.subMessage}
                       </div>
                   )}
                </div>
                {/* Icon placeholder based on type */}
                <div className="opacity-50">
                    {notif.type === 'UNLOCK' && <Unlock className="w-5 h-5" />}
                    {notif.type === 'OBJECTIVE' && <CheckCircle2 className="w-5 h-5" />}
                    {notif.type === 'OBJECTIVE_ADD' && <CheckCircle2 className="w-5 h-5" />}
                    {notif.type === 'OBJECTIVE_DELETE' && <CheckCircle2 className="w-5 h-5" />}
                    {notif.type === 'OBJECTIVE_FAIL' && <CheckCircle2 className="w-5 h-5" />}
                    {notif.type === 'LOCATION' && <MapPin className="w-5 h-5" />}
                    {notif.type === 'SYSTEM' && <CheckCircle2 className="w-5 h-5" />}
                    {notif.type === 'NPC_MOVE' && <MapPin className="w-5 h-5" />}
                </div>
             </div>
             
             {/* Progress bar timer */}
             <div 
                className="absolute bottom-0 left-0 h-[2px] bg-current opacity-30 w-full"
                style={{ animation: `shrink-width ${notif.durationMs}ms linear forwards` }}
             ></div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes scan-line {
            0% { transform: scaleX(0); opacity: 0; }
            50% { transform: scaleX(1); opacity: 1; }
            100% { transform: scaleX(0); opacity: 0; }
        }
        @keyframes shrink-width {
            from { width: 100%; }
            to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default FeedbackOverlay;
