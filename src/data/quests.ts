import type { Cond } from '../engine/world/mapTypes';

export interface QuestReward { zeni?: number; xp?: number; items?: Record<string, number>; training?: number }
export interface QuestStepDef { text: string; done: Cond }
export interface QuestDef {
  id: string;
  name: string;
  giver: string;
  place: string;
  /** The quest can be offered once this holds. */
  available: Cond;
  /** Set when accepted. Alpha 3f's Ridge Ambush already used `ridge_helped`, so old saves keep their progress. */
  startFlag: string;
  steps: QuestStepDef[];
  turnIn: string;
  summary: string;
  reward: QuestReward;
  /** Honest note about when the quest stops being possible. */
  missable: string;
}

export const QUEST_DONE = (id: string) => `qd:${id}`;
const AFTER_FRIEZA = 'All side quests close for good once the confrontation with Frieza begins at the landing zone.';

export const QUESTS: QuestDef[] = [
  { id: 'shore_net', name: 'Stolen Supplies', giver: 'Namekian fisher', place: 'Azure Shore', available: { flag: 'scouts1' }, startFlag: 'q:shore_net',
    summary: 'Frieza’s scouts took the fisher’s supplies and are patrolling the beach with them.',
    steps: [{ text: 'Defeat the scout patrol on the beach', done: { flag: 'foe:shore_foe1' } }, { text: 'Recover the fisher’s supply sack', done: { flag: 'qp:shore_sack' } }],
    turnIn: 'The Namekian fisher at Azure Shore', reward: { items: { senzu: 1 }, zeni: 120, xp: 150 }, missable: AFTER_FRIEZA },
  { id: 'aojan_medicine', name: 'Medicine for the Elders', giver: 'Aojan elder', place: 'Aojan Village', available: { flag: 'dende_met' }, startFlag: 'q:aojan_medicine',
    summary: 'The village elders are worn out after the raids and need medical supplies.',
    steps: [{ text: 'Bring 2 Med Kits to the village elder (buy them from the trader if needed)', done: { has: { medkit: 2 } } }],
    turnIn: 'The Namekian elder in Aojan Village', reward: { items: { vitalcap: 1 }, zeni: 150, xp: 250 }, missable: AFTER_FRIEZA },
  { id: 'grotto_child', name: 'Lost in the Grotto', giver: 'Namekian child', place: 'Aojan Village', available: { flag: 'dodoria_done' }, startFlag: 'q:grotto_child',
    summary: 'A child’s little brother followed the soldiers east and never came home.',
    steps: [{ text: 'Find the lost child in the Crystal Grotto', done: { flag: 'qp:grotto_child_found' } }],
    turnIn: 'The Namekian child in Aojan Village', reward: { items: { guardcap: 1 }, zeni: 100, xp: 200 }, missable: AFTER_FRIEZA },
  { id: 'camp_bounty', name: 'Bounty on the Patrols', giver: 'Aojan trader', place: 'Aojan Village', available: { flag: 'dodoria_done' }, startFlag: 'q:camp_bounty',
    summary: 'The trader will pay well for anyone who thins out the patrols around Frieza’s camp.',
    steps: [{ text: 'Defeat the camp patrol at the Landing Zone', done: { flag: 'foe:landing_foe1' } }, { text: 'Defeat the elite patrol at the Landing Zone', done: { flag: 'foe:landing_foe2' } }],
    turnIn: 'The trader in Aojan Village', reward: { zeni: 300, items: { megakit: 1 }, xp: 300 }, missable: AFTER_FRIEZA },
  { id: 'ship_logbook', name: 'Frieza’s Logbook', giver: 'Found in the ship hold', place: 'Frieza’s Ship · Hold', available: { flag: 'dodoria_done' }, startFlag: 'q:ship_logbook',
    summary: 'Somewhere in the ship hold lies an order log. Guru will want to read how Frieza hunts the Dragon Balls.',
    steps: [{ text: 'Search Frieza’s ship hold for his order log', done: { flag: 'qp:logbook' } }],
    turnIn: 'Guru, at the Sanctuary', reward: { training: 3, xp: 400 }, missable: AFTER_FRIEZA },
  { id: 'ridge_ambush', name: 'The Ridge Ambush', giver: 'Frightened Namekian', place: 'Namek Highlands', available: { flag: 'guru_done' }, startFlag: 'ridge_helped',
    summary: 'Soldiers ambushed a group of travellers. One of them still lurks in the northern grass.',
    steps: [{ text: 'Defeat the ambush party in the northern grass', done: { flag: 'foe:ridge_foe1' } }],
    turnIn: 'The frightened Namekian on the Highlands', reward: { items: { medkit: 2 }, zeni: 150, xp: 350 }, missable: AFTER_FRIEZA },
  { id: 'nail_hold', name: 'Nail’s Request', giver: 'Nail', place: 'Guru’s Sanctuary', available: { flag: 'guru_done', not: 'piccolo_joined' }, startFlag: 'q:nail_hold',
    summary: 'Nail wants the guards in Frieza’s ship hold cleared before the Ginyu Force arrives.',
    steps: [{ text: 'Defeat the first hold guard patrol', done: { flag: 'foe:hold_foe1' } }, { text: 'Defeat the second hold guard patrol', done: { flag: 'foe:hold_foe2' } }],
    turnIn: 'Nail at Guru’s Sanctuary', reward: { items: { powercap: 1 }, zeni: 200, xp: 400 },
    missable: 'Only until Frieza strikes the Sanctuary after the Ginyu Force: Nail then fuses with Piccolo and the request closes.' },
];
export const questById = (id: string) => QUESTS.find((q) => q.id === id);
