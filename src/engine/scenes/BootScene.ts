import Phaser from 'phaser';
import { SPRITE_BOXES } from '../../data/spriteManifest.generated';
import { ACTOR_DIR, texKey } from '../assets';
import { WORLD_OBJECTS, WORLD_TEXTURES } from '../world/worldAssets';
import { overworldTextures } from '../world/overworld';
import { vfxTextures, registerBeamFrames, auraRiseTextures } from '../animation/vfxSprites';
import { frameTexKey, powerupFrameNames } from '../animation/gokuForms';

export interface BootReport { ok: boolean; missing: string[] }

/** Preloads every critical resource. Missing files fail loudly (diagnostics), never silently. */
export class BootScene extends Phaser.Scene {
  missing: string[] = [];
  constructor() { super('boot'); }
  preload() {
    this.load.on('loaderror', (file: Phaser.Loader.File) => { this.missing.push(file.key + ' <- ' + file.url); });
    for (const [sprite, poses] of Object.entries(SPRITE_BOXES)) for (const pose of Object.keys(poses)) this.load.image(texKey(sprite, pose), `${ACTOR_DIR}/${sprite}_${pose}.png`);
    for (const name of WORLD_OBJECTS) this.load.image('o_' + name, `assets/world/obj/${name}.png`);
    for (const name of WORLD_TEXTURES) this.load.image('t_' + name, `assets/world/tex/${name}.png`);
    for (const [key, url] of overworldTextures()) this.load.image(key, url);
    for (const [key, url] of vfxTextures()) this.load.image(key, url);
    for (const [key, url] of auraRiseTextures()) this.load.image(key, url);
    for (const n of powerupFrameNames()) this.load.image(frameTexKey(n), `${ACTOR_DIR}/${n}.png`);
    this.load.on('progress', (v: number) => this.game.events.emit('boot-progress', v));
  }
  create() {
    // hard pixel art must never be smoothed: nearest filtering for overworld frames and VFX sprites
    for (const [key] of [...overworldTextures(), ...vfxTextures()]) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    registerBeamFrames(this.textures);
    const report: BootReport = { ok: this.missing.length === 0, missing: this.missing };
    this.game.events.emit('boot-done', report);
  }
}
