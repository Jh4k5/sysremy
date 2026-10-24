"use client";

/**
 * Systemy v3 — Sparkline يدوي (SVG inline)
 * نقاط ومسار بلون النوع بلا أي مكتبات رسم.
 * x: نسبة 0..1 عبر النطاق الزمني — النقاط الفارغة تُترك فجوات صادقة.
 */

const W = 100;
const H = 32;
const PAD_Y = 4;
const PAD_X = 3;

export interface SparkPoint {
  /** موضع النقطة عبر النطاق 0..1 */
  x: number;
  /** القيمة المسجلة */
  v: number;
}

export function Sparkline({
  points,
  color,
  label,
}: {
  points: SparkPoint[];
  color: string;
  label: string;
}) {
  if (points.length === 0) return null;

  const vs = points.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;

  const cx = (x: number) => PAD_X + Math.min(1, Math.max(0, x)) * (W - PAD_X * 2);
  const cy = (v: number) => PAD_Y + (1 - (v - min) / span) * (H - PAD_Y * 2);

  const coords = points.map((p) => ({ x: cx(p.x), y: cy(p.v) }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${last.x.toFixed(2)} ${H} L ${first.x.toFixed(2)} ${H} Z`
      : "";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="w-full h-9 block overflow-visible"
    >
      {areaPath && <path d={areaPath} fill={color} fillOpacity={0.1} />}
      {coords.length > 1 && (
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          opacity={0.9}
        />
      )}
      {coords.map((c, i) => (
        <path
          key={i}
          d={`M ${c.x.toFixed(2)} ${c.y.toFixed(2)} h 0.01`}
          stroke={color}
          strokeWidth={i === coords.length - 1 ? 4.5 : 3}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          opacity={i === coords.length - 1 ? 1 : 0.75}
        />
      ))}
    </svg>
  );
}
