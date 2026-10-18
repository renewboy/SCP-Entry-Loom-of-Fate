import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { enhanceBackgroundPrompt, enhanceNpcPrompt, enhanceEntityPrompt, enhanceScenePrompt } from '../../../services/ai/promptUtils.ts';

const samples = [
  { id: 'background', builder: 'enhanceBackgroundPrompt', description: 'unoccupied secure humanoid containment interview room at Site-19 for a plague-doctor anomaly, off-white concrete walls, brushed steel isolation door, thick observation glass, plain interview table and two empty chairs, closed black leather medical bag on the table, red door-status lamp, neutral white ceiling strips, ivory and graphite material colors, quiet clinical unease, foreground window frame, midground table, receding doorway, wide 16:9 landscape composition' },
  { id: 'npc', builder: 'enhanceNpcPrompt', description: 'adult male Foundation field researcher, slender angular face, straight nose, narrow attentive eyes, short swept-back black hair in distinct tapered locks, practical white laboratory coat over a rust-orange knitted top, small graphite radio clipped to the coat, calm reserved expression, three-quarter head-and-shoulders view, plain warm ivory laboratory wall, neutral light, square 1:1 portrait composition' },
  { id: 'entity', builder: 'enhanceEntityPrompt', description: 'SCP-049, tall humanoid plague doctor, long smooth ivory beak-shaped mask grown from the face, watchful eyes inside recessed eye openings, plain black hood and unadorned charcoal-black hide-like robes without ornamental trim or emblems, large clean angular robe folds, black gloves, plain worn black leather medical bag held in one hand, reserved upright pose, visible full body from hood to feet, plain ivory containment wall with a small red status light, neutral overhead illumination, square 1:1 composition' },
  { id: 'scene', builder: 'enhanceScenePrompt', description: 'two adult survivors building a waist-high barricade from oak wardrobes and upright mattresses inside SCP-3008-1, one survivor in a rust-orange jacket bracing the wardrobe while another in a beige work shirt pulls a mattress into position, immeasurably vast repeating furniture showrooms beyond them, a single distant employee with a smooth featureless head, yellow shirt and blue trousers walking passively along an aisle, amber display lamps and neutral white ceiling lights, brown timber and cream upholstery, clear readable gestures and layered silhouettes, wide 16:9 landscape composition' },
];
const builders = { enhanceBackgroundPrompt, enhanceNpcPrompt, enhanceEntityPrompt, enhanceScenePrompt };
const manifest = {
  promptSource: 'services/ai/promptUtils.ts',
  promptSourceSha256: createHash('sha256').update(readFileSync(new URL('../../../services/ai/promptUtils.ts', import.meta.url))).digest('hex'),
  referenceRole: 'User-supplied PV screenshots; drawing technique only, with subject and colors supplied by each description.',
  samples: samples.map(sample => ({ ...sample, prompt: builders[sample.builder](sample.description, 'paper-cut') }))
};
writeFileSync(new URL('prompts.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
process.stdout.write(JSON.stringify(manifest));
