import { v4 as uuidv4 } from 'uuid';
import { BaseState, Message } from './types.js';

type StateListener = (state: BaseState) => void;

export class StateStore {
  private state: BaseState;
  private listeners: Set<StateListener> = new Set();
  private history: BaseState[] = [];

  constructor(initialState?: Partial<BaseState>) {
    this.state = {
      sessionId: uuidv4(),
      status: 'idle',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...initialState,
    };
  }

  getState(): BaseState {
    return { ...this.state };
  }

  update(updates: Partial<BaseState>): BaseState {
    this.history.push({ ...this.state });
    this.state = {
      ...this.state,
      ...updates,
      updatedAt: new Date(),
    };
    this.notifyListeners();
    return this.getState();
  }

  addMessage(message: Omit<Message, 'id' | 'timestamp'>): Message {
    const fullMessage: Message = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };
    this.update({
      messages: [...this.state.messages, fullMessage],
    });
    return fullMessage;
  }

  setStatus(status: BaseState['status']): void {
    this.update({ status });
  }

  setWorkflowStage(stage: string): void {
    this.update({ workflowStage: stage });
  }

  setCurrentAgent(agentId: string): void {
    this.update({ currentAgent: agentId });
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach((listener) => listener(currentState));
  }

  checkpoint(): BaseState {
    return { ...this.state };
  }

  restore(checkpoint: BaseState): void {
    this.state = { ...checkpoint };
    this.notifyListeners();
  }

  getHistory(): BaseState[] {
    return [...this.history];
  }
}

export class DomainStateStore<T extends Record<string, unknown>> extends StateStore {
  private domainState: T;

  constructor(initialBaseState?: Partial<BaseState>, initialDomainState?: T) {
    super(initialBaseState);
    this.domainState = (initialDomainState || {}) as T;
  }

  getDomainState(): T {
    return { ...this.domainState };
  }

  updateDomain(updates: Partial<T>): T {
    this.domainState = {
      ...this.domainState,
      ...updates,
    };
    this.update({});
    return this.getDomainState();
  }

  getFullState(): BaseState & { domain: T } {
    return {
      ...this.getState(),
      domain: this.getDomainState(),
    };
  }
}
