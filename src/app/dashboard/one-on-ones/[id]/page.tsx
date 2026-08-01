import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadProfilesByIds } from "@/lib/performance/profiles";
import { OneOnOneStatusBadge } from "@/components/performance/status-badges";
import { markOneOnOneCompleted } from "../actions";
import { NoteForm } from "../note-form";

// 1:1 meeting detail (HR-78). Shared notes: one note either participant can
// read/edit. Private notes: only the current viewer's own private note is
// ever fetched — one_on_one_notes_select (0010_performance_reviews_goals.sql)
// makes it impossible for this query to return the other participant's
// private note even if it were requested, but the `.eq("author_id", ...)`
// below keeps the intent explicit and means this page never even asks for
// data it shouldn't get back. There is deliberately no admin view of this
// page's note content — see ARCHITECTURE.md.
export default async function OneOnOneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("one_on_ones")
    .select("id, employee_id, manager_id, meeting_date, status")
    .eq("id", id)
    .single();

  if (!meeting) notFound();

  const [{ data: sharedNote }, { data: myPrivateNote }] = await Promise.all([
    supabase
      .from("one_on_one_notes")
      .select("body")
      .eq("one_on_one_id", id)
      .eq("visibility", "shared")
      .maybeSingle(),
    supabase
      .from("one_on_one_notes")
      .select("body")
      .eq("one_on_one_id", id)
      .eq("visibility", "private")
      .eq("author_id", user.id)
      .maybeSingle(),
  ]);

  const otherId = user.id === meeting.employee_id ? meeting.manager_id : meeting.employee_id;
  const profileMap = await loadProfilesByIds(supabase, [otherId]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="display-serif text-3xl">
              {profileMap.get(otherId)?.fullName ?? "1:1"}
            </h1>
            <OneOnOneStatusBadge status={meeting.status} />
          </div>
          <p className="font-mono text-[13px] text-mute">{meeting.meeting_date}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Link
            href="/dashboard/one-on-ones"
            className="text-sm font-medium text-link hover:underline"
          >
            Back to 1:1s
          </Link>
          {meeting.status !== "completed" && (
            <form action={markOneOnOneCompleted.bind(null, meeting.id)}>
              <button type="submit" className="btn btn-outline btn-sm">
                Mark completed
              </button>
            </form>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="section-label">Shared notes</h2>
        <p className="text-sm text-mute">Visible to both of you — agenda, action items, etc.</p>
        <div className="card p-6">
          <NoteForm
            oneOnOneId={meeting.id}
            visibility="shared"
            initialBody={sharedNote?.body ?? ""}
            placeholder="Agenda and action items…"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Your private notes</h2>
        <p className="text-sm text-mute">
          Only visible to you — not even the other participant or an admin can read this.
        </p>
        <div className="card p-6">
          <NoteForm
            oneOnOneId={meeting.id}
            visibility="private"
            initialBody={myPrivateNote?.body ?? ""}
            placeholder="Talking points, private reflections…"
          />
        </div>
      </section>
    </main>
  );
}
