"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  createMeeting,
  createSeries,
  deleteMeeting,
  getMeeting,
  saveDeliverables,
} from "./db";
import { extractionToPayload } from "./llm";
import { SAMPLE_EXTRACTION, SAMPLE_TITLE, SAMPLE_TRANSCRIPT } from "./sample";
import { DeliverablesPayloadSchema } from "./schema";
import { getDictionary } from "./i18n";
import { getLocale } from "./locale";

export interface FormState {
  error: string | null;
}

export async function createMeetingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const transcript = String(formData.get("transcript") ?? "").trim();
  if (!transcript) {
    const d = getDictionary(await getLocale());
    return { error: d.form.emptyError };
  }

  const title =
    String(formData.get("title") ?? "").trim() || "Untitled meeting";
  const meetingDate =
    String(formData.get("meeting_date") ?? "").trim() || null;

  let seriesId: string | null = null;
  const seriesChoice = String(formData.get("series") ?? "");
  if (seriesChoice === "new") {
    const seriesTitle =
      String(formData.get("new_series_title") ?? "").trim() || title;
    seriesId = createSeries(seriesTitle).id;
  } else if (seriesChoice) {
    seriesId = seriesChoice;
  }

  const meeting = createMeeting({
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
  const meeting = getMeeting(meetingId);
  if (!meeting) return { ok: false, error: "Meeting not found." };
  saveDeliverables(meetingId, parsed.data, null, 1);
  refresh();
  return { ok: true };
}

export async function deleteMeetingAction(formData: FormData): Promise<void> {
  const meetingId = String(formData.get("meeting_id") ?? "");
  if (!meetingId) return;
  deleteMeeting(meetingId);
  redirect("/history");
}

export async function loadSampleAction(): Promise<void> {
  const existingSeriesTitle = "Product & Onboarding";
  const series = createSeries(existingSeriesTitle);
  const meeting = createMeeting({
    title: SAMPLE_TITLE,
    meeting_date: "2026-09-18",
    transcript: SAMPLE_TRANSCRIPT,
    series_id: series.id,
  });
  saveDeliverables(
    meeting.id,
    extractionToPayload(SAMPLE_EXTRACTION),
    "sample",
    0,
  );
  redirect(`/meetings/${meeting.id}`);
}
