# Meeting → Actions

Paste a meeting transcript. Get back minutes, decisions, action items, a
follow-up email and a project update.

![Recap](docs/screenshots/shot-recap.png)

## Try it

1. `npm install && npm run dev` → http://localhost:3000
2. Click **Load sample meeting** (no API key needed).
3. Watch the recap stream in, actions first. Tick a checkbox, **Edit**
   anything, **Regenerate** to redo.

![New meeting](docs/screenshots/shot-home.png)
![History](docs/screenshots/shot-history.png)

## What it does

- **Core recap**: summary, decisions, open questions and action items,
  streamed section by section.
- **Follow-up email and project update**: composed from the recap, so
  they always agree with it.
- **Review loop**: edit any field, mark actions done, regenerate.
- **Ownership honesty**: each owner and due date is labeled explicit,
  inferred or unknown, instead of passing guesses off as facts.
- **Series**: group recurring meetings; open actions and past decisions
  are passed along as context.
- **History**: past meetings and their recaps, stored locally.
- English/French, light/dark.

## How it works

```
transcript ──► model (core recap as JSON) ──► validate ──► save
                                                    │
                       email + project update ◄──────┘
                       composed in code, not generated
```

The model produces only the core recap, validated against a schema with
one repair retry on failure. Sections stream over NDJSON, actions first.
Reasoning models get their thinking tucked behind a collapsible panel.

## Evals

`npm run evals` runs 6 annotated transcripts (`data/eval-set.json`)
through the model and grades the result without an LLM judge: expected
actions must be found (keyword match) with the right owner and
`explicit`/`inferred`/`unknown` status, expected decisions must appear,
and traps (floated ideas, finished work, brainstorming) must not turn
into tasks or decisions.

Last run (`nvidia/nemotron-3.5-super-vl:free`): 5/6 transcripts fully
correct. Owners and statuses were right every time an action was
found, and no trap fired. The miss: in a meeting where one task has
no owner and another only an implied one, the model drops both
instead of reporting them as `unknown` / `inferred`.

## Running it as a public demo

- **Per-visitor data**: a proxy gives each browser an anonymous id
  (httpOnly cookie) and every query is scoped to it, so visitors never
  see or edit each other's meetings. Demo data is purged after 30 days.
- **Rate limits**: fixed-window counters in Postgres, per IP and global
  (`src/lib/limits.ts`), on generation and meeting creation.
  Transcripts are capped at 60,000 characters.

## Tests

`npm test` runs the unit tests (Vitest), including the streaming
parser against a mocked model: sections split across chunks, garbled
lines, the repair call that fills only missing sections, and retries.
CI runs lint, typecheck, tests and build on every push.

## Setup

1. **Database**: in the Vercel project, Storage → Create → Neon, and
   connect it. That sets `DATABASE_URL`; tables are created on first
   request. For local dev, pull it with `vercel env pull .env.local`.
2. **Key**: set `OPENAI_API_KEY` (an OpenRouter key; the default models
   are free) in Vercel and in `.env`. Without it, generation shows a
   notice — the sample meeting still works.

| Variable | Default |
|----------|---------|
| `DATABASE_URL` | (required) |
| `OPENAI_API_KEY` | (required for generation) |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | `nvidia/nemotron-3.5-super-vl:free` |
| `OPENAI_FALLBACK_MODEL` | `nvidia/nemotron-3.5-lightning:free` (used when the primary fails) |

```bash
npm install
npm run dev      # http://localhost:3000 (needs DATABASE_URL)
npm run lint
npm test
npm run evals    # needs OPENAI_API_KEY
npm run build
```
