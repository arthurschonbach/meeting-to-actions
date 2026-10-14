"use client";

import { useActionState, useState } from "react";
import { createMeetingAction, type FormState } from "@/lib/actions";
import type { Series } from "@/lib/schema";
import { useI18n } from "./LocaleProvider";
import { areaClass, btnPrimary, inputLargeClass, labelClass } from "./ui";

export function ImportForm({ series }: { series: Series[] }) {
  const { d } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createMeetingAction,
    { error: null },
  );
  const [transcript, setTranscript] = useState("");
  const [seriesChoice, setSeriesChoice] = useState("");

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="title">
            {d.form.titleLabel}
          </label>
          <input
            id="title"
            name="title"
            className={inputLargeClass}
            placeholder={d.form.titlePlaceholder}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="meeting_date">
            {d.form.dateLabel}
          </label>
          <input
            id="meeting_date"
            name="meeting_date"
            className={inputLargeClass}
            placeholder={d.form.datePlaceholder}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="series">
            {d.form.seriesLabel}
          </label>
          <select
            id="series"
            name="series"
            className={inputLargeClass}
            value={seriesChoice}
            onChange={(event) => setSeriesChoice(event.target.value)}
          >
            <option value="">{d.form.seriesNone}</option>
            {series.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
            <option value="new">{d.form.seriesNew}</option>
          </select>
          <p className="mt-1 text-xs text-muted">{d.form.seriesHint}</p>
        </div>
        {seriesChoice === "new" && (
          <div>
            <label className={labelClass} htmlFor="new_series_title">
              {d.form.seriesNewLabel}
            </label>
            <input
              id="new_series_title"
              name="new_series_title"
              className={inputLargeClass}
              placeholder={d.form.seriesNewPlaceholder}
            />
          </div>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label className="block text-sm font-medium" htmlFor="transcript">
            {d.form.transcriptLabel}
          </label>
          <label className="cursor-pointer text-xs text-muted underline underline-offset-4 transition-colors hover:text-foreground">
            {d.form.transcriptLoad}
            <input
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) setTranscript(await file.text());
              }}
            />
          </label>
        </div>
        <textarea
          id="transcript"
          name="transcript"
          className={`${areaClass} min-h-72 font-mono`}
          placeholder={d.form.transcriptPlaceholder}
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          required
        />
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? d.form.submitting : d.form.submit}
        </button>
        {pending && (
          <span className="text-sm text-muted">{d.form.submitHint}</span>
        )}
      </div>
    </form>
  );
}
