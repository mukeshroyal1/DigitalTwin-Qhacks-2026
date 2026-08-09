import { useState } from 'react';
import { Header } from '../components/Header';
import { MessageList } from '../components/MessageList';
import { ChatInput } from '../components/ChatInput';
import { useChat } from '../hooks/useChat';
import { useSettings } from '../context/SettingsContext';

export function SidePanel() {
  const [showSettings, setShowSettings] = useState(false);
  const { ready, loadError, memoryEnabled, setMemoryEnabled, reload } = useSettings();
  const { messages, inputValue, setInputValue, sendMessage, cancelMessage, isSending } =
    useChat();

  if (!ready) {
    return (
      <div className="wrap">
        <div className="panel-shell panel-loading">Loading…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="wrap">
        <div className="panel-shell panel-error">
          <p>{loadError}</p>
          <button type="button" className="api-key-save" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="panel-shell">
        <Header
          showSettings={showSettings}
          memoryEnabled={memoryEnabled}
          onToggleSettings={() => setShowSettings((v) => !v)}
          onToggleMemory={() => {
            void setMemoryEnabled(!memoryEnabled);
          }}
        />
        <MessageList messages={messages} />
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={sendMessage}
          onCancel={cancelMessage}
          disabled={isSending}
          isSending={isSending}
        />
      </div>
    </div>
  );
}
