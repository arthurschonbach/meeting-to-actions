import {
  getMeeting,
  getPriorContext,
  saveDeliverables,
  setMeetingError,
} from "@/lib/db";
import { extractionToPayload, streamExtraction } from "@/lib/llm";

// A generation is one streamed call, plus retries and a repair call when
// the free provider misbehaves. Vercel allows up to 300s.
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }

  const context = meeting.series_id
    ? await getPriorContext(meeting.series_id, meeting.id)
    : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
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
