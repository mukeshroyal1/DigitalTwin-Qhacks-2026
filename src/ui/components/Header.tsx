import { useEffect, useState } from 'react';
import { sendToBackground } from '../../shared/messaging';

type HeaderProps = {
  showSettings: boolean;
  memoryEnabled: boolean;
  onToggleSettings: () => void;
  onToggleMemory: () => void;
};

export function Header({
  showSettings,
  memoryEnabled,
  onToggleSettings,
  onToggleMemory,
}: HeaderProps) {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void sendToBackground<{ apiKey: string }>({ type: 'GET_SETTINGS' }).then((res) => {
      if (res?.apiKey) setApiKey(res.apiKey);
    });
  }, []);

  const saveKey = async () => {
    await sendToBackground({ type: 'SET_API_KEY', apiKey });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <header className="chat-header">
      <div className="header-left">
        <div className="brand-label">DigitalTwin</div>
      </div>
      <div className="header-right">
        <div className={`settings-content ${showSettings ? 'open' : ''}`}>
          <div className="settings-stack">
            <div className="settings-item-inline">
              <span className="settings-text">Memory</span>
              <label className="toggle-switch" style={{ cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={memoryEnabled}
                  onChange={onToggleMemory}
                  className="toggle-input"
                />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="api-key-row">
              <input
                className="api-key-input"
                type="password"
                placeholder="Backboard API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button type="button" className="api-key-save" onClick={saveKey}>
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
        </div>
        <button
          className="settings-btn"
          onClick={onToggleSettings}
          title={showSettings ? 'Close settings' : 'Settings'}
          type="button"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {showSettings ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
              </>
            )}
          </svg>
        </button>
      </div>
    </header>
  );
}
