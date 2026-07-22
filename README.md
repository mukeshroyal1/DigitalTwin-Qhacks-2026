# DigitalTwin

Modular Chrome extension (Manifest V3) for browser automation chat.

## What changed from the old webpack app

- **Removed**: Google OAuth, Gmail/Drive/Sheets/Calendar tools, local `get_memory` / `store_memory`, hardcoded ElevenLabs keys, fake-mouse cosmetics, bookmark/history/download extras
- **Memory**: Backboard thread history only (toggle Memory in settings → `memory: Auto` vs fresh thread)
- **Frontend**: React side panel split into components (`ui/components`, `ui/hooks`, `ui/pages`)
- **Build**: Vite + `@crxjs/vite-plugin` (no webpack)

## Layout

```
src/
  entrypoints/     background, sidepanel, content
  ui/              React components + hooks
  agent/           Backboard loop + system prompt
  tools/           click, snapshot, tabs, navigate, screenshot
  drivers/cdp/     debugger + accessibility snapshot + click
  shared/          messaging types
```

## Setup

```bash
cd "DigitalTwin-main 2"
npm install
npm run build
```

Load unpacked extension from `dist/` in `chrome://extensions`.

Add your Backboard API key in the side panel settings.
