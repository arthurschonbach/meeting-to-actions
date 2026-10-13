"use client";

import { useState } from "react";
import { saveDeliverablesAction } from "@/lib/actions";
import {
  type ActionItemInput,
  type DeliverablesMeta,
  type DeliverablesPayload,
  type OwnerStatusValue,
} from "@/lib/schema";
import { useI18n } from "./LocaleProvider";
import { cn } from "@/lib/cn";
import {
  ErrorBox,
  SectionCard,
  areaClass,
  btnAdd,
  btnPrimary,
  btnRow,
  btnSecondary,
  inputClass,
} from "./ui";

const STATUS_OPTIONS: OwnerStatusValue[] = ["explicit", "inferred", "unknown"];

type ReviewData = DeliverablesPayload;

interface Props {
  meetingId: string;
  initial: ReviewData;
  error: string | null;
  meta: DeliverablesMeta;
  onRegenerate: () => void;
  onSaved: (data: ReviewData) => void;
  onCancel: () => void;
}

export function ReviewClient({
  meetingId,
  initial,
  error,
  meta,
  onRegenerate,
  onSaved,
  onCancel,
}: Props) {
  const { d } = useI18n();
  const [data, setData] = useState<ReviewData>(initial);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [saving, setSaving] = useState(false);

  function update(patch: Partial<ReviewData>) {
    setData((current) => ({ ...current, ...patch }));
    setDirty(true);
    setSaveState("idle");
  }

  async function save() {
    setSaving(true);
    const result = await saveDeliverablesAction(meetingId, data);
    setSaving(false);
    if (result.ok) {
      setDirty(false);
      setSaveState("saved");
      onSaved(data);
    } else {
      setSaveState("error");
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <ErrorBox
          title={d.generation.failed}
          message={error}
          action={
            <button className={btnSecondary} onClick={onRegenerate}>
              {d.review.retry}
            </button>
          }
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          {meta.generatedLabel ?? d.recap.notGenerated}
          {meta.edited ? ` · ${d.recap.edited}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {saveState === "saved" && !dirty && (
            <span className="text-xs text-muted">{d.review.saved}</span>
          )}
          {saveState === "error" && (
            <span className="text-xs text-danger">{d.review.saveFailed}</span>
          )}
          {dirty && <span className="text-xs text-muted">{d.review.unsaved}</span>}
          <button className={btnSecondary} disabled={saving} onClick={onCancel}>
            {d.review.done}
          </button>
          <button
            className={btnSecondary}
            disabled={saving}
            onClick={onRegenerate}
          >
            {d.review.regenerate}
          </button>
          <button className={btnPrimary} disabled={saving} onClick={save}>
            {saving ? d.review.saving : d.review.save}
          </button>
        </div>
      </div>

      <SectionCard title={d.sections.action_items}>
        <ActionItems
          items={data.action_items}
          onChange={(action_items) => update({ action_items })}
        />
      </SectionCard>

      <SectionCard title={d.sections.decisions}>
        <PairList
          items={data.decisions.map((item) => ({
            id: item.id,
            text: item.statement,
            context: item.context,
          }))}
          firstPlaceholder={d.review.decisionPlaceholder}
          emptyLabel={d.common.none}
          onChange={(items) =>
            update({
              decisions: items.map((i) => ({
                id: i.id,
                statement: i.text,
                context: i.context,
              })),
            })
          }
        />
      </SectionCard>

      <SectionCard title={d.sections.open_questions}>
        <PairList
          items={data.open_questions.map((item) => ({
            id: item.id,
            text: item.question,
            context: item.context,
          }))}
          firstPlaceholder={d.review.questionPlaceholder}
          emptyLabel={d.common.none}
          onChange={(items) =>
            update({
              open_questions: items.map((i) => ({
                id: i.id,
                question: i.text,
                context: i.context,
              })),
            })
          }
        />
      </SectionCard>

      <SectionCard title={d.sections.minutes}>
        <textarea
          className={`${areaClass} min-h-56`}
          value={data.minutes}
          onChange={(event) => update({ minutes: event.target.value })}
        />
      </SectionCard>

      <SectionCard title={d.sections.follow_up_email}>
        <div className="space-y-3">
          <input
            className={inputClass}
            value={data.follow_up_email.subject}
            onChange={(event) =>
              update({
                follow_up_email: {
                  ...data.follow_up_email,
                  subject: event.target.value,
                },
              })
            }
            placeholder={d.review.subjectPlaceholder}
          />
          <textarea
            className={`${areaClass} min-h-48`}
            value={data.follow_up_email.body}
            onChange={(event) =>
              update({
                follow_up_email: {
                  ...data.follow_up_email,
                  body: event.target.value,
                },
              })
            }
          />
        </div>
      </SectionCard>

      <SectionCard title={d.sections.project_update}>
        <div className="space-y-3">
          <textarea
            className={`${areaClass} min-h-24`}
            value={data.project_update.summary}
            onChange={(event) =>
              update({
                project_update: {
                  ...data.project_update,
                  summary: event.target.value,
                },
              })
            }
            placeholder={d.review.summaryPlaceholder}
          />
          <StringList
            label={d.project.progress}
            items={data.project_update.progress}
            onChange={(progress) =>
              update({ project_update: { ...data.project_update, progress } })
            }
          />
          <StringList
            label={d.project.blockers}
            items={data.project_update.blockers}
            onChange={(blockers) =>
              update({ project_update: { ...data.project_update, blockers } })
            }
          />
          <StringList
            label={d.project.nextSteps}
            items={data.project_update.next_steps}
            onChange={(next_steps) =>
              update({ project_update: { ...data.project_update, next_steps } })
            }
          />
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <button className={btnPrimary} disabled={saving} onClick={save}>
          {saving ? d.review.saving : d.review.save}
        </button>
      </div>
    </div>
  );
}

function StringList({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const { d } = useI18n();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <button className={btnAdd} onClick={() => onChange([...items, ""])}>
          {d.review.add}
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-muted">{d.common.none}</p>
        )}
        {items.map((value, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className={inputClass}
              value={value}
              onChange={(event) => {
                const next = [...items];
                next[index] = event.target.value;
                onChange(next);
              }}
            />
            <button
              className={btnRow}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              {d.review.remove}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PairItem {
  id: string;
  text: string;
  context: string | null;
}

function PairList({
  items,
  firstPlaceholder,
  emptyLabel,
  onChange,
}: {
  items: PairItem[];
  firstPlaceholder: string;
  emptyLabel: string;
  onChange: (items: PairItem[]) => void;
}) {
  const { d } = useI18n();
  return (
    <div>
      {items.length === 0 && (
        <p className="mb-2 text-sm text-muted">{emptyLabel}</p>
      )}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]"
          >
            <input
              className={inputClass}
              value={item.text}
              placeholder={firstPlaceholder}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...item, text: event.target.value };
                onChange(next);
              }}
            />
            <input
              className={inputClass}
              value={item.context ?? ""}
              placeholder={d.review.contextPlaceholder}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...item, context: event.target.value || null };
                onChange(next);
              }}
            />
            <button
              className={btnRow}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              {d.review.remove}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <button
          className={btnAdd}
          onClick={() =>
            onChange([
              ...items,
              { id: crypto.randomUUID(), text: "", context: null },
            ])
          }
        >
          {d.review.add}
        </button>
      </div>
    </div>
  );
}

function ActionItems({
  items,
  onChange,
}: {
  items: ActionItemInput[];
  onChange: (items: ActionItemInput[]) => void;
}) {
  const { d } = useI18n();

  function makeItem(): ActionItemInput {
    return {
      id: crypto.randomUUID(),
      task: "",
      owner: null,
      owner_status: "unknown",
      due_date: null,
      due_date_status: "unknown",
      status: "open",
      sort_order: items.length,
    };
  }

  function set(index: number, patch: Partial<ActionItemInput>) {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onChange(next.map((item, i) => ({ ...item, sort_order: i })));
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-sm text-muted">{d.common.none}</p>
      )}
      {items.map((item, index) => (
        <div key={item.id} className="space-y-2 rounded-md border border-border p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <input
              className={inputClass}
              value={item.task}
              placeholder={d.review.taskPlaceholder}
              onChange={(event) => set(index, { task: event.target.value })}
            />
            <div className="flex items-center gap-2">
              <label className="flex h-9 items-center gap-1.5 px-1 text-xs whitespace-nowrap text-muted">
                <input
                  type="checkbox"
                  checked={item.status === "done"}
                  onChange={(event) =>
                    set(index, { status: event.target.checked ? "done" : "open" })
                  }
                  className="accent-[var(--accent)]"
                />
                {d.review.doneLabel}
              </label>
              <button
                className={btnRow}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                {d.review.remove}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <input
                className={inputClass}
                value={item.owner ?? ""}
                placeholder={d.review.ownerPlaceholder}
                onChange={(event) =>
                  set(index, { owner: event.target.value || null })
                }
              />
              <StatusSelect
                value={item.owner_status}
                onChange={(owner_status) => set(index, { owner_status })}
              />
            </div>
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <input
                className={inputClass}
                value={item.due_date ?? ""}
                placeholder={d.review.duePlaceholder}
                onChange={(event) =>
                  set(index, { due_date: event.target.value || null })
                }
              />
              <StatusSelect
                value={item.due_date_status}
                onChange={(due_date_status) => set(index, { due_date_status })}
              />
            </div>
          </div>
        </div>
      ))}
      <button className={btnAdd} onClick={() => onChange([...items, makeItem()])}>
        {d.review.addActionItem}
      </button>
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: OwnerStatusValue;
  onChange: (value: OwnerStatusValue) => void;
}) {
  const { d } = useI18n();
  const tone =
    value === "inferred"
      ? "text-warning"
      : value === "unknown"
        ? "text-muted"
        : "text-foreground";
  return (
    <select
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:border-accent",
        tone,
      )}
      value={value}
      onChange={(event) => onChange(event.target.value as OwnerStatusValue)}
      title={d.review.statusTitle}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {d.status[option]}
        </option>
      ))}
    </select>
  );
}
