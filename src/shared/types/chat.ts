export type MessageRole = 'user' | 'assistant';

export type MessageStatus = 'done' | 'thinking' | 'error';

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  status?: MessageStatus;
  actionText?: string;
  screenshot?: { imageData: string; title?: string };
  createdAt: number;
};
