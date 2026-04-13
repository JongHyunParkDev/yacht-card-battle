# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**YCB (CB-Tower)** is a card-based roguelike game built with Phaser 3, targeting Web, Desktop (Electron), and Mobile (Capacitor) platforms. The UI and game content are primarily in Korean.

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

- **PreloadScene** (`src/scenes/PreloadScene.ts`): Asset loading
  - 배경(bg1, bg2, bg_battle_fire/grass/earth/thunder/water), 캐릭터 idle 스프라이트시트(300×400px), 정적 캐릭터 이미지, 맵 이미지, 카드/속성 스프라이트, 장비 시트
  - **새 에셋은 반드시 PreloadScene의 `preload()`에 등록** — 다른 씬에서 `this.load.*` 호출 금지
  - 등록한 key를 해당 씬 코드 상단 주석이나 상수로 명시해 추적 가능하게 유지
- **IntroScene** (`src/scenes/IntroScene.ts`): 메인 메뉴 — 새로하기/이어하기/카드 도감/설정/종료 버튼, 우측 하단에 레거시 패널(누적 골드 + 수집 장비 목록) 표시
- **CharacterSelectScene** (`src/scenes/CharacterSelectScene.ts`): 캐릭터/무기 선택, 이전 런에서 수집한 장비(`allEquipment`) 미리보기 및 선택, `startEquipment` 배열을 MainScene으로 전달
- **MainScene** (`src/scenes/MainScene.ts`): 핵심 게임플레이 — 절차적 맵, 노드 이동, 덱 패널, 일시정지 메뉴; `SaveState` 인터페이스 소유, Electron IPC로 영속화
- **NodeEventScene** (`src/scenes/NodeEventScene.ts`): 비전투 노드 이벤트 처리; `NodeEventData`를 MainScene으로부터 수신
- **BattleScene** (`src/scenes/BattleScene.ts`): 턴제 카드 배틀; `BattleSceneData`를 MainScene으로부터 수신; 결과를 MainScene에 반환
- **CardGalleryScene** (`src/scenes/CardGalleryScene.ts`): 카드 도감 뷰어
- **SettingsScene** (`src/scenes/SettingsScene.ts`): 언어/해상도/전체화면/볼륨 설정

### Scene Data Interfaces
Scenes communicate by passing typed data objects via `scene.start('SceneName', data)`:
- `BattleSceneData` — defined in `BattleScene.ts`: 플레이어 스탯, 덱, 캐릭터 무기, 노드 정보 (isBoss, isFinalBoss 포함)
- `NodeEventData` — defined in `NodeEventScene.ts`: 노드 타입, 플레이어 스탯, 장비, 골드, 덱

---

## 캐릭터 시스템

`src/scenes/CharacterSelectScene.ts`의 `CHARACTERS` 배열에 정의. 5종 캐릭터:

| ID | 무기 | HP | ATK | DEF | CRIT% | CRIT배율 | 특성 |
|---|---|---|---|---|---|---|---|
| guardian | swordShield | 110 | 10 | 12 | 10 | 1.5 | 쉴드 카드 효율 2배 |
| ranger | bow | 55 | 14 | 0 | 25 | 1.5 | 화살 카드 = ATK+밸류, 연쇄 데미지 +50% |
| berserker | greatsword | 75 | 12 | 10 | 15 | 1.5 | HP 60% 이하 시 크리 확률·데미지↑ |
| titan | hammer | 115 | 13 | 0 | 10 | 1.5 | 모든 공격 방어력 무시(관통) |
| lancer | spear | 80 | 10 | 0 | 15 | 1.8 | 투창 항상 크리, 크리뎀×밸류 ≥ 적HP 즉사 |

- 각 무기 타입별 idle 애니메이션 스프라이트시트 (`char_bow`, `char_hammer`, `char_shield`, `char_spear`, `char_sword`) 사용
- 프레임 수: swordShield=6, bow=5, greatsword=7, hammer=7, spear=5
- `CHAR_SPRITE_KEY`, `CHAR_FRAME_COUNT` 상수로 관리

### 무기별 초기 덱 구성 (`INITIAL_DECK_SUMMARY`)
| 무기 | 일반 카드 | 속성 카드 |
|---|---|---|
| swordShield | 공격×3  수비×3  포션×2 | 흙★×4  물★×3  풀★×2  불★×1  번개★×1 |
| bow | 화살×5  공격×2  수비×2  포션×2 | 번개★×3  풀★×3  물★×1  불★×1  흙★×1 |
| greatsword | 공격×4  수비×1  포션×1 | 불★×4  번개★×3  물★×2  흙★×2  풀★×1 |
| hammer | 공격×3  수비×3  포션×2 | 흙★×4  불★×3  물★×2  풀★×1  번개★×1 |
| spear | 투창×5  공격×2  수비×2  포션×2 | 물★×2  불★×2  풀★×2  번개★×2  흙★×1 |

---

## Card System

`src/data/cardData.ts` — 총 30장:
- **속성 카드** (5속성 × 5별 등급 = 25장): Water(취약 테마), Fire(화상 테마), Grass(회복+방어막 테마), Lightning(연쇄+기절 테마), Earth(방어막+방깎 테마)
- **일반 카드** (5장): 공격(attack), 수비(defense), 투창(spear), 화살(arrow), HP회복(hp)

### 카드 효과 타입 (`CardEffectType`)
| 효과 | 설명 |
|---|---|
| burn | 화상: 턴 종료마다 value 데미지, duration턴 |
| vulnerable | 취약: 받는 피해 +50%, duration턴 |
| stun | 기절: 다음 적 공격 스킵 |
| armor_break | 방깎: 적 방어력 value 감소 (영구) |
| heal | 회복: 플레이어 HP value 즉시 회복 |
| shield_add | 방어막: 이번 턴 추가 쉴드 value |
| chain | 연쇄: 적에게 상태이상 있을 때 추가 value 데미지 |
| multi_hit | 다중: value회 분할 타격 |
| pierce | 관통: 방어력 무시 |

- `src/objects/Card.ts` — Phaser container, 카드 렌더링 (180×252px, border/title/stars/sprite/stats)
- 카드 런타임 배율 필드: `mult` (전체 배율, 기본 1.0), `bonusValue` (별 강화로 누적된 기본값 보너스)

---

## Equipment System

`src/data/equipmentData.ts` — 총 30개 장비:

### 등급별 드롭 확률 (실제 코드 기준)
| 등급 | 확률 | 수 |
|---|---|---|
| common | 60% | 11 |
| uncommon | 30% | 7 |
| rare | 9% | 5 |
| unique | 0.9% | 4 |
| legendary | 0.1% | 3 |

- **스탯**: atk, def, crit, critDmg, maxHp, cardMult, shieldMult, elementAtkBonus, elementDefBonus
- **특수 효과** (`SpecialEffectType`):

| 타입 | 설명 |
|---|---|
| shield_on_turn_end | 매 전투 턴 종료 후 방어막 생성 |
| heal_on_win | 전투 승리 시 HP 회복 |
| heal_on_win_pct | 전투 승리 시 최대 HP의 value% 회복 |
| bonus_draw | 매 턴 카드 추가 드로우 |
| element_amplify | 속성 유불리 배율 +value |
| lifesteal_pct | 공격 데미지의 value% HP 흡수 |
| card_mult_on_crit | 크리티컬 발생 시 카드 밸류 추가 ×value |

- 장비 이미지: `equip_sheet_1`, `equip_sheet_2` (1024×1024, 4×4 그리드, 프레임 256×256)

### 배율 적용 규칙 (중요!)
`cardMult`와 `shieldMult`는 **가산(additive)** 방식으로 누적:
```typescript
// 올바른 방식 (가산)
playerCardMult = parseFloat((playerCardMult + (s.cardMult - 1)).toFixed(4));
// 예: 1.0 + (1.2-1) = 1.2 → 1.2 + (1.2-1) = 1.4 → 1.4 + (1.2-1) = 1.6
```
복리(compound) 방식 `*=` 절대 사용 금지. 이벤트, 장비, 강화 이벤트 모두 동일하게 적용.

---

## Map Node Types

`src/data/nodeTypes.ts`에 `NODE_TYPE` 상수로 정의:

| 값 | 타입 | 설명 |
|---|---|---|
| 0 | START | 시작점 (내부용) |
| 1 | SKULL | 일반속성 랜덤 몹 전투 |
| 2 | SWORD | 맵속성 랜덤 몹 전투 |
| 3 | ENHANCE | 캐릭터 강화 (패시브) |
| 4 | TREASURE | 장비 뽑기 |
| 5 | CARD_FLIP | 도박 — 카드 뒤집기 골드 게임 |
| 6 | CARD_SWAP | 속성 카드 교환 |
| 7 | HEART | 생명력 제단 — HP 희생 → 카드밸류 강화 (티어 선택) |
| 8 | SHIELD_UP | 회복의 샘 — 쉴드업 OR HP 회복 선택 |
| 9 | STAR_UP | 속성 카드 별 +1 |
| 10 | INDIAN_POKER | 덱 정제 (인디언 포커 방식) |
| 11 | BOSS_WATER | 물 속성 보스 |
| 12 | BOSS_FIRE | 불 속성 보스 |
| 13 | BOSS_GRASS | 풀 속성 보스 |
| 15 | BOSS_LIGHTNING | 번개 속성 보스 |
| 16 | BOSS_EARTH | 땅 속성 보스 |
| 18 | BOSS_FINAL | 무속성 최종 보스 (3페이즈) |

**그룹 분류** (절차적 맵 생성용):
- 그룹 A (전투): 1, 2
- 그룹 B (보상/이벤트): 3, 4, 5
- 그룹 C (카드 변형): 6, 7, 8, 9, 10

`getNodeFrameName()` — 노드 타입 → map_nodes 스프라이트 프레임명 변환

---

## Enemy System

`src/data/enemyData.ts` — 총 24종:
- 속성별 (water/fire/grass/earth/lightning/normal) × 랭크 (normal/elite/boss) = 24종
- `getRandomEnemy(element, rank)` 함수로 랜덤 적 반환

### 기본 적 스탯 (현재 고정값, 맵 스케일링 미구현)
| 속성 | normal HP / ATK | elite HP / ATK | boss HP / ATK |
|---|---|---|---|
| water | 30-45 / 5-6 | 80 / 12 | 200 / 20 |
| fire | 25-40 / 7-10 | 75 / 15 | 180 / 25 |
| grass | 35-55 / 4-5 | 90 / 10 | 250 / 15 |
| earth | 50-60 / 6-8 | 100 / 14 | 300 / 18 |
| lightning | 20-35 / 8-12 | 70 / 18 | 160 / 30 |
| normal | 35-50 / 6-8 | 85 / 12 | 220 / 22 |

---

## Battle System

`src/scenes/BattleScene.ts`:

### 기본 메커니즘
- **타입 차트**: Water > Fire > Grass > Earth > Lightning > Water (1.5× 유리 / 0.5× 불리)
- **방어**: 받는 피해 = 공격력 / 방어력 (기본 0, 최대 50)
- **크리티컬**: 기본 0%, 최대 100%; 기본 배율 1.5×, 최대 2.5×
- **턴**: 최대 20턴 (초과 시 AI 승리); 매 턴 5장 드로우, 카드당 1회 리롤 가능
- **3장 동속성 콤보**: 보너스 데미지 적용
- **쉴드 시스템**: 턴 시작 시 쉴드 초기화, 방어막 카드로 쌓임

### HP 바 구현 (중요!)
HP 바는 **왼쪽 고정** 방식:
```typescript
// 반드시 setOrigin(0, 0.5) — 왼쪽이 0HP, 오른쪽이 최대HP
hpBarFill.setOrigin(0, 0.5).setPosition(barLeftX, barY);
```
`setOrigin(0.5, 0.5)`를 쓰면 바가 가운데에서 줄어드는 버그 발생 — 절대 사용 금지.

### 적 상태이상 (BattleScene 내부 상태)
- `enemyBurnValue` / `enemyBurnDur`: 화상
- `enemyVulnerableDur`: 취약
- `enemyStunned`: 기절
- `enemyArmorBreak`: 방깎 누적량

### UI 구성
- 플레이어/적 HP바, 상태이상 아이콘
- 적 행동 예고 (enemyIntentCont)
- 카드 핸드 + 리롤 버튼
- 공격 버튼 (선택한 카드 없으면 비활성)
- 속성별 전투 배경 이미지 (bg_battle_*)
- 캐릭터 idle 애니메이션 (플레이어 좌측)

### 보스 전투 (일반)
`BattleSceneData.isBoss = true` 시 boss 랭크 적 소환, 보스 이름은 `mobName`으로 전달

---

## BOSS_FINAL (최종 보스) — 3페이즈 시스템

`BattleSceneData.isFinalBoss = true` 로 활성화. `BattleScene.ts` 상단 상수:

```typescript
const FINAL_BOSS_HP        = 100;   // 페이즈당 HP (매 보스 턴 종료 후 100으로 리셋)
const FINAL_BOSS_SHIELD    = 50;    // 보스 턴 종료 후 부여되는 쉴드
const FINAL_BOSS_MAX_TURNS = 5;     // 페이즈당 최대 플레이어 턴 (초과 시 플레이어 사망)

const FINAL_BOSS_PHASES = [
  { atk: 22, def: 10, label: '1형태',    color: '#ffffff', desc: '일반 공격 패턴' },
  { atk: 30, def:  5, label: '분노 형태', color: '#ff8800', desc: '3번째 턴마다 분노 일격 (2× ATK)' },
  { atk: 38, def:  0, label: '절망 형태', color: '#ff2222', desc: '매 턴 ATK+4, 짝수 턴 이중 타격' },
];
```

### 동작 규칙
1. **HP 리셋**: 보스 턴 종료 후 HP가 `FINAL_BOSS_HP(100)`으로 완전 회복
2. **쉴드 부여**: 보스 턴 종료 후 `finalBossShield = 50` (상태이상 적용 X)
3. **5턴 제한**: 플레이어가 5턴 안에 보스 HP를 0으로 만들지 못하면 즉사 (번/취약 등 상태이상으로는 페이즈 클리어 불가)
4. **페이즈 전환**: HP 0 도달 시 다음 페이즈로 전환, 총 3페이즈 클리어 시 승리
5. **쉴드 흡수**: `damageEnemy(rawDmg)` 헬퍼가 `finalBossShield`를 먼저 흡수 후 HP 감소
6. **번 스킵**: 보스 턴의 화상(burn) 효과는 최종 보스에게 적용되지 않음

### 관련 필드 및 메서드
```typescript
// 필드
finalBossPhase: number       // 현재 페이즈 (0/1/2)
finalBossPatternTurn: number // 페이즈 내 보스 턴 카운터
finalBossEnrageBonus: number // 3페이즈 분노 ATK 누적값
finalBossShield: number      // 현재 보스 쉴드량
finalBossShieldLabel: Text   // 쉴드 표시 라벨

// 메서드
damageEnemy(rawDmg: number): number  // 쉴드 흡수 후 HP 차감
updateFinalBossShieldDisplay()        // 쉴드 라벨 갱신
afterFinalBossTurn()                  // 보스 턴 종료 처리 (HP/쉴드 리셋, 5턴 체크)
nextFinalBossPhase()                  // 다음 페이즈 전환
```

---

## Node Events (NodeEventScene)

`src/scenes/NodeEventScene.ts` — 모든 비전투 노드 처리:

| 노드 | 이벤트명 | 내용 |
|---|---|---|
| SKULL/SWORD | createBattleEvent | 전투 씬으로 전환 |
| ENHANCE | createEnhanceEvent | 패시브 스탯 강화 |
| TREASURE | createTreasureEvent | 장비 드롭/선택 |
| CARD_FLIP | createCardFlipEvent | 골드 도박 게임 |
| CARD_SWAP | createCardSwapEvent | 속성 카드 교환 |
| HEART | createHeartEvent | 생명력 제단 (아래 참조) |
| SHIELD_UP | createShieldEvent | 회복의 샘 (아래 참조) |
| STAR_UP | createStarEvent | 속성 카드 별 +1 업그레이드 |
| INDIAN_POKER | createDeckPurificationEvent | 덱 정제 |
| 보스 노드 | createBossEvent | 보스 전투 전환 |

### HEART 이벤트 (생명력 제단) 티어
| 티어 | HP 소모 | 카드 밸류 증가 |
|---|---|---|
| 소 희생 | -5 HP | +5% (multiplier: 1.05) |
| 중 희생 | -10 HP | +10% (multiplier: 1.10) |
| 대 희생 | -20 HP | +20% (multiplier: 1.20) |

이벤트 결과로 `cardValueMultiplier`가 반환되며 MainScene에서 **가산** 방식 적용.

### SHIELD_UP 이벤트 (회복의 샘)
- 선택지 1: 방어 카드 강화 ×1.2 → shieldMult에 가산 적용 (`shieldMult += 0.2`)
- 선택지 2: HP 회복 (최대 HP의 28%)

### 배율 계산 (NodeEventScene 내부, 항상 additive)
```typescript
const nextMult = parseFloat((currentMult + (multGain - 1)).toFixed(2));
```

---

## Procedural Map

`MainScene`에서 생성:
- 맵 해시 기반 시드 RNG
- 12 레이어: 시작(1노드) → 중간 레이어들(2~4노드) → 최종 보스(1노드)
- 맵 스크롤 높이: 2400px, 줌: 1.1×
- 노드 경로: 도트 간격 38px로 자동 연결선 그리기
- 플레이어 토큰: 반지름 11px 원형, 이동 시 1.25× 리프트 애니메이션
- `completedElements: string[]` — 클리어한 속성 맵 목록 (SaveState에 저장)

---

## Asset Structure

```
src/assets/img/
  background/  — bg1, bg2, bg_battle_{fire,grass,earth,thunder,water}.png
  char/        — {bow,hammer,shield,spear,sword}-idle.png (스프라이트시트 300×400)
                 {bow,hammer,shield,spear,sword}.png (정적 이미지)
  map/         — map_bg.png, map_nodes.png
  card/        — card-sprite.png (6행×5열, 370×370px)
  config/      — attr-sprite.png (7아이콘, 128×128px)
  equipment/   — equip_sheet_1.png, equip_sheet_2.png (1024×1024, 256×256 프레임)
```

---

## Localization (i18n)

- `src/utils/localization.ts` — 한국어/영어 문자열 맵, SettingsScene에서 언어 전환, Electron IPC로 영속화
- **모든 UI 텍스트는 반드시 `i18n.t('key')` 를 통해 출력** — 하드코딩 금지
- 새 문자열 추가 시 `localization.ts`의 `ko` / `en` 양쪽 맵에 동시에 등록
- 언어 변경은 런타임에 즉시 반영되므로 텍스트 오브젝트 생성 시점에 `i18n.t()` 호출 필요
- 단, 적 이름(`enemyData.ts`의 `nameKey`)은 현재 i18n 미적용 (영어 그대로 표시)

---

## Persistence (Desktop — Electron IPC)

`electron/main.js`에서 IPC 핸들러 정의. 저장 파일 경로: `app.getPath('userData')`.

| IPC 채널 | 파일 | 설명 |
|---|---|---|
| `save-game` / `load-game` | `savegame.json` | 현재 런 SaveState 전체 저장/로드 |
| `check-save-file` | `savegame.json` | 세이브 파일 존재 여부 확인 |
| `save-persistent` / `load-persistent` | `legacy.json` | 런 중 골드/장비 실시간 저장 (`currentGold`, `currentEquipment`) |
| `save-legacy` / `load-legacy` | `legacy.json` | 런 종료 시 영구 기록 누적 (`totalGold`, `allEquipment`, `runs`) |
| `save-settings` / `load-settings` | `settings.json` | 언어/해상도/볼륨 설정 |
| `apply-settings` | — | 창 크기/전체화면 즉시 적용 (IPC on, not handle) |

### `legacy.json` 구조
```json
{
  "runs": [...],
  "totalGold": 0,
  "allEquipment": [],
  "currentGold": 0,
  "currentEquipment": []
}
```
- `totalGold` / `allEquipment`: `save-legacy` 호출 시 누적 (런 종료 시점)
- `currentGold` / `currentEquipment`: `save-persistent` 호출 시 덮어쓰기 (런 중 실시간)
- IntroScene은 `load-legacy`로 `totalGold`, `allEquipment`를 읽어 레거시 패널 표시
- CharacterSelectScene은 `load-legacy`로 `allEquipment`를 읽어 시작 장비 선택 제공

### `SaveState` 인터페이스 (`MainScene.ts`)
```typescript
interface SaveState {
  mapHash: string;
  currentNodeId?: number;
  playerHp?: number;  playerMaxHp?: number;
  playerAtk?: number; playerDef?: number;
  playerCrit?: number; playerCritDmg?: number;
  playerCardMult?: number; playerShieldMult?: number;
  characterId?: string;
  deck?: { cardId: number; count: number; mult?: number; stars?: number; bonusValue?: number }[];
  equipment?: string[];
  maxEquipSlots?: number;
  cardMultipliers?: Record<number, number>;  // 개별 카드 배율 (enhance 이벤트 결과)
  completedElements?: string[];              // 클리어한 속성 맵 목록
}
```

---

## Utilities

- `src/utils/sceneUtils.ts`:
  - `setResponsiveScale(obj, heightPct)` — 화면 높이 비례 스케일 설정
  - `addFullscreenBackground(scene, key)` — 풀스크린 배경 이미지 배치 (resize 이벤트 연동)
- `src/utils/Audio.ts` — `AudioManager`: BGM/SFX 볼륨 관리, `play(sfxKey)`, `setBgmVolume(v)`, `setSfxVolume(v)`, `bgmVol` 프로퍼티

---

## Platform Notes

- Electron 윈도우: 기본 1280×720 (리사이즈 불가, 설정으로 해상도/전체화면 변경 가능)
- Capacitor: Android/iOS 타겟; `npm run build` 후 `npm run capacitor:copy` 순서 필수
- 한국어 폰트 (SBAggroL/M/B) — `index.html`의 CSS에서 Phaser 초기화 전 로드
- PreloadScene에서 `document.fonts.load()` await로 폰트 렌더링 준비 보장

---

## 미구현 / TODO

- **적 맵 진행 스케일링**: `completedElements.length`를 기반으로 맵 이동 시마다 적 스탯 강화
- **전체 밸런스 조정**: 이벤트 보상 균형, 적 전투 특색 강화 (속성별 고유 패턴)
- **Legacy 장비 선택**: CharacterSelectScene에서 `allEquipment` 목록을 `load-legacy`로 불러와 시작 장비 선택 UI 제공
