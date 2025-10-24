# Tabby - Every tab, exactly where it should be

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

## Getting Started

### Prerequisites

- Node.js + pnpm
- Chrome/Chromium browser

### Installation & Development

```bash
# Install dependencies
pnpm install

# Build the extension
pnpm build

# Start the development server
pnpm dev
```

Load the extension in Chrome:

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `.output/` folder

[![Built with Devbox](https://www.jetify.com/img/devbox/shield_galaxy.svg)](https://www.jetify.com/devbox/docs/)
