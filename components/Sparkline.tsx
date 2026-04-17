type Accent =
  | "green" | "cyan" | "purple" | "orange" | "red" | "yellow" | "pink" | "blue";

const STROKE: Record<Accent, string> = {
  green:  "#3dffb0",
  cyan:   "#44e7ff",
  purple: "#c77dff",
  orange: "#ff9f45",
  red:    "#ff4d6d",
  yellow: "#ffe94a",
  pink:   "#ff5db1",
  blue:   "#5b8cff",
};

export function Sparkline({
  data,
  accent = "cyan",
  width = 160,
  height = 40,
  strokeWidth = 1.75,
}: {
  data: number[];
  accent?: Accent;
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  // If no data, show a flat line
  const values = data.length > 0 ? data : [0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const linePath = `M ${pts.join(" L ")}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  const color = STROKE[accent];
  const id = `spark-${accent}-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full h-full"
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={areaPath} fill={`url(#${id})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${id}-glow)`}
      />
    </svg>
  );
}
