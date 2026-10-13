"use client";

import { useEffect, useRef, useState } from "react";
import {
  CORE_SECTION_ORDER,
  type CoreSectionDataMap,
  type CoreSectionName,
} from "@/lib/schema";
import { format } from "@/lib/i18n";
import { useI18n } from "./LocaleProvider";
import { Chip, ErrorBox, SectionTitle, btnSecondary } from "./ui";

interface Props {
  sections: Partial<CoreSectionDataMap>;
  reasoning: string;
  error: string | null;
  onRetry: () => void;
}

export function GenerationPanel({ sections, reasoning, error, onRetry }: Props) {
  const { d } = useI18n();
  const [elapsed, setElapsed] = useState(0);
  const reasoningRef = useRef<HTMLDivElement>(null);
  const arrived = CORE_SECTION_ORDER.filter(
    (name) => sections[name] !== undefined,
  ).length;

  useEffect(() => {
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    reasoningRef.current?.scrollTo({ top: reasoningRef.current.scrollHeight });
  }, [reasoning]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 rounded-md border border-border p-4">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-accent animate-pulse"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {error ? d.generation.stopped : d.generation.generating}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {error
              ? d.generation.failedHint
              : format(d.generation.progress, {
                  done: arrived,
                  total: CORE_SECTION_ORDER.length,
                  elapsed: formatElapsed(elapsed),
                })}
          </p>
        </div>
      </div>

      {error && (
        <ErrorBox
          title={d.generation.failed}
          message={error}
          action={
            <button onClick={onRetry} className={btnSecondary}>
              {d.generation.retry}
            </button>
          }
        />
      )}

      {reasoning && (
        <details className="rounded-md border border-border">
          <summary className="cursor-pointer px-4 py-2.5 text-xs text-muted select-none hover:text-foreground">
            {d.generation.notes}
          </summary>
          <div
            ref={reasoningRef}
            className="max-h-40 overflow-auto border-t border-border px-4 py-3 font-mono text-xs whitespace-pre-wrap text-muted"
          >
            {reasoning}
          </div>
        </details>
      )}

      <div className="space-y-8">
        {CORE_SECTION_ORDER.map((name) => (
          <PreviewSection key={name} name={name} data={sections[name]} />
        ))}
      </div>
    </div>
  );
}

function PreviewSection({
  name,
  data,
}: {
  name: CoreSectionName;
  data: CoreSectionDataMap[CoreSectionName] | undefined;
}) {
  const { d } = useI18n();
  return (
    <section>
      <SectionTitle>{d.sections[name]}</SectionTitle>
      {data === undefined ? (
        <div className="space-y-2" aria-hidden>
          <div className="h-3 w-3/4 rounded bg-surface animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-surface animate-pulse" />
        </div>
      ) : (
        <div className="text-sm leading-relaxed">
          <SectionBody name={name} data={data} />
        </div>
      )}
    </section>
  );
}

function SectionBody({
  name,
  data,
}: {
  name: CoreSectionName;
  data: CoreSectionDataMap[CoreSectionName];
}) {
  const { d } = useI18n();

  switch (name) {
    case "minutes": {
      const minutes = data as CoreSectionDataMap["minutes"];
      return (
        <div className="space-y-3">
          <p className="font-medium">{minutes.title}</p>
          <p className="whitespace-pre-wrap">{minutes.summary}</p>
          {minutes.attendees.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {minutes.attendees.map((person) => (
                <Chip key={person}>{person}</Chip>
              ))}
            </div>
          )}
        </div>
      );
    }
    case "decisions": {
      const decisions = data as CoreSectionDataMap["decisions"];
      if (decisions.length === 0) return <Empty />;
      return (
        <ul className="space-y-2">
          {decisions.map((decision, index) => (
            <li key={index}>
              <p>{decision.statement}</p>
              {decision.context && (
                <p className="text-xs text-muted">{decision.context}</p>
              )}
            </li>
          ))}
        </ul>
      );
    }
    case "open_questions": {
      const questions = data as CoreSectionDataMap["open_questions"];
      if (questions.length === 0) return <Empty />;
      return (
        <ul className="space-y-2">
          {questions.map((question, index) => (
            <li key={index}>
              <p>{question.question}</p>
              {question.context && (
                <p className="text-xs text-muted">{question.context}</p>
              )}
            </li>
          ))}
        </ul>
      );
    }
    case "action_items": {
      const items = data as CoreSectionDataMap["action_items"];
      if (items.length === 0) return <Empty />;
      return (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="rounded-md border border-border p-3">
              <p>{item.task}</p>
              <p className="mt-1 text-xs text-muted">
                {item.owner ?? d.recap.noOwner}
                {item.owner_status === "inferred" ? ` (${d.recap.inferred})` : ""}
                {" · "}
                {item.due_date ?? d.recap.noDue}
                {item.due_date_status === "inferred"
                  ? ` (${d.recap.inferred})`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      );
    }
  }
}

function Empty() {
  const { d } = useI18n();
  return <p className="text-muted">{d.common.none}</p>;
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
