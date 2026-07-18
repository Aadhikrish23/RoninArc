type EventCallback = (data?: unknown) => void;

class EventBus {
  private listeners: Record<string, EventCallback[]> = {};

  publish(event: string, data?: unknown): void {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[EventBus] Error in callback for event "${event}":`, error);
      }
    });
  }

  subscribe(event: string, callback: EventCallback): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.unsubscribe(event, callback);
  }

  unsubscribe(event: string, callback: EventCallback): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
  }
}

export const eventBus = new EventBus();
export default eventBus;
