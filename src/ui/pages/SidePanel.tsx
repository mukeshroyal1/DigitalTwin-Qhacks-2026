import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { MessageList } from '../components/MessageList';
import { ChatInput } from '../components/ChatInput';
import { useChat } from '../hooks/useChat';
import { sendToBackground } from '../../shared/messaging';

export function SidePanel() {
  const [showSettings, setShowSettings] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const { messages, inputValue, setInputValue, sendMessage, isSending } =
    useChat(memoryEnabled);

  useEffect(() => {
    void sendToBackground<{ apiKey: string; memoryEnabled: boolean }>({
      type: 'GET_SETTINGS',
    }).then((res) => {
      if (typeof res?.memoryEnabled === 'boolean') {
        setMemoryEnabled(res.memoryEnabled);
      }
      setReady(true);
    });
  }, []);

  const toggleMemory = () => {
    const next = !memoryEnabled;
    setMemoryEnabled(next);
    void sendToBackground({ type: 'SET_MEMORY_ENABLED', enabled: next });
  };

  if (!ready) {
    return (
      <div className="wrap">
        <div id="logged-in-view" />
      </div>
    );
  }

  return (
    <div className="wrap">
      <div id="logged-in-view">
        <Header
          showSettings={showSettings}
          memoryEnabled={memoryEnabled}
          onToggleSettings={() => setShowSettings((v) => !v)}
          onToggleMemory={toggleMemory}
        />
        <MessageList messages={messages} />
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={sendMessage}
          disabled={isSending}
        />
      </div>
    </div>
  );
}
