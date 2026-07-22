import { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageType } from '../../shared/types/chat';
import { ChatMessage } from './ChatMessage';
import { EmptyState } from './EmptyState';

type MessageListProps = {
  messages: ChatMessageType[];
};

export function MessageList({ messages }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const hasMessages = messages.length > 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={`messages ${hasMessages ? 'has-messages' : ''}`} id="msgs">
      {!hasMessages && <EmptyState />}
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
