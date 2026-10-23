/** Compact, platform-independent star rating used in case cards and verdicts. */
export default function RatingStars({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const filled = Math.max(0, Math.min(3, Math.floor(value)));

  return (
    <span role="img" aria-label={label} className="inline-flex items-center gap-0.5 align-middle">
      {[0, 1, 2].map((index) => (
        <svg
          key={index}
          aria-hidden="true"
          focusable="false"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          shapeRendering="crispEdges"
        >
          <path
            d="M8 1 10 5 15 5 11 8 13 14 8 11 3 14 5 8 1 5 6 5Z"
            fill={index < filled ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="miter"
          />
        </svg>
      ))}
    </span>
  );
}
