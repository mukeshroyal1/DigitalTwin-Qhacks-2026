export type ExtensionMessage =
  | { type: 'EXECUTE_TOOL'; name: string; args: Record<string, unknown> }
  | { type: 'SET_API_KEY'; apiKey: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_MEMORY_ENABLED'; enabled: boolean };

export function sendToBackground<T = unknown>(message: ExtensionMessage): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}
