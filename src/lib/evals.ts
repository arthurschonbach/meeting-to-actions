import { z } from "zod";
import evalSetFile from "../../data/eval-set.json";
import { OwnerStatus, type CoreExtraction } from "./schema";

// Judge-free grading: a fixed set of annotated transcripts, checked with
// keyword matches and exact owner/status comparisons. Reproducible, cheap,
// and every failure says exactly what was wrong.

const Pattern = z.object({ keywords: z.array(z.string()).min(1) });

const ExpectedAction = Pattern.extend({
  owner: z.string().nullable(),
  ownerStatus: OwnerStatus,
  dueStatus: OwnerStatus.optional(),
});

const Forbidden = Pattern.extend({ why: z.string() });

const EvalItemSchema = z.object({
  id: z.string(),
  about: z.string(),
  transcript: z.string().min(1),
  actions: z.array(ExpectedAction),
  decisions: z.array(Pattern),
  expectNoDecisions: z.boolean().optional(),
  forbiddenActions: z.array(Forbidden),
  forbiddenDecisions: z.array(Forbidden),
});

const EvalSetSchema = z.object({
  version: z.number(),
  items: z.array(EvalItemSchema).min(1),
});

export type EvalItem = z.infer<typeof EvalItemSchema>;

export function loadEvalSet(): EvalItem[] {
  return EvalSetSchema.parse(evalSetFile).items;
}

/** Every keyword group must match; "a|b" within a group accepts either. */
export function matches(text: string, keywords: string[]): boolean {
  const lowered = text.toLowerCase();
  return keywords.every((group) =>
    group.split("|").some((alt) => lowered.includes(alt.toLowerCase())),
  );
}

/** "Lea (Ops)" and "lea" are the same owner; null only matches null. */
export function sameOwner(actual: string | null, expected: string | null): boolean {
  if (actual === null || expected === null) return actual === expected;
  const first = (name: string) => name.trim().toLowerCase().split(/[\s(]/)[0];
  return first(actual) === first(expected);
}

export interface Check {
  kind: "action" | "owner" | "owner_status" | "due_status" | "decision" | "forbidden";
  ok: boolean;
  detail: string;
}

export interface Grade {
  passed: boolean;
  checks: Check[];
  /** Extracted actions that matched no expected one (not a failure). */
  extraActions: string[];
}

export function gradeExtraction(item: EvalItem, extraction: CoreExtraction): Grade {
  const checks: Check[] = [];
  const used = new Set<number>();

  for (const expected of item.actions) {
    const label = expected.keywords.join(" + ");
    const index = extraction.action_items.findIndex(
      (a, i) => !used.has(i) && matches(a.task, expected.keywords),
    );
    if (index === -1) {
      checks.push({ kind: "action", ok: false, detail: `missing action: ${label}` });
      continue;
    }
    used.add(index);
    const actual = extraction.action_items[index];
    checks.push({ kind: "action", ok: true, detail: `found: ${actual.task}` });
    checks.push({
      kind: "owner",
      ok: sameOwner(actual.owner, expected.owner),
      detail: `${label}: owner ${actual.owner ?? "null"}, expected ${expected.owner ?? "null"}`,
    });
    checks.push({
      kind: "owner_status",
      ok: actual.owner_status === expected.ownerStatus,
      detail: `${label}: owner ${actual.owner_status}, expected ${expected.ownerStatus}`,
    });
    if (expected.dueStatus) {
      checks.push({
        kind: "due_status",
        ok: actual.due_date_status === expected.dueStatus,
        detail: `${label}: due ${actual.due_date_status}, expected ${expected.dueStatus}`,
      });
    }
  }

  for (const expected of item.decisions) {
    const found = extraction.decisions.some((d) => matches(d.statement, expected.keywords));
    checks.push({
      kind: "decision",
      ok: found,
      detail: `${found ? "found" : "missing"} decision: ${expected.keywords.join(" + ")}`,
    });
  }
  if (item.expectNoDecisions) {
    checks.push({
      kind: "forbidden",
      ok: extraction.decisions.length === 0,
      detail: `expected no decisions, got ${extraction.decisions.length}`,
    });
  }

  for (const f of item.forbiddenActions) {
    const hit = extraction.action_items.find((a) => matches(a.task, f.keywords));
    checks.push({
      kind: "forbidden",
      ok: !hit,
      detail: hit ? `invented action (${f.why}): ${hit.task}` : `no action for ${f.keywords.join(" + ")}`,
    });
  }
  for (const f of item.forbiddenDecisions) {
    const hit = extraction.decisions.find((d) => matches(d.statement, f.keywords));
    checks.push({
      kind: "forbidden",
      ok: !hit,
      detail: hit ? `invented decision (${f.why}): ${hit.statement}` : `no decision for ${f.keywords.join(" + ")}`,
    });
  }

  return {
    passed: checks.every((c) => c.ok),
    checks,
    extraActions: extraction.action_items.filter((_, i) => !used.has(i)).map((a) => a.task),
  };
}

export interface Summary {
  items: number;
  passed: number;
  /** Per check kind: [ok, total]. */
  byKind: Record<Check["kind"], [number, number]>;
}

export function summarize(grades: Grade[]): Summary {
  const byKind = {
    action: [0, 0],
    owner: [0, 0],
    owner_status: [0, 0],
    due_status: [0, 0],
    decision: [0, 0],
    forbidden: [0, 0],
  } as Summary["byKind"];
  for (const check of grades.flatMap((g) => g.checks)) {
    byKind[check.kind][1] += 1;
    if (check.ok) byKind[check.kind][0] += 1;
  }
  return { items: grades.length, passed: grades.filter((g) => g.passed).length, byKind };
}
