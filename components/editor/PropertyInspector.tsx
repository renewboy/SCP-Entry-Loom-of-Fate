import React from 'react';
import { MapBlueprint, MapBlueprintEdge, MapBlueprintNode, MapBlueprintNPC, MapBlueprintObjective } from '../../types';
import { useTranslation } from '../../utils/i18n';
import { dangerColor } from '../../utils/siteNetwork';
import GameButton from '../common/GameButton';
import { AreaField, Field, ImageSlot, SelectField, TextField } from './EditorFields';
import ChipInput from './ChipInput';

export type EditorSelection = { type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null;
export const EDGE_ID_SEPARATOR = '|';

interface PropertyInspectorProps {
    blueprint: MapBlueprint;
    selection: EditorSelection;
    setSelection: (sel: EditorSelection) => void;
    updateNode: (id: string, updates: Partial<MapBlueprintNode>) => void;
    updateEdge: (from: string, to: string, updates: Partial<MapBlueprintEdge>) => void;
    updateNPC: (id: string, updates: Partial<MapBlueprintNPC>) => void;
    updateObjective: (id: string, updates: Partial<MapBlueprintObjective>) => void;
    setBlueprint: (next: MapBlueprint | ((prev: MapBlueprint) => MapBlueprint), commitMode?: 'immediate' | 'deferred') => void;
    onDeleteSelection: () => void;
    npcImagePrompts?: Record<string, string>;
    onNpcPromptChange?: (npcId: string, value: string) => void;
    onGenerateNpcImage?: (npcId: string) => void;
    onUploadNpcImage?: (npcId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
    onDeleteNpcImage?: (npcId: string) => void;
    npcImages?: Record<string, string>;
    generatingState?: { npc: Record<string, boolean> };
    setLightboxImage?: (url: string | null) => void;
    commitBlueprint: () => void;
    commitScpData: () => void;
}

const PropertyInspector: React.FC<PropertyInspectorProps> = ({
    blueprint, selection, setSelection, updateNode, updateEdge, updateNPC, updateObjective, setBlueprint, onDeleteSelection,
    npcImagePrompts, onNpcPromptChange, onGenerateNpcImage, onUploadNpcImage, onDeleteNpcImage, npcImages, generatingState, setLightboxImage, commitBlueprint, commitScpData
}) => {
    const { t } = useTranslation();

    const nodeOptions = blueprint.nodes.map(n => ({ value: n.id, label: n.name, hint: n.id }));
    const deleteButton = (
        <div className="side-del">
            <GameButton variant="danger" size="sm" block onClick={onDeleteSelection}>{t('common.delete')}</GameButton>
        </div>
    );

    const panel = (title: string, kind: string, body: React.ReactNode) => (
        <>
            <div className="side-head"><b>{title}</b><span>{kind}</span></div>
            <div className="side-body">{body}</div>
        </>
    );

    if (!selection) {
        return panel(blueprint.title, t('map_editor.kind_map'), (
            <>
                <TextField mono label={t('map_editor.map_id')} value={blueprint.id} onChange={value => setBlueprint(prev => ({ ...prev, id: value }), 'deferred')} onBlur={commitBlueprint} />
                <TextField label={t('map_editor.map_title')} value={blueprint.title} onChange={value => setBlueprint(prev => ({ ...prev, title: value }), 'deferred')} onBlur={commitBlueprint} />
                <SelectField label={t('map_editor.start_node_id')} value={blueprint.startNodeId} options={nodeOptions} onChange={value => setBlueprint(prev => ({ ...prev, startNodeId: value }), 'immediate')} />
                <p className="side-empty">{t('map_editor.no_selection')}</p>
            </>
        ));
    }

    if (selection.type === 'node') {
        const node = blueprint.nodes.find(n => n.id === selection.id);
        if (!node) return null;
        const danger = node.danger ?? 0;
        const setTags = (key: 'requires' | 'discoverables' | 'interactables') => (tags: string[]) => {
            updateNode(node.id, { [key]: tags });
            commitBlueprint();
        };
        return panel(node.name, t('map_editor.kind_node'), (
            <>
                <TextField mono label={t('map_editor.node_id')} value={node.id} onChange={value => updateNode(node.id, { id: value })} onBlur={commitBlueprint} />
                <TextField label={t('map_editor.node_name')} value={node.name} onChange={value => updateNode(node.id, { name: value })} onBlur={commitBlueprint} />
                <Field label={t('game.map_tooltip_danger')}>
                    <div className="danger-row">
                        <input
                            className="rng"
                            type="range"
                            min="0"
                            max="100"
                            value={danger}
                            aria-label={t('game.map_tooltip_danger')}
                            onChange={e => updateNode(node.id, { danger: parseInt(e.target.value, 10) })}
                            onMouseUp={commitBlueprint}
                            onTouchEnd={commitBlueprint}
                        />
                        <b style={{ color: dangerColor(danger) }}>{danger}</b>
                    </div>
                </Field>
                <ChipInput label={t('map_editor.requires')} tags={node.requires} onChange={setTags('requires')} />
                <ChipInput label={t('map_editor.discoverables')} tags={node.discoverables} onChange={setTags('discoverables')} />
                <ChipInput label={t('map_editor.interactables')} tags={node.interactables} onChange={setTags('interactables')} />
                <TextField label={t('map_editor.visual_hint')} value={node.visualHint || ''} onChange={value => updateNode(node.id, { visualHint: value })} onBlur={commitBlueprint} />
                <AreaField label={t('map_editor.blocked_text')} value={node.blockedText || ''} onChange={value => updateNode(node.id, { blockedText: value })} onBlur={commitBlueprint} />
                {deleteButton}
            </>
        ));
    }

    if (selection.type === 'edge') {
        const [from, to] = selection.id.split(EDGE_ID_SEPARATOR);
        const edge = blueprint.edges.find(e => e.from === from && e.to === to);
        if (!edge) return null;
        const nameOf = (id: string) => blueprint.nodes.find(n => n.id === id)?.name || id;
        const canonicalFrom = from < to ? from : to;
        const canonicalTo = from < to ? to : from;

        const reroute = (nextFrom: string, nextTo: string) => {
            setBlueprint(prev => ({
                ...prev,
                edges: prev.edges.map(e => (e.from === from && e.to === to) ? { ...e, from: nextFrom, to: nextTo, bidirectional: false } : e)
            }), 'immediate');
            setSelection({ type: 'edge', id: `${nextFrom}${EDGE_ID_SEPARATOR}${nextTo}` });
        };
        const handleDirectionCycle = () => {
            if (edge.bidirectional) {
                reroute(canonicalFrom, canonicalTo);
            } else if (edge.from === canonicalFrom) {
                reroute(to, from);
            } else {
                updateEdge(from, to, { bidirectional: true });
                commitBlueprint();
            }
        };
        return panel(t('map_editor.edges'), t('map_editor.kind_edge'), (
            <>
                <Field label={t('map_editor.direction')}>
                    <button type="button" className="dir-btn" title={t('map_editor.click_to_cycle')} onClick={handleDirectionCycle}>
                        {nameOf(from)} {edge.bidirectional ? '↔' : '→'} {nameOf(to)}
                    </button>
                    <div className="fld-note">{t('map_editor.cycle_hint')}</div>
                </Field>
                {deleteButton}
            </>
        ));
    }

    if (selection.type === 'npc') {
        const npc = blueprint.npcs.find(n => n.id === selection.id);
        if (!npc) return null;
        return panel(npc.name, t('map_editor.kind_npc'), (
            <>
                <Field label={t('map_editor.npc_avatar')}>
                    <textarea
                        style={{ height: 58 }}
                        value={npcImagePrompts?.[npc.id] || ''}
                        placeholder={t('story_editor.npc_prompt_placeholder')}
                        onChange={e => onNpcPromptChange?.(npc.id, e.target.value)}
                        onBlur={commitScpData}
                    />
                    <ImageSlot
                        actionsFirst
                        url={npcImages?.[npc.id]}
                        ratio="1"
                        generating={generatingState?.npc?.[npc.id]}
                        labels={{ generate: t('story_editor.btn_generate'), upload: t('story_editor.btn_upload'), delete: t('common.delete'), empty: t('story_editor.no_image'), generating: t('story_editor.generating') }}
                        onGenerate={() => onGenerateNpcImage?.(npc.id)}
                        onUpload={e => onUploadNpcImage?.(npc.id, e)}
                        onDelete={() => onDeleteNpcImage?.(npc.id)}
                        onZoom={url => setLightboxImage?.(url)}
                    />
                </Field>
                <TextField mono label={t('map_editor.npc_id')} value={npc.id} onChange={value => updateNPC(npc.id, { id: value })} onBlur={commitBlueprint} />
                <TextField label={t('map_editor.npc_name')} value={npc.name} onChange={value => updateNPC(npc.id, { name: value })} onBlur={commitBlueprint} />
                <TextField label={t('map_editor.npc_archetype')} value={npc.archetype} onChange={value => updateNPC(npc.id, { archetype: value })} onBlur={commitBlueprint} />
                <SelectField label={t('map_editor.initial_node_id')} value={npc.initialNodeId} options={nodeOptions} onChange={value => { updateNPC(npc.id, { initialNodeId: value }); commitBlueprint(); }} />
                <ChipInput label={t('map_editor.secret_tags')} tags={npc.secretTags} onChange={tags => { updateNPC(npc.id, { secretTags: tags }); commitBlueprint(); }} />
                <ChipInput label={t('map_editor.dialogue_goals')} tags={npc.dialogueGoals} onChange={tags => { updateNPC(npc.id, { dialogueGoals: tags }); commitBlueprint(); }} />
                {deleteButton}
            </>
        ));
    }

    const obj = blueprint.objectives.find(o => o.id === selection.id);
    if (!obj) return null;
    const tokens = obj.reward?.accessTokens ?? [];
    const availableTokens = Array.from(new Set(blueprint.nodes.flatMap(n => n.requires ?? []))).filter(token => !tokens.includes(token));
    return panel(obj.title, t('map_editor.kind_objective'), (
        <>
            <TextField mono label={t('map_editor.obj_id')} value={obj.id} onChange={value => updateObjective(obj.id, { id: value })} onBlur={commitBlueprint} />
            <TextField label={t('map_editor.obj_title')} value={obj.title} onChange={value => updateObjective(obj.id, { title: value })} onBlur={commitBlueprint} />
            <SelectField
                label={t('map_editor.obj_type')}
                value={obj.type}
                options={[{ value: 'MAIN', label: t('map_editor.obj_main') }, { value: 'SIDE', label: t('map_editor.obj_side') }]}
                onChange={value => { updateObjective(obj.id, { type: value as MapBlueprintObjective['type'] }); commitBlueprint(); }}
            />
            <SelectField label={t('map_editor.target_node_id')} value={obj.nodeId} options={nodeOptions} onChange={value => { updateObjective(obj.id, { nodeId: value }); commitBlueprint(); }} />
            <AreaField label={t('map_editor.obj_detail')} value={obj.detail || ''} height={110} onChange={value => updateObjective(obj.id, { detail: value })} onBlur={commitBlueprint} />
            <div className="sub-title">{t('map_editor.rewards')}</div>
            <SelectField
                label={t('map_editor.add_access_token')}
                value=""
                options={[{ value: '', label: t('map_editor.select_token') }, ...availableTokens.map(token => ({ value: token, label: token }))]}
                onChange={value => {
                    if (!value) return;
                    updateObjective(obj.id, { reward: { ...obj.reward, accessTokens: [...tokens, value] } });
                    commitBlueprint();
                }}
            />
            {tokens.length > 0 && (
                <div className="fld">
                    <div className="chips">
                        {tokens.map(token => (
                            <span key={token} className="chip">
                                {token}
                                <button
                                    type="button"
                                    aria-label={t('common.delete')}
                                    onClick={() => {
                                        updateObjective(obj.id, { reward: { ...obj.reward, accessTokens: tokens.filter(entry => entry !== token) } });
                                        commitBlueprint();
                                    }}
                                >
                                    ✕
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}
            <TextField
                mono
                type="number"
                label={t('map_editor.stability_delta')}
                value={obj.reward?.stabilityDelta || 0}
                onChange={value => updateObjective(obj.id, { reward: { ...obj.reward, stabilityDelta: parseInt(value, 10) || 0 } })}
                onBlur={commitBlueprint}
            />
            {deleteButton}
        </>
    ));
};

export default PropertyInspector;
