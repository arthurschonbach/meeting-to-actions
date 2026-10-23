import { Suspense } from "react";
import Link from "next/link";
import { EmptyState, PageHeader, btnSecondary } from "@/components/ui";
import { listMeetings } from "@/lib/db";
import { format, formatDate, getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getVisitorId } from "@/lib/visitor";

export default async function Page() {
  const d = getDictionary(await getLocale());

  return (
    <div className="space-y-8">
      <PageHeader
        title={d.history.title}
        action={
          <Link href="/" className={btnSecondary}>
            {d.history.newMeeting}
          </Link>
        }
      />

      <Suspense
        fallback={<p className="text-sm text-muted">{d.history.loading}</p>}
      >
        <MeetingsList />
      </Suspense>
    </div>
  );
}

async function MeetingsList() {
  const meetings = await listMeetings(await getVisitorId());
  const locale = await getLocale();
  const d = getDictionary(locale);

  if (meetings.length === 0) {
    return <EmptyState>{d.history.empty}</EmptyState>;
  }

  return (
    <ul className="m-0 list-none p-0">
      {meetings.map((meeting) => (
        <li key={meeting.id} className="border-b border-border last:border-b-0">
          <Link
            href={`/meetings/${meeting.id}`}
            className="group flex items-center justify-between gap-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-accent">
                {meeting.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {[
                  meeting.meeting_date,
                  meeting.series_title,
                  formatDate(meeting.created_at, locale),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {meeting.error ? (
                <span className="text-xs font-medium text-danger">
                  {d.history.generationFailed}
                </span>
              ) : meeting.action_count === 0 ? (
                <span className="text-xs text-muted">
                  {d.history.generating}
                </span>
              ) : (
                <span className="text-xs text-muted">
                  {meeting.action_count === 1
                    ? format(d.history.taskCountsOne, {
                        open: meeting.open_count,
                      })
                    : format(d.history.taskCounts, {
                        open: meeting.open_count,
                        total: meeting.action_count,
                      })}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
