import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../shared/types/chat';
import type { AgentEvent } from '../../shared/types/agent';
import { sendToBackground, type PortMessage } from '../../shared/messaging';
import { useSettings } from '../context/SettingsContext';

function createId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChat() {
  const { apiKey, memoryEnabled } = useSettings();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const thinkingIdRef = useRef<string | null>(null);
  const runningRef = useRef(false);
  const runIdRef = useRef<string | null>(null);
  const portRef = useRef<chrome.runtime.Port | null>(null);

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
      runIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'sidepanel' });
    portRef.current = port;

    const onMessage = (message: PortMessage) => {
      if (message.type !== 'AGENT_EVENT') return;
      if (runIdRef.current && message.runId !== runIdRef.current) return;
      applyEvent(message.event);
    };

    port.onMessage.addListener(onMessage);
    return () => {
      port.onMessage.removeListener(onMessage);
      portRef.current = null;
      try {
        port.disconnect();
      } catch {
        // ignore
      }
    };
  }, [applyEvent]);

  const cancelMessage = useCallback(async () => {
    const runId = runIdRef.current;
    if (!runId) return;
    try {
      await sendToBackground({ type: 'ABORT_AGENT', runId });
    } catch {
      // ignore — UI will still wait for done/cancel events if any
    }
  }, []);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim();
    if (!text || isSending || runningRef.current) return;

    if (!apiKey.trim()) {
      const nextThinkingId = createId();
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'user',
          content: text,
          status: 'done',
          createdAt: Date.now(),
        },
        {
          id: nextThinkingId,
          role: 'assistant',
          content: 'Add your Backboard API key in settings first.',
          status: 'error',
          createdAt: Date.now(),
        },
      ]);
      setInputValue('');
      return;
    }

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

    const runId = createId();
    setInputValue('');
    setIsSending(true);
    runningRef.current = true;
    thinkingIdRef.current = nextThinkingId;
    runIdRef.current = runId;
    setMessages((prev) => [...prev, userMessage, thinkingMessage]);

    try {
      const res = await sendToBackground({
        type: 'RUN_AGENT',
        runId,
        text,
        memoryEnabled,
      });

      if (!res.ok) {
        applyEvent({ kind: 'error', text: res.error });
        applyEvent({ kind: 'done' });
      }
    } catch (error) {
      applyEvent({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Failed to send',
      });
      applyEvent({ kind: 'done' });
    }
  }, [inputValue, isSending, apiKey, memoryEnabled, applyEvent]);

  return {
    messages,
    inputValue,
    setInputValue,
    sendMessage,
    cancelMessage,
    isSending,
  };
}
