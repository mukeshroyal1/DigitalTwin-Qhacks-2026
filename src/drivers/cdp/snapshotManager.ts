export type SnapshotNode = {
  id: string;
  role: string;
  name: string;
  value?: string;
  backendDOMNodeId?: number;
  children: SnapshotNode[];
};

type AxNode = {
  nodeId: string;
  ignored?: boolean;
  role?: { value?: string };
  name?: { value?: string };
  value?: { value?: string | number | boolean };
  description?: { value?: string };
  childIds?: string[];
  backendDOMNodeId?: number;
};

const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'combobox',
  'checkbox',
  'radio',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'tab',
  'slider',
  'spinbutton',
  'searchbox',
  'switch',
  'option',
  'listbox',
]);

function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Interesting-node rules ported from DigitalTwin-main 2 snapshot-manager. */
function isInteresting(node: AxNode): boolean {
  if (node.ignored) return false;
  const role = node.role?.value || '';
  const name = String(node.name?.value || '');
  const value = typeof node.value?.value === 'string' ? node.value.value : '';
  const description =
    typeof node.description?.value === 'string' ? node.description.value : '';

  if (role === 'RootWebArea' || role === 'WebArea') return true;
  if (INTERACTIVE_ROLES.has(role)) return true;
  if (role === 'image' || role === 'img') return true;
  if (role === 'StaticText' && name.trim().length >= 2) return true;
  if (role === 'heading' && name.trim()) return true;

  const layoutRoles = new Set([
    'generic',
    'none',
    'group',
    'main',
    'navigation',
    'contentinfo',
    'search',
    'banner',
    'complementary',
    'region',
    'article',
    'section',
  ]);
  if (layoutRoles.has(role)) {
    return [name, value, description].some((c) => c && c.trim().length > 1);
  }
  if (role && role !== 'generic') {
    return [name, value, description].some((c) => c && c.trim().length > 1);
  }
  return false;
}

function storageKey(tabId: number) {
  return `snapshot:${tabId}`;
}

export class SnapshotManager {
  private snapshots = new Map<number, Map<string, SnapshotNode>>();

  async getNode(tabId: number, uid: string) {
    let map = this.snapshots.get(tabId);
    if (!map) {
      map = await this.load(tabId);
    }
    return map?.get(uid);
  }

  private async load(tabId: number) {
    try {
      const key = storageKey(tabId);
      const raw = await chrome.storage.session.get(key);
      const entries = raw[key] as Array<[string, SnapshotNode]> | undefined;
      if (!entries?.length) return undefined;
      const map = new Map(entries);
      this.snapshots.set(tabId, map);
      return map;
    } catch {
      return undefined;
    }
  }

  private async save(tabId: number, map: Map<string, SnapshotNode>) {
    this.snapshots.set(tabId, map);
    try {
      const flat = Array.from(map.entries()).map(([id, node]) => [
        id,
        {
          id: node.id,
          role: node.role,
          name: node.name,
          value: node.value,
          backendDOMNodeId: node.backendDOMNodeId,
          children: [],
        },
      ]);
      await chrome.storage.session.set({ [storageKey(tabId)]: flat });
    } catch {
      // session storage may be unavailable
    }
  }

  async create(tabId: number, cdp: import('./cdpCommander').CdpCommander): Promise<string> {
    await cdp.sendCommand('Accessibility.enable');
    await cdp.sendCommand('DOM.enable');
    await cdp.sendCommand('DOM.getDocument', { depth: 0 }).catch(() => undefined);

    const tree = await cdp.sendCommand<{ nodes: AxNode[] }>('Accessibility.getFullAXTree');
    const nodes = tree.nodes || [];
    const byId = new Map(nodes.map((n) => [n.nodeId, n]));

    const interesting = new Set<string>();
    for (const n of nodes) {
      if (isInteresting(n)) interesting.add(n.nodeId);
    }

    const uidMap = new Map<string, SnapshotNode>();
    const build = (axId: string): SnapshotNode | null => {
      const ax = byId.get(axId);
      if (!ax) return null;
      const childNodes = (ax.childIds || [])
        .map((cid) => build(cid))
        .filter(Boolean) as SnapshotNode[];

      if (!interesting.has(axId) && childNodes.length === 0) return null;

      // Flatten single-child non-interesting wrappers (legacy serializeTree)
      if (!interesting.has(axId) && childNodes.length === 1) {
        return childNodes[0];
      }
      if (!interesting.has(axId) && childNodes.length > 1) {
        return {
          id: '',
          role: 'group',
          name: '',
          children: childNodes,
        };
      }

      const uid = shortId();
      const node: SnapshotNode = {
        id: uid,
        role: ax.role?.value || 'unknown',
        name: String(ax.name?.value || ''),
        value: ax.value?.value != null ? String(ax.value.value) : undefined,
        backendDOMNodeId: ax.backendDOMNodeId,
        children: childNodes,
      };
      uidMap.set(uid, node);
      return node;
    };

    const rootAx = nodes.find((n) => n.role?.value === 'RootWebArea') || nodes[0];
    const root = rootAx ? build(rootAx.nodeId) : null;
    await this.save(tabId, uidMap);
    await this.injectUids(cdp, uidMap);

    const interactive = this.formatInteractive(uidMap);
    const full = this.format(root);
    if (interactive) {
      return `${interactive}\n\n---\n${full.slice(0, 8000)}`;
    }
    return full.slice(0, 14000);
  }

  private async injectUids(
    cdp: import('./cdpCommander').CdpCommander,
    uidMap: Map<string, SnapshotNode>
  ) {
    await cdp.sendCommand('DOM.enable');
    await cdp.sendCommand('DOM.getDocument', { depth: 0 }).catch(() => undefined);

    const entries = Array.from(uidMap.values()).filter((n) => n.backendDOMNodeId);
    const concurrency = 40;

    for (let start = 0; start < entries.length; start += concurrency) {
      const batch = entries.slice(start, start + concurrency);
      await Promise.all(
        batch.map(async (node) => {
          if (!node.backendDOMNodeId) return;
          try {
            const resolved = await cdp.sendCommand<{ object?: { objectId?: string } }>(
              'DOM.resolveNode',
              { backendNodeId: node.backendDOMNodeId }
            );
            const objectId = resolved.object?.objectId;
            if (!objectId) return;
            await cdp.sendCommand('Runtime.callFunctionOn', {
              objectId,
              functionDeclaration: `function(uid){
                if (this && this.setAttribute) {
                  this.setAttribute('data-dt-uid', uid);
                  return true;
                }
                return false;
              }`,
              arguments: [{ value: node.id }],
              returnByValue: true,
            });
            await cdp
              .sendCommand('Runtime.releaseObject', { objectId })
              .catch(() => undefined);
          } catch {
            // node may not map to a real DOM element
          }
        })
      );
    }
  }

  private formatInteractive(uidMap: Map<string, SnapshotNode>) {
    const lines: string[] = ['Interactive elements:'];
    for (const node of uidMap.values()) {
      if (!INTERACTIVE_ROLES.has(node.role)) continue;
      if (!node.name.trim() && node.role !== 'textbox' && node.role !== 'searchbox') continue;
      lines.push(`uid=${node.id} ${node.role} "${node.name}"`);
    }
    return lines.length > 1 ? lines.slice(0, 200).join('\n') : '';
  }

  private format(node: SnapshotNode | null, depth = 0): string {
    if (!node) return '';
    const lines: string[] = [];
    if (node.id) {
      const valuePart = node.value != null ? ` value="${node.value}"` : '';
      lines.push(
        `${' '.repeat(depth)}uid=${node.id} ${node.role} "${node.name}"${valuePart}`
      );
    }
    for (const child of node.children) {
      const text = this.format(child, node.id ? depth + 1 : depth);
      if (text) lines.push(text);
    }
    return lines.join('\n');
  }

  async search(tabId: number, query: string): Promise<string> {
    let map = this.snapshots.get(tabId);
    if (!map) map = await this.load(tabId);
    if (!map) return 'No snapshot. Call take_snapshot first.';
    const q = query.toLowerCase();
    const hits: string[] = [];
    for (const node of map.values()) {
      const line = `uid=${node.id} ${node.role} "${node.name}"`;
      if (line.toLowerCase().includes(q)) hits.push(line);
    }
    return hits.length ? hits.slice(0, 50).join('\n') : `No matches for "${query}"`;
  }
}

export const snapshotManager = new SnapshotManager();
