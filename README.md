# Tabby: Every tab, exactly where it should be

Meet Tabby, AI that knows what to keep, what to close, and what deserves your
focus.

A smarter way to browse, with an intelligent workspace manager that transforms
messy tabs into structured, project-based workflows. Tabby lets you group,
clean, and manage browser tabs within contextual workspaces. Leverage on-device
AI to intelligently sort, tag, and organize your tabs and resources.

## Features

- **Workspaces** — Create isolated tab contexts; switch between them seamlessly
- **Tab Groups** — Automatically group and organize tabs within a workspace
- **Resources** — Save bookmark-like collections tied to workspaces
- **AI Workflows** — On-device sorting, grouping, and tab cleanup
- **One-Click Sync** — All changes persist across browser sessions

## Tech Stack

- **Extension Framework**: WXT
- **UI**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Database**: IndexedDB with Dexie.js
- **AI**: Chrome Built-in APIs
- **Package Manager**: pnpm

## Requirements

- Node.js (LTS recommended) and pnpm
- Chrome or Chromium-based browser

## Quickstart

1. Install dependencies

```bash
pnpm install
```

2. Build or run in dev

```bash
pnpm build
pnpm dev
```

3. Load the extension in Chrome

- Open chrome://extensions/
- Enable Developer mode
- Click “Load unpacked”
- Select the output directory inside .output/

You’re in! Tabby will start with an “Undefined” workspace that previews your
currently open tabs.

## First Run Tips

- Bootstrap from Undefined
  - Open the “Undefined” workspace
  - Click the three-dot menu
  - Create a new workspace “from Undefined” to snapshot your current tabs

- Command Menu
  - Press Control + Space (Windows/Linux/macOS) to open the command menu
  - Ask Tabby to clean up, group, tag, or rename tabs

- Configure Tabby Engine
  - Go to Settings → Preferences → Tabby Engine
  - Engine options:
    - Cloud: Best for very large workspaces and many windows
    - Local: Fast, private, and ideal for light cleanup, renaming, and
      small/medium groups

- Troubleshooting:
  - If cloud dev endpoints error in your environment, switch to Local
  - Or create your own Firebase project and point Tabby to it for full control

## Recommendations

- Use Cloud when:
  - You have hundreds of tabs, multiple windows, or large workspaces
- Use Local when:
  - You want maximum privacy, minimal latency, or are doing light
    grouping/cleanup

## Development

```bash
# Install dependencies
pnpm install

# Build for Chrome
pnpm build

# Start dev server
pnpm dev
```

## Acknowledgements

Built with WXT, Dexie.js, shadcn/ui, and Firebase sdk.
