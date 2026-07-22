import * as Backboard from './providers/backboard';
import { ASSISTANT_NAME } from './providers/backboard';
import { SYSTEM_PROMPT } from './prompts/system';
import { getToolDefinitions } from '../tools/registry';
import type { ToolResult } from '../tools/types';

export type AgentEvent =
  | { kind: 'status'; text: string }
  | { kind: 'tool'; name: string; status: 'start' | 'done' | 'error' }
  | { kind: 'message'; text: string }
  | { kind: 'screenshot'; imageData: string; title?: string }
  | { kind: 'error'; text: string }
  | { kind: 'done' };

export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>
) => Promise<ToolResult>;

type RunOptions = {
  apiKey: string;
  text: string;
  memoryEnabled: boolean;
  onEvent: (event: AgentEvent) => void;
  executeTool: ToolExecutor;
};

type BackboardResponse = {
  status?: string;
  content?: string;
  run_id?: string;
  tool_calls?: Array<Record<string, unknown>>;
  required_action?: {
    submit_tool_outputs?: {
      tool_calls?: Array<Record<string, unknown>>;
    };
  };
  messages?: Array<{ content?: string }>;
  choices?: Array<{ message?: { content?: string } }>;
};

const MAX_ITERS = 16;

function parseArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

function normalizeStatus(status?: string) {
  return String(status || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Only return tool calls when Backboard is actually waiting for outputs.
 * Avoid re-running echoed tool_calls on COMPLETED responses (causes 404 submit).
 */
function getPendingToolCalls(resp: BackboardResponse): Array<Record<string, unknown>> {
  const status = normalizeStatus(resp.status);
  const fromAction = Array.isArray(resp.required_action?.submit_tool_outputs?.tool_calls)
    ? resp.required_action!.submit_tool_outputs!.tool_calls!
    : [];
  const fromTop = Array.isArray(resp.tool_calls) ? resp.tool_calls : [];
  const calls = fromAction.length ? fromAction : fromTop;

  if (!calls.length) return [];

  const terminal = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED']);
  if (terminal.has(status)) return [];

  // Explicit pending
  if (status === 'REQUIRES_ACTION' || fromAction.length > 0) return calls;

  // Legacy: tool_calls + run_id
  if (resp.run_id) return calls;

  // Ambiguous empty status: only act if there is no final assistant text yet
  if (!status && !getContent(resp)) return calls;

  return [];
}

function getContent(resp: BackboardResponse) {
  if (typeof resp.content === 'string' && resp.content.trim()) return resp.content;
  const choice = resp.choices?.[0]?.message?.content;
  if (typeof choice === 'string' && choice.trim()) return choice;
  const messages = resp.messages || [];
  const last = messages[messages.length - 1]?.content;
  return typeof last === 'string' ? last : '';
}

function newestThread(threads: Backboard.BackboardThread[]) {
  if (!threads.length) return null;
  return [...threads].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  })[0];
}

async function ensureAssistant(apiKey: string) {
  const tools = getToolDefinitions();
  const assistants = await Backboard.listAssistants(apiKey);
  const existing = assistants.find((a) => a.name === ASSISTANT_NAME);

  if (existing?.assistant_id) {
    await Backboard.updateAssistant(apiKey, existing.assistant_id, {
      system_prompt: SYSTEM_PROMPT,
      tools,
    });
    return existing.assistant_id;
  }

  const created = await Backboard.createAssistant(apiKey, {
    name: ASSISTANT_NAME,
    system_prompt: SYSTEM_PROMPT,
    tools,
  });
  return created.assistantId;
}

async function getThreadId(apiKey: string, assistantId: string, memoryEnabled: boolean) {
  if (!memoryEnabled) {
    const thread = await Backboard.createThread(apiKey, assistantId);
    return thread.threadId;
  }

  const threads = await Backboard.listThreads(apiKey, assistantId);
  const latest = newestThread(threads);
  if (latest?.thread_id) return latest.thread_id;

  const created = await Backboard.createThread(apiKey, assistantId);
  return created.threadId;
}

export async function runAgent({
  apiKey,
  text,
  memoryEnabled,
  onEvent,
  executeTool,
}: RunOptions) {
  onEvent({ kind: 'status', text: 'Thinking' });

  const assistantId = await ensureAssistant(apiKey);
  const threadId = await getThreadId(apiKey, assistantId, memoryEnabled);

  let resp = (await Backboard.addMessage(apiKey, threadId, {
    content: text,
    memory: memoryEnabled ? 'Auto' : 'off',
    llm_provider: 'openai',
    model_name: 'gpt-4o-mini',
  })) as BackboardResponse;

  const lastErrors: string[] = [];
  const seenCallIds = new Set<string>();

  for (let i = 0; i < MAX_ITERS; i++) {
    const toolCalls = getPendingToolCalls(resp).filter((call) => {
      const id = String(call.id || call.tool_call_id || '');
      if (!id) return true;
      if (seenCallIds.has(id)) return false;
      return true;
    });
    const content = getContent(resp);

    // Only finish when there are no pending tool calls
    if (!toolCalls.length) {
      onEvent({
        kind: 'message',
        text: content || 'Done.',
      });
      onEvent({ kind: 'done' });
      return;
    }

    onEvent({
      kind: 'status',
      text: `In Action (${toolCalls.length} tool${toolCalls.length === 1 ? '' : 's'})`,
    });

    const outputs: Array<{ tool_call_id: string; output: string }> = [];

    for (let idx = 0; idx < toolCalls.length; idx++) {
      const call = toolCalls[idx];
      const fn = call.function as { name?: string; arguments?: unknown } | undefined;
      const name = String(fn?.name || call.name || '');
      const args = parseArgs(fn?.arguments ?? call.arguments);
      const callId = String(call.id || call.tool_call_id || '');

      if (!name || !callId) {
        outputs.push({
          tool_call_id: callId || `invalid-${idx}`,
          output: JSON.stringify({
            success: false,
            error: !name ? 'Tool call missing name' : 'Tool call missing id',
          }),
        });
        continue;
      }

      seenCallIds.add(callId);
      onEvent({ kind: 'tool', name, status: 'start' });
      let result: ToolResult;
      try {
        result = await executeTool(name, args);
      } catch (error) {
        result = {
          success: false,
          error: error instanceof Error ? error.message : 'Tool threw',
        };
      }
      onEvent({
        kind: 'tool',
        name,
        status: result.success ? 'done' : 'error',
      });

      if (!result.success) {
        lastErrors.push(`${name}: ${result.error || result.message || 'failed'}`);
        if (lastErrors.length > 6) lastErrors.shift();
      }

      if (name === 'capture_tab_screenshot' && result.success) {
        const imageData = (result.data as { imageData?: string } | undefined)?.imageData;
        if (imageData) {
          onEvent({
            kind: 'screenshot',
            imageData,
            title: (result.data as { title?: string })?.title,
          });
        }
      }

      const safe =
        name === 'capture_tab_screenshot' && result.success
          ? {
              success: true,
              message: result.message,
              data: {
                title: (result.data as { title?: string })?.title,
                url: (result.data as { url?: string })?.url,
              },
            }
          : result;

      outputs.push({
        tool_call_id: callId,
        output: JSON.stringify(safe),
      });
    }

    if (!outputs.length) {
      onEvent({ kind: 'error', text: 'Tool calls produced no outputs' });
      onEvent({ kind: 'done' });
      return;
    }

    try {
      resp = (await Backboard.submitToolOutputs(
        apiKey,
        threadId,
        outputs
      )) as BackboardResponse;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Tool submit failed';
      // If the server already closed the run, finish with whatever we have
      if (/no pending tool calls|nothing to submit|404/i.test(msg)) {
        const toolSummary = outputs
          .map((o) => {
            try {
              const parsed = JSON.parse(o.output) as ToolResult;
              return parsed.success
                ? parsed.message || 'ok'
                : parsed.error || 'failed';
            } catch {
              return 'done';
            }
          })
          .join('; ');
        onEvent({
          kind: 'message',
          text:
            content ||
            `Finished local actions (${toolSummary}). The model run had already closed — try your request again if the page did not update.`,
        });
        onEvent({ kind: 'done' });
        return;
      }
      onEvent({ kind: 'error', text: `Tool submit failed: ${msg}` });
      onEvent({ kind: 'done' });
      return;
    }
  }

  const hint = lastErrors.length ? ` Last errors: ${lastErrors.join('; ')}` : '';
  onEvent({
    kind: 'error',
    text: `Stopped after too many tool steps.${hint}`,
  });
  onEvent({ kind: 'done' });
}
