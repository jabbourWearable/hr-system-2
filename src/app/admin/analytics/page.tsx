import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  BarList,
  ColumnChart,
  TrendLineChart,
  VizTable,
} from "@/components/analytics/charts";
import {
  RANGE_OPTIONS,
  buildBuckets,
  countBy,
  countPerBucket,
  cumulativePerBucket,
  inclusiveDaySpan,
  resolveRangeKey,
} from "@/lib/analytics/analytics";
import { LeaveStatusBadge } from "@/components/leave/status-badge";
import type { LeaveStatus } from "@/types/database";

// Admin-facing analytics & reporting (HR-76), mirroring hibob's Analytics
// layer over the data the app already collects: headcount (profiles),
// attendance trends (attendance), leave utilization (leave_requests), and
// kudos/engagement (kudos). Gated by requireRole('admin') here — every page
// under /admin must call this itself (see ARCHITECTURE.md). RLS's
// *_admin_all policies grant the read; queries below only narrow by date.
//
// Leave note: this dashboard measures *booked* leave — approved days on
// requests submitted in the period — because requests are typically filed
// for future dates (all current live rows are), so "days already taken"
// would read as an empty chart while vacations sit fully approved.

const RESIDUAL_LABELS = new Set(["Unassigned", "No department"]);

/** Sort desc by count but keep residual buckets ("Unassigned") last. */
function residualLast(entries: [string, number][]): [string, number][] {
  return [
    ...entries.filter(([label]) => !RESIDUAL_LABELS.has(label)),
    ...entries.filter(([label]) => RESIDUAL_LABELS.has(label)),
  ];
}

function ChartHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4 space-y-0.5">
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      <p className="text-xs text-mute">{sub}</p>
    </div>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireRole("admin");
  const { range: rawRange } = await searchParams;
  const range = resolveRangeKey(rawRange);
  const buckets = buildBuckets(range, new Date());
  const rangeStart = buckets[0].start;
  const rangeStartISO = rangeStart.toISOString();
  const unitNoun = range === "30d" ? "day" : range === "90d" ? "week" : "month";
  const supabase = await createClient();

  const [profilesRes, sitesRes, attendanceRes, leaveRes, kudosRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, department, site_id, created_at"),
      supabase.from("sites").select("id, name"),
      supabase
        .from("attendance")
        .select("check_in_at, check_out_at")
        .gte("check_in_at", rangeStartISO),
      supabase
        .from("leave_requests")
        .select("status, leave_type, start_date, end_date, created_at")
        .gte("created_at", rangeStartISO),
      supabase
        .from("kudos")
        .select("recipient_id, category, created_at")
        .gte("created_at", rangeStartISO),
    ]);

  const profiles = profilesRes.data ?? [];
  const sites = sitesRes.data ?? [];
  const attendance = attendanceRes.data ?? [];
  const leave = leaveRes.data ?? [];
  const kudos = kudosRes.data ?? [];

  // Headcount --------------------------------------------------------------
  const newJoiners = profiles.filter(
    (p) => new Date(p.created_at).getTime() >= rangeStart.getTime(),
  ).length;
  const growth = cumulativePerBucket(
    profiles.map((p) => p.created_at),
    buckets,
  );
  const byDepartment = residualLast(
    countBy(profiles, (p) => p.department?.trim() || "No department"),
  );
  const siteNames = new Map(sites.map((s) => [s.id, s.name]));
  const bySite = residualLast(
    countBy(profiles, (p) =>
      p.site_id ? (siteNames.get(p.site_id) ?? "Unknown site") : "Unassigned",
    ),
  );

  // Attendance ---------------------------------------------------------------
  const checkInsPerBucket = countPerBucket(
    attendance.map((r) => r.check_in_at),
    buckets,
  );
  const completedShifts = attendance.filter((r) => r.check_out_at);
  const avgShiftHours =
    completedShifts.length > 0
      ? completedShifts.reduce(
          (sum, r) =>
            sum +
            (new Date(r.check_out_at!).getTime() -
              new Date(r.check_in_at).getTime()) /
              3_600_000,
          0,
        ) / completedShifts.length
      : null;

  // Leave -----------------------------------------------------------------
  const statusCounts = new Map(countBy(leave, (r) => r.status));
  const approvedLeave = leave.filter((r) => r.status === "approved");
  const approvedDaysByType = residualLast(
    [
      ...approvedLeave
        .reduce((acc, r) => {
          const days = inclusiveDaySpan(r.start_date, r.end_date);
          acc.set(r.leave_type, (acc.get(r.leave_type) ?? 0) + days);
          return acc;
        }, new Map<string, number>())
        .entries(),
    ].sort((a, b) => b[1] - a[1]),
  );
  const approvedDaysTotal = approvedDaysByType.reduce(
    (sum, [, days]) => sum + days,
    0,
  );

  // Kudos -------------------------------------------------------------------
  const kudosPerBucket = countPerBucket(
    kudos.map((k) => k.created_at),
    buckets,
  );
  const kudosByCategory = countBy(kudos, (k) => k.category);
  const nameOf = new Map(profiles.map((p) => [p.id, p.full_name]));
  const topRecipients = countBy(kudos, (k) => k.recipient_id)
    .slice(0, 5)
    .map(([id, count]) => ({
      label: nameOf.get(id) ?? "Former employee",
      value: count,
    }));

  const kpis = [
    {
      label: "Headcount today",
      value: String(profiles.length),
      sub: `+${newJoiners} joined in period`,
      subTone: newJoiners > 0 ? "text-accent-green" : "text-mute",
    },
    {
      label: "Check-ins in period",
      value: String(attendance.length),
      sub:
        avgShiftHours === null
          ? "No completed shifts"
          : `Avg shift ${avgShiftHours.toFixed(1)}h`,
      subTone: "text-mute",
    },
    {
      label: "Approved leave days",
      value: String(approvedDaysTotal),
      sub: `${approvedLeave.length} requests approved`,
      subTone: "text-mute",
    },
    {
      label: "Kudos in period",
      value: String(kudos.length),
      sub: kudosByCategory[0]
        ? `Top: ${kudosByCategory[0][0]}`
        : "None given yet",
      subTone: "text-mute",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl sm:text-4xl">Analytics</h1>
          <p className="text-sm text-mute">
            Headcount, attendance, leave, and recognition across the company.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm font-medium text-link hover:underline"
        >
          Back to admin
        </Link>
      </div>

      {/* Date range presets — one row, scopes everything below it. */}
      <nav aria-label="Date range" className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((option) => (
          <Link
            key={option.key}
            href={`/admin/analytics?range=${option.key}`}
            aria-current={option.key === range ? "page" : undefined}
            className={
              option.key === range
                ? "rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-on"
                : "rounded-full border border-hairline-strong bg-elevated px-3.5 py-1.5 text-xs font-medium text-body transition-colors hover:border-stone hover:text-ink"
            }
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <section className="space-y-3">
        <h2 className="section-label">Overview</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="card p-5">
              <p className="display-serif text-4xl">{kpi.value}</p>
              <p className="section-label mt-2">{kpi.label}</p>
              <p className={`mt-1 text-xs ${kpi.subTone}`}>{kpi.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Headcount</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5 lg:col-span-2">
            <ChartHeader
              title="Headcount growth"
              sub={`Total accounts at the end of each ${unitNoun}`}
            />
            <TrendLineChart
              points={buckets.map((bucket, i) => ({
                label: bucket.label,
                longLabel: bucket.longLabel,
                value: growth[i],
              }))}
              seriesLabel="accounts"
              ariaLabel={`Headcount growth per ${unitNoun}`}
            />
            <VizTable
              caption="Headcount growth data"
              columns={[
                unitNoun === "day"
                  ? "Date"
                  : unitNoun === "week"
                    ? "Week"
                    : "Month",
                "Accounts",
              ]}
              rows={buckets.map((bucket, i) => [bucket.longLabel, growth[i]])}
            />
          </div>
          <div className="card p-5">
            <ChartHeader title="By department" sub="Current headcount" />
            <BarList
              items={byDepartment.map(([label, value]) => ({ label, value }))}
              emptyText="No employees yet."
            />
          </div>
          <div className="card p-5">
            <ChartHeader title="By work site" sub="Current assignment" />
            <BarList
              items={bySite.map(([label, value]) => ({ label, value }))}
              emptyText="No employees yet."
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Attendance</h2>
        <div className="card p-5">
          <ChartHeader
            title="Check-ins"
            sub={`Geo-verified check-ins per ${unitNoun}`}
          />
          <ColumnChart
            points={buckets.map((bucket, i) => ({
              label: bucket.label,
              longLabel: bucket.longLabel,
              value: checkInsPerBucket[i],
            }))}
            seriesLabel="check-ins"
            ariaLabel={`Check-ins per ${unitNoun}`}
          />
          {attendance.length === 0 && (
            <p className="mt-2 text-sm text-mute">
              No check-ins in this period.
            </p>
          )}
          <VizTable
            caption="Check-ins data"
            columns={[
              unitNoun === "day"
                ? "Date"
                : unitNoun === "week"
                  ? "Week"
                  : "Month",
              "Check-ins",
            ]}
            rows={buckets.map((bucket, i) => [
              bucket.longLabel,
              checkInsPerBucket[i],
            ])}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Leave</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <ChartHeader
              title="Approved days by type"
              sub="Booked leave on requests submitted in the period"
            />
            <BarList
              items={approvedDaysByType.map(([label, value]) => ({
                label,
                value,
              }))}
              unit=" days"
              emptyText="No approved leave in this period."
            />
          </div>
          <div className="card p-5">
            <ChartHeader
              title="Requests by status"
              sub="Requests submitted in the period"
            />
            <ul className="space-y-2.5">
              {(["pending", "approved", "rejected"] as LeaveStatus[]).map(
                (status) => (
                  <li
                    key={status}
                    className="flex items-center justify-between gap-3"
                  >
                    <LeaveStatusBadge status={status} />
                    <span className="font-mono text-xs tabular-nums text-ink">
                      {statusCounts.get(status) ?? 0}
                    </span>
                  </li>
                ),
              )}
            </ul>
            <p className="mt-4 border-t border-hairline pt-3 text-xs text-mute">
              {leave.length} request{leave.length === 1 ? "" : "s"} submitted in
              this period.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Kudos &amp; engagement</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5 lg:col-span-2">
            <ChartHeader title="Kudos given" sub={`Kudos posted per ${unitNoun}`} />
            <ColumnChart
              points={buckets.map((bucket, i) => ({
                label: bucket.label,
                longLabel: bucket.longLabel,
                value: kudosPerBucket[i],
              }))}
              seriesLabel="kudos"
              ariaLabel={`Kudos per ${unitNoun}`}
            />
            {kudos.length === 0 && (
              <p className="mt-2 text-sm text-mute">
                No kudos in this period.
              </p>
            )}
            <VizTable
              caption="Kudos data"
              columns={[
                unitNoun === "day"
                  ? "Date"
                  : unitNoun === "week"
                    ? "Week"
                    : "Month",
                "Kudos",
              ]}
              rows={buckets.map((bucket, i) => [
                bucket.longLabel,
                kudosPerBucket[i],
              ])}
            />
          </div>
          <div className="card p-5">
            <ChartHeader title="By category" sub="Kudos given in the period" />
            <BarList
              items={kudosByCategory.map(([label, value]) => ({
                label,
                value,
              }))}
              emptyText="No kudos in this period."
            />
          </div>
          <div className="card p-5">
            <ChartHeader
              title="Top recipients"
              sub="Most-recognized people in the period"
            />
            <BarList
              items={topRecipients}
              emptyText="No kudos in this period."
            />
          </div>
        </div>
      </section>
    </main>
  );
}
