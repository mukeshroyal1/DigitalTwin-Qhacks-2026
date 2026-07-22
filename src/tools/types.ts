export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

export type ToolResult = {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
};

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

export type RegisteredTool = {
  definition: ToolDefinition;
  execute: ToolHandler;
};
