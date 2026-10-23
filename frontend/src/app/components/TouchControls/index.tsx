import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { gameEvents } from '../../../game/events/bridge';
import { touchState } from '../../../game/touch';
import type { NearbyInteraction } from '../../hooks/useGameEvents';

type Dir = 'up' | 'down' | 'left' | 'right';

const BUTTONS: Array<{ dir: Dir; column: number; row: number }> = [
  { dir: 'up', column: 2, row: 1 },
  { dir: 'left', column: 1, row: 2 },
  { dir: 'right', column: 3, row: 2 },
  { dir: 'down', column: 2, row: 3 },
];

function DirectionArrow({ dir }: { dir: Dir }) {
  const rotation = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16" shapeRendering="crispEdges">
      <path
        d="M6 7v7h4V7h5L8 0 1 7h5z"
        fill="currentColor"
        transform={`rotate(${rotation} 8 8)`}
      />
    </svg>
  );
}

/**
 * Touch controls: D-pad + action button, shown only on coarse-pointer
 * devices. The D-pad writes shared touch state (read by Player); the
 * action button travels the same bridge path as the E key.
 */
export default function TouchControls({ nearbyInteraction }: { nearbyInteraction: NearbyInteraction | null }) {
  const [visible, setVisible] = useState(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(any-pointer: coarse)').matches,
  );
  const heldInputs = useRef<Record<Dir, { pointers: Set<number>; keys: Set<string> }>>({
    up: { pointers: new Set(), keys: new Set() },
    down: { pointers: new Set(), keys: new Set() },
    left: { pointers: new Set(), keys: new Set() },
    right: { pointers: new Set(), keys: new Set() },
  });
  const assistiveMoveTimers = useRef<Partial<Record<Dir, ReturnType<typeof setTimeout>>>>({});
  const lastKeyboardActivationAt = useRef<Partial<Record<Dir, number>>>({});

  const syncDirection = (dir: Dir) => {
    const held = heldInputs.current[dir];
    touchState[dir] = held.pointers.size > 0 || held.keys.size > 0;
  };

  const resetInputs = useCallback(() => {
    lastKeyboardActivationAt.current = {};
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const timer = assistiveMoveTimers.current[dir];
      if (timer) clearTimeout(timer);
      delete assistiveMoveTimers.current[dir];
      heldInputs.current[dir].pointers.clear();
      heldInputs.current[dir].keys.clear();
      touchState[dir] = false;
    }
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const coarsePointer = window.matchMedia('(any-pointer: coarse)');
    const updatePointerMode = (event: MediaQueryListEvent) => {
      setVisible(event.matches);
      if (!event.matches) resetInputs();
    };
    coarsePointer.addEventListener('change', updatePointerMode);
    return () => coarsePointer.removeEventListener('change', updatePointerMode);
  }, [resetInputs]);

  useEffect(() => {
    const resetWhenHidden = () => {
      if (document.visibilityState === 'hidden') resetInputs();
    };
    window.addEventListener('blur', resetInputs);
    document.addEventListener('visibilitychange', resetWhenHidden);
    return () => {
      window.removeEventListener('blur', resetInputs);
      document.removeEventListener('visibilitychange', resetWhenHidden);
      resetInputs();
    };
  }, [resetInputs]);

  if (!visible) return null;

  const setPointer = (dir: Dir, on: boolean) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (on) heldInputs.current[dir].pointers.add(e.pointerId);
    else heldInputs.current[dir].pointers.delete(e.pointerId);
    syncDirection(dir);
  };
  const setFromKey = (dir: Dir, on: boolean) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    lastKeyboardActivationAt.current[dir] = performance.now();
    if (on) heldInputs.current[dir].keys.add(e.key);
    else heldInputs.current[dir].keys.delete(e.key);
    syncDirection(dir);
  };
  const moveOnAssistiveClick = (dir: Dir) => (e: MouseEvent<HTMLButtonElement>) => {
    // Physical pointer holds are handled by pointer events. A synthetic
    // click-only activation (common with screen readers) gets a short step.
    if (e.detail !== 0) return;
    const keyboardActivationAt = lastKeyboardActivationAt.current[dir];
    if (keyboardActivationAt !== undefined && performance.now() - keyboardActivationAt < 300) return;
    const previous = assistiveMoveTimers.current[dir];
    if (previous) clearTimeout(previous);
    heldInputs.current[dir].keys.add('assistive-activation');
    syncDirection(dir);
    assistiveMoveTimers.current[dir] = setTimeout(() => {
      heldInputs.current[dir].keys.delete('assistive-activation');
      delete assistiveMoveTimers.current[dir];
      syncDirection(dir);
    }, 180);
  };

  return (
    <div className="flex items-center justify-between gap-2 border-t border-stone-800 bg-stone-950 px-2 py-2">
      <div
        role="group"
        className="grid shrink-0 select-none grid-cols-3 grid-rows-3 gap-1"
        style={{ touchAction: 'none' }}
        aria-label="Movement pad"
      >
        {BUTTONS.map((b) => (
          <button
            key={b.dir}
            className="pixel-btn h-11 w-11 rounded bg-stone-900 text-lg text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            style={{ gridColumn: b.column, gridRow: b.row, touchAction: 'none' }}
            type="button"
            onPointerDown={setPointer(b.dir, true)}
            onPointerUp={setPointer(b.dir, false)}
            onPointerLeave={setPointer(b.dir, false)}
            onPointerCancel={setPointer(b.dir, false)}
            onClick={moveOnAssistiveClick(b.dir)}
            onKeyDown={setFromKey(b.dir, true)}
            onKeyUp={setFromKey(b.dir, false)}
            onBlur={() => {
              heldInputs.current[b.dir].keys.clear();
              delete lastKeyboardActivationAt.current[b.dir];
              syncDirection(b.dir);
            }}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={`Move ${b.dir}; activate for a short step or hold Enter or Space to move`}
            aria-keyshortcuts="Enter Space"
          >
            <DirectionArrow dir={b.dir} />
          </button>
        ))}
      </div>
      <button
        className="pixel-btn touch-action-btn flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-800 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-white"
        style={{ touchAction: 'none' }}
        onClick={() => gameEvents.emit({ type: 'INTERACT_PRESSED' })}
        disabled={!nearbyInteraction}
        aria-label={nearbyInteraction
          ? `${nearbyInteraction.kind === 'npc' ? 'Talk to' : 'Examine'} ${nearbyInteraction.label}`
          : 'No nearby person or object to interact with'}
        aria-keyshortcuts="E Enter Space"
      >
        <span className="font-mono text-[10px] font-semibold leading-none">
          {nearbyInteraction?.kind === 'npc' ? 'Talk' : nearbyInteraction ? 'Examine' : 'Use'}
        </span>
      </button>
    </div>
  );
}
