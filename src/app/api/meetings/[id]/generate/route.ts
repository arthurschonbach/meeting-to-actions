import {
  getMeeting,
  getPriorContext,
  saveDeliverables,
  setMeetingError,
} from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { GENERATE_LIMITS } from "@/lib/limits";
import { extractionToPayload, streamExtraction } from "@/lib/llm";
import { getLocale } from "@/lib/locale";
import { hitLimit } from "@/lib/rate-limit";
import { clientIp, getVisitorId } from "@/lib/visitor";

// A generation is one streamed call, plus retries and a repair call when
// the free provider misbehaves. Vercel allows up to 300s.
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const visitor = await getVisitorId();
  const meeting = await getMeeting(visitor, id);
  if (!meeting) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const line = (event: unknown) => encoder.encode(`${JSON.stringify(event)}\n`);

  if (await hitLimit(clientIp(request.headers), GENERATE_LIMITS)) {
    // Same NDJSON shape as a failed generation, so the panel shows it and
    // offers a retry; the meeting itself is left untouched.
    const d = getDictionary(await getLocale());
    return new Response(line({ type: "error", message: d.generation.rateLimited }), {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  }

  const context = meeting.series_id
    ? await getPriorContext(visitor, meeting.series_id, meeting.id)
    : undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(line(event));
        } catch {
          // Client went away; keep going so the result is still saved.
        }
      };

      try {
        let completed = false;
        for await (const event of streamExtraction(meeting.transcript, context)) {
          if (event.type === "done") {
            const payload = extractionToPayload(event.extraction);
            await saveDeliverables(id, payload, event.model, 0);
            await setMeetingError(id, null);
            completed = true;
            send({ type: "done", model: event.model, payload });
          } else {
            send(event);
          }
        }
        if (!completed) {
          throw new Error("Generation produced no output.");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Generation failed.";
        console.error("Generation failed:", error);
        await setMeetingError(id, message).catch(() => {});
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
    },
  });
}
