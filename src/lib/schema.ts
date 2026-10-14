import { z } from "zod";

export const OwnerStatus = z.enum(["explicit", "inferred", "unknown"]);
export const ItemStatus = z.enum(["open", "done"]);

export const ExtractionSchema = z.object({
  minutes: z.object({
    title: z.string().describe("A short title for the meeting"),
    summary: z
      .string()
      .describe("One paragraph summarizing the meeting. Only include facts stated in the transcript."),
    attendees: z
      .array(z.string())
      .describe("Names of people who attended, as stated in the transcript."),
    topics: z
      .array(
        z.object({
          heading: z.string(),
          notes: z.string(),
        }),
      )
      .describe("The main topics discussed, each with notes."),
  }),
  decisions: z
    .array(
      z.object({
        statement: z.string().describe("A decision that was actually made in the meeting."),
        context: z.string().nullable().describe("Brief context, or null if none."),
      }),
    )
    .describe("Only decisions explicitly made. Do not include proposals or ideas that were not decided."),
  open_questions: z
    .array(
      z.object({
        question: z.string().describe("A question left unresolved."),
        context: z.string().nullable(),
      }),
    )
    .describe("Issues that remain unresolved at the end of the meeting."),
  action_items: z
    .array(
      z.object({
        task: z.string().describe("A concrete task."),
        owner: z
          .string()
          .nullable()
          .describe("The person responsible, or null when not explicitly assigned."),
        owner_status: OwnerStatus.describe(
          "explicit if the owner was stated, inferred if you had to deduce it, unknown if not determinable.",
        ),
        due_date: z
          .string()
          .nullable()
          .describe("A deadline as stated (e.g. 'Friday', '2024-03-01'), or null when absent."),
        due_date_status: OwnerStatus.describe(
          "explicit if the deadline was stated, inferred if deduced, unknown if absent.",
        ),
      }),
    )
    .describe("Only tasks that were explicitly agreed or assigned. Do not invent tasks."),
  follow_up_email: z.object({
    subject: z.string(),
    body: z.string().describe("A concise draft follow-up email in plain text."),
  }),
  project_update: z.object({
    summary: z.string(),
    progress: z.array(z.string()),
    blockers: z.array(z.string()),
    next_steps: z.array(z.string()),
  }),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

/**
 * Core output, the ONLY thing the LLM generates.
 * Email + project update are derived in code (verbatim reuse, zero tokens).
 * Topics are dropped (transcript stays viewable; topics were the main
 * repetition + token sink).
 */
export const CoreExtractionSchema = z.object({
  minutes: z.object({
    title: z.string().max(80).describe("Short meeting title, max 8 words."),
    summary: z
      .string()
      .max(400)
      .describe("2 sentences max. What the meeting was about. No decisions, tasks, or open questions."),
    attendees: z
      .array(z.string())
      .max(20)
      .describe("Names as stated in the transcript."),
  }),
  decisions: z
    .array(
      z.object({
        statement: z.string().max(140).describe("One line, imperative."),
        context: z.string().max(60).nullable().describe("Max 8 words or null."),
      }),
    )
    .max(8)
    .describe("Only things actually decided."),
  open_questions: z
    .array(
      z.object({
        question: z.string().max(140).describe("One line."),
        context: z.string().max(60).nullable().describe("Max 8 words or null."),
      }),
    )
    .max(8)
    .describe("Unresolved items only."),
  action_items: z
    .array(
      z.object({
        task: z.string().max(120).describe("Imperative, under 12 words."),
        owner: z.string().max(40).nullable().describe("Person responsible, or null."),
        owner_status: OwnerStatus.describe("explicit if stated, inferred if deduced, unknown otherwise."),
        due_date: z.string().max(40).nullable().describe("As stated, or null."),
        due_date_status: OwnerStatus.describe("explicit if stated, inferred if deduced, unknown otherwise."),
      }),
    )
    .max(12)
    .describe("Only tasks explicitly agreed or assigned."),
});

export type CoreExtraction = z.infer<typeof CoreExtractionSchema>;

export const CORE_SECTION_ORDER = [
  "action_items",
  "decisions",
  "open_questions",
  "minutes",
] as const;

export type CoreSectionName = (typeof CORE_SECTION_ORDER)[number];

export const CoreSectionSchemas = {
  minutes: CoreExtractionSchema.shape.minutes,
  decisions: CoreExtractionSchema.shape.decisions,
  open_questions: CoreExtractionSchema.shape.open_questions,
  action_items: CoreExtractionSchema.shape.action_items,
} satisfies Record<CoreSectionName, z.ZodType>;

export type CoreSectionDataMap = {
  [K in CoreSectionName]: z.infer<(typeof CoreSectionSchemas)[K]>;
};

export const SECTION_ORDER = [
  "minutes",
  "decisions",
  "open_questions",
  "action_items",
  "follow_up_email",
  "project_update",
] as const;

export type SectionName = (typeof SECTION_ORDER)[number];

export const SectionSchemas = {
  minutes: ExtractionSchema.shape.minutes,
  decisions: ExtractionSchema.shape.decisions,
  open_questions: ExtractionSchema.shape.open_questions,
  action_items: ExtractionSchema.shape.action_items,
  follow_up_email: ExtractionSchema.shape.follow_up_email,
  project_update: ExtractionSchema.shape.project_update,
} satisfies Record<SectionName, z.ZodType>;

export type SectionDataMap = {
  [K in SectionName]: z.infer<(typeof SectionSchemas)[K]>;
};

export const ActionItemInputSchema = z.object({
  id: z.string(),
  task: z.string(),
  owner: z.string().nullable(),
  owner_status: OwnerStatus,
  due_date: z.string().nullable(),
  due_date_status: OwnerStatus,
  status: ItemStatus,
  sort_order: z.number(),
});

export const DeliverablesPayloadSchema = z.object({
  minutes: z.string(),
  decisions: z.array(
    z.object({ id: z.string(), statement: z.string(), context: z.string().nullable() }),
  ),
  open_questions: z.array(
    z.object({ id: z.string(), question: z.string(), context: z.string().nullable() }),
  ),
  follow_up_email: z.object({ subject: z.string(), body: z.string() }),
  project_update: z.object({
    summary: z.string(),
    progress: z.array(z.string()),
    blockers: z.array(z.string()),
    next_steps: z.array(z.string()),
  }),
  action_items: z.array(ActionItemInputSchema),
});

export type DeliverablesPayload = z.infer<typeof DeliverablesPayloadSchema>;
export type ActionItemInput = z.infer<typeof ActionItemInputSchema>;

export interface DeliverablesMeta {
  edited: boolean;
  generatedLabel: string | null;
}

export type ActionItemStatus = z.infer<typeof ItemStatus>;
export type OwnerStatusValue = z.infer<typeof OwnerStatus>;

export interface Series {
  id: string;
  title: string;
  created_at: string;
}

export interface MeetingRow {
  id: string;
  series_id: string | null;
  title: string;
  meeting_date: string | null;
  transcript: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliverablesRow {
  id: string;
  meeting_id: string;
  minutes: string | null;
  decisions: string | null;
  open_questions: string | null;
  follow_up_email: string | null;
  project_update: string | null;
  model: string | null;
  generated_at: string | null;
  edited: number;
}

export interface ActionItemRow {
  id: string;
  meeting_id: string;
  task: string;
  owner: string | null;
  owner_status: OwnerStatusValue;
  due_date: string | null;
  due_date_status: OwnerStatusValue;
  status: ActionItemStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MeetingDetail {
  meeting: MeetingRow;
  deliverables: DeliverablesRow | null;
  action_items: ActionItemRow[];
  series: Series | null;
}
