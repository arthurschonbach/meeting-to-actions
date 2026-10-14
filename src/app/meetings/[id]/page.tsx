import { Suspense } from "react";
import Link from "next/link";
import { MeetingWorkspace } from "@/components/MeetingWorkspace";
import { EmptyState, btnDanger, btnGhost } from "@/components/ui";
import { deleteMeetingAction } from "@/lib/actions";
import { getMeetingDetail } from "@/lib/db";
import { format, formatDate, formatDateTime, getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import type {
  ActionItemRow,
  DeliverablesPayload,
  DeliverablesRow,
} from "@/lib/schema";

export default async function Page({ params }: PageProps<"/meetings/[id]">) {
  const d = getDictionary(await getLocale());
  return (
    <Suspense
      fallback={<p className="text-sm text-muted">{d.meeting.loading}</p>}
    >
      <MeetingDetail params={params} />
    </Suspense>
  );
}

async function MeetingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getMeetingDetail(id);

  const locale = await getLocale();
  const d = getDictionary(locale);

  // Demo deployments (Vercel) keep sqlite in instance-local /tmp: a meeting
  // saved on one instance 404s on another. Explain instead of a dead end.
  if (!detail) {
    return (
      <div className="space-y-8">
        <Link href="/history" className={btnGhost}>
          {d.meeting.back}
        </Link>
        <EmptyState>{`${d.meeting.notFound} — ${d.meeting.notFoundHint}`}</EmptyState>
      </div>
    );
  }
  const { meeting, deliverables, action_items, series } = detail;
  const payload = buildPayload(deliverables, action_items);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/history" className={btnGhost}>
          {d.meeting.back}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              {meeting.title}
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              {[
                meeting.meeting_date,
                series ? format(d.meeting.series, { title: series.title }) : null,
                format(d.meeting.imported, {
                  date: formatDate(meeting.created_at, locale),
                }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <form action={deleteMeetingAction} className="shrink-0">
            <input type="hidden" name="meeting_id" value={meeting.id} />
            <button type="submit" className={btnDanger}>
              {d.meeting.delete}
            </button>
          </form>
        </div>
      </div>

      <details className="rounded-md border border-border">
        <summary className="cursor-pointer select-none px-4 py-2.5 text-sm text-muted transition-colors hover:text-foreground">
          {d.meeting.viewTranscript}
        </summary>
        <pre className="max-h-96 overflow-auto border-t border-border px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted">
          {meeting.transcript}
        </pre>
      </details>

      <MeetingWorkspace
        meetingId={meeting.id}
        initial={payload}
        error={meeting.error}
        hasDeliverables={deliverables !== null}
        meta={{
          edited: Boolean(deliverables?.edited),
          generatedLabel: deliverables?.generated_at
            ? deliverables.model
              ? format(d.recap.generated, {
                  date: formatDateTime(deliverables.generated_at, locale),
                  model: deliverables.model,
                })
              : format(d.recap.generatedNoModel, {
                  date: formatDateTime(deliverables.generated_at, locale),
                })
            : null,
        }}
      />
    </div>
  );
}

function buildPayload(
  deliverables: DeliverablesRow | null,
  actionItems: ActionItemRow[],
): DeliverablesPayload {
  function parse<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return {
    minutes: deliverables?.minutes ?? "",
    decisions: parse(deliverables?.decisions, []),
    open_questions: parse(deliverables?.open_questions, []),
    follow_up_email: parse(deliverables?.follow_up_email, {
      subject: "",
      body: "",
    }),
    project_update: parse(deliverables?.project_update, {
      summary: "",
      progress: [],
      blockers: [],
      next_steps: [],
    }),
    action_items: actionItems.map((item) => ({
      id: item.id,
      task: item.task,
      owner: item.owner,
      owner_status: item.owner_status,
      due_date: item.due_date,
      due_date_status: item.due_date_status,
      status: item.status,
      sort_order: item.sort_order,
    })),
  };
}
