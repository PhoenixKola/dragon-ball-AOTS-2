import type { HeroId } from '../types';
import { ITEM_ICON_IDS, SKILL_ICON_IDS } from '../data/artManifest.generated';

const KNOWN = ['trunks', 'trunks_ssj', 'gohan', 'goku', 'krillin', 'piccolo', 'vegeta', 'dende', 'nail', 'bulma', 'cui', 'cooler', 'ginyu', 'frieza1', 'zarbon', 'dodoria', 'recoome', 'jeice', 'burter', 'guldo', 'ssj_goku', 'frieza4'];
// forms and enemy variants that share a portrait
const ALIAS: Record<string, string> = { zarbon2: 'zarbon', frieza2: 'frieza1', frieza3: 'frieza1', frieza5: 'frieza4', scout: 'frieza1', guard: 'frieza1' };

export function Portrait({ id, className = '' }: { id: string; className?: string }) {
  const key = KNOWN.includes(ALIAS[id] ?? id) ? (ALIAS[id] ?? id) : 'dende';
  return <img className={className} alt="" draggable={false} src={`assets/portraits/${key}.png`} />;
}
export const heroLabel = (id: HeroId | string) => id.charAt(0).toUpperCase() + id.slice(1);
/**
 * Icon sources: `skill:<id>` (validated 32x32 per-skill icon), `item:<id>` (validated item icon),
 * `legacy:<name>` (older generic crop, kept only for commands with no validated equivalent).
 */
export function Icon({ name, className = 'ico' }: { name?: string; className?: string }) {
  if (!name) return null;
  const [kind, id] = name.includes(':') ? (name.split(/:(.*)/s) as [string, string]) : ['legacy', name];
  let src = '', cls = className;
  if (kind === 'skill' && SKILL_ICON_IDS.includes(id)) src = `assets/reviewed/icons/skills/${id}.png`;
  else if (kind === 'cmd') src = `assets/reviewed/icons/commands/${id}.png`;
  else if (kind === 'item' && ITEM_ICON_IDS.includes(id)) src = `assets/reviewed/icons/items/${id}.png`;
  else { src = `assets/skill-icons/${kind === 'legacy' ? id : 'attack'}.png`; cls += ' legacy'; }
  return <img className={cls} alt="" draggable={false} src={src} onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />;
}
