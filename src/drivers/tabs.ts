export async function getActiveTab() {
  const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (focused?.id != null && isPageTab(focused)) return focused;

  const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (current?.id != null && isPageTab(current)) return current;

  const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
  const page = tabs.find((t) => t.id != null && isPageTab(t) && t.active) || tabs.find((t) => t.id != null && isPageTab(t));
  if (page) return page;

  const any = await chrome.tabs.query({});
  return any.find((t) => t.id != null && isPageTab(t)) || current || focused || null;
}

function isPageTab(tab: chrome.tabs.Tab) {
  const url = tab.url || '';
  if (!url) return true;
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return false;
  if (url.startsWith('devtools://') || url.startsWith('edge://')) return false;
  return true;
}

export function normalizeUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return 'about:blank';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    return `https://${trimmed}`;
  }
  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
}

export function waitForTabLoad(tabId: number, timeoutMs = 30000): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        resolve();
        return;
      }
      if (tab?.status === 'complete') {
        resolve();
        return;
      }

      const listener = (id: number, change: chrome.tabs.TabChangeInfo) => {
        if (id === tabId && change.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, timeoutMs);
    });
  });
}
