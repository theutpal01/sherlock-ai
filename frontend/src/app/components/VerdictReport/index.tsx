import type { AccuseResult } from '../../../api/client';
import { readBestStars, starsFor } from '../../verdictStars';
import RatingStars from '../RatingStars';

/** Full verdict report: shared by the case-closed overlay. */
export default function VerdictReport({
  verdict,
  streak,
  caseId,
  onFocusEvidence,
}: {
  verdict: AccuseResult;
  streak?: number;
  caseId?: string;
  onFocusEvidence?: (id: string) => void;
}) {
  const stars = starsFor(verdict);
  const best = caseId ? Math.max(readBestStars(caseId), stars) : stars;
  return (
    <div>
      <p className={`font-pixel text-lg ${verdict.correct ? 'text-green-300' : 'text-red-300'}`}>
        {verdict.correct ? 'CASE SOLVED' : 'WRONG ACCUSATION'}
      </p>
      {verdict.correct && (
        <p className="mt-1 font-pixel text-sm text-amber-300">
          <RatingStars value={stars} label={`${stars} of 3 stars`} />
          {caseId && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-stone-400">
              best <RatingStars value={best} label={`${best} of 3 stars`} />
            </span>
          )}
        </p>
      )}
      <p className="mt-1 text-sm font-semibold text-stone-100">{verdict.accused_name}</p>
      {typeof streak === 'number' && streak > 0 && (
        <p className="mt-1 font-pixel text-xs text-amber-300">
          Peak deduction streak: {streak}
        </p>
      )}
      <p className="mt-1 text-sm text-stone-300">{verdict.summary}</p>
      {verdict.solution_timeline.length > 0 && (
        <details className="mt-3 rounded border border-amber-900/70 bg-stone-900/70 p-2">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-amber-200 underline decoration-amber-800 underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
            Reveal the full case timeline (spoilers)
          </summary>
          <ol className="mt-2 list-decimal space-y-2 border-t border-stone-800 pl-6 pt-2 text-sm leading-relaxed text-stone-200">
            {verdict.solution_timeline.map((event, index) => (
              <li key={`${index}-${event}`}>{event}</li>
            ))}
          </ol>
        </details>
      )}
      <p className="mt-1 font-mono text-xs text-stone-400">support: {verdict.support_level}</p>
      <p className="mt-1 font-mono text-xs text-amber-200">
        score: {verdict.score}
        {verdict.breakdown && (
          <>
            {' '}
            (base {verdict.breakdown.base} − hints {verdict.breakdown.hint_cost} − actions{' '}
            {verdict.breakdown.action_cost}
            {verdict.breakdown.multiplier > 1 ? ` ×${verdict.breakdown.multiplier} classic` : ''})
          </>
        )}
      </p>
      {verdict.supporting.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-semibold text-stone-200">Supporting</p>
          <ul className="text-sm text-stone-300">
            {verdict.supporting.map((e) => (
              <li key={e.id}>
                · {onFocusEvidence ? (
                  <button
                    type="button"
                    onClick={() => onFocusEvidence(e.id)}
                    className="min-h-11 text-left text-amber-200 underline decoration-amber-700 underline-offset-2 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  >{e.title}</button>
                ) : e.title}{' '}
                <span className="font-mono text-xs text-stone-400">({e.via.join('; ')})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {verdict.contradicting.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-semibold text-stone-200">Pointing elsewhere</p>
          <ul className="text-sm text-stone-300">
            {verdict.contradicting.map((e) => (
              <li key={e.id}>
                · {onFocusEvidence ? (
                  <button
                    type="button"
                    onClick={() => onFocusEvidence(e.id)}
                    className="min-h-11 text-left text-amber-200 underline decoration-amber-700 underline-offset-2 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  >{e.title}</button>
                ) : e.title}{' '}
                <span className="font-mono text-xs text-stone-400">({e.via.join('; ')})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {verdict.leads_remaining.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-semibold text-stone-200">Leads left unexamined</p>
          <ul className="text-sm text-stone-300">
            {verdict.leads_remaining.map((title, index) => {
              const id = verdict.leads_remaining_ids[index];
              return (
                <li key={id ?? `${title}-${index}`}>
                  · {id && onFocusEvidence ? (
                    <button
                      type="button"
                      onClick={() => onFocusEvidence(id)}
                      className="min-h-11 text-left text-amber-200 underline decoration-amber-700 underline-offset-2 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                    >{title}</button>
                  ) : title}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-snug text-stone-300">
        {verdict.why}
      </pre>
    </div>
  );
}
