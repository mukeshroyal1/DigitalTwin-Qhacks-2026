import { ElementLocator } from '../../drivers/cdp/elementLocator';
import { CdpCommander } from '../../drivers/cdp/cdpCommander';
import { debuggerManager } from '../../drivers/cdp/debuggerManager';
import { snapshotManager } from '../../drivers/cdp/snapshotManager';
import { getActiveTab } from '../../drivers/tabs';
import type { ToolHandler } from '../types';

async function resolveTarget(uid: string) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab');
  const node = await snapshotManager.getNode(tab.id, uid);
  if (!node) throw new Error(`Unknown uid "${uid}". Call take_snapshot again.`);
  return { tabId: tab.id, node };
}

export const clickElement: ToolHandler = async (args) => {
  try {
    const uid = String(args.uid || '').trim();
    if (!uid) return { success: false, error: 'uid is required' };
    const { tabId, node } = await resolveTarget(uid);
    await new ElementLocator(tabId, node).click(args.dblClick ? 2 : 1);
    return {
      success: true,
      message: `Clicked ${node.role} "${node.name}" (uid=${uid})`,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Click failed' };
  }
};

export const hoverElement: ToolHandler = async (args) => {
  try {
    const uid = String(args.uid || '').trim();
    if (!uid) return { success: false, error: 'uid is required' };
    const { tabId, node } = await resolveTarget(uid);
    await new ElementLocator(tabId, node).hover();
    return { success: true, message: `Hovered ${node.role} "${node.name}"` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Hover failed' };
  }
};

export const fillElement: ToolHandler = async (args) => {
  try {
    const uid = String(args.uid || '').trim();
    const value = String(args.value ?? '');
    if (!uid) return { success: false, error: 'uid is required' };
    const { tabId, node } = await resolveTarget(uid);
    await new ElementLocator(tabId, node).fill(value);
    return { success: true, message: `Filled ${uid}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Fill failed' };
  }
};

export const scrollPage: ToolHandler = async (args) => {
  const tab = await getActiveTab();
  if (!tab?.id) return { success: false, error: 'No active tab' };
  const deltaY = Number(args.deltaY ?? 600);
  const deltaX = Number(args.deltaX ?? 0);
  try {
    const ok = await debuggerManager.attach(tab.id);
    if (!ok) return { success: false, error: 'Failed to attach debugger' };
    const cdp = new CdpCommander(tab.id);
    await cdp.sendCommand('Runtime.evaluate', {
      expression: `window.scrollBy(${deltaX}, ${deltaY})`,
    });
    return { success: true, message: `Scrolled by (${deltaX}, ${deltaY})` };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Scroll failed',
    };
  }
};

export const wait: ToolHandler = async (args) => {
  const time = Math.min(Math.max(Number(args.time) || 1000, 0), 10000);
  await new Promise((r) => setTimeout(r, time));
  return { success: true, message: `Waited ${time}ms` };
};
