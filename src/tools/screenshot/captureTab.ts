import { getActiveTab } from '../../drivers/tabs';
import type { RegisteredTool } from '../types';

export const captureScreenshotTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'capture_tab_screenshot',
      description: 'Capture a screenshot of the visible tab.',
      parameters: { type: 'object', properties: {} },
    },
  },
  execute: async () => {
    const tab = await getActiveTab();
    if (!tab?.windowId) return { success: false, error: 'No active tab' };
    try {
      if (tab.id != null) await chrome.tabs.update(tab.id, { active: true });
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      return {
        success: true,
        message: 'Screenshot captured',
        data: { imageData: dataUrl, title: tab.title, url: tab.url },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Screenshot failed',
      };
    }
  },
};
