import { ElementLocator } from '../../drivers/cdp/elementLocator';
import { CdpCommander } from '../../drivers/cdp/cdpCommander';
import { debuggerManager } from '../../drivers/cdp/debuggerManager';
import { snapshotManager } from '../../drivers/cdp/snapshotManager';
import { getActiveTab } from '../../drivers/tabs';
import type { RegisteredTool } from '../types';

async function resolveTarget(uid: string) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab');
  const node = await snapshotManager.getNode(tab.id, uid);
  if (!node) throw new Error(`Unknown uid "${uid}". Call take_snapshot again.`);
  return { tabId: tab.id, node };
}

export const clickElementTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'click_element',
      description:
        'Click an element by uid from the latest snapshot (CDP mouse click; DOM fallback if covered). Prefer button/link names matching the user request (e.g. Buy).',
      parameters: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Element uid from take_snapshot' },
          dblClick: {
            type: 'boolean',
            description: 'If true, double-click the element',
          },
        },
        required: ['uid'],
      },
    },
  },
  execute: async (args) => {
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
  },
};

export const hoverElementTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'hover_element',
      description: 'Hover over an element by uid from the latest snapshot.',
      parameters: {
        type: 'object',
        properties: {
          uid: { type: 'string' },
        },
        required: ['uid'],
      },
    },
  },
  execute: async (args) => {
    try {
      const uid = String(args.uid || '').trim();
      if (!uid) return { success: false, error: 'uid is required' };
      const { tabId, node } = await resolveTarget(uid);
      await new ElementLocator(tabId, node).hover();
      return { success: true, message: `Hovered ${node.role} "${node.name}"` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Hover failed' };
    }
  },
};

export const fillElementTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'fill_element',
      description: 'Fill a text input/textarea by uid from the latest snapshot.',
      parameters: {
        type: 'object',
        properties: {
          uid: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['uid', 'value'],
      },
    },
  },
  execute: async (args) => {
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
  },
};

export const scrollPageTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'scroll_page',
      description: 'Scroll the current page by a pixel amount (positive = down).',
      parameters: {
        type: 'object',
        properties: {
          deltaY: {
            type: 'number',
            description: 'Vertical scroll delta in pixels (default 600)',
          },
          deltaX: {
            type: 'number',
            description: 'Horizontal scroll delta in pixels (default 0)',
          },
        },
      },
    },
  },
  execute: async (args) => {
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
  },
};

export const waitTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'wait',
      description: 'Wait for a number of milliseconds before continuing.',
      parameters: {
        type: 'object',
        properties: {
          time: { type: 'number', description: 'Milliseconds to wait (default 1000)' },
        },
      },
    },
  },
  execute: async (args) => {
    const time = Math.min(Math.max(Number(args.time) || 1000, 0), 10000);
    await new Promise((r) => setTimeout(r, time));
    return { success: true, message: `Waited ${time}ms` };
  },
};
