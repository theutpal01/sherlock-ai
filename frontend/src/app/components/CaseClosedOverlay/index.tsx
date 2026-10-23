import type { AccuseResult } from '../../../api/client';
import type { Achievement } from '../../achievements';
import { useState } from 'react';
import VerdictReport from '../VerdictReport';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { starsFor } from '../../verdictStars';

/** Full-screen verdict: the accusation stands, with replay options. */
export default function CaseClosedOverlay({
  verdict,
  streak,
  caseId,
  unlocks,
  achievementStorageWarning,
  starStorageWarning,
  onReplay,
  onReview,
  onFocusEvidence,
  onMenu,
}: {
  verdict: AccuseResult;
  streak: number;
  caseId: string;
  unlocks: Achievement[];
  achievementStorageWarning: boolean;
  starStorageWarning: boolean;
  onReplay: () => void;
  onReview: () => void;
  onFocusEvidence: (id: string) => void;
  onMenu: () => void;
}) {
  const { dialogRef, handleKeyDown, skipFocusRestore } = useDialogFocus();
  const [exportStatus, setExportStatus] = useState('');

  const exportCaseReport = () => {
    const inline = (value: string) => value.replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|');
    const quote = (value: string) => value.split(/\r?\n/).map((line) => `> ${line}`).join('\n');
    const sections = [
      '# SherlockAI Case Report',
      '',
      `- Case: ${inline(caseId)}`,
      `- Outcome: ${verdict.correct ? 'Solved' : 'Incorrect accusation'}`,
      `- Accused: ${inline(verdict.accused_name)}`,
      `- Score: ${verdict.score} (${starsFor(verdict)} of 3 stars)`,
      `- Support level: ${inline(verdict.support_level)}`,
      ...(typeof streak === 'number' && streak > 0 ? [`- Peak deduction streak: ${streak}`] : []),
      ...(verdict.breakdown ? [
        `- Score breakdown: ${verdict.breakdown.base} base − ${verdict.breakdown.hint_cost} hints − ${verdict.breakdown.action_cost} actions${verdict.breakdown.multiplier > 1 ? ` ×${verdict.breakdown.multiplier} classic` : ''}`,
      ] : []),
      '',
      '## Summary',
      '',
      quote(verdict.summary),
      ...(verdict.supporting.length > 0 ? [
        '',
        '## Supporting evidence',
        '',
        ...verdict.supporting.map((item) => `- ${inline(item.title)} (${inline(item.id)}): ${item.via.map(inline).join('; ')}`),
      ] : []),
      ...(verdict.contradicting.length > 0 ? [
        '',
        '## Evidence pointing elsewhere',
        '',
        ...verdict.contradicting.map((item) => `- ${inline(item.title)} (${inline(item.id)}): ${item.via.map(inline).join('; ')}`),
      ] : []),
      ...(verdict.leads_remaining.length > 0 ? [
        '',
        '## Leads left unexamined',
        '',
        ...verdict.leads_remaining.map((title, index) => `- ${inline(title)}${verdict.leads_remaining_ids[index] ? ` (${inline(verdict.leads_remaining_ids[index])})` : ''}`),
      ] : []),
      ...(verdict.solution_timeline.length > 0 ? [
        '',
        '## Full case timeline (spoilers)',
        '',
        ...verdict.solution_timeline.map((event, index) => `${index + 1}. ${inline(event)}`),
      ] : []),
      '',
      '## Reasoning',
      '',
      quote(verdict.why),
      '',
      `Exported ${new Date().toLocaleDateString()}. This report contains case spoilers.`,
      '',
    ];

    try {
      const safeCaseId = caseId.replace(/[^a-z0-9_-]/gi, '-');
      const url = URL.createObjectURL(new Blob([sections.join('\n')], { type: 'text/markdown;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `sherlock-${safeCaseId}-case-report.md`;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportStatus('Spoiler-labeled case report downloaded.');
    } catch {
      setExportStatus('Could not download the case report.');
    }
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-closed-title"
      onKeyDown={handleKeyDown}
    >
      <div className="pixel-panel anim-fade-up max-h-[calc(100dvh_-_2rem)] w-full max-w-xl overflow-y-auto rounded bg-stone-950 p-5">
        <h2 id="case-closed-title" className="sr-only">
          {verdict.correct ? 'Case solved' : 'Incorrect accusation'}
        </h2>
        <VerdictReport
          verdict={verdict}
          streak={streak}
          caseId={caseId}
          onFocusEvidence={(id) => {
            onFocusEvidence(id);
            onReview();
          }}
        />
        <div className="mt-3">
          <button
            type="button"
            onClick={exportCaseReport}
            className="min-h-11 rounded border border-amber-800 px-3 text-xs font-semibold text-amber-200 hover:bg-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            Download case report (contains spoilers)
          </button>
          <p role="status" aria-live="polite" className="mt-1 min-h-4 text-xs text-stone-400">
            {exportStatus}
          </p>
        </div>
        {starStorageWarning && (
          <p className="mt-2 rounded border border-amber-800 bg-amber-950/40 p-2 text-xs text-amber-200" role="status" aria-live="polite">
            The saved best-score data could not be read or saved. This score is visible here, but may not be available later.
          </p>
        )}
        {unlocks.length > 0 && (
          <div className="mt-3 rounded border border-amber-800 bg-amber-950/40 p-2" role="status" aria-live="polite">
            <p className="font-pixel text-xs text-amber-300">BADGE UNLOCKED</p>
            <ul className="mt-1 space-y-1">
              {unlocks.map((a) => (
                <li key={a.id} className="text-sm text-amber-100">
                  <span className="font-semibold">{a.name}</span>
                  <span className="text-amber-300/80"> — {a.desc}</span>
                </li>
              ))}
            </ul>
            {achievementStorageWarning && (
              <p className="mt-2 text-xs text-amber-200" role="status">
                Browser storage is unavailable. These badges are unlocked for this visit but may not persist after reload.
              </p>
            )}
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button onClick={onReplay} autoFocus className="pixel-btn min-h-11 rounded bg-amber-800 px-2 py-2 text-sm font-semibold text-amber-100">
            Play again
          </button>
          <button onClick={onReview} className="pixel-btn min-h-11 rounded bg-stone-900 px-2 py-2 text-sm text-stone-200">
            Review scene
          </button>
          <button onClick={() => { skipFocusRestore(); onMenu(); }} className="pixel-btn min-h-11 rounded bg-stone-900 px-2 py-2 text-sm text-stone-200">
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
