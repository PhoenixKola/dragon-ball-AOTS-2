import type { HeroId } from '../types';

export interface ComboRecipe {
  id: string;
  skill: string;
  members: HeroId[];
  name: string;
  hint: string;
  unlockFlag?: string; // story flag that teaches the recipe; undefined = known from the start
}

export const COMBOS: ComboRecipe[] = [
  { id: 'gohan_krillin', skill: 'combo_gohan_krillin', members: ['gohan', 'krillin'], name: 'Masenko Disc Rush', hint: 'Both need 50 Rage and must not have acted this round.' },
  { id: 'vegeta_krillin', skill: 'combo_vegeta_krillin', members: ['vegeta', 'krillin'], name: 'Disc & Galick', hint: 'Learned once Vegeta fights beside Krillin.', unlockFlag: 'vegeta_joined' },
  { id: 'goku_vegeta', skill: 'combo_goku_vegeta', members: ['goku', 'vegeta'], name: 'Saiyan Crossfire', hint: 'Learned when Goku and Vegeta first fight side by side.', unlockFlag: 'goku_joined' },
  { id: 'piccolo_gohan', skill: 'combo_piccolo_gohan', members: ['piccolo', 'gohan'], name: 'Master & Pupil Cannon', hint: 'Learned after Piccolo returns.', unlockFlag: 'piccolo_joined' },
  { id: 'z_trio', skill: 'combo_z_trio', members: ['goku', 'gohan', 'piccolo'], name: 'Z-Fighters Triple Strike', hint: 'Needs all three; learned after Piccolo returns.', unlockFlag: 'piccolo_joined' },
];
export const comboById = (id: string) => COMBOS.find((c) => c.id === id);
