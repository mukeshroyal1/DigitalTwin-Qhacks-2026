import { getActiveTab, normalizeUrl, waitForTabLoad } from '../../drivers/tabs';
import type { RegisteredTool } from '../types';

export const getAllTabsTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'get_all_tabs',
      description: 'List open tabs in the current window.',
      parameters: { type: 'object', properties: {} },
    },
  },
  execute: async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return {
      success: true,
      data: tabs.map((t) => ({ id: t.id, title: t.title, url: t.url, active: t.active })),
    };
  },
};

export const getCurrentTabTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'get_current_tab',
      description: 'Get the active page tab.',
      parameters: { type: 'object', properties: {} },
    },
  },
  execute: async () => {
    const tab = await getActiveTab();
    if (!tab) return { success: false, error: 'No active tab' };
    return {
      success: true,
      data: { id: tab.id, title: tab.title, url: tab.url },
    };
  },
};

export const createNewTabTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'create_new_tab',
      description: 'Open a URL in a new tab and wait for it to load.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL or search query' },
        },
        required: ['url'],
      },
    },
  },
  execute: async (args) => {
    const url = normalizeUrl(String(args.url || ''));
    const tab = await chrome.tabs.create({ url, active: true });
    if (tab.id == null) return { success: false, error: 'Failed to create tab' };
    await waitForTabLoad(tab.id);
    const updated = await chrome.tabs.get(tab.id);
    return {
      success: true,
      message: 'Opened new tab',
      data: { tabId: updated.id, url: updated.url, title: updated.title },
    };
  },
};

export const navigateToUrlTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'navigate_to_url',
      description: 'Navigate the current tab to a URL (same-tab navigation).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL or search query' },
        },
        required: ['url'],
      },
    },
  },
  execute: async (args) => {
    const tab = await getActiveTab();
    if (!tab?.id) return { success: false, error: 'No active tab' };
    const url = normalizeUrl(String(args.url || ''));
    await chrome.tabs.update(tab.id, { url, active: true });
    await waitForTabLoad(tab.id);
    const updated = await chrome.tabs.get(tab.id);
    return {
      success: true,
      message: `Navigated to ${updated.url}`,
      data: { tabId: updated.id, url: updated.url, title: updated.title },
    };
  },
};

export const goBackTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'go_back',
      description: 'Go back in the current tab history.',
      parameters: { type: 'object', properties: {} },
    },
  },
  execute: async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return { success: false, error: 'No active tab' };
    try {
      await chrome.tabs.goBack(tab.id);
      await waitForTabLoad(tab.id, 10000);
      const updated = await chrome.tabs.get(tab.id);
      return { success: true, message: 'Went back', data: { url: updated.url } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'go_back failed',
      };
    }
  },
};

export const goForwardTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'go_forward',
      description: 'Go forward in the current tab history.',
      parameters: { type: 'object', properties: {} },
    },
  },
  execute: async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return { success: false, error: 'No active tab' };
    try {
      await chrome.tabs.goForward(tab.id);
      await waitForTabLoad(tab.id, 10000);
      const updated = await chrome.tabs.get(tab.id);
      return { success: true, message: 'Went forward', data: { url: updated.url } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'go_forward failed',
      };
    }
  },
};

export const reloadTabTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'reload_tab',
      description: 'Reload the current tab.',
      parameters: { type: 'object', properties: {} },
    },
  },
  execute: async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return { success: false, error: 'No active tab' };
    await chrome.tabs.reload(tab.id);
    await waitForTabLoad(tab.id);
    return { success: true, message: 'Reloaded tab' };
  },
};

export const switchToTabTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'switch_to_tab',
      description: 'Activate a tab by id.',
      parameters: {
        type: 'object',
        properties: { tabId: { type: 'number' } },
        required: ['tabId'],
      },
    },
  },
  execute: async (args) => {
    const tabId = Number(args.tabId);
    if (!tabId) return { success: false, error: 'tabId is required' };
    await chrome.tabs.update(tabId, { active: true });
    return { success: true, message: `Switched to tab ${tabId}` };
  },
};

export const closeTabTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'close_tab',
      description: 'Close a tab by id (defaults to current tab).',
      parameters: {
        type: 'object',
        properties: { tabId: { type: 'number' } },
      },
    },
  },
  execute: async (args) => {
    let tabId = Number(args.tabId);
    if (!tabId) {
      const tab = await getActiveTab();
      if (!tab?.id) return { success: false, error: 'No tab to close' };
      tabId = tab.id;
    }
    await chrome.tabs.remove(tabId);
    return { success: true, message: `Closed tab ${tabId}` };
  },
};
