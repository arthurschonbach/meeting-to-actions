// Runs the eval set against the configured model and prints a report.
//   npm run evals            (needs OPENAI_API_KEY in .env)
//   npm run evals -- --json  (machine-readable, e.g. to keep a history)
import { gradeExtraction, loadEvalSet, summarize, type Grade } from "../src/lib/evals";
import { generateExtraction } from "../src/lib/llm";

const asJson = process.argv.includes("--json");

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set (add it to .env).");
  process.exit(1);
}

const items = loadEvalSet();
const grades: Grade[] = [];
const report = [];
let model = "";

// Sequential: the default models are free tier and rate-limited.
for (const item of items) {
  try {
    const result = await generateExtraction(item.transcript);
    model = result.model;
    const grade = gradeExtraction(item, result.extraction);
    grades.push(grade);
    report.push({ id: item.id, ...grade });
    if (!asJson) {
      console.log(`${grade.passed ? "PASS" : "FAIL"}  ${item.id}`);
      for (const check of grade.checks.filter((c) => !c.ok)) console.log(`      ✗ ${check.detail}`);
      for (const extra of grade.extraActions) console.log(`      · extra action: ${extra}`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const grade: Grade = { passed: false, checks: [{ kind: "action", ok: false, detail: `error: ${detail}` }], extraActions: [] };
    grades.push(grade);
    report.push({ id: item.id, ...grade });
    if (!asJson) console.log(`FAIL  ${item.id}\n      ✗ error: ${detail}`);
  }
}

const summary = summarize(grades);
if (asJson) {
  console.log(JSON.stringify({ model, date: new Date().toISOString(), summary, report }, null, 2));
} else {
  console.log(`\n${summary.passed}/${summary.items} transcripts fully correct (model: ${model || "n/a"})`);
  for (const [kind, [ok, total]] of Object.entries(summary.byKind)) {
    if (total > 0) console.log(`  ${kind.padEnd(13)} ${ok}/${total}`);
  }
}
