import Phaser from 'phaser';
import { ManorScene } from './scenes/ManorScene';

/** Create exactly one Phaser.Game per mount (spec 17: no duplicate instance). */
export function createGame(parent: HTMLElement, caseId = 'blackwood_manor'): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 480,
    backgroundColor: '#0c0a09',
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [ManorScene],
  };
  const game = new Phaser.Game(config);
  // Set synchronously post-construct, pre-boot: ManorScene.create()
  // reads it to pick the case layout.
  game.registry.set('caseId', caseId);
  return game;
}

export function destroyGame(game: Phaser.Game | undefined): void {
  if (!game) return;
  try {
    // Deterministic scene teardown first: game.destroy() alone does not
    // reliably fire scene shutdown, which leaked bridge subscriptions
    // into dead scenes (displayList null crash).
    const scene = game.scene.getScene('manor') as unknown as ManorScene | null;
    scene?.teardown();
  } catch {
    /* scene already gone — nothing to unsubscribe */
  }
  game.destroy(true);
}
