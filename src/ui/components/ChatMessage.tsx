import type { ChatMessage as ChatMessageType } from '../../shared/types/chat';
import { StatusIndicator } from './StatusIndicator';

type ChatMessageProps = {
  message: ChatMessageType;
};

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isThinking = message.status === 'thinking';

  return (
    <div className={`chat-bubble ${isUser ? 'user' : 'gpt'}`}>
      <div className="content">
        {isThinking ? (
          <StatusIndicator text={message.actionText || 'Thinking'} />
        ) : (
          <>
            {message.content && (
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {message.content}
              </div>
            )}
            {message.screenshot && (
              <img
                src={message.screenshot.imageData}
                alt={message.screenshot.title || 'Screenshot'}
                style={{
                  maxWidth: '100%',
                  borderRadius: 8,
                  marginTop: message.content ? 8 : 0,
                  border: '1px solid #e0e0e0',
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
