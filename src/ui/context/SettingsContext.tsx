import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { sendToBackground } from '../../shared/messaging';

type SettingsContextValue = {
  ready: boolean;
  loadError: string | null;
  apiKey: string;
  memoryEnabled: boolean;
  setApiKey: (apiKey: string) => Promise<{ ok: boolean; error?: string }>;
  setMemoryEnabled: (enabled: boolean) => Promise<{ ok: boolean; error?: string }>;
  reload: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiKey, setApiKeyState] = useState('');
  const [memoryEnabled, setMemoryEnabledState] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await sendToBackground({ type: 'GET_SETTINGS' });
      if (!res.ok) {
        setLoadError(res.error || 'Failed to load settings');
        setReady(true);
        return;
      }
      setApiKeyState(res.apiKey);
      setMemoryEnabledState(res.memoryEnabled);
      setLoadError(null);
      setReady(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load settings');
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setApiKey = useCallback(async (next: string) => {
    try {
      const res = await sendToBackground({ type: 'SET_API_KEY', apiKey: next });
      if (!res.ok) return { ok: false, error: res.error };
      setApiKeyState(next.trim());
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to save API key',
      };
    }
  }, []);

  const setMemoryEnabled = useCallback(async (enabled: boolean) => {
    const previous = memoryEnabled;
    setMemoryEnabledState(enabled);
    try {
      const res = await sendToBackground({ type: 'SET_MEMORY_ENABLED', enabled });
      if (!res.ok) {
        setMemoryEnabledState(previous);
        return { ok: false, error: res.error };
      }
      return { ok: true };
    } catch (error) {
      setMemoryEnabledState(previous);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to update memory setting',
      };
    }
  }, [memoryEnabled]);

  const value = useMemo(
    () => ({
      ready,
      loadError,
      apiKey,
      memoryEnabled,
      setApiKey,
      setMemoryEnabled,
      reload,
    }),
    [ready, loadError, apiKey, memoryEnabled, setApiKey, setMemoryEnabled, reload]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
