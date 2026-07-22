const AUTO_DETACH_MS = 60_000;

class DebuggerManager {
  private attached = new Set<number>();
  private locks = new Map<number, Promise<boolean>>();
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    chrome.debugger?.onDetach?.addListener((source) => {
      if (source.tabId != null) {
        this.attached.delete(source.tabId);
        this.clearTimer(source.tabId);
      }
    });
    chrome.tabs?.onRemoved?.addListener((tabId) => {
      this.attached.delete(tabId);
      this.clearTimer(tabId);
    });
  }

  private clearTimer(tabId: number) {
    const t = this.timers.get(tabId);
    if (t) clearTimeout(t);
    this.timers.delete(tabId);
  }

  private scheduleDetach(tabId: number) {
    this.clearTimer(tabId);
    this.timers.set(
      tabId,
      setTimeout(() => {
        void this.detach(tabId);
      }, AUTO_DETACH_MS)
    );
  }

  private async ensureNoExtensionFrame(tabId: number) {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const frames = Array.from(document.querySelectorAll('iframe'));
          let removed = false;
          for (const frame of frames) {
            if (frame.src.startsWith('chrome-extension://')) {
              frame.remove();
              removed = true;
            }
          }
          return removed;
        },
      });
      return Boolean(result[0]?.result);
    } catch {
      return false;
    }
  }

  async attach(tabId: number): Promise<boolean> {
    this.clearTimer(tabId);
    if (this.attached.has(tabId)) {
      this.scheduleDetach(tabId);
      return true;
    }

    const existing = this.locks.get(tabId);
    if (existing) return existing;

    const promise = (async () => {
      const removed = await this.ensureNoExtensionFrame(tabId);
      if (removed) await new Promise((r) => setTimeout(r, 200));

      return new Promise<boolean>((resolve) => {
        chrome.debugger.attach({ tabId }, '1.3', () => {
          const err = chrome.runtime.lastError?.message || '';
          if (err) {
            // SW restart while Chrome still holds the debugger session
            if (/already attached/i.test(err)) {
              this.attached.add(tabId);
              this.scheduleDetach(tabId);
              resolve(true);
              return;
            }
            console.error('[debugger] attach failed:', err);
            resolve(false);
            return;
          }
          this.attached.add(tabId);
          this.scheduleDetach(tabId);
          resolve(true);
        });
      });
    })().finally(() => this.locks.delete(tabId));

    this.locks.set(tabId, promise);
    return promise;
  }

  async detach(tabId: number): Promise<void> {
    this.clearTimer(tabId);
    if (!this.attached.has(tabId)) return;
    await new Promise<void>((resolve) => {
      chrome.debugger.detach({ tabId }, () => {
        this.attached.delete(tabId);
        resolve();
      });
    });
  }
}

export const debuggerManager = new DebuggerManager();
