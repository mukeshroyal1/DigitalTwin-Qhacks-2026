import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../shared/types/chat';
import { sendToBackground } from '../../shared/messaging';
import { runAgent, type AgentEvent } from '../../agent/loop';
import type { ToolResult } from '../../tools/types';

function createId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChat(memoryEnabled: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const thinkingIdRef = useRef<string | null>(null);
  const runningRef = useRef(false);

  // Hold a Port so the service worker stays alive while tools run
  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'sidepanel' });
    return () => {
      try {
        port.disconnect();
      } catch {
        // ignore
      }
    };
  }, []);

  const applyEvent = useCallback((event: AgentEvent) => {
    const thinkingId = thinkingIdRef.current;

    if (event.kind === 'status' && thinkingId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId ? { ...m, status: 'thinking', actionText: event.text } : m
        )
      );
      return;
    }

    if (event.kind === 'tool' && thinkingId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? {
                ...m,
                status: 'thinking',
                actionText:
                  event.status === 'start'
                    ? `Running ${event.name}`
                    : event.status === 'error'
                      ? `Failed ${event.name}`
                      : `Finished ${event.name}`,
              }
            : m
        )
      );
      return;
    }

    if (event.kind === 'message' && thinkingId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? { ...m, status: 'done', content: event.text, actionText: undefined }
            : m
        )
      );
      return;
    }

    if (event.kind === 'screenshot') {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content: event.title || 'Screenshot',
          status: 'done',
          screenshot: { imageData: event.imageData, title: event.title },
          createdAt: Date.now(),
        },
      ]);
      return;
    }

    if (event.kind === 'error' && thinkingId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? { ...m, status: 'error', content: event.text, actionText: undefined }
            : m
        )
      );
      return;
    }

    if (event.kind === 'done') {
      setIsSending(false);
      thinkingIdRef.current = null;
      runningRef.current = false;
    }
  }, []);

  const sendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isSending || runningRef.current) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: text,
      status: 'done',
      createdAt: Date.now(),
    };

    const nextThinkingId = createId();
    const thinkingMessage: ChatMessage = {
      id: nextThinkingId,
      role: 'assistant',
      content: '',
      status: 'thinking',
      actionText: 'Thinking',
      createdAt: Date.now(),
    };

    setInputValue('');
    setIsSending(true);
    runningRef.current = true;
    thinkingIdRef.current = nextThinkingId;
    setMessages((prev) => [...prev, userMessage, thinkingMessage]);

    try {
      const settings = await sendToBackground<{ apiKey?: string }>({ type: 'GET_SETTINGS' });
      const apiKey = settings?.apiKey || '';
      if (!apiKey) {
        applyEvent({
          kind: 'error',
          text: 'Add your Backboard API key in settings first.',
        });
        applyEvent({ kind: 'done' });
        return;
      }

      // Agent loop lives in the side panel (legacy DigitalTwin-main 2 pattern).
      // Browser tools execute in the service worker via EXECUTE_TOOL.
      await runAgent({
        apiKey,
        text,
        memoryEnabled,
        onEvent: applyEvent,
        executeTool: async (name, args) => {
          const result = await sendToBackground<ToolResult>({
            type: 'EXECUTE_TOOL',
            name,
            args,
          });
          if (!result || typeof result !== 'object') {
            return { success: false, error: 'No response from background tool runner' };
          }
          return result;
        },
      });
    } catch (error) {
      applyEvent({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Failed to send',
      });
      applyEvent({ kind: 'done' });
    }
  }, [inputValue, isSending, memoryEnabled, applyEvent]);

  return {
    messages,
    inputValue,
    setInputValue,
    sendMessage,
    isSending,
  };
}
