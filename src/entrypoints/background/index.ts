import { executeTool } from '../../tools/registry';
import type { ExtensionMessage } from '../../shared/messaging';

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidepanel') return;
  const ping = setInterval(() => {
    try {
      port.postMessage({ type: 'ping' });
    } catch {
      clearInterval(ping);
    }
  }, 20000);
  port.onDisconnect.addListener(() => clearInterval(ping));
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message.type === 'GET_SETTINGS') {
        const stored = await chrome.storage.local.get(['backboardApiKey', 'memoryEnabled']);
        sendResponse({
          apiKey: stored.backboardApiKey || '',
          memoryEnabled: stored.memoryEnabled !== false,
        });
        return;
      }

      if (message.type === 'SET_MEMORY_ENABLED') {
        await chrome.storage.local.set({ memoryEnabled: message.enabled });
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'SET_API_KEY') {
        await chrome.storage.local.set({ backboardApiKey: message.apiKey.trim() });
        sendResponse({ ok: true });
        return;
      }

      if (message.type === 'EXECUTE_TOOL') {
        const result = await executeTool(message.name, message.args || {});
        sendResponse(result);
        return;
      }

      sendResponse({ ok: false, error: 'Unknown message' });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();

  return true;
});
