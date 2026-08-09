import { executeTool } from '../../tools/registry';
import { runAgent } from '../../agent/loop';
import type { AgentEvent } from '../../shared/types/agent';
import type {
  ExtensionMessage,
  ExtensionResponseMap,
  PortMessage,
} from '../../shared/messaging';

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

let sidePanelPort: chrome.runtime.Port | null = null;
let activeRun: { runId: string; controller: AbortController } | null = null;

function emitToPanel(message: PortMessage) {
  try {
    sidePanelPort?.postMessage(message);
  } catch {
    // Panel disconnected
  }
}

function emitAgentEvent(runId: string, event: AgentEvent) {
  emitToPanel({ type: 'AGENT_EVENT', runId, event });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidepanel') return;
  sidePanelPort = port;

  const ping = setInterval(() => {
    try {
      port.postMessage({ type: 'ping' } satisfies PortMessage);
    } catch {
      clearInterval(ping);
    }
  }, 20000);

  port.onDisconnect.addListener(() => {
    clearInterval(ping);
    if (sidePanelPort === port) sidePanelPort = null;
  });
});

async function handleMessage(
  message: ExtensionMessage
): Promise<ExtensionResponseMap[ExtensionMessage['type']]> {
  if (message.type === 'GET_SETTINGS') {
    const stored = await chrome.storage.local.get(['backboardApiKey', 'memoryEnabled']);
    return {
      ok: true,
      apiKey: (stored.backboardApiKey as string) || '',
      memoryEnabled: stored.memoryEnabled !== false,
    };
  }

  if (message.type === 'SET_MEMORY_ENABLED') {
    await chrome.storage.local.set({ memoryEnabled: message.enabled });
    return { ok: true };
  }

  if (message.type === 'SET_API_KEY') {
    await chrome.storage.local.set({ backboardApiKey: message.apiKey.trim() });
    return { ok: true };
  }

  if (message.type === 'ABORT_AGENT') {
    if (activeRun?.runId === message.runId) {
      activeRun.controller.abort();
      activeRun = null;
    }
    return { ok: true };
  }

  if (message.type === 'RUN_AGENT') {
    if (activeRun) {
      return { ok: false, error: 'An agent run is already in progress' };
    }

    const stored = await chrome.storage.local.get(['backboardApiKey']);
    const apiKey = ((stored.backboardApiKey as string) || '').trim();
    if (!apiKey) {
      return { ok: false, error: 'Add your Backboard API key in settings first.' };
    }

    const controller = new AbortController();
    activeRun = { runId: message.runId, controller };

    void runAgent({
      apiKey,
      text: message.text,
      memoryEnabled: message.memoryEnabled,
      signal: controller.signal,
      executeTool,
      onEvent: (event) => {
        emitAgentEvent(message.runId, event);
        if (event.kind === 'done' && activeRun?.runId === message.runId) {
          activeRun = null;
        }
      },
    }).catch((error) => {
      if (activeRun?.runId === message.runId) activeRun = null;
      emitAgentEvent(message.runId, {
        kind: 'error',
        text: error instanceof Error ? error.message : 'Agent failed',
      });
      emitAgentEvent(message.runId, { kind: 'done' });
    });

    return { ok: true, runId: message.runId };
  }

  return { ok: false, error: 'Unknown message' };
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void handleMessage(message)
    .then((response) => sendResponse(response))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  return true;
});
