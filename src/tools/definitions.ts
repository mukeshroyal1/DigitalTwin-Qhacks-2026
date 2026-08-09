import type { ToolDefinition } from './types';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'take_snapshot',
      description:
        'Capture an accessibility snapshot of the current page with uid handles for click/fill.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_elements',
      description: 'Search the latest snapshot for elements matching a query string.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to search for in the snapshot' },
        },
        required: ['query'],
      },
    },
  },
  {
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
  {
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
  {
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
  {
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
  {
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
  {
    type: 'function',
    function: {
      name: 'get_all_tabs',
      description: 'List open tabs in the current window.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_tab',
      description: 'Get the active page tab.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
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
  {
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
  {
    type: 'function',
    function: {
      name: 'go_back',
      description: 'Go back in the current tab history.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'go_forward',
      description: 'Go forward in the current tab history.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reload_tab',
      description: 'Reload the current tab.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
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
  {
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
  {
    type: 'function',
    function: {
      name: 'capture_tab_screenshot',
      description: 'Capture a screenshot of the visible tab.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

export function listToolNames(): string[] {
  return TOOL_DEFINITIONS.map((t) => t.function.name);
}
