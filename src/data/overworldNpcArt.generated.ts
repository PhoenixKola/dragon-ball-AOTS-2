import type { OverworldEntity } from './artManifest.generated';

/** Native-generated Namekian field additions; kept separate from the pack-generated manifest. */
export const OVERWORLD_NPC_ART: Record<string, OverworldEntity> = {
  namek_trader: {
    provenance: 'Codex native imagegen (Namek village trader 4x4 directional atlas, 2026-11-05)',
    approved: true,
    canvas: [144, 144],
    anchor: [72, 140],
    scale: 1,
    limitations: ['One approved Namekian merchant identity; 3 authored walk drawings plus a held idle in each direction.'],
    dirs: Object.fromEntries(['down', 'up', 'left', 'right'].map((dir) => [dir, {
      idle: ['idle_000.png'],
      walk: ['walk_000.png', 'walk_001.png', 'walk_002.png', 'walk_001.png'],
      walkMs: 130,
    }])) as OverworldEntity['dirs'],
  },
  namek_elder: {
    provenance: 'Codex native imagegen (Namek elder healer 4x4 directional atlas, 2026-11-05)',
    approved: true,
    canvas: [144, 144],
    anchor: [72, 140],
    scale: 1,
    limitations: ['One elder identity; 3 authored walk drawings plus a held idle in each direction.'],
    dirs: Object.fromEntries(['down', 'up', 'left', 'right'].map((dir) => [dir, {
      idle: ['idle_000.png'], walk: ['walk_000.png', 'walk_001.png', 'walk_002.png', 'walk_001.png'], walkMs: 150,
    }])) as OverworldEntity['dirs'],
  },
  namek_child: {
    provenance: 'Codex native imagegen (Namek child villager 4x4 directional atlas, 2026-11-05)',
    approved: true,
    canvas: [144, 144],
    anchor: [72, 140],
    scale: 1,
    limitations: ['One child identity; 3 authored walk drawings plus a held idle in each direction; intentionally shorter than adult villagers.'],
    dirs: Object.fromEntries(['down', 'up', 'left', 'right'].map((dir) => [dir, {
      idle: ['idle_000.png'], walk: ['walk_000.png', 'walk_001.png', 'walk_002.png', 'walk_001.png'], walkMs: 120,
    }])) as OverworldEntity['dirs'],
  },
  namek_villager: {
    provenance: 'Codex native imagegen (Namek adult villager 4x4 directional atlas, 2026-11-05)',
    approved: true,
    canvas: [144, 144],
    anchor: [72, 140],
    scale: 1,
    limitations: ['One adult villager identity; 3 authored walk drawings plus a held idle in each direction.'],
    dirs: Object.fromEntries(['down', 'up', 'left', 'right'].map((dir) => [dir, {
      idle: ['idle_000.png'], walk: ['walk_000.png', 'walk_001.png', 'walk_002.png', 'walk_001.png'], walkMs: 145,
    }])) as OverworldEntity['dirs'],
  },
};
