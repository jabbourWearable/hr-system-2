// Server-rendered SVG charts for the admin analytics dashboard (HR-76).
//
// Deliberately zero client JS: the hover/focus layer is pure CSS (see the
// "Analytics charts" section of globals.css) — every time bucket is a
// `.viz-band` <g> holding an invisible full-height hit rect (the hit target
// is the whole band, far bigger than the mark) plus a `.viz-hover` readout
// shown on hover/focus. Tooltips enhance, never gate: each chart ships a
// <VizTable> twin with every value as plain text.
//
// Mark vocabulary follows the dataviz method on top of DESIGN.md's tokens:
// single-series slot-1 hue only (--chart-series, validated per theme mode),
// columns ≤ 24px thick with a 4px rounded data-end and a square baseline,
// 2px lines with a surface-ringed end marker, solid hairline gridlines, and
// text in text tokens — never the series color.

type Point = { label: string; longLabel: string; value: number };

const VB_W = 720;
const VB_H = 240;
const M = { top: 26, right: 12, bottom: 26, left: 34 };
const PLOT_W = VB_W - M.left - M.right;
const PLOT_H = VB_H - M.top - M.bottom;
const BASELINE = M.top + PLOT_H;

function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(Math.max(rough, 1e-9)));
  for (const multiple of [1, 2, 5, 10]) {
    if (rough <= multiple * power) return multiple * power;
  }
  return 10 * power;
}

/** Rounded y-scale: clean tick values (0 / 2 / 4 …), top ≥ data max.
    Every metric on this dashboard is an integer count, so the step never
    drops below 1 (no fractional ticks on a count axis). */
function yScale(maxValue: number): { top: number; ticks: number[] } {
  const step = Math.max(1, niceStep(Math.max(maxValue, 1) / 3));
  const top = Math.max(step, Math.ceil(Math.max(maxValue, 1) / step) * step);
  const ticks: number[] = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);
  return { top, ticks };
}

function Gridlines({ ticks, top }: { ticks: number[]; top: number }) {
  return (
    <g aria-hidden>
      {ticks.map((tick) => {
        const y = BASELINE - (tick / top) * PLOT_H;
        return (
          <g key={tick}>
            <line
              x1={M.left}
              x2={VB_W - M.right}
              y1={y}
              y2={y}
              style={{
                stroke: tick === 0 ? "var(--hairline-strong)" : "var(--hairline)",
                strokeWidth: 1,
              }}
            />
            <text
              x={M.left - 6}
              y={y + 3}
              textAnchor="end"
              style={{
                fill: "var(--mute)",
                fontSize: 10,
                fontFamily: "var(--font-geist-mono)",
              }}
            >
              {tick}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function XTicks({ points, every }: { points: Point[]; every: number }) {
  const bandW = PLOT_W / points.length;
  return (
    <g aria-hidden>
      {points.map((point, i) =>
        i % every === 0 ? (
          <text
            key={i}
            x={M.left + bandW * (i + 0.5)}
            y={BASELINE + 16}
            textAnchor="middle"
            style={{
              fill: "var(--mute)",
              fontSize: 10,
              fontFamily: "var(--font-geist-mono)",
            }}
          >
            {point.label}
          </text>
        ) : null,
      )}
    </g>
  );
}

/** Fixed-position hover readout, top-right of the plot — value leads. */
function Readout({ value, text }: { value: number; text: string }) {
  return (
    <text x={VB_W - M.right} y={14} textAnchor="end" style={{ fontSize: 12 }}>
      <tspan style={{ fill: "var(--ink)", fontWeight: 600 }}>{value}</tspan>
      <tspan style={{ fill: "var(--mute)" }}> {text}</tspan>
    </text>
  );
}

/** Column with a 4px rounded data-end and a square baseline. */
function columnPath(x: number, yTop: number, width: number): string {
  const height = BASELINE - yTop;
  if (height <= 0) return "";
  const r = Math.min(4, width / 2, height);
  return [
    `M${x},${BASELINE}`,
    `L${x},${yTop + r}`,
    `Q${x},${yTop} ${x + r},${yTop}`,
    `L${x + width - r},${yTop}`,
    `Q${x + width},${yTop} ${x + width},${yTop + r}`,
    `L${x + width},${BASELINE}`,
    "Z",
  ].join(" ");
}

export function ColumnChart({
  points,
  seriesLabel,
  ariaLabel,
}: {
  points: Point[];
  /** Readout noun, e.g. "check-ins" → "12 check-ins · Jul 14". */
  seriesLabel: string;
  ariaLabel: string;
}) {
  const { top, ticks } = yScale(Math.max(...points.map((p) => p.value)));
  const bandW = PLOT_W / points.length;
  const colW = Math.min(24, Math.max(bandW - 2, 1));
  const tickEvery = Math.ceil(points.length / 7);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="h-auto w-full"
      role="group"
      aria-label={ariaLabel}
    >
      <Gridlines ticks={ticks} top={top} />
      <XTicks points={points} every={tickEvery} />
      {points.map((point, i) => {
        const bandX = M.left + bandW * i;
        const yTop = BASELINE - (point.value / top) * PLOT_H;
        return (
          <g key={i} className="viz-band">
            <path
              className="viz-mark"
              d={columnPath(bandX + (bandW - colW) / 2, yTop, colW)}
              style={{ fill: "var(--chart-series)" }}
            />
            <g className="viz-hover" aria-hidden>
              <Readout
                value={point.value}
                text={`${seriesLabel} · ${point.longLabel}`}
              />
            </g>
            <rect
              x={bandX}
              y={M.top}
              width={bandW}
              height={PLOT_H}
              fill="transparent"
              tabIndex={0}
              aria-label={`${point.longLabel}: ${point.value} ${seriesLabel}`}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function TrendLineChart({
  points,
  seriesLabel,
  ariaLabel,
}: {
  points: Point[];
  seriesLabel: string;
  ariaLabel: string;
}) {
  const { top, ticks } = yScale(Math.max(...points.map((p) => p.value)));
  const bandW = PLOT_W / points.length;
  const tickEvery = Math.ceil(points.length / 7);

  const cx = (i: number) => M.left + bandW * (i + 0.5);
  const cy = (value: number) => BASELINE - (value / top) * PLOT_H;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${cx(i)},${cy(p.value)}`)
    .join(" ");
  const areaPath = `${linePath} L${cx(points.length - 1)},${BASELINE} L${cx(0)},${BASELINE} Z`;

  const last = points[points.length - 1];
  const endX = cx(points.length - 1);
  const endY = cy(last.value);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="h-auto w-full"
      role="group"
      aria-label={ariaLabel}
    >
      <Gridlines ticks={ticks} top={top} />
      <XTicks points={points} every={tickEvery} />
      {/* area wash ~10% of the series hue, never a saturated block */}
      <path d={areaPath} style={{ fill: "var(--chart-series)", opacity: 0.1 }} />
      <path
        d={linePath}
        style={{
          fill: "none",
          stroke: "var(--chart-series)",
          strokeWidth: 2,
          strokeLinejoin: "round",
          strokeLinecap: "round",
        }}
      />
      {/* end marker (surface ring) + direct end label — the one labeled point */}
      <circle
        cx={endX}
        cy={endY}
        r={4}
        style={{
          fill: "var(--chart-series)",
          stroke: "var(--card)",
          strokeWidth: 2,
        }}
      />
      <text
        x={endX - 8}
        y={Math.max(endY - 8, M.top + 10)}
        textAnchor="end"
        style={{ fill: "var(--ink)", fontSize: 12, fontWeight: 600 }}
      >
        {last.value}
      </text>
      {points.map((point, i) => (
        <g key={i} className="viz-band">
          <g className="viz-hover" aria-hidden>
            <line
              x1={cx(i)}
              x2={cx(i)}
              y1={M.top}
              y2={BASELINE}
              style={{ stroke: "var(--stone)", strokeWidth: 1 }}
            />
            <circle
              cx={cx(i)}
              cy={cy(point.value)}
              r={4.5}
              style={{
                fill: "var(--chart-series)",
                stroke: "var(--card)",
                strokeWidth: 2,
              }}
            />
            <Readout
              value={point.value}
              text={`${seriesLabel} · ${point.longLabel}`}
            />
          </g>
          <rect
            x={M.left + bandW * i}
            y={M.top}
            width={bandW}
            height={PLOT_H}
            fill="transparent"
            tabIndex={0}
            aria-label={`${point.longLabel}: ${point.value} ${seriesLabel}`}
          />
        </g>
      ))}
    </svg>
  );
}

/**
 * Horizontal labeled bars for nominal categories (department, site, leave
 * type, kudos category). One series → every bar wears the same slot-1 hue,
 * and every bar carries a visible direct value label, so no tooltip or
 * separate table twin is needed.
 */
export function BarList({
  items,
  unit,
  emptyText,
}: {
  items: { label: string; value: number }[];
  /** Optional value suffix, e.g. " days". */
  unit?: string;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-mute">{emptyText}</p>;
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li
          key={i}
          className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-3"
        >
          <span className="truncate text-sm text-body" title={item.label}>
            {item.label}
          </span>
          <span aria-hidden className="h-2.5">
            <span
              className="block h-full rounded-r-[4px]"
              style={{
                width: `${(item.value / max) * 100}%`,
                background: "var(--chart-series)",
              }}
            />
          </span>
          <span className="font-mono text-xs tabular-nums text-ink">
            {item.value}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The table-view twin of a time-series chart — the WCAG-clean equivalent. */
export function VizTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: [string, string];
  rows: [string, string | number][];
}) {
  return (
    <details>
      <summary className="w-fit cursor-pointer text-xs text-mute transition-colors hover:text-ink">
        View data
      </summary>
      <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-hairline">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-hairline text-left">
            <tr>
              <th className="section-label px-3 py-2">{columns[0]}</th>
              <th className="section-label px-3 py-2">{columns[1]}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td className="px-3 py-1.5 text-body">{label}</td>
                <td className="px-3 py-1.5 font-mono text-xs tabular-nums text-ink">
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
