import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
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

const DB_PATH =
  process.env.DATABASE_PATH ??
  // Vercel's filesystem is read-only except /tmp. Data there is ephemeral
  // (per-invocation), which is fine for a demo.
  (process.env.VERCEL
    ? path.join("/tmp", "meetings.db")
    : path.join(process.cwd(), "data", "meetings.db"));

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
`;

function createDb(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const instance = new Database(DB_PATH);
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  instance.exec(SCHEMA);
  return instance;
}

const globalForDb = globalThis as unknown as { __mtdDb?: Database.Database };
const db = globalForDb.__mtdDb ?? (globalForDb.__mtdDb = createDb());

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

export interface PriorContext {
  openActionItems: ActionItemRow[];
  decisions: { statement: string; context: string | null }[];
  meetings: { title: string; meeting_date: string | null }[];
}

export function listSeries(): Series[] {
  return db
    .prepare("SELECT * FROM series ORDER BY created_at DESC")
    .all() as Series[];
}

export function createSeries(title: string): Series {
  const series: Series = { id: newId(), title, created_at: now() };
  db.prepare("INSERT INTO series (id, title, created_at) VALUES (?, ?, ?)").run(
    series.id,
    series.title,
    series.created_at,
  );
  return series;
}

export interface CreateMeetingInput {
  title: string;
  meeting_date: string | null;
  transcript: string;
  series_id: string | null;
}

export function createMeeting(input: CreateMeetingInput): MeetingRow {
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
  db.prepare(
    `INSERT INTO meetings (id, series_id, title, meeting_date, transcript, error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    meeting.id,
    meeting.series_id,
    meeting.title,
    meeting.meeting_date,
    meeting.transcript,
    meeting.error,
    meeting.created_at,
    meeting.updated_at,
  );
  return meeting;
}

export function setMeetingError(meetingId: string, error: string | null): void {
  db.prepare("UPDATE meetings SET error = ?, updated_at = ? WHERE id = ?").run(
    error,
    now(),
    meetingId,
  );
}

export function deleteMeeting(meetingId: string): void {
  db.prepare("DELETE FROM meetings WHERE id = ?").run(meetingId);
}

function getMeetingSync(meetingId: string): MeetingRow | undefined {
  return db
    .prepare("SELECT * FROM meetings WHERE id = ?")
    .get(meetingId) as MeetingRow | undefined;
}

export function getMeeting(meetingId: string): MeetingRow | undefined {
  return getMeetingSync(meetingId);
}

export async function getMeetingDetail(
  meetingId: string,
): Promise<MeetingDetail | null> {
  await connection();
  const meeting = getMeetingSync(meetingId);
  if (!meeting) return null;
  const deliverables = db
    .prepare("SELECT * FROM deliverables WHERE meeting_id = ?")
    .get(meetingId) as DeliverablesRow | undefined;
  const action_items = db
    .prepare(
      "SELECT * FROM action_items WHERE meeting_id = ? ORDER BY sort_order, created_at",
    )
    .all(meetingId) as ActionItemRow[];
  const series = meeting.series_id
    ? ((db
        .prepare("SELECT * FROM series WHERE id = ?")
        .get(meeting.series_id) as Series | undefined) ?? null)
    : null;
  return { meeting, deliverables: deliverables ?? null, action_items, series };
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

export async function listMeetings(): Promise<MeetingListItem[]> {
  await connection();
  return db
    .prepare(
      `SELECT m.id, m.title, m.meeting_date, m.created_at, m.error,
              s.title AS series_title,
              COUNT(a.id) AS action_count,
              COALESCE(SUM(CASE WHEN a.status = 'open' THEN 1 ELSE 0 END), 0) AS open_count
       FROM meetings m
       LEFT JOIN series s ON s.id = m.series_id
       LEFT JOIN action_items a ON a.meeting_id = m.id
       GROUP BY m.id
       ORDER BY m.created_at DESC`,
    )
    .all() as MeetingListItem[];
}

export function getPriorContext(
  seriesId: string,
  excludeMeetingId: string,
): PriorContext {
  const meetings = db
    .prepare(
      `SELECT id, title, meeting_date FROM meetings
       WHERE series_id = ? AND id != ? ORDER BY created_at ASC`,
    )
    .all(seriesId, excludeMeetingId) as {
    id: string;
    title: string;
    meeting_date: string | null;
  }[];

  const openActionItems = db
    .prepare(
      `SELECT a.* FROM action_items a
       JOIN meetings m ON m.id = a.meeting_id
       WHERE m.series_id = ? AND a.meeting_id != ? AND a.status = 'open'
       ORDER BY a.created_at ASC`,
    )
    .all(seriesId, excludeMeetingId) as ActionItemRow[];

  const decisions: { statement: string; context: string | null }[] = [];
  for (const meeting of meetings) {
    const row = db
      .prepare("SELECT decisions FROM deliverables WHERE meeting_id = ?")
      .get(meeting.id) as { decisions: string | null } | undefined;
    if (!row?.decisions) continue;
    for (const decision of JSON.parse(row.decisions) as {
      statement: string;
      context: string | null;
    }[]) {
      decisions.push(decision);
    }
  }

  return { openActionItems, decisions, meetings };
}

export function saveDeliverables(
  meetingId: string,
  payload: DeliverablesPayload,
  model: string | null,
  edited = 1,
): void {
  const persist = db.transaction((data: DeliverablesPayload) => {
    const timestamp = now();
    const existing = db
      .prepare("SELECT id FROM deliverables WHERE meeting_id = ?")
      .get(meetingId) as { id: string } | undefined;

    if (existing) {
      if (model) {
        db.prepare(
          `UPDATE deliverables SET minutes = ?, decisions = ?, open_questions = ?,
             follow_up_email = ?, project_update = ?, model = ?, generated_at = ?, edited = ?
           WHERE meeting_id = ?`,
        ).run(
          data.minutes,
          JSON.stringify(data.decisions),
          JSON.stringify(data.open_questions),
          JSON.stringify(data.follow_up_email),
          JSON.stringify(data.project_update),
          model,
          timestamp,
          edited,
          meetingId,
        );
      } else {
        db.prepare(
          `UPDATE deliverables SET minutes = ?, decisions = ?, open_questions = ?,
             follow_up_email = ?, project_update = ?, edited = ?
           WHERE meeting_id = ?`,
        ).run(
          data.minutes,
          JSON.stringify(data.decisions),
          JSON.stringify(data.open_questions),
          JSON.stringify(data.follow_up_email),
          JSON.stringify(data.project_update),
          edited,
          meetingId,
        );
      }
    } else {
      db.prepare(
        `INSERT INTO deliverables (id, meeting_id, minutes, decisions, open_questions,
           follow_up_email, project_update, model, generated_at, edited)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newId(),
        meetingId,
        data.minutes,
        JSON.stringify(data.decisions),
        JSON.stringify(data.open_questions),
        JSON.stringify(data.follow_up_email),
        JSON.stringify(data.project_update),
        model,
        timestamp,
        edited,
      );
    }

    const existingIds = (
      db
        .prepare("SELECT id FROM action_items WHERE meeting_id = ?")
        .all(meetingId) as { id: string }[]
    ).map((row) => row.id);
    const incomingIds = data.action_items.map((item) => item.id);

    for (const stale of existingIds.filter((id) => !incomingIds.includes(id))) {
      db.prepare("DELETE FROM action_items WHERE id = ?").run(stale);
    }

    for (const item of data.action_items) {
      upsertActionItem(meetingId, item);
    }

    db.prepare("UPDATE meetings SET updated_at = ? WHERE id = ?").run(
      timestamp,
      meetingId,
    );
  });

  persist(payload);
}

export function upsertActionItem(
  meetingId: string,
  item: ActionItemInput,
): void {
  const timestamp = now();
  const exists = db
    .prepare("SELECT id FROM action_items WHERE id = ?")
    .get(item.id);
  if (exists) {
    db.prepare(
      `UPDATE action_items SET task = ?, owner = ?, owner_status = ?, due_date = ?,
         due_date_status = ?, status = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      item.task,
      item.owner,
      item.owner_status,
      item.due_date,
      item.due_date_status,
      item.status,
      item.sort_order,
      timestamp,
      item.id,
    );
  } else {
    db.prepare(
      `INSERT INTO action_items (id, meeting_id, task, owner, owner_status, due_date,
         due_date_status, status, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      item.id,
      meetingId,
      item.task,
      item.owner,
      item.owner_status,
      item.due_date,
      item.due_date_status,
      item.status,
      item.sort_order,
      timestamp,
      timestamp,
    );
  }
}

export function setActionItemStatus(id: string, status: "open" | "done"): void {
  db.prepare("UPDATE action_items SET status = ?, updated_at = ? WHERE id = ?").run(
    status,
    now(),
    id,
  );
}