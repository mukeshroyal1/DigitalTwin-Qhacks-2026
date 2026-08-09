import { takeSnapshot, searchElements } from './browser/takeSnapshot';
import {
  clickElement,
  fillElement,
  hoverElement,
  scrollPage,
  wait,
} from './browser/actions';
import {
  getAllTabs,
  getCurrentTab,
  createNewTab,
  navigateToUrl,
  goBack,
  goForward,
  reloadTab,
  switchToTab,
  closeTab,
} from './tabs/tabTools';
import { captureScreenshot } from './screenshot/captureTab';
import { listToolNames } from './definitions';
import type { ToolHandler, ToolResult } from './types';

const handlers: Record<string, ToolHandler> = {
  take_snapshot: takeSnapshot,
  search_elements: searchElements,
  click_element: clickElement,
  hover_element: hoverElement,
  fill_element: fillElement,
  scroll_page: scrollPage,
  wait,
  get_all_tabs: getAllTabs,
  get_current_tab: getCurrentTab,
  create_new_tab: createNewTab,
  navigate_to_url: navigateToUrl,
  go_back: goBack,
  go_forward: goForward,
  reload_tab: reloadTab,
  switch_to_tab: switchToTab,
  close_tab: closeTab,
  capture_tab_screenshot: captureScreenshot,
};

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const handler = handlers[name];
  if (!handler) {
    return {
      success: false,
      error: `Unknown tool "${name}". Available tools: ${listToolNames().join(', ')}.`,
    };
  }

  return handler(args || {});
}
