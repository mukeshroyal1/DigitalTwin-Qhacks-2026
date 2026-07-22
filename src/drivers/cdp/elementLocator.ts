import { CdpCommander } from './cdpCommander';
import { debuggerManager } from './debuggerManager';
import type { SnapshotNode } from './snapshotManager';

type Box = { x: number; y: number; width: number; height: number };

const UID_ATTR = 'data-dt-uid';

/**
 * Port of DigitalTwin-main 2 SmartLocator click/fill/hover:
 * scroll → bounding box → covered check → CDP mouse (or DOM click if covered).
 * Skips fake mouse / highlight chrome.
 */
export class ElementLocator {
  private cdp: CdpCommander;

  constructor(
    private tabId: number,
    private node: SnapshotNode
  ) {
    this.cdp = new CdpCommander(tabId);
  }

  async click(count = 1) {
    await this.prepare();
    await this.ensureUidAttr();

    const box = await this.boundingBox();
    if (!box || box.width < 1 || box.height < 1) {
      // Last resort: click via backend node without coordinates
      const ok = await this.clickViaBackendNode();
      if (!ok) {
        throw new Error(
          `Element not visible or has zero size (uid=${this.node.id} ${this.node.role} "${this.node.name}")`
        );
      }
      return;
    }

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    for (let i = 0; i < count; i++) {
      const covered = await this.isCovered(x, y);
      if (covered) {
        const ok = await this.dispatchDomClick();
        if (!ok) throw new Error('Covered element DOM click failed');
      } else {
        await this.cdp.sendCommand('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x,
          y,
        });
        await this.cdp.sendCommand('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x,
          y,
          button: 'left',
          clickCount: i + 1,
        });
        await new Promise((r) => setTimeout(r, 50));
        await this.cdp.sendCommand('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x,
          y,
          button: 'left',
          clickCount: i + 1,
        });
      }
      if (i < count - 1) await new Promise((r) => setTimeout(r, 50));
    }

    // Settle like legacy waitForEventsAfterAction
    await new Promise((r) => setTimeout(r, 200));
  }

  async hover() {
    await this.prepare();
    await this.ensureUidAttr();
    const box = await this.boundingBox();
    if (!box || box.width < 1 || box.height < 1) {
      throw new Error('Element not visible or has zero size');
    }
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.cdp.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x,
      y,
    });
  }

  async fill(value: string) {
    await this.prepare();
    if (this.node.backendDOMNodeId) {
      await this.cdp
        .sendCommand('DOM.focus', { backendNodeId: this.node.backendDOMNodeId })
        .catch(() => undefined);
    }

    // Select-all then insertText (legacy SmartLocator path without Monaco/highlight)
    await this.cdp.sendCommand('Input.dispatchKeyEvent', {
      type: 'keyDown',
      commands: ['selectAll'],
    });
    await this.cdp.sendCommand('Input.dispatchKeyEvent', {
      type: 'keyUp',
      commands: ['selectAll'],
    });
    await new Promise((r) => setTimeout(r, 30));
    await this.cdp.sendCommand('Input.insertText', { text: value });

    // Fire input/change for React-controlled fields
    if (this.node.backendDOMNodeId) {
      try {
        const resolved = await this.cdp.sendCommand<{ object?: { objectId?: string } }>(
          'DOM.resolveNode',
          { backendNodeId: this.node.backendDOMNodeId }
        );
        const objectId = resolved.object?.objectId;
        if (objectId) {
          await this.cdp.sendCommand('Runtime.callFunctionOn', {
            objectId,
            functionDeclaration: `function() {
              this.dispatchEvent(new Event('input', { bubbles: true }));
              this.dispatchEvent(new Event('change', { bubbles: true }));
            }`,
          });
        }
      } catch {
        // ignore
      }
    }
  }

  private async prepare() {
    await chrome.tabs.update(this.tabId, { active: true }).catch(() => undefined);
    const ok = await debuggerManager.attach(this.tabId);
    if (!ok) throw new Error('Failed to attach debugger');
    await this.cdp.sendCommand('DOM.enable');
    await this.cdp.sendCommand('DOM.getDocument', { depth: 0 }).catch(() => undefined);
    await this.cdp.sendCommand('Runtime.enable').catch(() => undefined);

    if (this.node.backendDOMNodeId) {
      await this.cdp
        .sendCommand('DOM.scrollIntoViewIfNeeded', {
          backendNodeId: this.node.backendDOMNodeId,
        })
        .catch(() => undefined);
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  /** Re-stamp uid if the page wiped attributes since snapshot. */
  private async ensureUidAttr() {
    if (!this.node.backendDOMNodeId) return;
    try {
      const resolved = await this.cdp.sendCommand<{ object?: { objectId?: string } }>(
        'DOM.resolveNode',
        { backendNodeId: this.node.backendDOMNodeId }
      );
      const objectId = resolved.object?.objectId;
      if (!objectId) return;
      await this.cdp.sendCommand('Runtime.callFunctionOn', {
        objectId,
        functionDeclaration: `function(uid) {
          if (this && this.setAttribute) this.setAttribute('${UID_ATTR}', uid);
        }`,
        arguments: [{ value: this.node.id }],
      });
    } catch {
      // ignore
    }
  }

  private async isCovered(x: number, y: number): Promise<boolean> {
    try {
      const evalResult = await this.cdp.sendCommand<{
        result?: { value?: { found?: boolean; isCovered?: boolean } };
      }>('Runtime.evaluate', {
        expression: `
          (function() {
            const el = document.querySelector('[${UID_ATTR}="${this.node.id}"]');
            if (!el) return { found: false, isCovered: true };
            const topEl = document.elementFromPoint(${x}, ${y});
            return {
              found: true,
              isCovered: !!(topEl && topEl !== el && !el.contains(topEl)),
            };
          })()
        `,
        returnByValue: true,
      });
      const info = evalResult.result?.value;
      if (!info?.found) return true;
      return Boolean(info.isCovered);
    } catch {
      return false;
    }
  }

  private async dispatchDomClick() {
    try {
      if (this.node.backendDOMNodeId) {
        const resolved = await this.cdp.sendCommand<{ object?: { objectId?: string } }>(
          'DOM.resolveNode',
          { backendNodeId: this.node.backendDOMNodeId }
        );
        const objectId = resolved.object?.objectId;
        if (objectId) {
          const result = await this.cdp.sendCommand<{ result?: { value?: boolean } }>(
            'Runtime.callFunctionOn',
            {
              objectId,
              functionDeclaration: `function() {
                if (!this) return false;
                this.dispatchEvent(new MouseEvent('click', {
                  bubbles: true, cancelable: true, view: window
                }));
                return true;
              }`,
              returnByValue: true,
            }
          );
          if (result.result?.value) return true;
        }
      }

      const result = await this.cdp.sendCommand<{ result?: { value?: boolean } }>(
        'Runtime.evaluate',
        {
          expression: `
            (function() {
              const el = document.querySelector('[${UID_ATTR}="${this.node.id}"]');
              if (!el) return false;
              el.dispatchEvent(new MouseEvent('click', {
                bubbles: true, cancelable: true, view: window
              }));
              return true;
            })()
          `,
          returnByValue: true,
        }
      );
      return Boolean(result.result?.value);
    } catch {
      return false;
    }
  }

  private async clickViaBackendNode() {
    if (!this.node.backendDOMNodeId) return false;
    try {
      const resolved = await this.cdp.sendCommand<{ object?: { objectId?: string } }>(
        'DOM.resolveNode',
        { backendNodeId: this.node.backendDOMNodeId }
      );
      const objectId = resolved.object?.objectId;
      if (!objectId) return false;
      const result = await this.cdp.sendCommand<{ result?: { value?: boolean } }>(
        'Runtime.callFunctionOn',
        {
          objectId,
          functionDeclaration: `function() {
            if (!this) return false;
            this.scrollIntoView({ block: 'center', inline: 'center' });
            if (typeof this.click === 'function') this.click();
            else this.dispatchEvent(new MouseEvent('click', {
              bubbles: true, cancelable: true, view: window
            }));
            return true;
          }`,
          returnByValue: true,
        }
      );
      return Boolean(result.result?.value);
    } catch {
      return false;
    }
  }

  private async boundingBox(): Promise<Box | null> {
    // Prefer stamped attribute (same as legacy data-aipex-nodeid path)
    try {
      const result = await this.cdp.sendCommand<{ result?: { value?: Box | null } }>(
        'Runtime.evaluate',
        {
          expression: `
            (function() {
              const el = document.querySelector('[${UID_ATTR}="${this.node.id}"]');
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return { x: r.left, y: r.top, width: r.width, height: r.height };
            })()
          `,
          returnByValue: true,
        }
      );
      if (result.result?.value) return result.result.value;
    } catch {
      // fall through
    }

    // Fallback via backendDOMNodeId
    if (!this.node.backendDOMNodeId) return null;
    try {
      const resolved = await this.cdp.sendCommand<{ object?: { objectId?: string } }>(
        'DOM.resolveNode',
        { backendNodeId: this.node.backendDOMNodeId }
      );
      const objectId = resolved.object?.objectId;
      if (!objectId) return null;
      const result = await this.cdp.sendCommand<{ result?: { value?: Box | null } }>(
        'Runtime.callFunctionOn',
        {
          objectId,
          functionDeclaration: `function() {
            const r = this.getBoundingClientRect();
            return { x: r.left, y: r.top, width: r.width, height: r.height };
          }`,
          returnByValue: true,
        }
      );
      return result.result?.value || null;
    } catch {
      return null;
    }
  }
}
