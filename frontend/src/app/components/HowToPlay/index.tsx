import { useDialogFocus } from '../../hooks/useDialogFocus';

/** How-to-play modal: static content, Escape to close. */
export default function HowToPlay({ onClose }: { onClose: () => void }) {
  const { dialogRef, handleKeyDown } = useDialogFocus(onClose);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="pixel-panel max-h-[calc(100dvh_-_2rem)] w-full max-w-lg overflow-y-auto rounded bg-stone-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="how-to-play-title" className="font-pixel text-sm text-amber-300">HOW TO PLAY</h2>
        <button
          onClick={onClose}
          autoFocus
          className="pixel-btn mt-3 min-h-11 w-full rounded bg-amber-800 px-3 py-2 text-sm font-semibold text-amber-100"
        >
          Close help (Esc)
        </button>
        <ul className="mt-3 space-y-2 text-stone-300">
          <li>· Move with <b>Arrow keys</b> or <b>WASD</b>. Walk into a gold doorway to change rooms; walk into a locked door or tap its lock to read the hint.</li>
          <li>· With a controller, move with the left stick or D-pad and press the bottom face button (<b>A</b> on Xbox, <b>X</b> on PlayStation) to interact.</li>
          <li>· Press <b>E</b> or activate the nearby <b>Talk</b> or <b>Examine</b> button when it appears. <b>Esc</b> pauses; leaving the tab pauses automatically.</li>
          <li>· On touch screens: use the <b>D-pad</b> to move, <b>tap</b> objects and characters, or press the nearby action button labeled <b>Talk</b> or <b>Examine</b>.</li>
          <li>· With a keyboard on a touch device, <b>Tab</b> to a D-pad direction and hold <b>Enter</b> or <b>Space</b> to move. Tab to <b>Talk</b> or <b>Examine</b>, then press <b>Enter</b> or <b>Space</b> to interact.</li>
          <li>· Every discovery becomes a structured fact; the engine derives deductions — open <b>WHY?</b> on any of them.</li>
        </ul>
        <details className="mt-2 border-t border-stone-800 pt-3">
          <summary className="min-h-11 cursor-pointer select-none py-2 font-semibold text-amber-200 underline-offset-4 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 marker:text-amber-300">
            More tools and saved data
          </summary>
          <ul className="mt-2 space-y-2 text-stone-300">
          <li>
            · The workbench has three tabs: <b>Case File</b> for clues and accusations,
            <b>Reasoning</b> for contradictions and links, and <b>Field Kit</b> for the map,
            photos, hints, and log. Open a saved photo full-size from its thumbnail, then use
            Previous/Next or the left/right arrow keys to browse the shots. Discovery photos
            also link back to their clue. Use <b>Download all photos</b> for a self-contained
            offline report. Click the
            in-game evidence counter to jump to your notebook. In the What-if sandbox, use
            <b>Review</b> beside a clue to open it without losing your selections. Reasoning’s{' '}
            <b>Chronology</b> shows time facts and evidence-backed incident-time deductions only when they link
            to clues you have found. Select a source clue to inspect it. Witness reports, alibis, and deductions
            are labeled separately.
            Use <b>Download chronology</b> to save the ordered, source-cited entries as Markdown.
          </li>
          <li>
            · In the What-if sandbox, choose a person, room, and time, then whether the person was
            seen there or claimed to be there. In Advanced facts, separate arguments with commas
            and fill each value; empty slots prevent the test from running. Combine this with Advanced facts for a read-only
            analysis that never changes your case. <b>Clear scenario</b> resets hypothetical facts
            and the result; evidence exclusions stay as set until you use <b>Clear exclusions</b>.
            Download a Markdown report to keep the exclusions, submitted facts, and comparison.
          </li>
          <li>· Add tags and private notes in the notebook. They stay in this browser and never change deductions. The Forensics lab is an optional memory exercise: watch and repeat the highlighted tiles; notes play only while sound is enabled. It adds a local badge.</li>
          <li>· The Field Kit map tracks explored rooms, clues in rooms you have reached, and where suspects were last seen. Select a found clue marker on the map to open that clue in your notebook.</li>
          <li>· The Investigation Log keeps recent events live. Expand <b>Search session history</b> to search or filter retained room changes, evidence finds, examinations, dialogue replies, ambient remarks, and case events by room or NPC. The NPC filter applies to recorded dialogue replies; ambient remarks are separate entries. The archive is saved for the active investigation in browser storage; a warning appears if it cannot be saved or restored. The Dialogue panel restores its reply history from retained NPC replies in this archive. Download the filtered history as Markdown; the report notes if older events were not retained. Select <b>Open clue</b> beside an evidence find to jump to it in the notebook.</li>
          <li>· People move and new threads unlock as you find things. Talk to everyone; nearby ambient remarks may change with the room, but they are flavor, not evidence.</li>
          <li>· <b>Possible suspect ≠ guilty.</b> Query each suspect, weigh the supporting and contradicting evidence, then accuse — the verdict is final for that session.</li>
          <li>· Investigation progress is stored by the game server, with a browser session reference used to resume at the last recorded room. A fresh investigation starts at the case opening room. If session references cannot be read or saved in browser storage, an amber warning appears; server-side progress remains intact, but the session may not resume after a reload.</li>
          <li>· Use <b>Browser data backup</b> on the title screen to save local notes, tags, photos, analysis marks, badges, settings, and session references. It does not contain server-stored investigation state; session references work only with the same game server.</li>
          <li>· The Case of the Day is shared for its UTC date, including NPC starting positions. Its saved run is separate from regular case progress and from other dates; continue until you reach a verdict, then replay it.</li>
          <li>· Stuck? Ask for a hint (−50 pts, Standard mode only).</li>
          <li>· Score: 1000 − 50/hint − 10/action, floored at 100, doubled in Classic.</li>
          </ul>
        </details>
        <button
          onClick={onClose}
          className="pixel-btn mt-4 min-h-11 w-full rounded bg-amber-800 px-3 py-2 text-sm font-semibold text-amber-100"
        >
          Got it (Esc)
        </button>
      </div>
    </div>
  );
}
