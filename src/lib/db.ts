import postgres from "postgres";
import { connection } from "next/server";
import type {
  ActionItemInput,
  ActionItemRow,
  DeliverablesPayload,
  DeliverablesRow,
  MeetingDetail,
  MeetingRow,
  Series,
} from "./schema";

// Postgres (Neon in production). One shared database, so every serverless
// instance sees the same meetings. Ids are generated in code and
// timestamps stored as ISO strings, so rows read back as plain strings.
function createSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.");
  // prepare: false - Neon's pooled endpoint (PgBouncer) can't keep
  // prepared statements across transactions.
  return postgres(url, { prepare: false, max: 5, onnotice: () => {} });
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  series_id TEXT REFERENCES series(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  meeting_date TEXT,
  transcript TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deliverables (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
  minutes TEXT,
  decisions TEXT,
  open_questions TEXT,
  follow_up_email TEXT,
  project_update TEXT,
  model TEXT,
  generated_at TEXT,
  edited INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  owner TEXT,
  owner_status TEXT NOT NULL,
  due_date TEXT,
  due_date_status TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_series ON meetings(series_id);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items(meeting_id);

-- Rows belong to an anonymous visitor (see lib/visitor.ts); deliverables
-- and action items follow their meeting. Rows from before this column
-- existed stay NULL: no one sees them, the purge removes them.
ALTER TABLE series ADD COLUMN IF NOT EXISTS visitor_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS visitor_id TEXT;
CREATE INDEX IF NOT EXISTS idx_series_visitor ON series(visitor_id);
CREATE INDEX IF NOT EXISTS idx_meetings_visitor ON meetings(visitor_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
`;

// Demo data is kept for RETENTION_DAYS, then purged.
export const RETENTION_DAYS = 30;

async function purge(sql: postgres.Sql): Promise<void> {
  // Timestamps are ISO strings, which sort like dates.
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  await sql`DELETE FROM meetings WHERE created_at < ${cutoff} OR visitor_id IS NULL`;
  await sql`
    DELETE FROM series s
    WHERE (s.created_at < ${cutoff} OR s.visitor_id IS NULL)
      AND NOT EXISTS (SELECT 1 FROM meetings m WHERE m.series_id = s.id)`;
}

const globalForDb = globalThis as unknown as {
  __mtdSql?: postgres.Sql;
  __mtdSchema?: Promise<void>;
};

/** The database, with tables created on first use in this process. */
export async function db(): Promise<postgres.Sql> {
  const sql = (globalForDb.__mtdSql ??= createSql());
  // Purge runs once per process start, which on serverless is often enough.
  globalForDb.__mtdSchema ??= sql
    .unsafe(SCHEMA)
    .then(() => purge(sql))
    .then(() => undefined)
    .catch((error) => {
      globalForDb.__mtdSchema = undefined; // retry on the next request
      throw error;
    });
  await globalForDb.__mtdSchema;
  return sql;
}

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

export interface PriorContext {
  openActionItems: ActionItemRow[];
  decisions: { statement: string; context: string | null }[];
  meetings: { title: string; meeting_date: string | null }[];
}

export async function listSeries(visitor: string): Promise<Series[]> {
  const sql = await db();
  return sql<Series[]>`
    SELECT id, title, created_at FROM series
    WHERE visitor_id = ${visitor} ORDER BY created_at DESC`;
}

export async function createSeries(visitor: string, title: string): Promise<Series> {
  const series: Series = { id: newId(), title, created_at: now() };
  const sql = await db();
  await sql`INSERT INTO series ${sql({ ...series, visitor_id: visitor })}`;
  return series;
}

export async function ownsSeries(visitor: string, seriesId: string): Promise<boolean> {
  const sql = await db();
  const [row] = await sql`
    SELECT 1 FROM series WHERE id = ${seriesId} AND visitor_id = ${visitor}`;
  return Boolean(row);
}

export interface CreateMeetingInput {
  title: string;
  meeting_date: string | null;
  transcript: string;
  series_id: string | null;
}

export async function createMeeting(
  visitor: string,
  input: CreateMeetingInput,
): Promise<MeetingRow> {
  const timestamp = now();
  const meeting: MeetingRow = {
    id: newId(),
    series_id: input.series_id,
    title: input.title,
    meeting_date: input.meeting_date,
    transcript: input.transcript,
    error: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const sql = await db();
  await sql`INSERT INTO meetings ${sql({ ...meeting, visitor_id: visitor })}`;
  return meeting;
}

export async function setMeetingError(
  meetingId: string,
  error: string | null,
): Promise<void> {
  const sql = await db();
  await sql`UPDATE meetings SET error = ${error}, updated_at = ${now()} WHERE id = ${meetingId}`;
}

export async function deleteMeeting(visitor: string, meetingId: string): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM meetings WHERE id = ${meetingId} AND visitor_id = ${visitor}`;
}

/** The meeting, only if it belongs to `visitor`. Gate for every write. */
export async function getMeeting(
  visitor: string,
  meetingId: string,
): Promise<MeetingRow | undefined> {
  const sql = await db();
  const [meeting] = await sql<MeetingRow[]>`
    SELECT id, series_id, title, meeting_date, transcript, error, created_at, updated_at
    FROM meetings WHERE id = ${meetingId} AND visitor_id = ${visitor}`;
  return meeting;
}

export async function getMeetingDetail(
  visitor: string,
  meetingId: string,
): Promise<MeetingDetail | null> {
  await connection();
  const meeting = await getMeeting(visitor, meetingId);
  if (!meeting) return null;
  const sql = await db();
  const [[deliverables], action_items, [series]] = await Promise.all([
    sql<DeliverablesRow[]>`SELECT * FROM deliverables WHERE meeting_id = ${meetingId}`,
    sql<ActionItemRow[]>`
      SELECT * FROM action_items WHERE meeting_id = ${meetingId}
      ORDER BY sort_order, created_at`,
    meeting.series_id
      ? sql<Series[]>`SELECT id, title, created_at FROM series WHERE id = ${meeting.series_id}`
      : Promise.resolve([] as Series[]),
  ]);
  return {
    meeting,
    deliverables: deliverables ?? null,
    action_items,
    series: series ?? null,
  };
}

export interface MeetingListItem {
  id: string;
  title: string;
  meeting_date: string | null;
  created_at: string;
  series_title: string | null;
  error: string | null;
  action_count: number;
  open_count: number;
}

export async function listMeetings(visitor: string): Promise<MeetingListItem[]> {
  await connection();
  const sql = await db();
  return sql<MeetingListItem[]>`
    SELECT m.id, m.title, m.meeting_date, m.created_at, m.error,
           s.title AS series_title,
           COUNT(a.id)::int AS action_count,
           COUNT(a.id) FILTER (WHERE a.status = 'open')::int AS open_count
    FROM meetings m
    LEFT JOIN series s ON s.id = m.series_id
    LEFT JOIN action_items a ON a.meeting_id = m.id
    WHERE m.visitor_id = ${visitor}
    GROUP BY m.id, s.title
    ORDER BY m.created_at DESC`;
}

export async function getPriorContext(
  visitor: string,
  seriesId: string,
  excludeMeetingId: string,
): Promise<PriorContext> {
  const sql = await db();
  const [meetings, openActionItems, decisionRows] = await Promise.all([
    sql<{ title: string; meeting_date: string | null }[]>`
      SELECT title, meeting_date FROM meetings
      WHERE series_id = ${seriesId} AND id != ${excludeMeetingId}
        AND visitor_id = ${visitor}
      ORDER BY created_at ASC`,
    sql<ActionItemRow[]>`
      SELECT a.* FROM action_items a
      JOIN meetings m ON m.id = a.meeting_id
      WHERE m.series_id = ${seriesId} AND a.meeting_id != ${excludeMeetingId}
        AND m.visitor_id = ${visitor} AND a.status = 'open'
      ORDER BY a.created_at ASC`,
    sql<{ decisions: string }[]>`
      SELECT d.decisions FROM deliverables d
      JOIN meetings m ON m.id = d.meeting_id
      WHERE m.series_id = ${seriesId} AND m.id != ${excludeMeetingId}
        AND m.visitor_id = ${visitor} AND d.decisions IS NOT NULL
      ORDER BY m.created_at ASC`,
  ]);
  const decisions = decisionRows.flatMap(
    (row) => JSON.parse(row.decisions) as { statement: string; context: string | null }[],
  );
  return { openActionItems, decisions, meetings };
}

export async function saveDeliverables(
  meetingId: string,
  payload: DeliverablesPayload,
  model: string | null,
  edited = 1,
): Promise<void> {
  const timestamp = now();
  const content = {
    minutes: payload.minutes,
    decisions: JSON.stringify(payload.decisions),
    open_questions: JSON.stringify(payload.open_questions),
    follow_up_email: JSON.stringify(payload.follow_up_email),
    project_update: JSON.stringify(payload.project_update),
    edited,
  };
  // Manual edits (model = null) keep the original model and timestamp.
  const generation = model ? { model, generated_at: timestamp } : {};
  const sql = await db();

  await sql.begin(async (tx) => {
    const [existing] = await tx`SELECT id FROM deliverables WHERE meeting_id = ${meetingId}`;
    if (existing) {
      await tx`UPDATE deliverables SET ${tx({ ...content, ...generation })}
               WHERE meeting_id = ${meetingId}`;
    } else {
      await tx`INSERT INTO deliverables ${tx({
        id: newId(),
        meeting_id: meetingId,
        model,
        generated_at: timestamp,
        ...content,
      })}`;
    }

    const incomingIds = payload.action_items.map((item) => item.id);
    await tx`DELETE FROM action_items
             WHERE meeting_id = ${meetingId} AND NOT (id = ANY(${incomingIds}::text[]))`;
    for (const item of payload.action_items) {
      await upsertActionItem(tx, meetingId, item, timestamp);
    }

    await tx`UPDATE meetings SET updated_at = ${timestamp} WHERE id = ${meetingId}`;
  });
}

async function upsertActionItem(
  tx: postgres.TransactionSql,
  meetingId: string,
  item: ActionItemInput,
  timestamp: string,
): Promise<void> {
  const fields = {
    task: item.task,
    owner: item.owner,
    owner_status: item.owner_status,
    due_date: item.due_date,
    due_date_status: item.due_date_status,
    status: item.status,
    sort_order: item.sort_order,
    updated_at: timestamp,
  };
  await tx`
    INSERT INTO action_items ${tx({ id: item.id, meeting_id: meetingId, created_at: timestamp, ...fields })}
    ON CONFLICT (id) DO UPDATE SET ${tx(fields)}`;
}
