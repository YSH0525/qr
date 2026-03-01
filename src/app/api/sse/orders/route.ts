import { orderEvents } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = crypto.randomUUID();
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      orderEvents.addClient(clientId, controller);

      // Send initial connection event
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`event: connected\ndata: {"clientId":"${clientId}"}\n\n`)
      );

      // Heartbeat every 30 seconds
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          orderEvents.removeClient(clientId);
        }
      }, 30000);
    },
    cancel() {
      clearInterval(heartbeat);
      orderEvents.removeClient(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
