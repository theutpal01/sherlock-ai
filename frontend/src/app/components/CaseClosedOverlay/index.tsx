import type { AccuseResult } from '../../../api/client';
import VerdictReport from '../VerdictReport';

/** Full-screen verdict: the accusation stands, with replay options. */
export default function CaseClosedOverlay({
  verdict,
  onReplay,
  onReview,
  onMenu,
}: {
  verdict: AccuseResult;
  onReplay: () => void;
  onReview: () => void;
  onMenu: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Case closed"
    >
      <div className="pixel-panel max-h-[88vh] w-full max-w-xl overflow-y-auto rounded bg-stone-950 p-5">
        <VerdictReport verdict={verdict} />
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={onReplay} autoFocus className="pixel-btn rounded bg-amber-800 px-2 py-2 text-sm font-semibold text-amber-100">
            Play again
          </button>
          <button onClick={onReview} className="pixel-btn rounded bg-stone-900 px-2 py-2 text-sm text-stone-200">
            Review scene
          </button>
          <button onClick={onMenu} className="pixel-btn rounded bg-stone-900 px-2 py-2 text-sm text-stone-200">
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
