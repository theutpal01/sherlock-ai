import Phaser from 'phaser';
import { IDLE_FRAMES, ensureCharAnims, type Facing } from '../art';
import { touchState } from '../touch';

const SPEED = 230;

/** Player detective with a generated four-direction walk cycle. */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private gamepad: Phaser.Input.Gamepad.GamepadPlugin | null = null;
  private lastDir: Facing = 'down';
  private ignoreMovementUntilReleased = false;

  private keys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    ensureCharAnims(scene, 'player');
    this.sprite = scene.physics.add.sprite(x, y, 'char-player', IDLE_FRAMES.down);
    this.sprite.setScale(2);
    // Keep collision on the feet instead of the full 48×64 display sprite.
    // A 36×16 footprint leaves clearance through the 48px door openings.
    this.sprite.body?.setSize(18, 8).setOffset(3, 24);
    this.sprite.setDepth(3.4);
    this.sprite.setCollideWorldBounds(true);
    this.gamepad = scene.input.gamepad;

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.keys = keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.UP,
        down: Phaser.Input.Keyboard.KeyCodes.DOWN,
        left: Phaser.Input.Keyboard.KeyCodes.LEFT,
        right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        w: Phaser.Input.Keyboard.KeyCodes.W,
        s: Phaser.Input.Keyboard.KeyCodes.S,
        a: Phaser.Input.Keyboard.KeyCodes.A,
        d: Phaser.Input.Keyboard.KeyCodes.D,
      }) as typeof this.keys;
    }
  }

  update(allowKeyboard = true, allowGamepad = true): void {
    let dx = 0;
    let dy = 0;

    if (allowKeyboard && this.keys) {
      if (this.keys.left.isDown || this.keys.a.isDown) dx -= 1;
      if (this.keys.right.isDown || this.keys.d.isDown) dx += 1;
      if (this.keys.up.isDown || this.keys.w.isDown) dy -= 1;
      if (this.keys.down.isDown || this.keys.s.isDown) dy += 1;
    }

    if (touchState.left) dx -= 1;
    if (touchState.right) dx += 1;
    if (touchState.up) dy -= 1;
    if (touchState.down) dy += 1;

    const pad = this.gamepad?.pad1;
    if (allowGamepad && pad?.connected) {
      const stickX = Math.abs(pad.leftStick.x) >= 0.25 ? pad.leftStick.x : 0;
      const stickY = Math.abs(pad.leftStick.y) >= 0.25 ? pad.leftStick.y : 0;
      dx += stickX + (pad.left ? -1 : 0) + (pad.right ? 1 : 0);
      dy += stickY + (pad.up ? -1 : 0) + (pad.down ? 1 : 0);
    }

    // Inputs from multiple devices should never multiply movement speed.
    dx = Math.sign(dx);
    dy = Math.sign(dy);

    // An interaction should stop the detective so the turn toward its
    // target remains visible. If a direction was held, wait for release
    // before accepting movement again; this avoids immediately walking
    // through a clue or NPC while the interaction panel opens.
    if (this.ignoreMovementUntilReleased) {
      if (dx === 0 && dy === 0) this.ignoreMovementUntilReleased = false;
      else dx = dy = 0;
    }

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

  /** Turn toward the person or clue that just received an interaction. */
  faceToward(x: number, y: number): void {
    const dx = x - this.x;
    const dy = y - this.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.lastDir = dx >= 0 ? 'right' : 'left';
    } else {
      this.lastDir = dy >= 0 ? 'down' : 'up';
    }
    this.ignoreMovementUntilReleased = true;
    this.sprite.setVelocity(0, 0);
    this.sprite.stop();
    this.sprite.setFrame(IDLE_FRAMES[this.lastDir]);
  }

  /** Full stop: velocity, animation, facing (window-blur recovery). */
  fullStop(): void {
    this.ignoreMovementUntilReleased = false;
    this.sprite.setVelocity(0, 0);
    this.sprite.stop();
    this.sprite.setFrame(IDLE_FRAMES[this.lastDir]);
  }
}

type KeyMap = Record<'ArrowUp' | 'ArrowLeft' | 'ArrowDown' | 'ArrowRight', Phaser.Input.Keyboard.Key>;
