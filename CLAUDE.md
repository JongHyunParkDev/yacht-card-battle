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
                   ↕                                   ↓
             SettingsScene / CardGalleryScene    NodeEventScene → BattleScene
                                                                      ↓
                                                               (returns to MainScene)
```

- **PreloadScene** (`src/scenes/PreloadScene.ts`): Asset loading (card-sprite.png 6×5 grid at 370px each, attr-sprite.png 7 icons at 128px, fonts)
  - **새 에셋은 반드시 PreloadScene의 `preload()`에 등록** — 다른 씬에서 `this.load.*` 호출 금지
  - 등록 방법: `this.load.image(key, path)` / `this.load.spritesheet(key, path, frameConfig)` / `this.load.atlas(key, imgPath, jsonPath)`
  - 등록한 key를 해당 씬 코드 상단 주석이나 상수로 명시해 추적 가능하게 유지
- **IntroScene** (`src/scenes/IntroScene.ts`): Main menu
- **CharacterSelectScene** (`src/scenes/CharacterSelectScene.ts`): Pre-game character/weapon selection
- **MainScene** (`src/scenes/MainScene.ts`): Core gameplay — procedural map, node navigation, deck panel, pause menu; owns `SaveState` interface and persists via Electron IPC
- **NodeEventScene** (`src/scenes/NodeEventScene.ts`): Handles non-battle node interactions (treasure, enhancement, card swap, Indian poker, etc.); receives `NodeEventData` from MainScene
- **BattleScene** (`src/scenes/BattleScene.ts`): Turn-based card battle; receives `BattleSceneData` from MainScene; returns result back to MainScene on win/lose
- **CardGalleryScene** (`src/scenes/CardGalleryScene.ts`): Card catalog viewer
- **SettingsScene** (`src/scenes/SettingsScene.ts`): Language/resolution/fullscreen settings

### Scene Data Interfaces
Scenes communicate by passing typed data objects via `scene.start('SceneName', data)`:
- `BattleSceneData` — defined in `BattleScene.ts`: player stats, deck, character weapon, node info
- `NodeEventData` — defined in `NodeEventScene.ts`: node type, player stats, equipment, gold, deck

### Card System
- Card data defined in `src/data/cardData.ts` — 30 cards total: 5 elements × 5 star levels + 5 special cards
- `src/objects/Card.ts` — Phaser container that renders a card (180×252px) with border, title, stars, sprite, stats
- Elements: Water, Fire, Grass, Lightning, Earth — with rock-paper-scissors effectiveness (1.5× / 0.5× damage)
- Starting deck: 25 cards (5 attribute × 5 copies of 1-star)

### Equipment System
- Defined in `src/data/equipmentData.ts`
- 5 slot types: weapon, hat, armor + 2 relic slots
- 5 grades: common(60%) / uncommon(25%) / rare(10%) / unique(4%) / legendary(1%)
- Stats: atk, def, crit, critDmg, maxHp, cardMult, shieldMult, elementAtkBonus, elementDmgReduce
- Special effects: `SpecialEffectType` — e.g. `shield_on_turn_end`, `heal_on_win`, `bonus_draw`, `element_amplify`, `lifesteal_pct`, `card_mult_on_crit`

### Map Node Types
Defined in `src/data/nodeTypes.ts` as `NODE_TYPE`. Nodes belong to one of three groups used for procedural generation:
- **Group A (전투)**: SKULL(1) — 일반속성 랜덤 몹, SWORD(2) — 맵속성 랜덤 몹
- **Group B (보상/이벤트)**: ENHANCE(3) — 캐릭터 강화, TREASURE(4) — 장비 뽑기, CARD_FLIP(5) — 도박
- **Group C (카드 변형)**: CARD_SWAP(6), HEART(7) — HP -5 카드밸류 ×1.3, SHIELD_UP(8), STAR_UP(9), INDIAN_POKER(10)
- **Boss nodes**: BOSS_WATER(11), BOSS_FIRE(12), BOSS_GRASS(13), BOSS_LIGHTNING(15), BOSS_EARTH(16), BOSS_FINAL(18)

### Procedural Map
- Generated in `MainScene` using seeded RNG based on map hash
- 12 layers: start (1 node) → intermediate layers (2–4 nodes) → final boss (1 node)

### Localization (i18n)
- `src/utils/localization.ts` — Korean/English string maps, language toggled via SettingsScene and persisted via Electron IPC
- **모든 UI 텍스트는 반드시 `i18n.t('key')` 를 통해 출력** — 하드코딩 금지
- 새 문자열 추가 시 `localization.ts`의 `ko` / `en` 양쪽 맵에 동시에 등록할 것
- 언어 변경은 런타임에 즉시 반영되므로 텍스트 오브젝트 생성 시점에 `i18n.t()` 호출 필요

### Persistence (Desktop)
- `electron/main.js` handles IPC for save/load game state and settings to disk
- Planned: IndexedDB or SQLite for browser/mobile

## Key Game Mechanics

- **Type chart**: Water > Fire > Grass > Earth > Lightning > Water (1.5× advantage / 0.5× disadvantage) — implemented as `TYPE_BEATS` in `BattleScene.ts`
- **Defense**: damage received = attack / defense (base 0, max 50)
- **Critical**: base 0%, max 100%; base 1.5×, max 2.5×
- **Battle turns**: max 20 (AI wins if not defeated); draw 5 cards/turn with 1 reroll per card; 3+ same-element cards → bonus damage
- **PvP**: async — opponent's last registered deck/equipment fights via AI

## Platform Notes

- Electron window is fixed 1280×720 (no resize); web uses Phaser RESIZE scale mode
- Capacitor targets Android and iOS; run `npm run build` before `npm run capacitor:copy`
- Korean fonts (SBAggroL/M/B) loaded via CSS in `index.html` before Phaser initializes
