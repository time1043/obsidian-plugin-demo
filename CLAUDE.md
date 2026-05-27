# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An Obsidian plugin ("Video Loop", ID: `video-loop`) for English learning — loop video segments with synchronized subtitles for shadowing practice. Desktop-only, uses Node.js `fs` via Electron.

## Repository Structure

- `obsidian-sample-plugin/` — the plugin project (source, build config, dependencies)
- `vault-demo/` — test Obsidian vault with demo files and subtitle samples
- `docs/` — development environment notes

The plugin source lives entirely in `obsidian-sample-plugin/src/`.

## Build & Dev Commands

All commands run from `obsidian-sample-plugin/` directory. **Use `pnpm` as package manager.**

```bash
pnpm install          # Install dependencies
pnpm run dev          # Watch mode (esbuild, auto-recompiles on change)
pnpm run build        # Type-check + production bundle
pnpm run lint         # ESLint with obsidianmd rules
```

## Development Testing

The vault at `vault-demo/` is pre-configured with `community-plugins.json` listing `"video-loop"`. The plugin is linked into the vault via NTFS junction:

```cmd
mklink /J vault-demo\.obsidian\plugins\video-loop obsidian-sample-plugin
```

After building, reload Obsidian (toggle plugin off/on in Settings → Community plugins). Open `vault-demo/demo.md` and run "Open Video Loop from current file" command.

## Architecture

```
src/
  main.ts              — Plugin lifecycle, commands, view registration, sync wiring
  VideoPlayerView.ts   — ItemView: <video> element, blob URL from fs.readFileSync, AB loop enforcement
  SubtitleView.ts      — ItemView: subtitle list, AB controls, speed controls, keyboard shortcuts
  types.ts             — Subtitle, ABLoopState interfaces
  settings.ts          — VideoLoopSettings (autoPlay toggle)
  global.d.ts          — Augments Window with require() for Electron fs access
  parsers/
    index.ts           — parseSubtitle() dispatcher + UTF-8/16 encoding detection
    AssParser.ts       — ASS/SSA format parser
    SrtParser.ts       — SRT format parser
```

### Data Flow

1. User opens a `.md` file with frontmatter `video` (absolute path) and `subtitle` (vault-relative .ass/.srt path)
2. `openVideoLoopFromActiveFile()` reads subtitle via `vault.readBinary()`, parses via `parsers/index.ts`
3. `openSplitLayout()` creates split view: subtitle left (20%), video right (80%)
4. `setupSync()` wires bidirectional callbacks between the two views

### Key Design Decisions

- **Video loading**: Uses `fs.readFileSync()` → `Blob` → `URL.createObjectURL()` because Obsidian's CSP blocks `file://` URLs
- **Subtitle encoding**: Auto-detects UTF-8/UTF-16LE/UTF-16BE via BOM in `parsers/index.ts`
- **Parser extensibility**: Add new formats by creating `parsers/XxxParser.ts` and adding to the `parsers` map in `parsers/index.ts`
- **View communication**: Plugin instance acts as mediator; views expose callback setters, main.ts wires them

### Keyboard Shortcuts (in SubtitleView)

- `Space` — toggle play/pause
- `ArrowLeft` — jump to previous subtitle
- `ArrowRight` — jump to next subtitle

### AB Loop Behavior

- **A button** — sets A to current subtitle's start time
- **B button** — sets B to current subtitle's end time
- **AB button** — if no loop active: loops current sentence; if loop active: clears loop

## Adding a New Subtitle Format

1. Create `src/parsers/XxxParser.ts` exporting `(content: string) => Subtitle[]`
2. Add `xxx: parseXxx` to the `parsers` record in `src/parsers/index.ts`
3. The encoding detection and extension dispatch are handled automatically
