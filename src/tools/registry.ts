import { takeSnapshotTool, searchElementsTool } from './browser/takeSnapshot';
import {
  clickElementTool,
  fillElementTool,
  hoverElementTool,
  scrollPageTool,
  waitTool,
} from './browser/actions';
import {
  getAllTabsTool,
  getCurrentTabTool,
  createNewTabTool,
  navigateToUrlTool,
  goBackTool,
  goForwardTool,
  reloadTabTool,
  switchToTabTool,
  closeTabTool,
} from './tabs/tabTools';
import { captureScreenshotTool } from './screenshot/captureTab';
import type { RegisteredTool, ToolResult } from './types';

const tools: RegisteredTool[] = [
  takeSnapshotTool,
  searchElementsTool,
  clickElementTool,
  hoverElementTool,
  fillElementTool,
  scrollPageTool,
  waitTool,
  getAllTabsTool,
  getCurrentTabTool,
  createNewTabTool,
  navigateToUrlTool,
  goBackTool,
  goForwardTool,
  reloadTabTool,
  switchToTabTool,
  closeTabTool,
  captureScreenshotTool,
];

const byName = new Map(tools.map((t) => [t.definition.function.name, t]));

export function getToolDefinitions() {
  return tools.map((t) => t.definition);
}

export function listToolNames() {
  return tools.map((t) => t.definition.function.name);
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const tool = byName.get(name);
  if (!tool) {
    return {
      success: false,
      error: `Unknown tool "${name}". Available tools: ${listToolNames().join(', ')}.`,
    };
  }

  return tool.execute(args || {});
}
