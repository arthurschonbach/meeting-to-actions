"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  createMeeting,
  createSeries,
  deleteMeeting,
  getMeeting,
  ownsSeries,
  saveDeliverables,
} from "./db";
import { CREATE_LIMITS } from "./limits";
import { extractionToPayload } from "./llm";
import { hitLimit } from "./rate-limit";
import { SAMPLE_EXTRACTION, SAMPLE_TITLE, SAMPLE_TRANSCRIPT } from "./sample";
import { DeliverablesPayloadSchema } from "./schema";
import { getDictionary } from "./i18n";
import { getLocale } from "./locale";
import { getClientIp, getVisitorId } from "./visitor";

export interface FormState {
  error: string | null;
}

// ~15k tokens: long meetings fit, pasted novels don't.
const MAX_TRANSCRIPT_CHARS = 60_000;
const MAX_TITLE_CHARS = 200;

export async function createMeetingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const d = getDictionary(await getLocale());
  const transcript = String(formData.get("transcript") ?? "").trim();
  if (!transcript) {
    return { error: d.form.emptyError };
  }
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return { error: d.form.tooLongError };
  }
  if (await hitLimit(await getClientIp(), CREATE_LIMITS)) {
    return { error: d.form.rateLimited };
  }
  const visitor = await getVisitorId();

  const title =
    String(formData.get("title") ?? "").trim().slice(0, MAX_TITLE_CHARS) ||
    "Untitled meeting";
  const meetingDate =
    String(formData.get("meeting_date") ?? "").trim() || null;

  let seriesId: string | null = null;
  const seriesChoice = String(formData.get("series") ?? "");
  if (seriesChoice === "new") {
    const seriesTitle =
      String(formData.get("new_series_title") ?? "").trim().slice(0, MAX_TITLE_CHARS) ||
      title;
    seriesId = (await createSeries(visitor, seriesTitle)).id;
  } else if (seriesChoice && (await ownsSeries(visitor, seriesChoice))) {
    seriesId = seriesChoice;
  }

  const meeting = await createMeeting(visitor, {
    title,
    meeting_date: meetingDate,
    transcript,
    series_id: seriesId,
  });

  redirect(`/meetings/${meeting.id}`);
}

export async function saveDeliverablesAction(
  meetingId: string,
  payload: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = DeliverablesPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "The submitted data was invalid." };
  }
  const meeting = await getMeeting(await getVisitorId(), meetingId);
  if (!meeting) return { ok: false, error: "Meeting not found." };
  await saveDeliverables(meetingId, parsed.data, null, 1);
  refresh();
  return { ok: true };
}

export async function deleteMeetingAction(formData: FormData): Promise<void> {
  const meetingId = String(formData.get("meeting_id") ?? "");
  if (!meetingId) return;
  await deleteMeeting(await getVisitorId(), meetingId);
  redirect("/history");
}

export async function loadSampleAction(): Promise<void> {
  if (await hitLimit(await getClientIp(), CREATE_LIMITS)) {
    redirect("/");
  }
  const visitor = await getVisitorId();
  const existingSeriesTitle = "Product & Onboarding";
  const series = await createSeries(visitor, existingSeriesTitle);
  const meeting = await createMeeting(visitor, {
    title: SAMPLE_TITLE,
    meeting_date: "2026-09-18",
    transcript: SAMPLE_TRANSCRIPT,
    series_id: series.id,
  });
  await saveDeliverables(
    meeting.id,
    extractionToPayload(SAMPLE_EXTRACTION),
    "sample",
    0,
  );
  redirect(`/meetings/${meeting.id}`);
}
