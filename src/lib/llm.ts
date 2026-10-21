import OpenAI from "openai";
import { z } from "zod";
import type { PriorContext } from "./db";
import {
  CORE_SECTION_ORDER,
  CoreExtractionSchema,
  CoreSectionSchemas,
  type CoreExtraction,
  type CoreSectionDataMap,
  type CoreSectionName,
  type DeliverablesPayload,
} from "./schema";

const BASE_URL =
  process.env.OPENAI_BASE_URL ?? "https://openrouter.ai/api/v1";
const MODEL = process.env.OPENAI_MODEL ?? "nvidia/nemotron-3.5-super-vl:free";
// Tried by OpenRouter when the primary model's provider errors.
const FALLBACK_MODEL =
  process.env.OPENAI_FALLBACK_MODEL ?? "nvidia/nemotron-3.5-lightning:free";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env to generate deliverables.",
    );
  }
  client ??= new OpenAI({
    apiKey,
    baseURL: BASE_URL,
    // Free-tier providers sometimes hang or rate-limit: fail fast and let
    // the SDK retry 408/429/5xx with backoff.
    timeout: 30_000,
    maxRetries: 2,
  });
  return client;
}

// OpenRouter extensions: `models` lists fallbacks, and `reasoning` turns
// off "thinking" so the token budget goes to the output.
const OPENROUTER = {
  models: [MODEL, FALLBACK_MODEL],
  reasoning: { enabled: false },
};

// OpenRouter answers 200 before the provider responds, so a provider
// timeout arrives as an `error` field in the body. The SDK only retries on
// HTTP status, so retry those here.
const ATTEMPTS = 3;

function bodyError(payload: unknown): Error | null {
  const error = (payload as { error?: { message?: string } }).error;
  return error ? new Error(error.message ?? "Provider error") : null;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const OUTPUT_SCHEMA = JSON.stringify(z.toJSONSchema(CoreExtractionSchema));

const RULES = `Rules, minimal output, zero repetition:
- Output ONLY what was explicitly stated. Never invent facts.
- minutes.summary: 2 sentences / 40 words max. Meeting topic only, no decisions, tasks, or questions.
- minutes.attendees: names only.
- decisions: max 5, one line each. context ≤ 8 words or null.
- action_items: max 8, imperative, ≤ 12 words. owner/due null + "unknown" unless stated (or genuinely deducible → "inferred").
- open_questions: max 5, one line each. context ≤ 8 words or null.
- Empty arrays when nothing stated. No filler.`;

const SYSTEM_PROMPT = `You turn meeting transcripts into a minimal structured core.

Return ONLY a single valid JSON object that conforms to this JSON Schema:
${OUTPUT_SCHEMA}

${RULES}
- Output raw JSON only: no markdown fences, no commentary, no reasoning.`;

const JSONL_SYSTEM_PROMPT = `You turn meeting transcripts into a minimal structured core.

Output ONLY newline-delimited JSON: exactly one JSON object per line, in this order:
{"section":"action_items","data":[{"task":string,"owner":string|null,"owner_status":"explicit"|"inferred"|"unknown","due_date":string|null,"due_date_status":"explicit"|"inferred"|"unknown"}]}
{"section":"decisions","data":[{"statement":string,"context":string|null}]}
{"section":"open_questions","data":[{"question":string,"context":string|null}]}
{"section":"minutes","data":{"title":string,"summary":string,"attendees":string[]}}

${RULES}
- Emit each JSON object on a single line. No markdown fences, no commentary, no extra text.`;

function buildContextBlock(context?: PriorContext): string {
  if (!context) return "";
  const parts: string[] = [];

  if (context.openActionItems.length > 0) {
    parts.push(
      "Open action items from earlier meetings in this series:\n" +
        context.openActionItems
          .map(
            (item) =>
              `- ${item.task} (owner: ${item.owner ?? "unspecified"}, due: ${item.due_date ?? "unspecified"})`,
          )
          .join("\n"),
    );
  }

  if (context.decisions.length > 0) {
    parts.push(
      "Decisions from earlier meetings in this series:\n" +
        context.decisions.map((decision) => `- ${decision.statement}`).join("\n"),
    );
  }

  if (parts.length === 0) return "";

  return `\n\nContext from earlier meetings (use only to interpret references, do not repeat as new items):\n${parts.join("\n\n")}`;
}

function parseJsonContent(content: string): unknown {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Model did not return a JSON object.");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export async function generateExtraction(
  transcript: string,
  context?: PriorContext,
): Promise<{ extraction: CoreExtraction; model: string }> {
  const userContent = `Transcript:\n\n${transcript}${buildContextBlock(context)}`;

  let repair: string | undefined;
  let lastError: Error = new Error("The model returned invalid output.");

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ];
    if (repair) messages.push({ role: "user", content: repair });

    const completion = await getClient().chat.completions.create({
      ...OPENROUTER,
      model: MODEL,
      temperature: 0.1,
      max_tokens: 1500,
      messages,
      response_format: { type: "json_object" },
    });

    const error = bodyError(completion);
    if (error || !completion.choices?.length) {
      lastError = error ?? new Error("Empty completion");
      await wait(1000 * attempt);
      continue;
    }

    try {
      const content = completion.choices[0].message.content ?? "";
      const parsed = CoreExtractionSchema.safeParse(parseJsonContent(content));
      if (parsed.success) {
        return { extraction: parsed.data, model: completion.model ?? MODEL };
      }
      repair = `Your previous response was invalid: ${describeIssues(parsed.error)}. Return corrected JSON only.`;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      repair = "Your previous response was not valid JSON. Return a single JSON object only.";
    }
  }

  throw lastError;
}

export type ExtractionStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "section"; section: CoreSectionName; data: CoreSectionDataMap[CoreSectionName] }
  | { type: "done"; extraction: CoreExtraction; model: string };

function parseSectionLine(
  line: string,
): { section: CoreSectionName; data: CoreSectionDataMap[CoreSectionName] } | null {
  const cleaned = line
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (!cleaned.startsWith("{")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const section = (parsed as { section?: unknown }).section;
  if (typeof section !== "string" || !(section in CoreSectionSchemas)) return null;

  const name = section as CoreSectionName;
  const result = CoreSectionSchemas[name].safeParse(
    (parsed as { data?: unknown }).data,
  );
  if (!result.success) return null;

  return { section: name, data: result.data as CoreSectionDataMap[CoreSectionName] };
}

function assembleExtraction(
  sections: Partial<CoreSectionDataMap>,
): CoreExtraction | null {
  const result = CoreExtractionSchema.safeParse({
    minutes: sections.minutes,
    decisions: sections.decisions,
    open_questions: sections.open_questions,
    action_items: sections.action_items,
  });
  return result.success ? result.data : null;
}

export async function* streamExtraction(
  transcript: string,
  context?: PriorContext,
): AsyncGenerator<ExtractionStreamEvent> {
  const userContent = `Transcript:\n\n${transcript}${buildContextBlock(context)}`;
  const sections: Partial<CoreSectionDataMap> = {};
  let rawContent = "";
  let model = MODEL;

  for (let attempt = 1; ; attempt++) {
    try {
      const stream = await getClient().chat.completions.create({
        ...OPENROUTER,
        model: MODEL,
        temperature: 0.1,
        max_tokens: 1500,
        stream: true,
        messages: [
          { role: "system", content: JSONL_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      });

      let buffer = "";
      for await (const chunk of stream) {
        const error = bodyError(chunk);
        if (error) throw error;
        model = chunk.model ?? model;
        const delta = chunk.choices?.[0]?.delta as
          | { content?: string | null; reasoning?: string | null }
          | undefined;
        if (!delta) continue;

        if (delta.reasoning) {
          yield { type: "reasoning", text: delta.reasoning };
        }
        if (!delta.content) continue;

        rawContent += delta.content;
        buffer += delta.content;
        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          const parsed = parseSectionLine(line);
          if (parsed) {
            Object.assign(sections, { [parsed.section]: parsed.data });
            yield { type: "section", ...parsed };
          }
        }
      }

      const tail = parseSectionLine(buffer);
      if (tail) {
        Object.assign(sections, { [tail.section]: tail.data });
        yield { type: "section", ...tail };
      }
      break;
    } catch (error) {
      // Retry only while nothing reached the client, so sections aren't
      // shown twice. Past that, the repair call below fills the gaps.
      if (rawContent || attempt === ATTEMPTS) {
        console.error("Extraction stream failed:", error);
        if (!rawContent) throw error;
        break;
      }
      await wait(1000 * attempt);
    }
  }

  let extraction = assembleExtraction(sections);

  if (!extraction && Object.keys(sections).length === 0 && rawContent) {
    try {
      const parsed = CoreExtractionSchema.safeParse(parseJsonContent(rawContent));
      if (parsed.success) extraction = parsed.data;
    } catch {
      // Not a single JSON object; fall through to repair.
    }
  }

  if (extraction) {
    yield { type: "done", extraction, model };
    return;
  }

  const repaired = await generateExtraction(transcript, context);
  for (const name of CORE_SECTION_ORDER) {
    if (sections[name] === undefined) {
      yield {
        type: "section",
        section: name,
        data: repaired.extraction[name] as CoreSectionDataMap[CoreSectionName],
      };
    }
  }
  yield { type: "done", extraction: repaired.extraction, model: repaired.model };
}

export function extractionToPayload(extraction: CoreExtraction): DeliverablesPayload {
  return {
    minutes: renderMinutes(extraction),
    decisions: extraction.decisions.map((decision) => ({
      id: crypto.randomUUID(),
      statement: decision.statement,
      context: decision.context,
    })),
    open_questions: extraction.open_questions.map((question) => ({
      id: crypto.randomUUID(),
      question: question.question,
      context: question.context,
    })),
    follow_up_email: buildFollowUpEmail(extraction),
    project_update: buildProjectUpdate(extraction),
    action_items: extraction.action_items.map((item, index) => ({
      id: crypto.randomUUID(),
      task: item.task,
      owner: item.owner,
      owner_status: item.owner_status,
      due_date: item.due_date,
      due_date_status: item.due_date_status,
      status: "open" as const,
      sort_order: index,
    })),
  };
}

function renderMinutes(extraction: CoreExtraction): string {
  const lines: string[] = [];
  if (extraction.minutes.attendees.length > 0) {
    lines.push(`Attendees: ${extraction.minutes.attendees.join(", ")}`, "");
  }
  lines.push(extraction.minutes.summary);
  return lines.join("\n").trim();
}

/** Email is assembled in code, verbatim reuse, zero LLM tokens. */
function buildFollowUpEmail(extraction: CoreExtraction): {
  subject: string;
  body: string;
} {
  const subject = `${extraction.minutes.title}, decisions and next steps`;
  const lines: string[] = ["Hi all,", ""];
  if (extraction.decisions.length > 0) {
    lines.push("Decisions:");
    for (const d of extraction.decisions) lines.push(`- ${d.statement}`);
    lines.push("");
  }
  if (extraction.action_items.length > 0) {
    lines.push("Actions:");
    for (const a of extraction.action_items) {
      lines.push(`- ${a.owner ?? "TBD"}: ${a.task}${a.due_date ? ` (${a.due_date})` : ""}`);
    }
    lines.push("");
  }
  if (extraction.open_questions.length > 0) {
    lines.push("Open:");
    for (const q of extraction.open_questions) lines.push(`- ${q.question}`);
    lines.push("");
  }
  lines.push("Best,");
  return { subject, body: lines.join("\n") };
}

/** Project update is derived, verbatim reuse, zero LLM tokens. */
function buildProjectUpdate(extraction: CoreExtraction): {
  summary: string;
  progress: string[];
  blockers: string[];
  next_steps: string[];
} {
  return {
    summary: extraction.minutes.summary,
    progress: extraction.decisions.map((d) => d.statement),
    blockers: extraction.open_questions.map((q) => q.question),
    next_steps: extraction.action_items.map((a) =>
      a.owner ? `${a.task} (${a.owner})` : a.task,
    ),
  };
}
