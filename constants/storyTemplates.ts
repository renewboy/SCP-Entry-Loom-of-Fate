import { MapBlueprint, SCPData } from '../types';

export const DEFAULT_BLUEPRINT: MapBlueprint = {
    id: 'scp_173_map',
    title: 'SCP-173 Containment Wing',
    startNodeId: 'node_control',
    nodes: [
        { id: 'node_control', name: 'Control Room', danger: 0, layout: { x: 100, y: 100 } },
        { id: 'node_airlock', name: 'Airlock', danger: 20, requires: ['access_code'], layout: { x: 220, y: 100 } },
        { id: 'node_containment', name: 'Containment Chamber', danger: 90, requires: ['key_card_4'], layout: { x: 340, y: 100 } },
        { id: 'node_hallway_a', name: 'Hallway A', danger: 10, layout: { x: 100, y: 200 } },
        { id: 'node_storage', name: 'Equipment Storage', danger: 5, layout: { x: 220, y: 200 } }
    ],
    edges: [
        { from: 'node_control', to: 'node_airlock', bidirectional: true },
        { from: 'node_airlock', to: 'node_containment', bidirectional: true },
        { from: 'node_control', to: 'node_hallway_a', bidirectional: true },
        { from: 'node_hallway_a', to: 'node_storage', bidirectional: true }
    ],
    npcs: [],
    objectives: [
        { id: 'obj_clean', title: 'Clean Containment', type: 'MAIN', nodeId: 'node_containment' }
     ]
};

export const SCP173_TEMPLATE: SCPData = {
    designation: 'SCP-173',
    name: 'The Sculpture',
    containmentClass: 'Euclid',
    role: 'Class D Personnel',
    entityDescription: 'Constructed from concrete and rebar with traces of Krylon brand spray paint. SCP-173 is animate and extremely hostile. The object cannot move while within a direct line of sight.',
    visualDescription: 'A sterile, dimly lit containment chamber with concrete walls. The floor is covered in a reddish-brown substance. Heavy steel doors seal the entrance.',
    storyDraft: {
        roleDetails: 'You are D-9341, a test subject assigned to SCP-173 for routine testing.',
        storyBackground: 'SCP-173 is a concrete sculpture that moves when not observed. It attacks by snapping the neck at the base of the skull.',
        narrativeConstraints: 'Maintain direct eye contact at all times. Alert others before blinking.',
        openingPrompt: 'The containment door slides open with a heavy grind. The air is stale and smells of blood and feces.'
    },
    mapBlueprint: DEFAULT_BLUEPRINT
};
