import Phaser from 'phaser';
import { Scene } from './scenes/Scene';

/** Create exactly one Phaser.Game per mount (spec 17: no duplicate instance). */
export function createGame(
  parent: HTMLElement,
  caseId = 'blackwood_manor',
  initialRoomId?: string,
  dailySeed?: number,
): Phaser.Game {
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
    input: { gamepad: true },
    scene: [Scene],
  };
  const game = new Phaser.Game(config);
  // Set synchronously post-construct, pre-boot: Scene.create() reads these
  // values to pick the case layout and resume a saved investigation's room.
  game.registry.set('caseId', caseId);
  game.registry.set('initialRoomId', initialRoomId);
  game.registry.set('dailySeed', dailySeed);
  return game;
}

export function destroyGame(game: Phaser.Game | undefined): void {
  if (!game) return;
  try {
    // Deterministic scene teardown first: game.destroy() alone does not
    // reliably fire scene shutdown, which leaked bridge subscriptions
    // into dead scenes (displayList null crash).
    const scene = game.scene.getScene('manor') as unknown as Scene | null;
    scene?.teardown();
  } catch {
    /* scene already gone — nothing to unsubscribe */
  }
  game.destroy(true);
}

/**
 * Capture the live canvas as a downscaled JPEG data URL for the photo log.
 * Uses the renderer's snapshot path (works without preserveDrawingBuffer);
 * resolves null when capture is unavailable. Never throws.
 */
export function snapshotGame(game: Phaser.Game, maxWidth = 320): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const renderer = game.renderer as unknown as {
        snapshot(cb: (img: HTMLImageElement) => void): void;
      };
      renderer.snapshot((img) => {
        try {
          const scale = Math.min(1, maxWidth / Math.max(1, img.width));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } catch {
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
  });
}
