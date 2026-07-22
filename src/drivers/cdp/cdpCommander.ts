const DEFAULT_TIMEOUT = 10_000;

export class CdpCommander {
  constructor(private tabId: number) {}

  sendCommand<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    timeout = DEFAULT_TIMEOUT
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`CDP ${method} timed out`));
      }, timeout);

      chrome.debugger.sendCommand({ tabId: this.tabId }, method, params, (result) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result as T);
      });
    });
  }
}
