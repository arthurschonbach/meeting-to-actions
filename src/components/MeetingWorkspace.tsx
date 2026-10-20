"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDeliverablesAction } from "@/lib/actions";
import { GenerationPanel } from "./GenerationPanel";
import { useI18n } from "./LocaleProvider";
import { RecapView } from "./RecapView";
import { ReviewClient } from "./ReviewClient";
import { format, formatDateTime } from "@/lib/i18n";
import type {
  DeliverablesMeta,
  DeliverablesPayload,
  CoreSectionDataMap,
  CoreSectionName,
} from "@/lib/schema";

interface Props {
  meetingId: string;
  initial: DeliverablesPayload;
  error: string | null;
  meta: DeliverablesMeta;
  hasDeliverables: boolean;
}

interface StreamEvent {
  type: "section" | "reasoning" | "done" | "error";
  section?: CoreSectionName;
  data?: CoreSectionDataMap[CoreSectionName];
  text?: string;
  message?: string;
  model?: string;
  payload?: DeliverablesPayload;
}

type Phase = "generating" | "recap" | "edit";

export function MeetingWorkspace({
  meetingId,
  initial,
  error,
  meta,
  hasDeliverables,
}: Props) {
  const router = useRouter();
  const { d, locale } = useI18n();
  const [phase, setPhase] = useState<Phase>(
    hasDeliverables ? "recap" : "generating",
  );
  const [data, setData] = useState<DeliverablesPayload>(initial);
  const [metaState, setMetaState] = useState(meta);
  const [sections, setSections] = useState<Partial<CoreSectionDataMap>>({});
  const [reasoning, setReasoning] = useState("");
  const [genError, setGenError] = useState<string | null>(null);
  // Bumped per attempt so the progress panel (and its clock) starts fresh.
  const [attempt, setAttempt] = useState(0);
  const startedRef = useRef(false);

  const generate = useCallback(async () => {
    setPhase("generating");
    setAttempt((value) => value + 1);
    setSections({});
    setReasoning("");
    setGenError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/generate`, {
        method: "POST",
      });
      if (!response.ok || !response.body) {
        throw new Error(`Request failed (${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;

          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "section" && event.section) {
            setSections((current) => ({
              ...current,
              [event.section as CoreSectionName]: event.data,
            }));
          } else if (event.type === "reasoning") {
            setReasoning((current) =>
              (current + (event.text ?? "")).slice(-4000),
            );
          } else if (event.type === "error") {
            setGenError(event.message ?? "Generation failed.");
          } else if (event.type === "done" && event.payload) {
            setData(event.payload);
            const date = formatDateTime(new Date().toISOString(), locale);
            setMetaState({
              edited: false,
              generatedLabel: event.model
                ? format(d.recap.generated, { date, model: event.model })
                : format(d.recap.generatedNoModel, { date }),
            });
            setPhase("recap");
            finished = true;
          }
        }
      }

      if (!finished) {
        setGenError((current) => current ?? "Generation ended unexpectedly.");
      }
    } catch (error) {
      setGenError(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      router.refresh();
    }
  }, [meetingId, router, d, locale]);

  useEffect(() => {
    if (!hasDeliverables && !startedRef.current) {
      startedRef.current = true;
      void generate();
    }
  }, [hasDeliverables, generate]);

  const toggleActionItem = useCallback(
    (id: string) => {
      const next: DeliverablesPayload = {
        ...data,
        action_items: data.action_items.map((item) =>
          item.id === id
            ? {
                ...item,
                status: item.status === "done" ? ("open" as const) : ("done" as const),
              }
            : item,
        ),
      };
      setData(next);
      setMetaState((current) => ({ ...current, edited: true }));
      void saveDeliverablesAction(meetingId, next);
    },
    [data, meetingId],
  );

  if (phase === "generating") {
    return (
      <GenerationPanel
        key={attempt}
        sections={sections}
        reasoning={reasoning}
        error={genError}
        onRetry={generate}
      />
    );
  }

  if (phase === "edit") {
    return (
      <ReviewClient
        meetingId={meetingId}
        initial={data}
        error={error}
        meta={metaState}
        onRegenerate={generate}
        onSaved={(payload) => {
          setData(payload);
          setMetaState((current) => ({ ...current, edited: true }));
          setPhase("recap");
        }}
        onCancel={() => setPhase("recap")}
      />
    );
  }

  return (
    <RecapView
      data={data}
      meta={metaState}
      onEdit={() => setPhase("edit")}
      onRegenerate={generate}
      onToggleActionItem={toggleActionItem}
    />
  );
}
