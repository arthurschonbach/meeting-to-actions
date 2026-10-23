import { describe, expect, it } from "vitest";
import { gradeExtraction, loadEvalSet, matches, sameOwner, summarize, type EvalItem } from "@/lib/evals";
import type { CoreExtraction } from "@/lib/schema";

const item: EvalItem = {
  id: "t",
  about: "test",
  transcript: "…",
  actions: [
    { keywords: ["forecast"], owner: "Lea", ownerStatus: "explicit", dueStatus: "explicit" },
    { keywords: ["photographer"], owner: null, ownerStatus: "unknown" },
  ],
  decisions: [{ keywords: ["hiring"] }],
  forbiddenActions: [{ keywords: ["migration"], why: "already done" }],
  forbiddenDecisions: [],
};

const action = (task: string, owner: string | null, status: "explicit" | "inferred" | "unknown" = "explicit") => ({
  task,
  owner,
  owner_status: status,
  due_date: status === "explicit" ? "the 10th" : null,
  due_date_status: status,
});

const extraction = (overrides: Partial<CoreExtraction> = {}): CoreExtraction => ({
  minutes: { title: "Sync", summary: "A sync.", attendees: [] },
  decisions: [{ statement: "Freeze hiring until July.", context: null }],
  open_questions: [],
  action_items: [action("Send the Q2 forecast to the board.", "Lea"), action("Book the photographer.", null, "unknown")],
  ...overrides,
});

describe("matches / sameOwner", () => {
  it("matches every keyword group, with | alternatives", () => {
    expect(matches("Fix the Android login bug", ["android|ios", "login"])).toBe(true);
    expect(matches("Fix the Android bug", ["android", "login"])).toBe(false);
  });
  it("compares owners by first name, case-insensitively", () => {
    expect(sameOwner("Lea (Ops)", "lea")).toBe(true);
    expect(sameOwner("Tim", "Lea")).toBe(false);
    expect(sameOwner(null, null)).toBe(true);
    expect(sameOwner("Tim", null)).toBe(false);
  });
});

describe("gradeExtraction", () => {
  it("passes a correct extraction", () => {
    expect(gradeExtraction(item, extraction()).passed).toBe(true);
  });

  it("fails when the task went to the first person asked, not the final owner", () => {
    const grade = gradeExtraction(item, extraction({
      action_items: [action("Send the forecast.", "Tim"), action("Book the photographer.", null, "unknown")],
    }));
    expect(grade.passed).toBe(false);
    expect(grade.checks.find((c) => c.kind === "owner" && !c.ok)?.detail).toContain("owner Tim, expected Lea");
  });

  it("fails a guessed owner presented as unknown-free", () => {
    const grade = gradeExtraction(item, extraction({
      action_items: [action("Send the forecast.", "Lea"), action("Book the photographer.", "Noah", "inferred")],
    }));
    expect(grade.checks.filter((c) => !c.ok).map((c) => c.kind)).toEqual(["owner", "owner_status"]);
  });

  it("fails on an invented action from a forbidden pattern", () => {
    const grade = gradeExtraction(item, extraction({
      action_items: [...extraction().action_items, action("Finish the database migration.", "Zoe")],
    }));
    expect(grade.passed).toBe(false);
    expect(grade.checks.some((c) => c.detail.startsWith("invented action"))).toBe(true);
  });

  it("reports extra actions without failing on them", () => {
    const grade = gradeExtraction(item, extraction({
      action_items: [...extraction().action_items, action("Send the newsletter.", null, "unknown")],
    }));
    expect(grade.passed).toBe(true);
    expect(grade.extraActions).toEqual(["Send the newsletter."]);
  });

  it("does not let one extracted action satisfy two expected ones", () => {
    const twice: EvalItem = { ...item, actions: [item.actions[0], item.actions[0]] };
    const grade = gradeExtraction(twice, extraction());
    expect(grade.checks.filter((c) => c.kind === "action").map((c) => c.ok)).toEqual([true, false]);
  });

  it("requires an empty decision list when asked", () => {
    const grade = gradeExtraction({ ...item, decisions: [], expectNoDecisions: true }, extraction());
    expect(grade.passed).toBe(false);
  });
});

describe("summarize", () => {
  it("counts checks per kind", () => {
    const summary = summarize([gradeExtraction(item, extraction())]);
    expect(summary).toMatchObject({ items: 1, passed: 1 });
    expect(summary.byKind.action).toEqual([2, 2]);
    expect(summary.byKind.due_status).toEqual([1, 1]);
  });
});

describe("eval set", () => {
  it("parses, with unique ids", () => {
    const items = loadEvalSet();
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });
  it("names only people present in the transcript as owners", () => {
    for (const i of loadEvalSet()) {
      for (const a of i.actions) if (a.owner) expect(i.transcript).toContain(a.owner);
    }
  });
});
