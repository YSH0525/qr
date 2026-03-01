type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

class OrderEventEmitter {
  private clients: Map<string, SSEClient> = new Map();

  addClient(id: string, controller: ReadableStreamDefaultController) {
    this.clients.set(id, { id, controller });
  }

  removeClient(id: string) {
    this.clients.delete(id);
  }

  broadcast(event: string, data: unknown) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    for (const [id, client] of this.clients) {
      try {
        client.controller.enqueue(encoder.encode(message));
      } catch {
        this.clients.delete(id);
      }
    }
  }

  get clientCount() {
    return this.clients.size;
  }
}

// Singleton — production에서도 동일 인스턴스 유지
const globalForSSE = globalThis as unknown as { orderEvents: OrderEventEmitter };
if (!globalForSSE.orderEvents) {
  globalForSSE.orderEvents = new OrderEventEmitter();
}
export const orderEvents = globalForSSE.orderEvents;
