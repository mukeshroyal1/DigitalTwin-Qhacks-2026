const DEFAULT_BASE = 'https://app.backboard.io/api';

export const ASSISTANT_NAME = 'DigitalTwin';

async function request(apiKey: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${DEFAULT_BASE}${path}`, {
    method,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'digitaltwin/0.2',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
    } catch {
      // keep statusText
    }
    throw new Error(`Backboard ${res.status}: ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export type BackboardAssistant = {
  assistant_id: string;
  name: string;
  created_at?: string;
};

export type BackboardThread = {
  thread_id: string;
  assistant_id?: string;
  created_at?: string;
};

export async function listAssistants(apiKey: string): Promise<BackboardAssistant[]> {
  const res = await request(apiKey, 'GET', '/assistants?skip=0&limit=100');
  return Array.isArray(res) ? res : [];
}

export async function createAssistant(
  apiKey: string,
  opts: { name: string; system_prompt: string; tools: unknown[] }
) {
  const res = await request(apiKey, 'POST', '/assistants', {
    name: opts.name,
    system_prompt: opts.system_prompt,
    tools: opts.tools,
  });
  return { assistantId: res.assistant_id as string };
}

export async function updateAssistant(
  apiKey: string,
  assistantId: string,
  opts: { system_prompt: string; tools: unknown[] }
) {
  await request(apiKey, 'PUT', `/assistants/${assistantId}`, {
    system_prompt: opts.system_prompt,
    tools: opts.tools,
  });
}

export async function listThreads(apiKey: string, assistantId: string): Promise<BackboardThread[]> {
  const res = await request(
    apiKey,
    'GET',
    `/assistants/${assistantId}/threads?skip=0&limit=100`
  );
  return Array.isArray(res) ? res : [];
}

export async function createThread(apiKey: string, assistantId: string) {
  const res = await request(apiKey, 'POST', `/assistants/${assistantId}/threads`, {});
  return { threadId: res.thread_id as string };
}

export async function addMessage(
  apiKey: string,
  threadId: string,
  opts: {
    content: string;
    memory?: 'Auto' | 'Readonly' | 'off' | 'On';
    llm_provider?: string;
    model_name?: string;
  }
) {
  const form = new FormData();
  form.append('content', opts.content);
  form.append('stream', 'false');
  form.append('memory', opts.memory || 'off');
  if (opts.llm_provider) form.append('llm_provider', opts.llm_provider);
  if (opts.model_name) form.append('model_name', opts.model_name);

  const res = await fetch(`${DEFAULT_BASE}/threads/${threadId}/messages`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'User-Agent': 'digitaltwin/0.2' },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backboard message failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function submitToolOutputs(
  apiKey: string,
  threadId: string,
  outputs: Array<{ tool_call_id: string; output: string }>
) {
  return request(apiKey, 'POST', '/threads/tool-outputs', {
    thread_id: threadId,
    tool_outputs: outputs.map((o) => ({
      tool_call_id: o.tool_call_id,
      output: o.output,
    })),
    stream: false,
  });
}
