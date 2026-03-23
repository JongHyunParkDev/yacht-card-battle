# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CB-Tower** is a card-based roguelike tower defense game built with Phaser 3, targeting Web, Desktop (Electron), and Mobile (Capacitor) platforms. The UI and game content are primarily in Korean.

## Commands

```bash
# Development
npm run dev           # Run both Vite dev server + Electron concurrently
npm run dev:web       # Vite dev server only (port 5173)
npm run dev:electron  # Electron only (waits for web server)

# Build
npm run build         # Vite build + Capacitor copy
npm run electron:build  # Build Electron .exe installer

# Mobile
npm run capacitor:copy         # Copy web build to mobile platforms
npm run capacitor:open:android # Open Android Studio
```

No test framework is configured.

## Architecture

### Scene Flow
Phaser Scenes are the primary unit of game state. The scene lifecycle:

```
PreloadScene → IntroScene → CharacterSelectScene → MainScene
                   ↕
             SettingsScene / CardGalleryScene
```

- **PreloadScene** (`src/scenes/PreloadScene.ts`): Asset loading (card-sprite.png 6×5 grid at 370px each, attr-sprite.png 7 icons at 128px, fonts)
- **IntroScene** (`src/scenes/IntroScene.ts`): Main menu
- **CharacterSelectScene** (`src/scenes/CharacterSelectScene.ts`): Pre-game character/weapon selection
- **MainScene** (`src/scenes/MainScene.ts`): Core gameplay — procedural map, node navigation, deck panel, pause menu
- **CardGalleryScene** (`src/scenes/CardGalleryScene.ts`): Card catalog viewer
- **SettingsScene** (`src/scenes/SettingsScene.ts`): Language/resolution/fullscreen settings

### Card System
- Card data defined in `src/data/cardData.ts` — 30 cards total: 5 elements × 5 star levels + 5 special cards
- `src/objects/Card.ts` — Phaser container that renders a card (180×252px) with border, title, stars, sprite, stats
- Elements: Water, Fire, Grass, Lightning, Earth — with rock-paper-scissors effectiveness (1.5× / 0.5× damage)
- Starting deck: 25 cards (5 attribute × 5 copies of 1-star)

### Procedural Map
- Generated in `MainScene` using seeded RNG based on map hash
- 12 layers: start (1 node) → intermediate layers (2–4 nodes) → final boss (1 node)

### Localization
- `src/utils/localization.ts` — Korean/English string maps, language toggled via SettingsScene and persisted via Electron IPC

### Persistence (Desktop)
- `electron/main.js` handles IPC for save/load game state and settings to disk
- Planned: IndexedDB or SQLite for browser/mobile

## Key Game Mechanics (from game.md)

- **Type chart**: Water > Fire > Grass > Earth > Lightning > Water
- **Defense**: damage received = attack / defense (base 0, max 50)
- **Critical**: base 0%, max 100%; base 1.5×, max 2.5×
- **Battle turns**: max 20; draw 5 cards/turn with 1 reroll per card; 3+ same-element cards → bonus damage
- **PvP**: async — opponent's last registered deck/equipment fights via AI

## Platform Notes

- Electron window is fixed 1280×720 (no resize); web uses Phaser RESIZE scale mode
- Capacitor targets Android and iOS; run `npm run build` before `npm run capacitor:copy`
- Korean fonts (SBAggroL/M/B) loaded via CSS in `index.html` before Phaser initializes
