export function LinePlot({
  series,
  label,
  background,
}: {
  series: { name: string; values: (number | null)[]; color: string }[];
  label: string;
  background?: number[];
}) {
  const values = series.flatMap((s) =>
    s.values.filter((v): v is number => v !== null && Number.isFinite(v)),
  );
  if (!values.length) return <p>Chưa đủ dữ liệu biểu đồ.</p>;
  const min = Math.min(...values),
    max = Math.max(...values),
    length = Math.max(...series.map((s) => s.values.length)),
    span = max - min || 1;
  return (
    <figure>
      <svg
        role="img"
        aria-label={label}
        viewBox="0 0 640 220"
        style={{ width: '100%', height: 'auto' }}
      >
        <title>{label}</title>
        <path d="M65 10V185H630" fill="none" stroke="currentColor" />
        {background?.map((score, i) => (
          <rect
            key={i}
            x={65 + (i / background.length) * 565}
            y={10}
            width={565 / background.length + 0.1}
            height={175}
            fill={score < 0 ? '#ba5566' : score > 0 ? '#237b62' : '#8999ad'}
            opacity={0.12}
          />
        ))}
        <text x="2" y="20" fill="currentColor" fontSize="12">
          {max.toFixed(2)}
        </text>
        <text x="2" y="185" fill="currentColor" fontSize="12">
          {min.toFixed(2)}
        </text>
        <text x="65" y="210" fill="currentColor" fontSize="12">
          0
        </text>
        <text x="560" y="210" fill="currentColor" fontSize="12">
          {length} sự kiện
        </text>
        {series.map((s) => {
          const segments: string[] = [];
          let segment = '';
          s.values.forEach((v, i) => {
            if (v === null || !Number.isFinite(v)) {
              if (segment) segments.push(segment);
              segment = '';
            } else
              segment += `${65 + (i / Math.max(1, length - 1)) * 565},${185 - ((v - min) / span) * 170} `;
          });
          if (segment) segments.push(segment);
          return (
            <g key={s.name}>
              {segments.map((points, i) => (
                <polyline key={i} points={points} stroke={s.color} strokeWidth="2" fill="none" />
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption>
        {label} · {series.map((s) => s.name).join(' / ')}
      </figcaption>
    </figure>
  );
}
