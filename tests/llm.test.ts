import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractionStreamEvent } from "@/lib/llm";

// One fake OpenAI client for the whole file: each test queues the
// responses `chat.completions.create` should return.
const create = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));
process.env.OPENAI_API_KEY = "test-key";

const { extractionToPayload, parseJsonContent, parseSectionLine, streamExtraction } =
  await import("@/lib/llm");
const { SAMPLE_EXTRACTION } = await import("@/lib/sample");
const { CoreExtractionSchema } = await import("@/lib/schema");

/** A streamed completion that yields `content` cut into `pieces` chunks. */
function streamOf(content: string, pieces = 7) {
  const size = Math.ceil(content.length / pieces);
  return (async function* () {
    for (let i = 0; i < content.length; i += size) {
      yield { model: "fake-model", choices: [{ delta: { content: content.slice(i, i + size) } }] };
    }
  })();
}

const sectionLines = (extraction = SAMPLE_EXTRACTION) =>
  [
    { section: "action_items", data: extraction.action_items },
    { section: "decisions", data: extraction.decisions },
    { section: "open_questions", data: extraction.open_questions },
    { section: "minutes", data: extraction.minutes },
  ]
    .map((line) => JSON.stringify(line))
    .join("\n");

async function collect(gen: AsyncGenerator<ExtractionStreamEvent>) {
  const events: ExtractionStreamEvent[] = [];
  for await (const event of gen) events.push(event);
  return events;
}

const sectionsOf = (events: ExtractionStreamEvent[]) =>
  events.flatMap((e) => (e.type === "section" ? [e.section] : []));

beforeEach(() => create.mockReset());

describe("sample extraction", () => {
  it("satisfies the core schema the model is held to", () => {
    expect(CoreExtractionSchema.safeParse(SAMPLE_EXTRACTION).success).toBe(true);
  });
});

describe("parseJsonContent", () => {
  it("strips code fences and surrounding prose", () => {
    expect(parseJsonContent('Here you go:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });
  it("throws when there is no object", () => {
    expect(() => parseJsonContent("no json here")).toThrow();
  });
});

describe("parseSectionLine", () => {
  it("validates a line against its own section schema", () => {
    const line = JSON.stringify({ section: "decisions", data: [{ statement: "Ship it.", context: null }] });
    expect(parseSectionLine(line)).toEqual({
      section: "decisions",
      data: [{ statement: "Ship it.", context: null }],
    });
  });
  it.each([
    ["an unknown section", JSON.stringify({ section: "email", data: {} })],
    ["data of the wrong shape", JSON.stringify({ section: "decisions", data: "Ship it." })],
    ["a broken line", '{"section": "decisions", "data": ['],
    ["prose", "Sure! Here are the sections."],
  ])("rejects %s", (_, line) => {
    expect(parseSectionLine(line)).toBeNull();
  });
  it("rejects a field over its length cap", () => {
    const long = { statement: "x".repeat(141), context: null };
    expect(parseSectionLine(JSON.stringify({ section: "decisions", data: [long] }))).toBeNull();
  });
});

describe("streamExtraction", () => {
  it("emits each section as soon as its line completes, actions first", async () => {
    create.mockResolvedValueOnce(streamOf(sectionLines(), 13));
    const events = await collect(streamExtraction("transcript"));
    const sections = sectionsOf(events);
    expect(sections).toEqual(["action_items", "decisions", "open_questions", "minutes"]);
    expect(events.at(-1)).toMatchObject({ type: "done", model: "fake-model", extraction: SAMPLE_EXTRACTION });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("fills only the missing sections with one repair call", async () => {
    // The stream drops the minutes line and garbles decisions.
    const partial = [
      JSON.stringify({ section: "action_items", data: SAMPLE_EXTRACTION.action_items }),
      '{"section":"decisions","data":[{"statement":',
      JSON.stringify({ section: "open_questions", data: SAMPLE_EXTRACTION.open_questions }),
    ].join("\n");
    create
      .mockResolvedValueOnce(streamOf(partial))
      .mockResolvedValueOnce({
        model: "fake-model",
        choices: [{ message: { content: JSON.stringify(SAMPLE_EXTRACTION) } }],
      });

    const events = await collect(streamExtraction("transcript"));
    const sections = sectionsOf(events);
    // Streamed sections are not re-sent; the repair fills the two gaps.
    expect(sections).toEqual(["action_items", "open_questions", "decisions", "minutes"]);
    expect(events.at(-1)).toMatchObject({ type: "done" });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0]).toMatchObject({ response_format: { type: "json_object" } });
  });

  it("retries a provider error that arrives before any content", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    create
      .mockResolvedValueOnce(
        (async function* () {
          yield { error: { message: "upstream timeout" } };
        })(),
      )
      .mockResolvedValueOnce(streamOf(sectionLines()));
    const done = collect(streamExtraction("transcript"));
    await vi.runAllTimersAsync();
    const events = await done;
    vi.useRealTimers();
    expect(events.at(-1)).toMatchObject({ type: "done" });
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe("extractionToPayload", () => {
  const payload = extractionToPayload(SAMPLE_EXTRACTION);

  it("builds the email from the recap, so the two can't disagree", () => {
    for (const d of SAMPLE_EXTRACTION.decisions) expect(payload.follow_up_email.body).toContain(d.statement);
    for (const a of SAMPLE_EXTRACTION.action_items) expect(payload.follow_up_email.body).toContain(a.task);
    expect(payload.follow_up_email.subject).toContain(SAMPLE_EXTRACTION.minutes.title);
  });

  it("maps decisions to progress, open questions to blockers", () => {
    expect(payload.project_update.progress).toEqual(SAMPLE_EXTRACTION.decisions.map((d) => d.statement));
    expect(payload.project_update.blockers).toEqual(SAMPLE_EXTRACTION.open_questions.map((q) => q.question));
  });

  it("writes TBD for actions without an owner", () => {
    const unowned = {
      ...SAMPLE_EXTRACTION,
      action_items: [
        { task: "Update design tokens.", owner: null, owner_status: "unknown" as const, due_date: null, due_date_status: "unknown" as const },
      ],
    };
    expect(extractionToPayload(unowned).follow_up_email.body).toContain("- TBD: Update design tokens.");
  });

  it("gives every item a fresh id and keeps action order", () => {
    const ids = [...payload.decisions, ...payload.open_questions, ...payload.action_items].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(payload.action_items.map((a) => a.sort_order)).toEqual(payload.action_items.map((_, i) => i));
    expect(payload.action_items.every((a) => a.status === "open")).toBe(true);
  });
});
