/** Shared touch-input state: the D-pad writes, Player.update reads. */

export const touchState = {
  up: false,
  down: false,
  left: false,
  right: false,
};

export function resetTouch(): void {
  touchState.up = false;
  touchState.down = false;
  touchState.left = false;
  touchState.right = false;
}
