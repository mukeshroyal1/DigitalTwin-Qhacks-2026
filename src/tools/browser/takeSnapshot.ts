import { CdpCommander } from '../../drivers/cdp/cdpCommander';
import { debuggerManager } from '../../drivers/cdp/debuggerManager';
import { snapshotManager } from '../../drivers/cdp/snapshotManager';
import { getActiveTab } from '../../drivers/tabs';
import type { ToolHandler } from '../types';

async function withDebugger<T>(tabId: number, fn: (cdp: CdpCommander) => Promise<T>) {
  const ok = await debuggerManager.attach(tabId);
  if (!ok) throw new Error('Could not attach debugger to this tab');
  return fn(new CdpCommander(tabId));
}

export const takeSnapshot: ToolHandler = async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return { success: false, error: 'No active tab' };
  try {
    await chrome.tabs.update(tab.id, { active: true }).catch(() => undefined);
    const snapshot = await withDebugger(tab.id, (cdp) => snapshotManager.create(tab.id!, cdp));
    return {
      success: true,
      message: `Snapshot created for ${tab.title || tab.url}`,
      data: { snapshot, title: tab.title, url: tab.url, tabId: tab.id },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Snapshot failed' };
  }
};

export const searchElements: ToolHandler = async (args) => {
  const tab = await getActiveTab();
  if (!tab?.id) return { success: false, error: 'No active tab' };
  const query = String(args.query || '').trim();
  if (!query) return { success: false, error: 'query is required' };
  const matches = await snapshotManager.search(tab.id, query);
  return {
    success: true,
    data: { matches },
  };
};
