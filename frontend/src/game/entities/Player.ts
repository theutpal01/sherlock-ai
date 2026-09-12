import Phaser from 'phaser';
import { IDLE_FRAMES, ensureCharAnims, type Facing } from '../art';
import { touchState } from '../touch';

const SPEED = 230;

/**
 * Player detective: 4-direction walk cycles from the verified CC-BY
 * cast sheet. Direction follows the dominant velocity axis.
 */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private wasd: KeyMap | undefined;
  private lastDir: Facing = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    ensureCharAnims(scene, 'player');
    this.sprite = scene.physics.add.sprite(x, y, 'char-player', IDLE_FRAMES.down);
    this.sprite.setScale(2);
    this.sprite.setDepth(10);
    this.sprite.setCollideWorldBounds(true);

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      this.wasd = keyboard.addKeys('W,A,S,D') as KeyMap;
    }
  }

  update(): void {
    let dx = 0;
    let dy = 0;
    if (this.cursors) {
      if (this.cursors.left.isDown) dx -= 1;
      if (this.cursors.right.isDown) dx += 1;
      if (this.cursors.up.isDown) dy -= 1;
      if (this.cursors.down.isDown) dy += 1;
    }
    if (this.wasd) {
      if (this.wasd.A.isDown) dx -= 1;
      if (this.wasd.D.isDown) dx += 1;
      if (this.wasd.W.isDown) dy -= 1;
      if (this.wasd.S.isDown) dy += 1;
    }
    if (touchState.left) dx -= 1;
    if (touchState.right) dx += 1;
    if (touchState.up) dy -= 1;
    if (touchState.down) dy += 1;
    if (dx !== 0 && dy !== 0) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    this.sprite.setVelocity(dx * SPEED, dy * SPEED);
    if (dx === 0 && dy === 0) {
      this.sprite.stop();
      this.sprite.setFrame(IDLE_FRAMES[this.lastDir]);
      return;
    }
    const dir: Facing =
      Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
    this.lastDir = dir;
    this.sprite.play(`char-player-walk-${dir}`, true);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  /** Full stop: velocity, animation, facing (window-blur recovery). */
  fullStop(): void {
    this.sprite.setVelocity(0, 0);
    this.sprite.stop();
    this.sprite.setFrame(IDLE_FRAMES[this.lastDir]);
  }
}

type KeyMap = Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
