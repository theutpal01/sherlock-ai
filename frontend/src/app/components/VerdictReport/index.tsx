import type { AccuseResult } from '../../../api/client';

/** Full verdict report: shared by the case-closed overlay. */
export default function VerdictReport({ verdict }: { verdict: AccuseResult }) {
  return (
    <div>
      <p className={`font-pixel text-lg ${verdict.correct ? 'text-green-300' : 'text-red-300'}`}>
        {verdict.correct ? '★ CASE SOLVED ★' : '✗ WRONG ACCUSATION'}
      </p>
      <p className="mt-1 text-sm font-semibold text-stone-100">{verdict.accused_name}</p>
      <p className="mt-1 text-sm text-stone-300">{verdict.summary}</p>
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
                · {e.title}{' '}
                <span className="font-mono text-xs text-stone-500">({e.via.join('; ')})</span>
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
                · {e.title}{' '}
                <span className="font-mono text-xs text-stone-500">({e.via.join('; ')})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {verdict.leads_remaining.length > 0 && (
        <p className="mt-2 text-sm text-stone-400">
          Leads left unexamined: {verdict.leads_remaining.join(' · ')}
        </p>
      )}
      <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-snug text-stone-300">
        {verdict.why}
      </pre>
    </div>
  );
}
