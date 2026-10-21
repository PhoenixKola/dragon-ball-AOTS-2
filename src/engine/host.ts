import Phaser from 'phaser';
import { BootScene, type BootReport } from './scenes/BootScene';
import { BattleScene } from './scenes/BattleScene';
import { WorldScene } from './scenes/WorldScene';
import { TitleScene } from './scenes/TitleScene';
import { CutsceneScene } from './scenes/CutsceneScene';
import { GAME_SCALE, LOGICAL_H, LOGICAL_W, type StageFit } from './gameScale';
import type { BattleController } from './combat/controller';

/** Owns the single Phaser.Game instance. React talks to scenes only through controllers started here. */
class GameHost {
  game: Phaser.Game | null = null;
  report: BootReport | null = null;
  private starting: Promise<BootReport> | null = null;
  progress = 0;
  private progressListeners = new Set<(v: number) => void>();
  onProgress(fn: (v: number) => void) { this.progressListeners.add(fn); fn(this.progress); return () => { this.progressListeners.delete(fn); }; }

  init(parent: HTMLElement, fit: StageFit): Promise<BootReport> {
    if (this.starting) return this.starting;
    GAME_SCALE.k = fit.k; GAME_SCALE.z = fit.z;
    this.starting = new Promise<BootReport>((resolve) => {
      this.game = new Phaser.Game({
        type: Phaser.AUTO, parent, width: LOGICAL_W * fit.k, height: LOGICAL_H * fit.k, backgroundColor: '#000000',
        scene: [BootScene, BattleScene, WorldScene, TitleScene, CutsceneScene], scale: { mode: Phaser.Scale.NONE },
        render: { antialias: true, pixelArt: false, roundPixels: false, powerPreference: 'high-performance' },
        input: { keyboard: false, mouse: true, touch: true, gamepad: false }, audio: { noAudio: true }, fps: { target: 60 },
        banner: false,
      });
      (window as unknown as { __game?: Phaser.Game }).__game = this.game;
      this.game.events.on(Phaser.Core.Events.PRE_RENDER, () => this.syncCameras());
      this.game.events.on('boot-progress', (v: number) => { this.progress = v; this.progressListeners.forEach((f) => f(v)); });
      this.game.events.once('boot-done', (r: BootReport) => { this.report = r; resolve(r); });
    });
    return this.starting;
  }

  /** A scene's main camera must always cover the whole canvas; a stale size shrinks the picture into a corner of the stage. */
  private syncCameras() {
    const g = this.game; if (!g) return;
    const w = g.scale.width, h = g.scale.height;
    for (const sc of g.scene.getScenes(true)) { const c = sc.cameras?.main; if (c && (c.width !== w || c.height !== h)) c.setSize(w, h); }
  }

  applyFit(fit: StageFit) {
    const g = this.game; if (!g) return;
    const changed = fit.k !== GAME_SCALE.k;
    GAME_SCALE.k = fit.k; GAME_SCALE.z = fit.z;
    if (changed) g.scale.resize(LOGICAL_W * fit.k, LOGICAL_H * fit.k);
    this.syncCameras();
    const c = g.canvas; if (c) { c.style.width = fit.cssW + 'px'; c.style.height = fit.cssH + 'px'; }
  }

  private pendingTransition: (() => void) | null = null;
  private transitionScheduled = false;
  /**
   * Scene changes are only ever executed at a safe frame boundary (after every scene finished its update),
   * never from inside a scene's own update/draw. The most recent request in a frame wins.
   */
  private transition(fn: () => void) {
    const g = this.game; if (!g) return;
    this.pendingTransition = fn;
    if (this.transitionScheduled) return;
    this.transitionScheduled = true;
    g.events.once(Phaser.Core.Events.POST_STEP, () => {
      this.transitionScheduled = false;
      const f = this.pendingTransition; this.pendingTransition = null;
      try { f?.(); } catch (e) { console.error('scene transition failed', e); }
    });
  }
  /** Names of currently active scenes (used by tests and the diagnostics overlay). */
  activeScenes(): string[] {
    const g = this.game; if (!g) return [];
    return ['battle', 'world', 'title', 'cutscene'].filter((k) => g.scene.isActive(k));
  }

  private stopAll() {
    const g = this.game; if (!g) return;
    for (const key of ['battle', 'world', 'title', 'cutscene']) if (g.scene.isActive(key) || g.scene.isPaused(key)) g.scene.stop(key);
  }
  startBattle(controller: BattleController) {
    this.transition(() => { const g = this.game!; this.stopAll(); g.scene.start('battle', { controller }); });
  }
  startWorld(data: unknown) {
    this.transition(() => { const g = this.game!; this.stopAll(); g.scene.start('world', data as object); });
  }
  startTitle() { this.transition(() => { const g = this.game!; this.stopAll(); g.scene.start('title'); }); }
  startCutscene(onDone: () => void) { this.transition(() => { const g = this.game!; this.stopAll(); g.scene.start('cutscene', { onDone }); }); }
  stop() { this.stopAll(); }
  scene<T extends Phaser.Scene>(key: string): T | null { return (this.game?.scene.getScene(key) as T) ?? null; }
}
export const host = new GameHost();
