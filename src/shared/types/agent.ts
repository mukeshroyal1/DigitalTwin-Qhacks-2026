export type AgentEvent =
  | { kind: 'status'; text: string }
  | { kind: 'tool'; name: string; status: 'start' | 'done' | 'error' }
  | { kind: 'message'; text: string }
  | { kind: 'screenshot'; imageData: string; title?: string }
  | { kind: 'error'; text: string }
  | { kind: 'done' };
