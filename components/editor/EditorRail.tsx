import React from 'react';
import { MapBlueprint } from '../../types';
import { useTranslation } from '../../utils/i18n';
import { NodeMark, ObjectiveIcon } from '../game/stage/NetworkNode';
import { EditorSelection } from './PropertyInspector';

interface EditorRailProps {
    blueprint: MapBlueprint;
    selection: EditorSelection;
    npcImages?: Record<string, string>;
    onSelect: (selection: EditorSelection) => void;
    onAddNode: () => void;
    onAddNPC: () => void;
    onAddObjective: () => void;
}

/** Every node, NPC and objective at a glance, drawn with the same marks as the map */
const EditorRail: React.FC<EditorRailProps> = ({ blueprint, selection, npcImages, onSelect, onAddNode, onAddNPC, onAddObjective }) => {
    const { t } = useTranslation();
    const itemClass = (type: NonNullable<EditorSelection>['type'], id: string) => `rail-item ${selection?.type === type && selection.id === id ? 'on' : ''}`;

    const head = (label: string, count: number, onAdd: () => void) => (
        <div className="rail-head">
            <span>{label} {count}</span>
            <button type="button" onClick={onAdd}>+ {t('map_editor.add_short')}</button>
        </div>
    );

    return (
        <>
            <div className="rail-sec">
                {head(t('map_editor.nodes'), blueprint.nodes.length, onAddNode)}
                {blueprint.nodes.map(node => {
                    const danger = node.danger ?? 0;
                    const notes = [`${t('stage.network.danger')} ${danger}`];
                    if (node.id === blueprint.startNodeId) notes.push(t('game.map_start'));
                    if ((node.requires ?? []).length) notes.push(t('stage.network.legend_gate'));
                    return (
                        <button key={node.id} type="button" className={itemClass('node', node.id)} onClick={() => onSelect({ type: 'node', id: node.id })}>
                            <svg width="16" height="16" viewBox="-13 -13 26 26" aria-hidden="true"><NodeMark x={0} y={0} danger={danger} scale={0.9} /></svg>
                            <span className="ri-text"><b>{node.name}</b><small>{notes.join(' · ')}</small></span>
                        </button>
                    );
                })}
            </div>
            <div className="rail-sec">
                {head(t('map_editor.npcs'), blueprint.npcs.length, onAddNPC)}
                {blueprint.npcs.map(npc => (
                    <button key={npc.id} type="button" className={itemClass('npc', npc.id)} onClick={() => onSelect({ type: 'npc', id: npc.id })}>
                        {npcImages?.[npc.id] ? <img className="ri-face" src={npcImages[npc.id]} alt="" /> : <span className="ri-q">?</span>}
                        <span className="ri-text"><b>{npc.name}</b><small>{npc.archetype}</small></span>
                    </button>
                ))}
                {!blueprint.npcs.length && <p className="rail-empty">{t('map_editor.no_npcs')}</p>}
            </div>
            <div className="rail-sec">
                {head(t('map_editor.objectives'), blueprint.objectives.length, onAddObjective)}
                {blueprint.objectives.map(objective => (
                    <button key={objective.id} type="button" className={itemClass('objective', objective.id)} onClick={() => onSelect({ type: 'objective', id: objective.id })}>
                        <ObjectiveIcon type={objective.type} />
                        <span className="ri-text"><b>{objective.title}</b><small>{t(objective.type === 'MAIN' ? 'map_editor.obj_main' : 'map_editor.obj_side')}</small></span>
                    </button>
                ))}
                {!blueprint.objectives.length && <p className="rail-empty">{t('map_editor.no_objectives')}</p>}
            </div>
        </>
    );
};

export default EditorRail;
