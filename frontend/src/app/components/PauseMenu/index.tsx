/** Pause overlay: the Phaser scene is frozen via bridge commands. */
export default function PauseMenu({
  onResume,
  onHowTo,
  onRestart,
  onQuit,
  muted,
  onMute,
}: {
  onResume: () => void;
  onHowTo: () => void;
  onRestart: () => void;
  onQuit: () => void;
  muted: boolean;
  onMute: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Paused"
    >
      <div className="pixel-panel w-full max-w-sm rounded bg-stone-950 p-5 text-center">
        <h2 className="font-pixel text-sm text-stone-100">PAUSED</h2>
        <div className="mt-4 flex flex-col gap-2">
          <button onClick={onResume} autoFocus className="pixel-btn rounded bg-amber-800 px-3 py-2 text-sm font-semibold text-amber-100">
            Resume (Esc)
          </button>
          <button onClick={onHowTo} className="pixel-btn rounded bg-stone-900 px-3 py-2 text-sm text-stone-200">
            How to play
          </button>
          <button onClick={onMute} className="pixel-btn rounded bg-stone-900 px-3 py-2 text-sm text-stone-200" aria-pressed={!muted}>
            Sound: {muted ? 'off' : 'on'}
          </button>
          <button onClick={onRestart} className="pixel-btn rounded bg-stone-900 px-3 py-2 text-sm text-stone-200">
            Restart investigation
          </button>
          <button onClick={onQuit} className="pixel-btn rounded bg-stone-900 px-3 py-2 text-sm text-red-300">
            Quit to menu
          </button>
        </div>
      </div>
    </div>
  );
}
