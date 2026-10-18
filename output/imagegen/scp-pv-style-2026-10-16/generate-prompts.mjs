import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { enhanceBackgroundPrompt, enhanceNpcPrompt } from '../../../services/ai/promptUtils.ts';

const source = new URL('../../../services/ai/promptUtils.ts', import.meta.url);
const samples = [
  {
    id: 'scp-049-background',
    title: 'SCP-049 — 收容访谈室',
    kind: 'background',
    builder: 'enhanceBackgroundPrompt',
    aspectRatio: '16:9',
    sourceUrl: 'https://scp-wiki.wikidot.com/scp-049',
    description: 'unoccupied secure humanoid containment interview room at Site-19 for a plague-doctor anomaly, off-white concrete walls, brushed steel isolation door, thick observation glass, a plain interview table and two empty chairs, a closed worn black leather medical bag on the table, red door-status lamp, neutral white ceiling strip lights, ivory and graphite material colors, quiet clinical unease, foreground window frame, midground table, receding doorway, wide 16:9 landscape composition'
  },
  {
    id: 'scp-049-portrait',
    title: 'SCP-049 — 疫医肖像',
    kind: 'portrait',
    builder: 'enhanceNpcPrompt',
    aspectRatio: '1:1',
    sourceUrl: 'https://scp-wiki.wikidot.com/scp-049',
    description: "SCP-049, tall gaunt humanoid plague doctor, long ivory beak-shaped mask fused to the face, deep-set watchful eyes, black hood, thick charcoal-black hide-like robes with heavy angular folds, high closed collar, black gloves, edge of a worn black leather doctor's bag, calm unsettling three-quarter head-and-shoulders view, unadorned off-white containment wall, neutral white overhead light, restrained red status lamp outside the focus, square 1:1 portrait composition"
  },
  {
    id: 'scp-3008-background',
    title: 'SCP-3008 — 家具堡垒外的长廊',
    kind: 'background',
    builder: 'enhanceBackgroundPrompt',
    aspectRatio: '16:9',
    sourceUrl: 'https://scp-wiki.wikidot.com/scp-3008',
    description: 'unoccupied impossibly vast furniture-store interior of SCP-3008-1, repeating oak showroom partitions and towering warehouse shelving beyond every visible aisle, low survivor barricade of wardrobes and upright mattresses in the foreground, beige sofas and a burnt-orange cushion in staged living rooms, warm amber display lamps near the barricade, neutral white overhead warehouse lighting receding into the distance, interrupted sightlines and no visible exterior boundary, ordinary retail materials and ominous empty scale, clear central passage, wide 16:9 landscape composition'
  },
  {
    id: 'scp-3008-portrait',
    title: 'SCP-3008-2 — 无面员工肖像',
    kind: 'portrait',
    builder: 'enhanceNpcPrompt',
    aspectRatio: '1:1',
    sourceUrl: 'https://scp-wiki.wikidot.com/scp-3008',
    description: 'SCP-3008-2 furniture-store employee, elongated humanoid upper torso, shoulders slightly too narrow, abnormally long neck, entirely smooth pale featureless oval head, no eyes nose mouth ears or facial marks, plain canary-yellow short-sleeved polo shirt, blue work trousers, slumped neutral posture, three-quarter upper-body view, simple timber showroom partitions in the distance, warm amber display-lamp side light and neutral ceiling light, square 1:1 portrait composition'
  }
];

const builders = { enhanceBackgroundPrompt, enhanceNpcPrompt };
const sha256 = value => createHash('sha256').update(value).digest('hex');
const manifest = {
  promptSource: 'services/ai/promptUtils.ts',
  promptSourceSha256: sha256(readFileSync(source)),
  generationMode: 'built-in image_gen',
  promptRule: 'The submitted prompt is exactly builder(description), with the corresponding bundled style reference image and no additional prefix or suffix.',
  samples: samples.map(sample => {
    const prompt = builders[sample.builder](sample.description, 'paper-cut');
    writeFileSync(new URL(`${sample.id}.prompt.txt`, import.meta.url), prompt);
    return { ...sample, prompt, promptSha256: sha256(prompt), referenceImage: `assets/imageStyles/${sample.kind === 'background' ? 'background' : 'npc'}.webp` };
  })
};

writeFileSync(new URL('prompts.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
process.stdout.write(JSON.stringify(manifest));
