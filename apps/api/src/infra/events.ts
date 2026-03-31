import { EventEmitter } from 'node:events';

export interface MeridianEvent {
  org_id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor_id: string | null;
  data: Record<string, unknown>;
}

class EventBus extends EventEmitter {
  emit(event: string, payload: MeridianEvent): boolean {
    return super.emit(event, payload);
  }

  on(event: string, listener: (payload: MeridianEvent) => void): this {
    return super.on(event, listener);
  }
}

export const eventBus = new EventBus();
eventBus.setMaxListeners(50);
