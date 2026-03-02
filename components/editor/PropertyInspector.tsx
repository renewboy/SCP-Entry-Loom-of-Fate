import React from 'react';
import { MapBlueprint, MapBlueprintNode, MapBlueprintEdge, MapBlueprintNPC, MapBlueprintObjective } from '../../types';
import { useTranslation } from '../../utils/i18n';

interface PropertyInspectorProps {
    blueprint: MapBlueprint;
    selection: { type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null;
    setSelection: (sel: { type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null) => void;
    updateNode: (id: string, updates: Partial<MapBlueprintNode>) => void;
    updateEdge: (from: string, to: string, updates: Partial<MapBlueprintEdge>) => void;
    updateNPC: (id: string, updates: Partial<MapBlueprintNPC>) => void;
    updateObjective: (id: string, updates: Partial<MapBlueprintObjective>) => void;
    setBlueprint: React.Dispatch<React.SetStateAction<MapBlueprint>>;
    npcImagePrompts?: Record<string, string>;
    onNpcPromptChange?: (npcId: string, value: string) => void;
    onGenerateNpcImage?: (npcId: string) => void;
    onUploadNpcImage?: (npcId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
    onDeleteNpcImage?: (npcId: string) => void;
    npcImages?: Record<string, string>;
    generatingState?: { npc: Record<string, boolean> };
    setLightboxImage?: (url: string | null) => void;
}

import TagInput from './TagInput';
import CustomSelect from './CustomSelect';
import {
    deleteButton,
    emptyStateBox,
    inputBase,
    inputGroup,
    labelBase,
    numberInputBase,
    rangeInputBase,
    textareaBase
} from './editorStyles';

const PropertyInspector: React.FC<PropertyInspectorProps> = ({ 
    blueprint, selection, setSelection, updateNode, updateEdge, updateNPC, updateObjective, setBlueprint,
    npcImagePrompts, onNpcPromptChange, onGenerateNpcImage, onUploadNpcImage, onDeleteNpcImage, npcImages, generatingState, setLightboxImage
}) => {
    const { t } = useTranslation();

    // Helper to get all access tokens used in requires fields for suggestions
    const getAllRequiredTokens = () => {
        const tokens = new Set<string>();
        blueprint.nodes.forEach(n => n.requires?.forEach(t => tokens.add(t)));
        return Array.from(tokens).map(t => ({ value: t, label: t }));
    };

    if (!selection) {
        return (
            <div className="p-4 font-mono">
                <div className="space-y-4">
                    <div className={inputGroup}>
                        <label className={labelBase}>{t('map_editor.map_id')}</label>
                        <input type="text" value={blueprint.id} onChange={e => setBlueprint(prev => ({...prev, id: e.target.value}))} className={inputBase} />
                    </div>
                    <div className={inputGroup}>
                        <label className={labelBase}>{t('map_editor.map_title')}</label>
                        <input type="text" value={blueprint.title} onChange={e => setBlueprint(prev => ({...prev, title: e.target.value}))} className={inputBase} />
                    </div>
                     <CustomSelect 
                        label={t('map_editor.start_node_id')}
                        value={blueprint.startNodeId}
                        onChange={(val) => setBlueprint(prev => ({...prev, startNodeId: val}))}
                        options={blueprint.nodes.map(n => ({ value: n.id, label: `${n.name} (${n.id})` }))}
                    />
                </div>
                 <div className={emptyStateBox}>
                    {t('map_editor.no_selection')}
                </div>
            </div>
        );
    }

    const renderNodeInspector = () => {
        const node = blueprint.nodes.find(n => n.id === selection.id);
        if (!node) return null;

        return (
            <div className="space-y-4 p-4">
                <div className={inputGroup}>
                    <label className={labelBase}>{t('map_editor.node_id')}</label>
                    <input 
                        type="text" 
                        value={node.id} 
                        onChange={(e) => updateNode(node.id, { id: e.target.value })}
                        className={inputBase}
                    />
                </div>
                <div className={inputGroup}>
                    <label className={labelBase}>{t('map_editor.node_name')}</label>
                    <input 
                        type="text" 
                        value={node.name} 
                        onChange={(e) => updateNode(node.id, { name: e.target.value })}
                        className={inputBase}
                    />
                </div>
                <div className={inputGroup}>
                    <label className={labelBase}>{t('game.map_tooltip_danger')}</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="range" 
                            min="0" max="100" 
                            value={node.danger} 
                            onChange={(e) => updateNode(node.id, { danger: parseInt(e.target.value) })}
                            className={rangeInputBase}
                        />
                        <div className={`text-xs font-mono w-8 text-right ${node.danger > 50 ? 'text-scp-alert' : (node.danger > 30 ? 'text-scp-amber' : 'text-scp-term')}`}>{node.danger}</div>
                    </div>
                </div>
                
                <TagInput label={t('map_editor.requires')} tags={node.requires} onChange={(newTags) => updateNode(node.id, { requires: newTags })} />
                
                <TagInput label={t('map_editor.discoverables')} tags={node.discoverables} onChange={(newTags) => updateNode(node.id, { discoverables: newTags })} />
                
                <TagInput label={t('map_editor.interactables')} tags={node.interactables} onChange={(newTags) => updateNode(node.id, { interactables: newTags })} />

                <div className={inputGroup}>
                    <label className={labelBase}>{t('map_editor.visual_hint')}</label>
                    <input 
                        type="text" 
                        value={node.visualHint || ''} 
                        onChange={(e) => updateNode(node.id, { visualHint: e.target.value })}
                        className={inputBase}
                    />
                </div>

                 <div className={inputGroup}>
                    <label className={labelBase}>{t('map_editor.blocked_text')}</label>
                    <textarea 
                        value={node.blockedText || ''} 
                        onChange={(e) => updateNode(node.id, { blockedText: e.target.value })}
                        className={`${textareaBase} h-20`}
                    />
                </div>
                
                <div className="pt-4 border-t border-[var(--scp-border)]">
                    <button 
                        onClick={() => {
                            setBlueprint(prev => ({
                                ...prev,
                                nodes: prev.nodes.filter(n => n.id !== node.id),
                                edges: prev.edges.filter(e => e.from !== node.id && e.to !== node.id),
                                npcs: prev.npcs.filter(n => n.initialNodeId !== node.id),
                                objectives: prev.objectives.filter(o => o.nodeId !== node.id)
                            }));
                        }}
                        className={deleteButton}
                    >
                        {t('common.delete')}
                    </button>
                </div>
            </div>
        );
    };

    const renderEdgeInspector = () => {
        const [from, to] = selection.id.split('-');
        const edge = blueprint.edges.find(e => e.from === from && e.to === to);
        if (!edge) return null;

        const fromNode = blueprint.nodes.find(n => n.id === from);
        const toNode = blueprint.nodes.find(n => n.id === to);

        const canonicalFrom = from < to ? from : to;
        const canonicalTo = from < to ? to : from;
        
        let currentState: 'bi' | 'canonical_fwd' | 'canonical_rev';
        if (edge.bidirectional) {
            currentState = 'bi';
        } else {
            if (edge.from === canonicalFrom) {
                currentState = 'canonical_fwd';
            } else {
                currentState = 'canonical_rev';
            }
        }

        const handleDirectionCycle = () => {
            if (currentState === 'bi') {
                if (edge.from !== canonicalFrom) {
                     setBlueprint(prev => ({
                        ...prev,
                        edges: prev.edges.map(e => {
                            if (e.from === from && e.to === to) {
                                return { ...e, from: canonicalFrom, to: canonicalTo, bidirectional: false };
                            }
                            return e;
                        })
                    }));
                    setSelection({ type: 'edge', id: `${canonicalFrom}-${canonicalTo}` });
                } else {
                    updateEdge(from, to, { bidirectional: false });
                }
            } else if (currentState === 'canonical_fwd') {
                 setBlueprint(prev => ({
                    ...prev,
                    edges: prev.edges.map(e => {
                        if (e.from === from && e.to === to) {
                            return { ...e, from: to, to: from, bidirectional: false };
                        }
                        return e;
                    })
                }));
                setSelection({ type: 'edge', id: `${to}-${from}` });
            } else {
                updateEdge(from, to, { bidirectional: true });
            }
        };

        let label = '';
        if (currentState === 'bi') {
            label = `${fromNode?.name || from} ↔ ${toNode?.name || to}`;
        } else if (currentState === 'canonical_fwd') {
             label = `${fromNode?.name || from} → ${toNode?.name || to}`;
        } else {
             label = `${fromNode?.name || from} → ${toNode?.name || to}`;
        }

        return (
            <div className="space-y-4 p-4">
                <div className="space-y-2">
                    <label className={labelBase}>{t('map_editor.direction')}</label>
                    <button
                        onClick={handleDirectionCycle}
                        className="w-full py-2 text-xs font-mono border bg-scp-amber/5 border-scp-amber/30 text-scp-amber hover:bg-scp-amber/10 flex items-center justify-center gap-2 transition-colors"
                        title={t('map_editor.click_to_cycle')}
                    >
                        {label}
                      
                    </button>
                    <div className="text-[12px] text-gray-500 italic text-center">
                        {t('map_editor.cycle_hint')}
                    </div>
                </div>
                
                <div className="pt-4 border-t border-[var(--scp-border)]">
                     <button 
                        onClick={() => {
                            setBlueprint(prev => ({
                                ...prev,
                                edges: prev.edges.filter(e => !(e.from === from && e.to === to))
                            }));
                        }}
                        className={deleteButton}
                    >
                        {t('common.delete')}
                    </button>
                </div>
            </div>
        );
    };

    const renderNPCInspector = () => {
        const npc = blueprint.npcs.find(n => n.id === selection.id);
        if (!npc) return null;

        const npcImage = npcImages?.[npc.id];
        const isGenerating = generatingState?.npc?.[npc.id];

        return (
            <div className="space-y-4 p-4">
                <div className="space-y-2 border-b border-[var(--scp-border)] pb-4 mb-2">
                    <label className={labelBase}>{t('map_editor.npc_avatar')}</label>
                    
                    <textarea 
                        value={npcImagePrompts?.[npc.id] || ''}
                        onChange={e => onNpcPromptChange?.(npc.id, e.target.value)}
                        className={`${textareaBase} h-16 text-[10px] leading-tight mb-1`}
                        placeholder="Visual description for AI generation..."
                    />
                    
                    <div className="flex gap-1 justify-end">
                        <button 
                            onClick={() => onGenerateNpcImage?.(npc.id)}
                            disabled={isGenerating}
                            className="text-[10px] px-2 py-1 bg-scp-accent/20 border border-scp-accent/50 text-scp-accent hover:bg-scp-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t('story_editor.btn_generate')}
                        </button>
                        <label className="text-[10px] px-2 py-1 bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 cursor-pointer">
                            {t('story_editor.btn_upload')}
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => onUploadNpcImage?.(npc.id, e)} />
                        </label>
                    </div>

                    <div 
                        className="w-full aspect-square bg-black/50 border border-gray-800 relative flex items-center justify-center overflow-hidden group cursor-pointer"
                        onClick={() => npcImage && setLightboxImage?.(npcImage)}
                    >
                        {npcImage ? (
                            <>
                                <img src={npcImage} alt={npc.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteNpcImage?.(npc.id);
                                    }}
                                    className="absolute top-1 right-1 bg-black/70 hover:bg-red-900/80 text-white p-1 rounded-sm z-20 transition-colors opacity-0 group-hover:opacity-100"
                                    title={t('common.delete')}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </>
                        ) : (
                            <div className="text-gray-700 text-xs flex flex-col items-center gap-1">
                                <span>NO IMG</span>
                            </div>
                        )}
                        {isGenerating && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col gap-2 items-center justify-center z-10 cursor-default" onClick={(e) => e.stopPropagation()}>
                                <div className="w-6 h-6 border-2 border-scp-accent border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-[12px] text-scp-accent animate-pulse">GENERATING...</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className={inputGroup}>
                    <label className={labelBase}>{t('map_editor.npc_id')}</label>
                    <input type="text" value={npc.id} onChange={e => updateNPC(npc.id, { id: e.target.value })} className={inputBase} />
                </div>
                <div className={inputGroup}>
                    <label className={labelBase}>{t('map_editor.npc_name')}</label>
                    <input type="text" value={npc.name} onChange={e => updateNPC(npc.id, { name: e.target.value })} className={inputBase} />
                </div>
                <div className={inputGroup}>
                    <label className={labelBase}>{t('map_editor.npc_archetype')}</label>
                    <input type="text" value={npc.archetype} onChange={e => updateNPC(npc.id, { archetype: e.target.value })} className={inputBase} />
                </div>
                 <CustomSelect 
                    label={t('map_editor.initial_node_id')}
                    value={npc.initialNodeId}
                    onChange={(val) => updateNPC(npc.id, { initialNodeId: val })}
                    options={blueprint.nodes.map(n => ({ value: n.id, label: `${n.name} (${n.id})` }))}
                />
                <TagInput label={t('map_editor.secret_tags')} tags={npc.secretTags} onChange={(newTags) => updateNPC(npc.id, { secretTags: newTags })} />
                <TagInput label={t('map_editor.dialogue_goals')} tags={npc.dialogueGoals} onChange={(newTags) => updateNPC(npc.id, { dialogueGoals: newTags })} />
                
                <div className="pt-4 border-t border-[var(--scp-border)]">
                     <button onClick={() => { setBlueprint(prev => ({ ...prev, npcs: prev.npcs.filter(n => n.id !== npc.id) })); }} className={deleteButton}>{t('common.delete')}</button>
                </div>
            </div>
        );
    };

    const renderObjectiveInspector = () => {
        const obj = blueprint.objectives.find(o => o.id === selection.id);
        if (!obj) return null;

        return (
            <div className="space-y-4 p-4">
                <div className={inputGroup}>
                    <label className={labelBase}>{t('map_editor.obj_id')}</label>
                    <input type="text" value={obj.id} onChange={e => updateObjective(obj.id, { id: e.target.value })} className={inputBase} />
                </div>
                <div className={inputGroup}>
                    <label className={labelBase}>{t('map_editor.obj_title')}</label>
                    <input type="text" value={obj.title} onChange={e => updateObjective(obj.id, { title: e.target.value })} className={inputBase} />
                </div>
                 <CustomSelect 
                    label={t('map_editor.obj_type')}
                    value={obj.type}
                    onChange={(val) => updateObjective(obj.id, { type: val as any })}
                    options={[{ value: 'MAIN', label: t('map_editor.obj_main') }, { value: 'SIDE', label: t('map_editor.obj_side') }]}
                />
                 <CustomSelect 
                    label={t('map_editor.target_node_id')}
                    value={obj.nodeId}
                    onChange={(val) => updateObjective(obj.id, { nodeId: val })}
                    options={blueprint.nodes.map(n => ({ value: n.id, label: `${n.name} (${n.id})` }))}
                />
                 <div className={inputGroup}>
                    <label className={labelBase}>{t('map_editor.obj_detail')}</label>
                    <textarea value={obj.detail || ''} onChange={e => updateObjective(obj.id, { detail: e.target.value })} className={`${textareaBase} h-20`} />
                </div>
                
                <div className="space-y-2 border-t border-[var(--scp-border)] pt-2 mt-2">
                    <label className="text-xs text-scp-text-dim uppercase font-bold font-mono block">{t('map_editor.rewards')}</label>
                    
                    <CustomSelect 
                        label={t('map_editor.add_access_token')}
                        value=""
                        onChange={(val) => {
                             const current = obj.reward?.accessTokens || [];
                             if (!current.includes(val)) {
                                 updateObjective(obj.id, { reward: { ...obj.reward, accessTokens: [...current, val] } });
                             }
                        }}
                        options={[{ value: '', label: t('map_editor.select_token') }, ...getAllRequiredTokens()]}
                    />
                    
                    <div className="flex flex-wrap gap-1 mb-1">
                        {obj.reward?.accessTokens?.map(token => (
                             <span key={token} className="px-1 bg-scp-term/10 text-scp-text text-xs border border-[var(--scp-border)] flex items-center gap-1">
                                {token}
                                <button onClick={() => {
                                     updateObjective(obj.id, { reward: { ...obj.reward, accessTokens: obj.reward?.accessTokens?.filter(t => t !== token) } });
                                }} className="hover:text-white font-bold px-1">×</button>
                            </span>
                        ))}
                    </div>

                    <div className={inputGroup}>
                        <label className={labelBase}>{t('map_editor.stability_delta')}</label>
                        <input 
                            type="number" 
                            value={obj.reward?.stabilityDelta || 0} 
                            onChange={(e) => updateObjective(obj.id, { reward: { ...obj.reward, stabilityDelta: parseInt(e.target.value) || 0 } })}
                            className={numberInputBase}
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-[var(--scp-border)]">
                     <button onClick={() => { setBlueprint(prev => ({ ...prev, objectives: prev.objectives.filter(o => o.id !== obj.id) })); }} className={deleteButton}>{t('common.delete')}</button>
                </div>
            </div>
        );
    };

    return (
        <div className="font-mono">
            {selection.type === 'node' && renderNodeInspector()}
            {selection.type === 'edge' && renderEdgeInspector()}
            {selection.type === 'npc' && renderNPCInspector()}
            {selection.type === 'objective' && renderObjectiveInspector()}
        </div>
    );
};

export default PropertyInspector;
