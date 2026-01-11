import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import {
  StateSnapshot,
  StateChange,
  StateSubscriber,
  StateSelector,
} from './types.js';

export class StateManager {
  private sessions: Map<string, SessionState> = new Map();
  private eventBus: EventEmitter = new EventEmitter();

  createSession(initialState?: Partial<StateSnapshot>): SessionState {
    const sessionId = uuidv4();
    const session = new SessionState(sessionId, initialState, (changes) =>
      this.notifyChanges(sessionId, changes)
    );
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  subscribe(subscriber: StateSubscriber): () => void {
    const handler = (
      _id: string,
      state: StateSnapshot,
      changes: StateChange[]
    ) => {
      subscriber(state, changes);
    };
    this.eventBus.on('state:changed', handler);
    return () => this.eventBus.off('state:changed', handler);
  }

  subscribeToSession(
    sessionId: string,
    subscriber: StateSubscriber
  ): () => void {
    const handler = (
      id: string,
      state: StateSnapshot,
      changes: StateChange[]
    ) => {
      if (id === sessionId) subscriber(state, changes);
    };
    this.eventBus.on('state:changed', handler);
    return () => this.eventBus.off('state:changed', handler);
  }

  private notifyChanges(sessionId: string, changes: StateChange[]): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.eventBus.emit('state:changed', sessionId, session.getState(), changes);
    }
  }

  removeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }
}

export class SessionState {
  private state: StateSnapshot;
  private history: StateSnapshot[] = [];
  private subscribers: Set<StateSubscriber> = new Set();

  constructor(
    readonly id: string,
    initialState?: Partial<StateSnapshot>,
    private onChange?: (changes: StateChange[]) => void
  ) {
    this.state = {
      sessionId: id,
      status: 'idle',
      createdAt: new Date(),
      updatedAt: new Date(),
      domain: {},
      ...initialState,
    };
  }

  getState(): StateSnapshot {
    return structuredClone(this.state);
  }

  getDomain<T>(): T {
    return structuredClone(this.state.domain) as T;
  }

  update(
    updates: Partial<StateSnapshot>,
    source: string = 'system'
  ): StateSnapshot {
    const changes = this.computeChanges(updates, source);

    this.history.push(structuredClone(this.state));

    this.state = {
      ...this.state,
      ...updates,
      domain: {
        ...this.state.domain,
        ...(updates.domain || {}),
      },
      updatedAt: new Date(),
    };

    if (changes.length > 0) {
      this.subscribers.forEach((s) => s(this.getState(), changes));
      this.onChange?.(changes);
    }

    return this.getState();
  }

  updateDomain(
    updates: Record<string, unknown>,
    source: string = 'system'
  ): StateSnapshot {
    return this.update({ domain: { ...this.state.domain, ...updates } }, source);
  }

  select<T>(selector: StateSelector<T>): T {
    return selector(this.getState());
  }

  subscribe(subscriber: StateSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  checkpoint(): string {
    const checkpointId = `checkpoint-${this.history.length}`;
    return checkpointId;
  }

  rollback(checkpointId: string): boolean {
    const index = parseInt(checkpointId.split('-')[1]);
    if (index >= 0 && index < this.history.length) {
      this.state = structuredClone(this.history[index]);
      return true;
    }
    return false;
  }

  getHistory(): StateSnapshot[] {
    return this.history.map((s) => structuredClone(s));
  }

  private computeChanges(
    updates: Partial<StateSnapshot>,
    source: string
  ): StateChange[] {
    const changes: StateChange[] = [];
    const now = new Date();

    const walk = (obj: Record<string, unknown>, path: string[] = []) => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];
        const currentValue = this.getValueAtPath(this.state, currentPath);

        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        ) {
          walk(value as Record<string, unknown>, currentPath);
        } else if (currentValue !== value) {
          changes.push({
            path: currentPath,
            previousValue: currentValue,
            newValue: value,
            timestamp: now,
            source,
          });
        }
      }
    };

    walk(updates);
    return changes;
  }

  private getValueAtPath(obj: unknown, path: string[]): unknown {
    return path.reduce(
      (current: unknown, key: string) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[key]
          : undefined,
      obj
    );
  }
}

export const stateManager = new StateManager();
