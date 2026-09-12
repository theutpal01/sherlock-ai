/** How-to-play modal: static content, Esc to close. */
export default function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
      onClick={onClose}
    >
      <div
        className="pixel-panel max-h-[85vh] w-full max-w-lg overflow-y-auto rounded bg-stone-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-pixel text-sm text-amber-300">HOW TO PLAY</h2>
        <ul className="mt-3 space-y-2 text-stone-300">
          <li>· Move with <b>WASD / arrow keys</b>. Walk into a gold doorway to change rooms.</li>
          <li>· Press <b>E</b> near an object to examine it, or near a character to talk.</li>
          <li>· On touch screens: use the <b>D-pad</b> to move, <b>tap</b> objects and characters, <b>E</b> button interacts.</li>
          <li>· Every discovery becomes a structured fact; the engine derives deductions — open <b>WHY?</b> on any of them.</li>
          <li>· People move and new threads unlock as you find things. Talk to everyone.</li>
          <li>· <b>Possible suspect ≠ guilty.</b> Query each suspect, weigh the supporting and contradicting evidence, then accuse — the verdict is final for that session.</li>
          <li>· Stuck? Ask for a hint (−50 pts, Standard mode only).</li>
          <li>· Score: 1000 − 50/hint − 10/action, floored at 100, doubled in Classic.</li>
        </ul>
        <button
          onClick={onClose}
          autoFocus
          className="pixel-btn mt-4 w-full rounded bg-amber-800 px-3 py-2 text-sm font-semibold text-amber-100"
        >
          Got it (Esc)
        </button>
      </div>
    </div>
  );
}
