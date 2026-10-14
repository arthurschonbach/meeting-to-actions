# Meeting → Actions

Paste a meeting transcript. Get back minutes, decisions, action items, a
follow-up email and a project update, streamed live as the model produces
them, editable, with per-task checkboxes.

![Recap](docs/screenshots/shot-recap.png)

Portfolio project **#1 of 3**. It shows *structured extraction + streaming
UX*: constrained LLM output (JSON schema, validated, repaired on failure),
verbatim-derived exports, and a review loop. #2 (`docs-to-answers`) covers
retrieval; #3 (`research-to-brief`) covers tool-calling agents.

## Demo in 2 minutes

1. `npm install && npm run dev` → http://localhost:3000
2. Click **Load sample meeting** (no API key needed).
3. Watch the recap stream in, actions first. Tick a checkbox, hit **Edit**,
   tweak anything, **Regenerate** to redo.

![New meeting](docs/screenshots/shot-home.png)
![History](docs/screenshots/shot-history.png)

## How it works

```
transcript ──► LLM (core JSON only) ──► validate (zod) ──► repair once ──► save
                     │                                              │
                     ▼                                              ▼
              minutes / decisions /                    email + project update
              open questions / actions                 DERIVED IN CODE,
              (streamed per section,                   verbatim reuse,
               actions first)                          zero LLM tokens
```

- **The LLM generates only the core** (`src/lib/schema.ts`
  `CoreExtractionSchema`): summary, decisions, open questions, action
  items, with tight caps (max lengths, max counts) to keep output sharp
  and cheap. Follow-up email and project update are **assembled in code**
  from the core, so they can never contradict it and cost nothing.
- **Streaming** (`src/app/api/meetings/[id]/generate/route.ts`): newline-
  delimited JSON sections over SSE-style NDJSON, with a non-streaming
  repair fallback. Reasoning models get their thinking hidden behind a
  collapsible panel.
- **Ownership honesty**: every owner/due date carries an
  explicit/inferred/unknown flag, the UI surfaces inferred values instead
  of laundering guesses as facts.
- **Series awareness**: recurring meetings pass open actions + past
  decisions as context (interpretation only, never repeated as new).
- **Stack**: Next.js 16, React 19, Tailwind v4, `better-sqlite3`, OpenAI
  SDK against OpenRouter. EN/FR, light/dark, 680px sober layout.

## Keys

- **Sample meeting works without a key.** Generating from your own
  transcripts needs one: copy `.env.example` to `.env`, set
  `OPENAI_API_KEY` (OpenRouter, free-tier keys work; the default model is
  a free one). Without it, generation shows an honest notice.

## Deploying (Vercel)

- Set `OPENAI_API_KEY` in the project environment variables and redeploy.
- The database lives in `/tmp` there (filesystem is read-only), so
  history is ephemeral per invocation - the sample meeting is always
  reloadable, which is the demo path.

## Production-swap notes (deliberately not built)

- Auth + per-user meetings (single-user sqlite today).
- Background generation jobs + retries instead of request-scoped streams
  past demo scale.
- Model fallback chain across providers when free-tier rate limits bite.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```
