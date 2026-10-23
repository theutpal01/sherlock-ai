import { useState, type RefObject } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

/** Pause overlay: the Phaser scene is frozen via bridge commands. */
export default function PauseMenu({
  onResume,
  onHowTo,
  onRestart,
  onQuit,
  muted,
  preferenceStorageWarning,
  sessionStorageWarning,
  onMute,
  volume,
  onVolume,
  returnFocusRef,
}: {
  onResume: () => void;
  onHowTo: () => void;
  onRestart: () => void;
  onQuit: () => void;
  muted: boolean;
  preferenceStorageWarning: boolean;
  sessionStorageWarning: boolean;
  onMute: () => void;
  volume: number;
  onVolume: (volume: number) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  const { dialogRef, handleKeyDown } = useDialogFocus(
    () => {
      if (confirmRestart) setConfirmRestart(false);
      else onResume();
    },
    returnFocusRef,
  );
  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role={confirmRestart ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby="pause-dialog-title"
      aria-describedby={confirmRestart ? 'restart-investigation-warning' : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="pixel-panel max-h-[calc(100dvh_-_2rem)] w-full max-w-sm overflow-y-auto rounded bg-stone-950 p-5 text-center">
        {confirmRestart ? (
          <>
            <h2 id="pause-dialog-title" className="font-pixel text-sm text-stone-100">RESTART INVESTIGATION?</h2>
            <p id="restart-investigation-warning" className="mt-3 text-sm text-stone-300">
              Your current evidence and interview progress will not carry into the new investigation.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={() => setConfirmRestart(false)} autoFocus className="pixel-btn min-h-11 rounded bg-stone-800 px-3 py-2 text-sm text-stone-100">
                Keep investigating
              </button>
              <button onClick={onRestart} className="pixel-btn min-h-11 rounded bg-red-900 px-3 py-2 text-sm font-semibold text-red-100">
                Start a new investigation
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="pause-dialog-title" className="font-pixel text-sm text-stone-100">PAUSED</h2>
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={onResume} autoFocus className="pixel-btn min-h-11 rounded bg-amber-800 px-3 py-2 text-sm font-semibold text-amber-100">
                Resume (Esc)
              </button>
              <button onClick={onHowTo} className="pixel-btn min-h-11 rounded bg-stone-900 px-3 py-2 text-sm text-stone-200">
                How to play
              </button>
              <button
                onClick={onMute}
                className="pixel-btn min-h-11 rounded bg-stone-900 px-3 py-2 text-sm text-stone-200"
                aria-pressed={!muted}
                aria-label="Sound effects"
              >
                Sound: {muted ? 'off' : 'on'}
              </button>
              <label className="flex min-h-11 items-center justify-between gap-2 rounded bg-stone-900 px-3 py-1 text-sm text-stone-200">
                <span>Volume</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(event) => onVolume(Number(event.currentTarget.value))}
                  aria-label="Sound effects volume"
                  aria-valuetext={`${Math.round(volume * 100)} percent`}
                  className="h-11 w-28 accent-amber-500"
                />
                <span className="min-w-8 text-right font-mono text-xs">{Math.round(volume * 100)}%</span>
              </label>
              {preferenceStorageWarning && (
                <p role="status" aria-live="polite" className="text-left text-xs text-amber-300">
                  Sound settings are active now, but browser storage is unavailable; they may reset after reload.
                </p>
              )}
              {sessionStorageWarning && (
                <p role="status" aria-live="polite" className="text-left text-xs text-amber-300">
                  Session references could not be read or saved in browser storage. Server-side progress remains intact, but this investigation may not resume after a reload.
                </p>
              )}
              <button onClick={() => setConfirmRestart(true)} className="pixel-btn min-h-11 rounded bg-stone-900 px-3 py-2 text-sm text-stone-200">
                Restart investigation
              </button>
              <button onClick={onQuit} className="pixel-btn min-h-11 rounded bg-stone-900 px-3 py-2 text-sm text-red-300">
                Quit to menu
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
