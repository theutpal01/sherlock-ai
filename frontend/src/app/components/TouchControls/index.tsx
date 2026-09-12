import { gameEvents } from '../../../game/events/bridge';
import { resetTouch, touchState } from '../../../game/touch';

type Dir = 'up' | 'down' | 'left' | 'right';

const BUTTONS: Array<{ dir: Dir; label: string; className: string }> = [
  { dir: 'up', label: '▲', className: 'col-start-2 row-start-1' },
  { dir: 'left', label: '◀', className: 'col-start-1 row-start-2' },
  { dir: 'right', label: '▶', className: 'col-start-3 row-start-2' },
  { dir: 'down', label: '▼', className: 'col-start-2 row-start-3' },
];

/**
 * Touch controls: D-pad + action button, shown only on coarse-pointer
 * devices. The D-pad writes shared touch state (read by Player); the
 * action button travels the same bridge path as the E key.
 */
export default function TouchControls() {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function' ||
    !window.matchMedia('(pointer: coarse)').matches
  ) {
    return null;
  }

  const set = (dir: Dir, on: boolean) => (e: React.SyntheticEvent) => {
    e.preventDefault();
    touchState[dir] = on;
  };

  return (
    <>
      <div
        className="pointer-events-none absolute bottom-3 left-3 grid select-none grid-cols-3 grid-rows-3 gap-1"
        style={{ touchAction: 'none' }}
        aria-label="Movement pad"
      >
        {BUTTONS.map((b) => (
          <button
            key={b.dir}
            className={`pixel-btn pointer-events-auto h-12 w-12 rounded bg-stone-900/80 text-lg text-amber-200 ${b.className}`}
            onPointerDown={set(b.dir, true)}
            onPointerUp={set(b.dir, false)}
            onPointerLeave={set(b.dir, false)}
            onPointerCancel={set(b.dir, false)}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={`Move ${b.dir}`}
          >
            {b.label}
          </button>
        ))}
      </div>
      <button
        className="pixel-btn absolute bottom-6 right-3 h-16 w-16 rounded-full bg-amber-800/90 font-pixel text-xs text-amber-100"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          e.preventDefault();
          gameEvents.emit({ type: 'INTERACT_PRESSED' });
        }}
        onPointerUp={resetTouch}
        aria-label="Interact"
      >
        E
      </button>
    </>
  );
}
