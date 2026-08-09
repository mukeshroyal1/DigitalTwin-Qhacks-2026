import type { AgentEvent } from './types/agent';

export type ExtensionMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_API_KEY'; apiKey: string }
  | { type: 'SET_MEMORY_ENABLED'; enabled: boolean }
  | { type: 'RUN_AGENT'; runId: string; text: string; memoryEnabled: boolean }
  | { type: 'ABORT_AGENT'; runId: string };

export type OkResponse = { ok: true };
export type ErrResponse = { ok: false; error: string };

export type ExtensionResponseMap = {
  GET_SETTINGS: { ok: true; apiKey: string; memoryEnabled: boolean } | ErrResponse;
  SET_API_KEY: OkResponse | ErrResponse;
  SET_MEMORY_ENABLED: OkResponse | ErrResponse;
  RUN_AGENT: { ok: true; runId: string } | ErrResponse;
  ABORT_AGENT: OkResponse | ErrResponse;
};

export type PortMessage =
  | { type: 'ping' }
  | { type: 'AGENT_EVENT'; runId: string; event: AgentEvent };

export function sendToBackground<T extends ExtensionMessage>(
  message: T
): Promise<ExtensionResponseMap[T['type']]> {
  return chrome.runtime.sendMessage(message) as Promise<ExtensionResponseMap[T['type']]>;
}
