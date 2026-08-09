import { getActiveTab, normalizeUrl, waitForTabLoad } from '../../drivers/tabs';
import type { ToolHandler } from '../types';

export const getAllTabs: ToolHandler = async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return {
    success: true,
    data: tabs.map((t) => ({ id: t.id, title: t.title, url: t.url, active: t.active })),
  };
};

export const getCurrentTab: ToolHandler = async () => {
  const tab = await getActiveTab();
  if (!tab) return { success: false, error: 'No active tab' };
  return {
    success: true,
    data: { id: tab.id, title: tab.title, url: tab.url },
  };
};

export const createNewTab: ToolHandler = async (args) => {
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
};

export const navigateToUrl: ToolHandler = async (args) => {
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
};

export const goBack: ToolHandler = async () => {
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
};

export const goForward: ToolHandler = async () => {
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
};

export const reloadTab: ToolHandler = async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return { success: false, error: 'No active tab' };
  await chrome.tabs.reload(tab.id);
  await waitForTabLoad(tab.id);
  return { success: true, message: 'Reloaded tab' };
};

export const switchToTab: ToolHandler = async (args) => {
  const tabId = Number(args.tabId);
  if (!tabId) return { success: false, error: 'tabId is required' };
  await chrome.tabs.update(tabId, { active: true });
  return { success: true, message: `Switched to tab ${tabId}` };
};

export const closeTab: ToolHandler = async (args) => {
  let tabId = Number(args.tabId);
  if (!tabId) {
    const tab = await getActiveTab();
    if (!tab?.id) return { success: false, error: 'No tab to close' };
    tabId = tab.id;
  }
  await chrome.tabs.remove(tabId);
  return { success: true, message: `Closed tab ${tabId}` };
};
