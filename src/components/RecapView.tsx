"use client";

import { useState } from "react";
import type { DeliverablesMeta, DeliverablesPayload } from "@/lib/schema";
import { format } from "@/lib/i18n";
import { useI18n } from "./LocaleProvider";
import { Chip, SectionCard, btnPrimary, btnSecondary } from "./ui";

interface Props {
  data: DeliverablesPayload;
  meta: DeliverablesMeta;
  onEdit: () => void;
  onRegenerate: () => void;
  onToggleActionItem: (id: string) => void;
}

export function RecapView({
  data,
  meta,
  onEdit,
  onRegenerate,
  onToggleActionItem,
}: Props) {
  const { d } = useI18n();

  const generated = meta.generatedLabel ?? d.recap.notGenerated;
  const openItems = data.action_items.filter((i) => i.status === "open");
  const unassigned = openItems.filter((i) => !i.owner).length;
  const allDone =
    data.action_items.length > 0 && openItems.length === 0;
  const { summary, attendees, topics } = parseMinutes(data.minutes);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {generated}
          {meta.edited ? ` · ${d.recap.edited}` : ""}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button className={btnSecondary} onClick={onRegenerate}>
            {d.recap.regenerate}
          </button>
          <button className={btnPrimary} onClick={onEdit}>
            {d.recap.edit}
          </button>
        </div>
      </div>

      {/* ——— Essentiel: single lede + counts. One read, no repeats. ——— */}
      {(summary || attendees.length > 0) && (
        <section className="rounded-md border border-border bg-surface/50 p-4 sm:p-5">
          {summary && (
            <p className="max-w-prose text-sm leading-relaxed font-medium tracking-tight">
              {summary}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
            <span>{countText(data.decisions.length, d.recap.overviewDecisionsOne, d.recap.overviewDecisions)}</span>
            <span>{countText(data.action_items.length, d.recap.overviewActionsOne, d.recap.overviewActions)}</span>
            <span>{countText(data.open_questions.length, d.recap.overviewOpenOne, d.recap.overviewOpen)}</span>
            {unassigned > 0 && (
              <span className="font-medium text-warning">
                {format(d.recap.unassigned, { count: unassigned })}
              </span>
            )}
            {allDone && (
              <span className="font-medium">{d.recap.allDone}</span>
            )}
          </div>
          {attendees.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {attendees.map((person) => (
                <Chip key={person}>{person}</Chip>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ——— Actions first: the only thing people act on. ——— */}
      <SectionCard
        title={d.sections.action_items}
        action={
          <span className="text-xs text-muted">
            {data.action_items.length === 1
              ? format(d.history.taskCountsOne, { open: openItems.length })
              : format(d.history.taskCounts, {
                  open: openItems.length,
                  total: data.action_items.length,
                })}
          </span>
        }
        className="border-accent/40"
      >
        {data.action_items.length === 0 ? (
          <Empty text={d.common.none} />
        ) : (
          <ul className="space-y-2">
            {data.action_items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-md border border-border bg-background p-3"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.status === "done"}
                  aria-label={item.task}
                  onClick={() => onToggleActionItem(item.id)}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    item.status === "done"
                      ? "border-foreground bg-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  {item.status === "done" && (
                    <svg
                      viewBox="0 0 12 12"
                      className="h-3 w-3 text-background"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <path
                        d="M2.5 6.5L5 9l4.5-6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      item.status === "done"
                        ? "text-muted line-through"
                        : "font-medium"
                    }
                  >
                    {item.task}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {item.owner ?? d.recap.noOwner}
                    {item.owner_status === "inferred"
                      ? ` · ${d.recap.inferred}`
                      : ""}
                    {" · "}
                    {item.due_date ?? d.recap.noDue}
                    {item.due_date_status === "inferred"
                      ? ` · ${d.recap.inferred}`
                      : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ——— Closed vs open, side by side. One line each. ——— */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title={d.sections.decisions}>
          {data.decisions.length === 0 ? (
            <Empty text={d.common.none} />
          ) : (
            <ul className="space-y-2">
              {data.decisions.map((decision) => (
                <li key={decision.id} className="flex gap-2">
                  <span aria-hidden className="shrink-0 text-accent">
                    →
                  </span>
                  <div className="min-w-0">
                    <p>{decision.statement}</p>
                    {decision.context && (
                      <p className="text-xs text-muted">
                        {decision.context}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={d.sections.open_questions}>
          {data.open_questions.length === 0 ? (
            <Empty text={d.common.none} />
          ) : (
            <ul className="space-y-2">
              {data.open_questions.map((question) => (
                <li key={question.id} className="flex gap-2">
                  <span aria-hidden className="shrink-0 text-warning">
                    ?
                  </span>
                  <div className="min-w-0">
                    <p>{question.question}</p>
                    {question.context && (
                      <p className="text-xs text-muted">
                        {question.context}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* ——— Context only: collapsed by default, no re-read. ——— */}
      {topics.length > 0 && (
        <details className="rounded-md border border-border">
          <summary className="cursor-pointer px-4 py-2.5 text-sm text-muted select-none hover:text-foreground">
            {d.recap.discussionDetails} · {topics.length}
          </summary>
          <div className="space-y-3 border-t border-border px-4 py-3 text-sm leading-relaxed">
            {topics.map((topic, index) => (
              <div key={index}>
                <p className="font-medium">{topic.heading}</p>
                <p className="text-muted">{topic.notes}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ——— Exports: copy-ready tabs, not stacked repeats. ——— */}
      <ExportsBlock data={data} />
    </div>
  );
}

function ExportsBlock({ data }: { data: DeliverablesPayload }) {
  const { d } = useI18n();
  const [tab, setTab] = useState<"email" | "project">("email");
  const emailText = `${data.follow_up_email.subject}\n\n${data.follow_up_email.body}`;
  const update = data.project_update;
  const updateEmpty =
    update.progress.length === 0 &&
    update.blockers.length === 0 &&
    update.next_steps.length === 0;

  return (
    <section className="rounded-md border border-border bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex items-center gap-1" role="tablist">
          <TabButton
            active={tab === "email"}
            onClick={() => setTab("email")}
            role="tab"
          >
            {d.recap.emailTab}
          </TabButton>
          <TabButton
            active={tab === "project"}
            onClick={() => setTab("project")}
            role="tab"
          >
            {d.recap.projectTab}
          </TabButton>
        </div>
        <span className="text-xs text-muted">{d.recap.exportsTitle}</span>
      </div>
      <div className="p-4 text-sm leading-relaxed sm:p-5">
        {tab === "email" ? (
          <div>
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="font-medium">{data.follow_up_email.subject}</p>
              <CopyButton text={emailText} />
            </div>
            <p className="whitespace-pre-wrap text-muted">
              {data.follow_up_email.body}
            </p>
          </div>
        ) : updateEmpty ? (
          <Empty text={d.common.none} />
        ) : (
          <div className="space-y-3">
            <StringList
              label={d.project.progress}
              items={update.progress}
            />
            <StringList
              label={d.project.blockers}
              items={update.blockers}
            />
            <StringList
              label={d.project.nextSteps}
              items={update.next_steps}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function TabButton({
  active,
  children,
  onClick,
  role,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  role?: string;
}) {
  return (
    <button
      type="button"
      role={role}
      onClick={onClick}
      className={`cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-surface text-foreground"
          : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-muted">{text}</p>;
}

function StringList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted">{label}</p>
      <ul className="list-disc space-y-0.5 pl-5">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function countText(count: number, one: string, many: string): string {
  return count === 1 ? one : format(many, { count });
}

function parseMinutes(text: string): {
  summary: string;
  attendees: string[];
  topics: { heading: string; notes: string }[];
} {
  const lines = text.split("\n");
  const attendees: string[] = [];
  let start = 0;
  if (lines[0]?.startsWith("Attendees:")) {
    attendees.push(
      ...lines[0]
        .slice("Attendees:".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    start = 1;
  }
  const rest = lines.slice(start).join("\n").trim();
  const parts = rest.split(/^## /m);
  const summary = (parts[0] ?? "").trim();
  const topics: { heading: string; notes: string }[] = [];
  for (const part of parts.slice(1)) {
    const [heading, ...noteLines] = part.split("\n");
    const notes = noteLines.join("\n").trim();
    if (heading.trim()) topics.push({ heading: heading.trim(), notes });
  }
  return { summary, attendees, topics };
}

function CopyButton({ text }: { text: string }) {
  const { d } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable; ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 cursor-pointer text-xs text-muted underline underline-offset-4 transition-colors hover:text-foreground"
    >
      {copied ? d.recap.copied : d.recap.copy}
    </button>
  );
}
