# DigitalTwin

**QHacks 2026**

https://github.com/mukeshroyal1/DigitalTwin-Qhacks-2026

## Description

DigitalTwin is a Chrome extension that turns your browser into an AI-operated workspace. You describe what you want in plain language — “open this product page and click Buy,” “fill this form,” “go back and try another tab” — and the agent plans and executes those actions on the live page.

Instead of brittle CSS selectors, DigitalTwin reads the page through Chrome’s accessibility tree (via the Chrome DevTools Protocol), assigns stable element UIDs, then clicks, types, scrolls, and navigates like a careful user. Conversation memory is handled by Backboard so the agent can keep context across a session when Memory is enabled.

Built for QHacks 2026 as a focused browser automation agent: chat in a side panel, tools in a service worker, and an LLM loop that keeps going until the task is done or blocked.

## Tech Stack

### Programming Languages

- TypeScript
- HTML
- CSS

### Libraries And Frameworks

- React 18
- Vite
- `@crxjs/vite-plugin` (Chrome Manifest V3)
- Chrome Extension APIs (`sidePanel`, `tabs`, `debugger`, `storage`, `scripting`)
- Chrome DevTools Protocol (CDP) for snapshots and input
- Backboard API (assistants, threads, tool calling)
- OpenAI `gpt-4o-mini` (via Backboard)

## Functions

### Agent Loop

The side panel runs the agentic loop: send the user message to Backboard, detect pending tool calls, execute each tool locally, submit results, and repeat (up to 16 steps) until the model finishes or the goal is blocked.

### Accessibility Snapshot

`take_snapshot` builds a structured view of the page from `Accessibility.getFullAXTree`, stamps interactive nodes with UIDs, and returns a compact list the model can search and click.

### Element Interaction

`click_element`, `hover_element`, and `fill_element` resolve a UID to a DOM node, scroll it into view, and interact with CDP mouse events (with a DOM click fallback when the target is covered). Forms follow click-then-fill so fields are focused before typing.

### Navigation And Tabs

`navigate_to_url`, `create_new_tab`, `go_back`, `go_forward`, `reload_tab`, `switch_to_tab`, `close_tab`, plus tab listing helpers so the agent can move across the browser, not only within one page.

### Memory

When Memory is on, DigitalTwin reuses the latest Backboard thread with `memory: Auto` so conversation history and preferences can carry across messages. When Memory is off, each request starts a fresh thread.

## Architecture

```
Side panel (React)              Background service worker         Backboard
─────────────────              ─────────────────────────         ────────
Chat UI + agent loop    ──►    EXECUTE_TOOL (CDP / tabs)   ◄──►  Assistant + threads
Status / screenshots           Snapshot, click, navigate         Tool outputs
```

```
src/
  entrypoints/     background service worker, React side panel
  ui/              chat components, hooks, settings
  agent/           Backboard loop + system prompt
  tools/           snapshot, click, fill, tabs, navigate, screenshot
  drivers/cdp/     debugger attach, AX snapshot, element locator
  shared/          messaging types
```

## Demo Flow

1. Open the DigitalTwin side panel and save your Backboard API key.
2. Optional: turn **Memory** on to keep conversation history.
3. Ask something like: “Go to apple.com, open MacBook Air, and click Buy.”
4. Watch the agent snapshot the page, search for the control, click, and continue until the goal is finished.
5. Read the past-tense summary of what it did.

## Installation

1. Fork the project
2. Clone the project
3. Navigate to the project directory

```bash
cd "DigitalTwin - Qhacks 2026"
```

4. Install the dependencies

```bash
npm install
```

5. Build the extension

```bash
npm run build
```

6. Open Chrome and go to `chrome://extensions`
7. Enable **Developer mode**
8. Click **Load unpacked** and select the `dist/` folder
9. Open the DigitalTwin side panel → Settings → paste your **Backboard API key** → Save

### Development

```bash
npm run dev
```

Then reload the unpacked extension after changes as needed.

## Team / Event

Built for **QHacks 2026**.
