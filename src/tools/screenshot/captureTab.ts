import { getActiveTab } from '../../drivers/tabs';
import type { ToolHandler } from '../types';

export const captureScreenshot: ToolHandler = async () => {
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
};
