export function ProgressBar({
  done,
  total,
  percent,
}: {
  done: number;
  total: number;
  percent: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-elevated"
      >
        <div
          className="h-full rounded-full bg-accent-green transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="whitespace-nowrap font-mono text-[13px] text-mute">
        {done}/{total} · {percent}%
      </span>
    </div>
  );
}
