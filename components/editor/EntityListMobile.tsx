import React from 'react';
import { MapBlueprint } from '../../types';
import { useTranslation } from '../../utils/i18n';
import { editorPanelHeader, editorPanelTitle } from './editorStyles';

type EditorSelection = { type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null;

interface EntityListMobileProps {
  blueprint: MapBlueprint;
  selection: EditorSelection;
  onSelectionChange: (sel: EditorSelection) => void;
  onAddNPC: () => void;
  onAddObjective: () => void;
}

const EntityListMobile: React.FC<EntityListMobileProps> = ({
  blueprint,
  selection,
  onSelectionChange,
  onAddNPC,
  onAddObjective
}) => {
  const { t } = useTranslation();
  
  return (
    <div className="h-full flex flex-col bg-[var(--scp-surface)]">
      <div className={`${editorPanelHeader} shrink-0`}>
        <div className="flex justify-between items-center w-full">
          <div className={editorPanelTitle}>
            {t('map_editor.entity_list')}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={onAddNPC}
              className="min-w-[44px] min-h-[44px] px-2 flex items-center justify-center text-scp-amber border border-scp-amber/30 rounded-sm text-[11px] font-mono hover:bg-scp-amber/10 transition-colors whitespace-nowrap leading-none"
            >
              + NPC
            </button>
            <button 
              onClick={onAddObjective}
              className="min-w-[44px] min-h-[44px] px-2 flex items-center justify-center text-scp-accent border border-scp-accent/30 rounded-sm text-[11px] font-mono hover:bg-scp-accent/10 transition-colors whitespace-nowrap leading-none"
            >
              + OBJ
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        <div>
          <div className="text-[12px] text-scp-text-dim uppercase font-bold mb-2 px-1 tracking-wider">
            {t('map_editor.npcs')} ({(blueprint.npcs || []).length})
          </div>
          <div className="space-y-2">
            {(blueprint.npcs || []).map(npc => (
              <div
                key={npc.id}
                onClick={() => onSelectionChange({ type: 'npc', id: npc.id })}
                className={`p-3 border rounded-sm cursor-pointer transition-all min-h-[56px]
                  ${selection?.type === 'npc' && selection.id === npc.id
                    ? 'bg-scp-amber/10 border-scp-amber text-scp-amber'
                    : 'bg-[var(--scp-surface)] border-scp-gray/30 hover:border-scp-amber/60 text-gray-400'
                  }`}
              >
                <div className="font-bold truncate text-sm">{npc.name}</div>
                <div className="text-[12px] opacity-60 truncate">{npc.archetype}</div>
              </div>
            ))}
            {(blueprint.npcs || []).length === 0 && (
              <div className="p-3 text-[12px] text-gray-600 italic text-center border border-dashed border-gray-800 rounded">
                No Entities
              </div>
            )}
          </div>
        </div>
        
        <div>
          <div className="text-[12px] text-scp-text-dim uppercase font-bold mb-2 px-1 tracking-wider border-t border-[var(--scp-border)] pt-4">
            {t('map_editor.objectives')} ({(blueprint.objectives || []).length})
          </div>
          <div className="space-y-2">
            {(blueprint.objectives || []).map(obj => (
              <div
                key={obj.id}
                onClick={() => onSelectionChange({ type: 'objective', id: obj.id })}
                className={`p-3 border rounded-sm cursor-pointer transition-all min-h-[56px]
                  ${selection?.type === 'objective' && selection.id === obj.id
                    ? 'bg-scp-accent/10 border-scp-accent text-scp-accent'
                    : 'bg-[var(--scp-surface)] border-scp-gray/30 hover:border-scp-accent/60 text-gray-400'
                  }`}
              >
                <div className="font-bold truncate text-sm">{obj.title}</div>
                <div className="text-[12px] opacity-60 truncate">{obj.type}</div>
              </div>
            ))}
            {(blueprint.objectives || []).length === 0 && (
              <div className="p-3 text-[12px] text-gray-600 italic text-center border border-dashed border-gray-800 rounded">
                No Objectives
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityListMobile;
