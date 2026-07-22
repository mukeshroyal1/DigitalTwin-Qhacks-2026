import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'DigitalTwin',
  version: '0.3.1',
  description: 'Modular browser automation chat assistant with Backboard memory',
  permissions: [
    'sidePanel',
    'storage',
    'tabs',
    'activeTab',
    'debugger',
    'scripting',
  ],
  host_permissions: ['<all_urls>'],
  action: {
    default_title: 'Open DigitalTwin',
  },
  side_panel: {
    default_path: 'src/entrypoints/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/entrypoints/background/index.ts',
    type: 'module',
  },
  icons: {
    '16': 'Logo.png',
    '48': 'Logo.png',
    '128': 'Logo.png',
  },
});
