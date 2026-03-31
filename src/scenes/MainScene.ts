import Phaser from 'phaser';
import { i18n } from '@src/utils/localization';
import { getNodeFrameName, NODE_TYPE_GROUPS, BOSS_NODE_TYPES } from '@src/data/nodeTypes';
import { CharacterDef, WeaponType, CHAR_SPRITE_KEY, CHAR_FRAME_COUNT, WEAPON_COLORS, CHARACTERS } from '@src/scenes/CharacterSelectScene';
import { CARD_DATA_LIST } from '@src/data/cardData';
import type { CardData } from '@src/data/cardData';
import Card, { CARD_WIDTH, CARD_HEIGHT } from '@src/objects/Card';
import { getEquipmentById, EQUIP_GRADE_COLOR } from '@src/data/equipmentData';

interface DeckEntry { card: CardData; count: number; }

interface SaveState {
  mapHash: string;
  currentNodeId?: number;
  playerHp?: number;
  playerMaxHp?: number;
  playerAtk?: number;
  playerDef?: number;
  playerCrit?: number;
  playerCritDmg?: number;
  playerCardMult?: number;
  playerShieldMult?: number;
  characterId?: string;
  deck?: { cardId: number; count: number }[];
  equipment?: string[];
  maxEquipSlots?: number;
  cardMultipliers?: Record<number, number>;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const MAP_WORLD_HEIGHT = 2400;
const MAP_NUM_LAYERS   = 12;
const MAP_ZOOM         = 1.1;

const PATH_DOT_INTERVAL = 38; // 도트 간 간격(px) — 거리에 비례해 도트 수 자동 결정

const DECK_PANEL_HANDLE_H = 34;
const DECK_PANEL_HANDLE_W = 120;
const DECK_COLOR_GOLD     = 0xd4af37;
const DECK_COLOR_GOLD_HVR = 0xf5cc4a;
const DECK_COLOR_BG       = 0x2a2a2a;

const HANDLE_RADIUS = { tl: 10, tr: 10, bl: 0, br: 0 } as any;
const PANEL_RADIUS  = { tl: 10, tr: 0,  bl: 0, br: 0 } as any;

const NODE_SCALE_DEFAULT  = 0.8;
const NODE_SCALE_HOVER    = 0.9;
const NODE_SCALE_PASSED   = 0.6;
const NODE_SCALE_INACTIVE = 0.7;

const TOKEN_SCALE_IDLE = 1.0;
const TOKEN_SCALE_LIFT = 1.25;
const TOKEN_RADIUS     = 11;   // 플레이어 토큰 원 반지름(px)

// ─── 인터페이스 ───────────────────────────────────────────────────────────────

export interface MapNode {
  id: number;
  layer: number;
  x: number;
  y: number;
  type: number;
  nextNodes: number[];
}

type NodeSprite = Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics;

// ─── 클래스 ───────────────────────────────────────────────────────────────────

export default class MainScene extends Phaser.Scene {
  // ── 상태 필드 ────────────────────────────────────────────────────────────────
  private isContinue    = false;
  private isPaused      = false;
  private isMoving      = false;
  private currentNodeId = -1;
  private isReady     = false;
  private currentMapElement: string = 'water';
  private character?: CharacterDef;
  private playerDeck: DeckEntry[] = [];
  // ── 플레이어 스탯 ─────────────────────────────────────────────────────────
  private legacyGold       = 0;
  private playerHp         = 100;
  private playerMaxHp      = 100;
  private playerAtk        = 0;
  private playerDef        = 0;
  private playerCrit       = 0;
  private playerCritDmg    = 1.5;
  private playerCardMult   = 1.0; // 카드 전체 공격/방어 배율 (전체)
  private playerShieldMult = 1.0; // 방어 카드 전체 배율
  private playerEquipment: string[] = [];
  private maxEquipSlots    = 1;
  private mapHash          = '';
  private cardMultipliers: Record<number, number> = {}; // 런타임 개별 카드 배율

  // ── 게임 오브젝트 참조 ────────────────────────────────────────────────────────
  private playerToken!: Phaser.GameObjects.Arc;
  private pauseMenuContainer!: Phaser.GameObjects.Container;
  private deckWindowContainer!: Phaser.GameObjects.Container;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private activePathsGraphics!: Phaser.GameObjects.Graphics;
  private fpsTxt?: Phaser.GameObjects.Text;

  constructor() {
    super('MainScene');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Phaser 라이프사이클
  // ─────────────────────────────────────────────────────────────────────────────

  /** CharacterSelectScene에서 전달된 data를 받습니다 */
  init(data: { isContinue?: boolean; character?: CharacterDef; startEquipment?: string[] }) {
    this.isContinue = data?.isContinue ?? false;
    this.character  = data?.character;
    if (data?.startEquipment && data.startEquipment.length > 0) {
      this.playerEquipment = [...data.startEquipment];
    }
  }

  async create() {
    const { width, height } = this.scale;
    const mapWorldWidth = Math.max(width, 1000);

    this.initCamera(mapWorldWidth);
    this.initBackground(mapWorldWidth);

    const state = await this.loadOrCreateSaveState();
    this.mapHash = state.mapHash;
    if (!this.character && state.characterId) {
      this.character = CHARACTERS.find(c => c.id === state.characterId);
    }
    // 캐릭터 기본값 → 세이브 값으로 덮어쓰기
    const base = this.character;
    
    // 골드는 SaveState가 아니라 영구 기록(legacy)에서 직접 불러옵니다.
    // @ts-ignore
    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        const res = await ipcRenderer.invoke('load-persistent');
        if (res?.success) {
          this.legacyGold = res.data.gold ?? 0;
        }
      } catch (e) { console.warn('골드 로드 실패', e); }
    }

    this.playerHp      = state.playerHp      ?? (base?.hp      ?? 100);
    this.playerMaxHp   = state.playerMaxHp   ?? (base?.hp      ?? 100);
    this.playerAtk     = state.playerAtk     ?? (base?.atk     ?? 0);
    this.playerDef     = state.playerDef     ?? (base?.def     ?? 0);
    this.playerCrit      = state.playerCrit    ?? (base?.crit    ?? 0);
    this.playerCritDmg   = state.playerCritDmg ?? (base?.critDmg ?? 1.5);
    this.playerEquipment  = state.equipment      ?? [];
    this.maxEquipSlots    = state.maxEquipSlots  ?? 1;
    this.playerCardMult   = state.playerCardMult   ?? 1.0;
    this.playerShieldMult = state.playerShieldMult ?? 1.0;
    this.cardMultipliers  = state.cardMultipliers || {};
    this.currentMapElement = (state as any).mapElement ?? 'water';

    // 만약 새 게임(isContinue === false)이고 초기 장비가 존재한다면, 해당 장비의 스탯을 기본 스탯에 적용
    if (!this.isContinue && this.playerEquipment.length > 0) {
      this.playerEquipment.forEach(eqId => {
        const eq = getEquipmentById(eqId);
        if (eq) {
          const s = eq.stats;
          if (s.atk)       this.playerAtk     += s.atk;
          if (s.def)       this.playerDef     += s.def;
          if (s.crit)      this.playerCrit    += s.crit;
          if (s.critDmg)   this.playerCritDmg += s.critDmg;
          if (s.maxHp) {
            this.playerMaxHp += s.maxHp;
            this.playerHp    += s.maxHp;
          }
          if (s.cardMult)   this.playerCardMult   *= s.cardMult;
          if (s.shieldMult) this.playerShieldMult *= s.shieldMult;
        }
      });
    }

    const mapLayersData = this.generateMapData(this.mapHash, mapWorldWidth, MAP_WORLD_HEIGHT);
    const allNodes      = mapLayersData.flat();
    const startNode     = mapLayersData[0][0];

    this.currentNodeId = (state.currentNodeId !== undefined && state.currentNodeId >= 0)
      ? state.currentNodeId
      : startNode.id;

    this.drawNodePaths(allNodes);
    this.activePathsGraphics = this.add.graphics().setDepth(4);

    const nodeSpritesMap = this.createNodeSprites(allNodes);
    this.updateNodesVisibility(allNodes, nodeSpritesMap, true);

    if (state.deck && state.deck.length > 0) {
      this.playerDeck = state.deck
        .map(e => ({ card: CARD_DATA_LIST.find(c => c.id === e.cardId)!, count: e.count }))
        .filter(e => e.card != null);
    } else {
      this.buildInitialDeck();
    }
    this.ensureCharAnimations();
    const spawnNode = allNodes.find(n => n.id === this.currentNodeId) ?? startNode;
    this.createPlayerToken(spawnNode);
    this.setupInput(width, height);

    // 덱 패널 생성 전 월드 오브젝트 목록 스냅샷
    const worldObjects = [...this.children.list];
    this.createDeckWindow(width, height);
    const overlayContainer = this.createScreenOverlay(width, height);

    // UI 카메라: zoom=1, scroll=0 → 스크린 좌표 = 월드 좌표 (완전 고정)
    this.uiCam = this.cameras.add(0, 0, width, height).setZoom(1);
    this.uiCam.ignore(worldObjects);
    this.cameras.main.ignore(this.deckWindowContainer);
    this.cameras.main.ignore(overlayContainer);

    // 개발 모드 FPS 표시 (우상단)
    if (import.meta.env.DEV) {
      this.fpsTxt = this.add.text(width - 6, 6, 'FPS --', {
        fontFamily: 'monospace', fontSize: '13px', color: '#00ff88',
        backgroundColor: '#00000099', padding: { x: 5, y: 2 },
      }).setOrigin(1, 0).setDepth(999);
      this.cameras.main.ignore(this.fpsTxt);
    }

    // 노드 클릭 이벤트 등록 (allNodes, nodeSpritesMap 클로저로 사용)
    this.registerNodeClickEvents(allNodes, nodeSpritesMap);
    this.isReady = true;
  }

  update() {
    if (!this.isReady || !this.fpsTxt) return;
    try {
      this.fpsTxt.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
    } catch { /* canvas not ready */ }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // create() 초기화 세부 메서드
  // ─────────────────────────────────────────────────────────────────────────────

  private initCamera(mapWorldWidth: number) {
    this.cameras.main.setBounds(0, 0, mapWorldWidth, MAP_WORLD_HEIGHT);
    this.cameras.main.setZoom(MAP_ZOOM);
    this.cameras.main.setRoundPixels(true);
  }

  private initBackground(mapWorldWidth: number) {
    const bg = this.add.image(mapWorldWidth / 2, MAP_WORLD_HEIGHT / 2, 'map_bg');
    bg.setDisplaySize(mapWorldWidth, MAP_WORLD_HEIGHT);

    // 다크 블루 분위기 틴트 (맵 위에 바로 얹힘)
    const tint = this.add.graphics();
    tint.fillStyle(0x08081a, 0.40);
    tint.fillRect(0, 0, mapWorldWidth, MAP_WORLD_HEIGHT);
    tint.setDepth(1);
  }

  /** 화면 고정 오버레이 (비네트 + 스캔라인 + 골드 프레임) — UI 카메라 전용 */
  private createScreenOverlay(width: number, height: number): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    container.setDepth(45);

    // ── 비네트: 몇 개의 반투명 사각형으로 그라디언트 근사 ──────────────────
    const vignette = this.add.graphics();
    const strips = [
      { a: 0.45, s: 32 },
      { a: 0.28, s: 65 },
      { a: 0.13, s: 105 },
    ];
    strips.forEach(({ a, s }) => {
      vignette.fillStyle(0x000000, a);
      vignette.fillRect(0, 0, width, s);                 // 상단
      vignette.fillRect(0, height - s, width, s);        // 하단
      vignette.fillRect(0, 0, s * 0.65, height);         // 좌측
      vignette.fillRect(width - s * 0.65, 0, s * 0.65, height); // 우측
    });

    // ── 스캔라인: 넓은 간격으로 드로우콜 최소화 ─────────────────────────────
    const scanlines = this.add.graphics();
    scanlines.lineStyle(1, 0x000000, 0.10);
    for (let y = 0; y < height; y += 6) {
      scanlines.lineBetween(0, y, width, y);
    }

    // ── 골드 프레임 보더 ─────────────────────────────────────────────────────
    const frame = this.add.graphics();
    frame.lineStyle(2, DECK_COLOR_GOLD, 0.55);
    frame.strokeRect(3, 3, width - 6, height - 6);
    frame.lineStyle(1, DECK_COLOR_GOLD, 0.20);
    frame.strokeRect(7, 7, width - 14, height - 14);

    container.add([vignette, scanlines, frame]);
    return container;
  }

  /** 이어하기면 세이브 파일에서 상태 로드, 없으면 새로 생성 후 저장 */
  private async loadOrCreateSaveState(): Promise<SaveState> {
    if (this.isContinue) {
      const loaded = await this.loadGameFromElectron();
      if (loaded) return loaded;
    }
    return this.createAndSaveNewState();
  }

  private async loadGameFromElectron(): Promise<SaveState | null> {
    // @ts-ignore
    if (typeof require === 'undefined') return null;
    try {
      const { ipcRenderer } = require('electron');
      const result = await ipcRenderer.invoke('load-game');
      if (result?.success && result.data?.mapHash) {
        console.log('세이브 로드 성공(Electron):', result.data);
        return result.data as SaveState;
      }
    } catch {
      console.warn('Electron 로드 실패, 새 상태 생성');
    }
    return null;
  }

  private async createAndSaveNewState(): Promise<SaveState> {
    const mapHash = `stage_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
    console.log('새로운 맵 해시 생성됨:', mapHash);
    const base = this.character;
    const state: SaveState = {
      mapHash,
      playerHp:      base?.hp      ?? 100,
      playerMaxHp:   base?.hp      ?? 100,
      playerAtk:     base?.atk     ?? 0,
      playerDef:     base?.def     ?? 0,
      playerCrit:    base?.crit    ?? 0,
      playerCritDmg: base?.critDmg ?? 1.5,
      characterId:   base?.id,
    };
    const elements = ['fire', 'water', 'grass', 'earth', 'lightning'];
    (state as any).mapElement = elements[Math.floor(Math.random() * elements.length)];
    await this.saveToElectron(state);
    return state;
  }

  /** 현재 플레이어 상태를 Electron에 저장 */
  private async saveGameState() {
    const state: SaveState = {
      mapHash:       this.mapHash,
      currentNodeId: this.currentNodeId,
      playerHp:      this.playerHp,
      playerMaxHp:   this.playerMaxHp,
      playerAtk:     this.playerAtk,
      playerDef:     this.playerDef,
      playerCrit:    this.playerCrit,
      playerCritDmg: this.playerCritDmg,
      characterId:   this.character?.id,
      deck:             this.playerDeck.map(e => ({ cardId: e.card.id, count: e.count })),
      equipment:        this.playerEquipment,
      maxEquipSlots:    this.maxEquipSlots,
      playerCardMult:   this.playerCardMult,
      playerShieldMult: this.playerShieldMult,
      cardMultipliers:  this.cardMultipliers,
    };
    (state as any).mapElement = this.currentMapElement; // mapElement 저장
    await this.saveToElectron(state);
  }

  private async saveToElectron(state: SaveState) {
    // @ts-ignore
    if (typeof require === 'undefined') return;
    try {
      const { ipcRenderer } = require('electron');
      await ipcRenderer.invoke('save-game', state);
    } catch (e) {
      console.warn('Electron 세이브 실패', e);
    }
  }

  /** 게임 오버: 세이브 파일 삭제 후 인트로로 복귀 */
  private async clearSaveAndReturn() {
    // @ts-ignore
    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        // 빈 상태로 덮어써서 세이브 초기화
        await ipcRenderer.invoke('save-game', {});
      } catch {}
    }
    this.scene.start('IntroScene');
  }

  /** 게임 오버 / 클리어 시 영구 기록 저장 (골드·장비는 런이 끝나도 보존) */
  private async saveLegacyData(reachedLayer: number) {
    // @ts-ignore
    if (typeof require === 'undefined') return;
    try {
      const { ipcRenderer } = require('electron');
      await ipcRenderer.invoke('save-legacy', {
        date:      new Date().toISOString(),
        gold:      this.legacyGold,
        equipment: [...this.playerEquipment],
        reached:   reachedLayer,
        character: this.character?.id ?? 'unknown',
      });
    } catch (e) {
      console.warn('Legacy 저장 실패', e);
    }
  }

  /** 노드 간 경로 그리기 — 베지어 곡선 점선 (고정 스타일, 배치 최적화) */
  private drawNodePaths(allNodes: MapNode[]) {
    const g = this.add.graphics();
    g.setDepth(3);
    g.fillStyle(0xd4af37, 0.75); // fillStyle 한 번만

    allNodes.forEach(node => {
      node.nextNodes.forEach(nextId => {
        const next = allNodes.find(n => n.id === nextId);
        if (!next) return;

        const cy1 = node.y + (next.y - node.y) * 0.35;
        const cy2 = next.y - (next.y - node.y) * 0.35;

        const dist  = Phaser.Math.Distance.Between(node.x, node.y, next.x, next.y);
        const steps = Math.max(2, Math.round(dist / PATH_DOT_INTERVAL));

        for (let i = 1; i < steps; i++) {
          const t  = i / steps;
          const mt = 1 - t;
          const px = mt * mt * mt * node.x + 3 * mt * mt * t * node.x
                   + 3 * mt * t * t * next.x + t * t * t * next.x;
          const py = mt * mt * mt * node.y + 3 * mt * mt * t * cy1
                   + 3 * mt * t * t * cy2   + t * t * t * next.y;
          g.fillCircle(px, py, 3);
        }
      });
    });
  }

  /** 노드 스프라이트(또는 시작점 그래픽) 생성 후 Map 반환 */
  private createNodeSprites(allNodes: MapNode[]): Map<number, NodeSprite> {
    const nodeSpritesMap = new Map<number, NodeSprite>();

    allNodes.forEach(node => {
      if (node.layer === 0) {
        // 시작 점: 흰 원 + 검정 테두리
        const dot = this.add.graphics();
        dot.fillStyle(0xffffff, 1);
        dot.lineStyle(3, 0x000000, 1);
        dot.fillCircle(node.x, node.y, 16);
        dot.strokeCircle(node.x, node.y, 16);
        dot.setDepth(6);
        nodeSpritesMap.set(node.id, dot);
        return;
      }

      const frameName = getNodeFrameName(node.type);
      const sprite    = this.add.sprite(node.x, node.y, 'map_nodes', frameName);
      sprite.setScale(NODE_SCALE_DEFAULT).setDepth(6);
      sprite.setInteractive({ useHandCursor: true });
      nodeSpritesMap.set(node.id, sprite);

      sprite.on('pointerover', () => {
        if (sprite.alpha < 1) return;
        sprite.setScale(NODE_SCALE_HOVER);
      });
      sprite.on('pointerout', () => {
        sprite.setScale(sprite.alpha < 1 ? NODE_SCALE_PASSED : NODE_SCALE_DEFAULT);
      });
    });

    return nodeSpritesMap;
  }

  /** 노드 클릭 이벤트 별도 등록 (create 이후 nodeSpritesMap 참조 필요) */
  private registerNodeClickEvents(
    allNodes: MapNode[],
    nodeSpritesMap: Map<number, NodeSprite>,
  ) {
    allNodes.forEach(node => {
      if (node.layer === 0) return;

      const sprite = nodeSpritesMap.get(node.id);
      if (!(sprite instanceof Phaser.GameObjects.Sprite)) return;

      sprite.on('pointerdown', () => {
        if (this.isPaused || this.isMoving) return;

        const currentNode = allNodes.find(n => n.id === this.currentNodeId);
        if (!currentNode) return;

        if (currentNode.nextNodes.includes(node.id)) {
          this.movePlayer(node.x, node.y, node);
          this.currentNodeId = node.id;
          this.updateNodesVisibility(allNodes, nodeSpritesMap, true);
        }
        // 불가 노드 클릭 시 아무 반응 없음 (shake 제거)
      });
    });
  }

  private createPlayerToken(startNode: MapNode) {
    // 외곽 흰 테두리 원 + 안쪽 골드 원으로 구성된 마커
    this.playerToken = this.add.circle(startNode.x, startNode.y, TOKEN_RADIUS, 0xd4af37);
    this.playerToken.setStrokeStyle(2.5, 0xffffff, 1);
    this.playerToken.setDepth(10);
    this.cameras.main.startFollow(this.playerToken, true, 0.1, 0.1);
  }

  private setupInput(width: number, height: number) {
    this.input.keyboard?.on('keydown-ESC', () => {
      this.togglePauseMenu(width, height);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 덱 패널
  // ─────────────────────────────────────────────────────────────────────────────

  /** 초기 덱 구성: 일반 공격×4 + 수비×3 + 포션×3 + 속성 1성 각×3 = 25장 */
  private buildInitialDeck() {
    // Normal cards: id 25=공격, 26=수비, 29=포션
    // Elemental 1-star: id 0=water, 5=fire, 10=grass, 15=lightning, 20=earth
    this.playerDeck = [
      { card: CARD_DATA_LIST[25], count: 4 },
      { card: CARD_DATA_LIST[26], count: 3 },
      { card: CARD_DATA_LIST[29], count: 3 },
      { card: CARD_DATA_LIST[0],  count: 3 },
      { card: CARD_DATA_LIST[5],  count: 3 },
      { card: CARD_DATA_LIST[10], count: 3 },
      { card: CARD_DATA_LIST[15], count: 3 },
      { card: CARD_DATA_LIST[20], count: 3 },
    ];
  }

  /** 캐릭터 idle 애니메이션이 없으면 생성 (씬 전환 후 유실 방지) */
  private ensureCharAnimations() {
    const chars: Array<{ weapon: WeaponType; frames: number }> = [
      { weapon: 'swordShield', frames: CHAR_FRAME_COUNT.swordShield },
      { weapon: 'bow',         frames: CHAR_FRAME_COUNT.bow         },
      { weapon: 'greatsword',  frames: CHAR_FRAME_COUNT.greatsword  },
      { weapon: 'hammer',      frames: CHAR_FRAME_COUNT.hammer      },
      { weapon: 'spear',       frames: CHAR_FRAME_COUNT.spear       },
    ];
    chars.forEach(({ weapon, frames }) => {
      const key = `char_idle_${weapon}`;
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames:    this.anims.generateFrameNumbers(CHAR_SPRITE_KEY[weapon], { start: 0, end: frames - 1 }),
          frameRate: 8,
          repeat:    -1,
        });
      }
    });
  }

  private createDeckWindow(width: number, height: number) {
    const panelW  = width;
    const panelH  = height - DECK_PANEL_HANDLE_H;
    const handleX = (panelW - DECK_PANEL_HANDLE_W) / 2;
    const handleY = 0;
    const leftW   = Math.floor(panelW * 0.38);
    const rightX  = leftW + 1;
    const rightW  = panelW - rightX;
    const topY    = DECK_PANEL_HANDLE_H + 10;

    this.deckWindowContainer = this.add.container(0, height - DECK_PANEL_HANDLE_H);
    this.deckWindowContainer.setDepth(50);

    // ── 핸들 ──────────────────────────────────────────────────────────────────
    const handleGraphics = this.add.graphics();
    this.drawHandleGraphics(handleGraphics, handleX, handleY, DECK_COLOR_GOLD);

    const deckText   = i18n.t('deck');
    const handleText = this.add.text(
      handleX + DECK_PANEL_HANDLE_W / 2,
      handleY + DECK_PANEL_HANDLE_H / 2,
      `${deckText} ▲`,
      { fontFamily: 'SBAggroM', fontSize: '14px', color: '#000000' },
    ).setOrigin(0.5);

    const handleZone = this.add.zone(
      handleX + DECK_PANEL_HANDLE_W / 2,
      handleY + DECK_PANEL_HANDLE_H / 2,
      DECK_PANEL_HANDLE_W,
      DECK_PANEL_HANDLE_H,
    ).setInteractive({ useHandCursor: true });

    // ── 패널 배경 ─────────────────────────────────────────────────────────────
    const panelBg = this.add.graphics();
    panelBg.fillStyle(DECK_COLOR_BG, 0.97);
    panelBg.lineStyle(2, DECK_COLOR_GOLD, 1);
    panelBg.fillRoundedRect(0, DECK_PANEL_HANDLE_H, panelW, panelH, PANEL_RADIUS);
    panelBg.strokeRoundedRect(0, DECK_PANEL_HANDLE_H, panelW, panelH, PANEL_RADIUS);
    panelBg.lineStyle(1, 0x444444, 1);
    panelBg.lineBetween(leftW, DECK_PANEL_HANDLE_H + 12, leftW, height - 12);

    const panelBlockZone = this.add
      .zone(panelW / 2, DECK_PANEL_HANDLE_H + panelH / 2, panelW, panelH)
      .setInteractive();

    // ─────────────────────────────────────────────────────────────────────────
    // 왼쪽: 캐릭터 정보
    // ─────────────────────────────────────────────────────────────────────────
    const char = this.character;

    const leftTitleTxt = this.add.text(leftW / 2, topY, i18n.t('charInfo'), {
      fontFamily: 'SBAggroB', fontSize: '14px', color: '#d4af37',
    }).setOrigin(0.5);

    // 캐릭터 정적 이미지
    const CHAR_IMG_KEY: Record<string, string> = {
      swordShield: 'char_img_shield',
      bow:         'char_img_bow',
      greatsword:  'char_img_sword',
      hammer:      'char_img_hammer',
      spear:       'char_img_spear',
    };
    // 이미지 높이: 이름 + 스탯 5행이 잘리지 않도록 제한
    const STAT_ROW_MIN_H = 44;
    const NAME_H         = 22;
    const charImgH = Math.min(
      Math.floor(panelH * 0.38),
      height - topY - NAME_H * 2 - STAT_ROW_MIN_H * 5 - 20,
    );
    const charImgY = topY + 16 + charImgH / 2;

    let charImg: Phaser.GameObjects.Image | null = null;
    if (char) {
      const imgKey = CHAR_IMG_KEY[char.weapon];
      charImg = this.add.image(leftW / 2, charImgY, imgKey);
      const src = charImg.texture.source[0];
      if (src) {
        const scale = Math.min(charImgH / src.height, (leftW * 0.80) / src.width);
        charImg.setScale(scale);
      }
    }

    // ── 장비 슬롯 오버레이 (이미지 좌측 상단 정사각형) ──────────────────────
    const SLOT_SIZE = 34;
    const SLOT_GAP  = 5;
    const SLOT_X0   = 10;
    const SLOT_Y0   = topY + 18;
    const equipG    = this.add.graphics();
    const equipTexts: Phaser.GameObjects.Text[] = [];

    for (let s = 0; s < this.maxEquipSlots; s++) {
      const sx    = SLOT_X0 + s * (SLOT_SIZE + SLOT_GAP);
      const sy    = SLOT_Y0;
      const item  = this.playerEquipment[s];
      const empty = item == null;

      equipG.fillStyle(empty ? 0x0d1117 : 0x1a3a1a, 0.85);
      equipG.lineStyle(2, empty ? 0x445566 : DECK_COLOR_GOLD, empty ? 0.5 : 1);
      equipG.fillRoundedRect(sx, sy, SLOT_SIZE, SLOT_SIZE, 5);
      equipG.strokeRoundedRect(sx, sy, SLOT_SIZE, SLOT_SIZE, 5);

      if (empty) {
        // 빈 슬롯: 중앙 + 기호
        equipTexts.push(
          this.add.text(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, '+', {
            fontFamily: 'SBAggroM', fontSize: '16px', color: '#445566',
          }).setOrigin(0.5),
        );
      } else {
        // 장비 있음: ID → 이름 조회 후 2글자 축약 + 등급색 표시
        const equip = getEquipmentById(item);
        const abbr  = (equip?.name ?? item).replace(/[^가-힣a-zA-Z]/g, '').slice(0, 2);
        const color = equip ? EQUIP_GRADE_COLOR[equip.grade] : '#d4af37';
        equipTexts.push(
          this.add.text(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, abbr, {
            fontFamily: 'SBAggroB', fontSize: '11px', color,
            wordWrap: { width: SLOT_SIZE - 4 }, align: 'center',
          }).setOrigin(0.5),
        );
      }
    }

    // 캐릭터 이름
    const accentColor = char ? WEAPON_COLORS[char.weapon].accent : '#888888';
    const charNameTxt = this.add.text(leftW / 2, topY + 30 + charImgH, char ? i18n.t(char.nameKey) : '---', {
      fontFamily: 'SBAggroB', fontSize: '13px', color: accentColor,
    }).setOrigin(0.5);

    // 스탯 바 영역
    type StatKey = 'hp' | 'def' | 'atk' | 'crit' | 'critDmg';
    const STAT_ROWS: Array<{ key: StatKey; label: string; fmt: (v: number) => string }> = [
      { key: 'hp',      label: i18n.t('statHp'),     fmt: v => `${v}` },
      { key: 'def',     label: i18n.t('statDef'),    fmt: v => `${v}` },
      { key: 'atk',     label: i18n.t('statAtk'),    fmt: v => `${v}` },
      { key: 'crit',    label: i18n.t('statCrit'),   fmt: v => `${v}%` },
      { key: 'critDmg', label: i18n.t('statCritDmg'),fmt: v => `×${v}` },
    ];
    const STAT_MAX: Record<StatKey, number> = { hp: 200, def: 50, atk: 100, crit: 100, critDmg: 2.5 };

    const statAreaY = topY + 34 + charImgH;
    const rowH      = (height - 10 - statAreaY) / STAT_ROWS.length;
    const barX      = leftW * 0.34;
    const barW      = leftW * 0.46;
    const barH      = Math.max(Math.floor(rowH * 0.30), 6);
    const charCol   = char ? WEAPON_COLORS[char.weapon].card : 0x888888;

    const statG = this.add.graphics();
    const statTexts: Phaser.GameObjects.Text[] = [];

    const liveStats: Record<string, number> = {
      hp:      this.playerHp,
      def:     this.playerDef,
      atk:     this.playerAtk,
      crit:    this.playerCrit,
      critDmg: this.playerCritDmg,
    };

    STAT_ROWS.forEach(({ key, label, fmt }, i) => {
      const cy    = statAreaY + i * rowH + rowH / 2;
      const val   = liveStats[key] ?? 0;
      const ratio = Math.min(val / STAT_MAX[key], 1);

      statG.fillStyle(0x2a2a3a, 1);
      statG.fillRoundedRect(barX, cy - barH / 2, barW, barH, 3);
      statG.fillStyle(charCol, 1);
      statG.fillRoundedRect(barX, cy - barH / 2, barW * ratio, barH, 3);

      statTexts.push(
        this.add.text(8, cy, label, {
          fontFamily: 'SBAggroM', fontSize: '12px', color: '#888888',
        }).setOrigin(0, 0.5),
        this.add.text(barX + barW + 5, cy, fmt(val), {
          fontFamily: 'SBAggroM', fontSize: '12px', color: '#d8c8a8',
        }).setOrigin(0, 0.5),
      );
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 오른쪽: 카드 이미지 목록 (10개 × n행)
    // ─────────────────────────────────────────────────────────────────────────
    const CARDS_PER_ROW = 10;
    const cardGap       = 6;
    const cardScale     = (rightW - cardGap * (CARDS_PER_ROW + 1)) / (CARDS_PER_ROW * CARD_WIDTH);
    const scaledW       = CARD_WIDTH  * cardScale;
    const scaledH       = CARD_HEIGHT * cardScale;
    const cardAreaStartY = topY + 24;

    const totalCards   = this.playerDeck.reduce((s, e) => s + e.count, 0);
    const deckTitleTxt = this.add.text(
      rightX + rightW / 2, topY,
      `${i18n.t('deckList')}  (${totalCards}장)`,
      { fontFamily: 'SBAggroB', fontSize: '14px', color: '#d4af37' },
    ).setOrigin(0.5);

    const deckCards: Card[] = [];
    let cardIdx = 0;
    for (const entry of this.playerDeck) {
      for (let c = 0; c < entry.count; c++) {
        const col = cardIdx % CARDS_PER_ROW;
        const row = Math.floor(cardIdx / CARDS_PER_ROW);
        const cx  = rightX + cardGap + col * (scaledW + cardGap);
        const cy  = cardAreaStartY + row * (scaledH + cardGap);

        const card = new Card(this, cx, cy, entry.card);
        card.setScale(cardScale);
        card.setInteractive(
          new Phaser.Geom.Rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT),
          Phaser.Geom.Rectangle.Contains,
        );

        card.on('pointerover', () => {
          this.deckWindowContainer.bringToTop(card);
          this.tweens.add({ targets: card, scaleX: cardScale * 1.18, scaleY: cardScale * 1.18, duration: 110, ease: 'Sine.easeOut' });
        });
        card.on('pointerdown', () => {
          this.showCardDetailPopup(entry.card);
        });
        card.on('pointerout', () => {
          this.tweens.add({ targets: card, scaleX: cardScale, scaleY: cardScale, duration: 110, ease: 'Sine.easeOut' });
        });

        deckCards.push(card);
        cardIdx++;
      }
    }

    // ── 컨테이너 조립 ─────────────────────────────────────────────────────────
    const items: Phaser.GameObjects.GameObject[] = [
      panelBg, panelBlockZone,
      handleGraphics, handleText, handleZone,
      leftTitleTxt, charNameTxt, statG, ...statTexts,
      equipG, ...equipTexts,
      deckTitleTxt, ...deckCards,
    ];
    if (charImg) items.push(charImg);
    this.deckWindowContainer.add(items);

    // ── 토글 ──────────────────────────────────────────────────────────────────
    let isPanelOpen = false;
    const closedY   = height - DECK_PANEL_HANDLE_H;
    const openY     = 0;

    const togglePanel = (toOpen: boolean) => {
      isPanelOpen = toOpen;
      handleText.setText(`${deckText} ${isPanelOpen ? '▼' : '▲'}`);
      this.tweens.add({
        targets: this.deckWindowContainer,
        y: isPanelOpen ? openY : closedY,
        duration: 350,
        ease: 'Cubic.easeOut',
      });
    };

    handleZone.on('pointerdown', () => togglePanel(!isPanelOpen));
    handleZone.on('pointerover', () => this.drawHandleGraphics(handleGraphics, handleX, handleY, DECK_COLOR_GOLD_HVR));
    handleZone.on('pointerout',  () => this.drawHandleGraphics(handleGraphics, handleX, handleY, DECK_COLOR_GOLD));
  }

  /** 핸들 그래픽 (re)draw 헬퍼 */
  private drawHandleGraphics(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number) {
    g.clear();
    g.fillStyle(color, 1);
    g.fillRoundedRect(x, y, DECK_PANEL_HANDLE_W, DECK_PANEL_HANDLE_H, HANDLE_RADIUS);
  }

  private showCardDetailPopup(cardData: CardData) {
    const { width, height } = this.scale;
    const popX = Math.round(width / 2);
    const popY = Math.round(height / 2);

    const popup = this.add.container(popX, popY).setDepth(200);
    this.cameras.main.ignore(popup); // MainScene uiCam에서 이미 그려짐

    // ── 딤 배경 ──
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.85);
    dim.fillRect(-popX, -popY, width, height);
    dim.setInteractive(new Phaser.Geom.Rectangle(-popX, -popY, width, height), Phaser.Geom.Rectangle.Contains);
    dim.on('pointerdown', () => popup.destroy());
    popup.add(dim);

    const PREVIEW_SCALE = 2.2;
    // ── 카드 미리보기 ──
    const previewCard = new Card(this, (-CARD_WIDTH / 2) * PREVIEW_SCALE, (-CARD_HEIGHT / 2) * PREVIEW_SCALE, cardData);
    previewCard.setScale(PREVIEW_SCALE);
    popup.add(previewCard);

    // 닫기 안내 텍스트
    const close = this.add.text(0, (CARD_HEIGHT / 2) * PREVIEW_SCALE + 30, '닫기 (여백 클릭)', {
      fontFamily: 'SBAggroM', fontSize: '18px', color: '#aaaaaa',
    }).setOrigin(0.5);
    popup.add(close);

    // 등장 효과
    popup.setScale(0.8);
    popup.setAlpha(0);
    this.tweens.add({ targets: popup, scale: 1, alpha: 1, duration: 250, ease: 'Back.easeOut' });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 일시정지 메뉴
  // ─────────────────────────────────────────────────────────────────────────────

  private togglePauseMenu(width: number, height: number) {
    if (this.isMoving) return;
    if (this.isPaused) {
      this.isPaused = false;
      this.pauseMenuContainer?.destroy();
      return;
    }
    this.isPaused = true;

    // uiCam(zoom=1, 고정) 기준 화면 중앙에 배치하고, cameras.main은 렌더링에서 제외
    this.pauseMenuContainer = this.add.container(width / 2, height / 2);
    this.pauseMenuContainer.setDepth(100);
    this.cameras.main.ignore(this.pauseMenuContainer);

    // 딤 배경 (넉넉하게 화면 전체 덮기)
    const bgW     = width * 3;
    const bgH     = height * 3;
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.7);
    backdrop.fillRect(-bgW / 2, -bgH / 2, bgW, bgH);
    backdrop.setInteractive(
      new Phaser.Geom.Rectangle(-bgW / 2, -bgH / 2, bgW, bgH),
      Phaser.Geom.Rectangle.Contains,
    );

    const titleText = this.add.text(0, -120, i18n.t('pause'), {
      fontFamily: 'SBAggroB', fontSize: '48px', color: '#ffffff',
    }).setOrigin(0.5);

    const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fixedWidth: 140, fixedHeight: 100,
      fontFamily: 'SBAggroM', fontSize: '20px',
      color: '#e6d8b8', backgroundColor: '#222222',
      align: 'center', padding: { top: 15, left: 5, right: 5 },
    };

    const helpBtn = this.createPauseButton(-160, 20, `?\n\n${i18n.t('help')}`, btnStyle, () => {
      this.tweens.add({ targets: helpBtn, scale: 0.9, yoyo: true, duration: 100 });
      console.log('도움말 클릭됨');
    });

    const resumeBtn = this.createPauseButton(0, 20, `▶\n\n${i18n.t('resume')}`, btnStyle, () => {
      this.isPaused = false;
      this.pauseMenuContainer.destroy();
    });

    const mainMenuBtn = this.createPauseButton(160, 20, `⌂\n\n${i18n.t('mainMenu')}`, btnStyle, () => {
      this.isPaused = false;
      this.scene.start('IntroScene');
    });

    this.pauseMenuContainer.add([backdrop, titleText, helpBtn, resumeBtn, mainMenuBtn]);
  }

  /** 일시정지 메뉴 공통 버튼 팩토리 */
  private createPauseButton(
    x: number, y: number, label: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    onDown: () => void,
  ): Phaser.GameObjects.Text {
    const btn = this.add.text(x, y, label, style)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerdown', onDown);
    btn.on('pointerover', () => btn.setColor('#ffdb58').setScale(1.05));
    btn.on('pointerout',  () => btn.setColor('#e6d8b8').setScale(1));
    return btn;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 노드 비주얼 업데이트
  // ─────────────────────────────────────────────────────────────────────────────

  private updateNodesVisibility(
    allNodes: MapNode[],
    nodeSpritesMap: Map<number, NodeSprite>,
    redrawPaths = false,
  ) {
    const currentNode = allNodes.find(n => n.id === this.currentNodeId);
    if (!currentNode) return;

    const currentLayer = currentNode.layer;

    allNodes.forEach(node => {
      const sprite = nodeSpritesMap.get(node.id);
      if (!sprite || node.layer === 0) return;
      if (!(sprite instanceof Phaser.GameObjects.Sprite)) return;

      if (node.layer <= currentLayer && node.id !== this.currentNodeId) {
        sprite.setAlpha(0.3).setScale(NODE_SCALE_PASSED).setTint(0x888888);
      } else if (node.id === this.currentNodeId) {
        sprite.setAlpha(1).setScale(NODE_SCALE_DEFAULT).clearTint();
      } else if (node.layer === currentLayer + 1 && currentNode.nextNodes.includes(node.id)) {
        this.tweens.killTweensOf(sprite);
        sprite.setAlpha(1).setScale(NODE_SCALE_DEFAULT).clearTint();
      } else {
        sprite.setAlpha(0.6).setScale(NODE_SCALE_INACTIVE).clearTint();
        this.tweens.killTweensOf(sprite);
      }
    });

    if (redrawPaths) {
      this.redrawActivePaths(currentNode, allNodes);
    }
  }

  /** 현재 노드 → 진행 가능 노드 경로 강조 (흰색 글로우 이중 레이어) */
  private redrawActivePaths(currentNode: MapNode, allNodes: MapNode[]) {
    const g = this.activePathsGraphics;
    g.clear();

    currentNode.nextNodes.forEach(nextId => {
      const next = allNodes.find(n => n.id === nextId);
      if (!next) return;

      const cy1   = currentNode.y + (next.y - currentNode.y) * 0.35;
      const cy2   = next.y - (next.y - currentNode.y) * 0.35;
      const dist  = Phaser.Math.Distance.Between(currentNode.x, currentNode.y, next.x, next.y);
      const steps = Math.max(2, Math.round(dist / PATH_DOT_INTERVAL));

      // 1패스: 외곽 글로우 (큰 반지름, 낮은 투명도)
      g.fillStyle(0xffffff, 0.25);
      for (let i = 1; i < steps; i++) {
        const t  = i / steps;
        const mt = 1 - t;
        const px = mt*mt*mt*currentNode.x + 3*mt*mt*t*currentNode.x + 3*mt*t*t*next.x + t*t*t*next.x;
        const py = mt*mt*mt*currentNode.y + 3*mt*mt*t*cy1           + 3*mt*t*t*cy2    + t*t*t*next.y;
        g.fillCircle(px, py, 6);
      }

      // 2패스: 중심 코어 (작은 반지름, 완전 불투명 흰색)
      g.fillStyle(0xffffff, 1);
      for (let i = 1; i < steps; i++) {
        const t  = i / steps;
        const mt = 1 - t;
        const px = mt*mt*mt*currentNode.x + 3*mt*mt*t*currentNode.x + 3*mt*t*t*next.x + t*t*t*next.x;
        const py = mt*mt*mt*currentNode.y + 3*mt*mt*t*cy1           + 3*mt*t*t*cy2    + t*t*t*next.y;
        g.fillCircle(px, py, 2.5);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 플레이어 이동
  // ─────────────────────────────────────────────────────────────────────────────

  private movePlayer(targetX: number, targetY: number, targetNode?: MapNode) {
    if (!this.playerToken) return;
    this.isMoving = true;
    this.tweens.killTweensOf(this.playerToken);

    const cam    = this.cameras.main;
    const liftMs = 280;
    const dropMs = 340;
    const midX   = (this.playerToken.x + targetX) / 2;
    const midY   = (this.playerToken.y + targetY) / 2 - 45; // 호(arc) 정점

    cam.startFollow(this.playerToken, true, 0.12, 0.12);

    // 1단계: 들어올리기 — 포물선 정점으로 부드럽게 상승
    this.tweens.add({
      targets: this.playerToken,
      x: midX, y: midY,
      scaleX: TOKEN_SCALE_LIFT, scaleY: TOKEN_SCALE_LIFT,
      duration: liftMs,
      ease: 'Sine.easeOut',
      onComplete: () => {

        // 2단계: 내려놓기 — 중력감 있게 목적지로 낙하
        this.tweens.add({
          targets: this.playerToken,
          x: targetX, y: targetY,
          scaleX: TOKEN_SCALE_IDLE, scaleY: TOKEN_SCALE_IDLE,
          duration: dropMs,
          ease: 'Quad.easeIn',
          onComplete: () => {

            // 3단계: 착지 squash — 납작해졌다가 원복
            this.tweens.add({
              targets: this.playerToken,
              scaleX: TOKEN_SCALE_IDLE * 1.35,
              scaleY: TOKEN_SCALE_IDLE * 0.72,
              duration: 75,
              ease: 'Sine.easeOut',
              yoyo: true,
              onComplete: () => {
                this.playerToken.setScale(TOKEN_SCALE_IDLE);
                cam.startFollow(this.playerToken, true, 0.1, 0.1);
                this.isMoving = false;
                if (targetNode && targetNode.layer > 0) {
                  // tween 콜백 내에서 scene.pause() 호출 시 Phaser 내부 상태 충돌 방지 —
                  // 다음 틱으로 미뤄서 TweenManager 처리 루프가 완료된 후 실행
                  this.time.delayedCall(1, () => this.triggerNodeEvent(targetNode));
                }
              },
            });
          },
        });
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 맵 생성 (시드 기반)
  // ─────────────────────────────────────────────────────────────────────────────

  /** 해시 기반 LCG 시드 난수 생성기 반환 */
  private buildSeededRandom(hash: string) {
    let seed = 0;
    for (let i = 0; i < hash.length; i++) {
      seed = ((seed << 5) - seed) + hash.charCodeAt(i);
      seed |= 0;
    }
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      if (seed < 0) seed += 233280;
      return seed / 233280;
    };
    const randInt = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
    return { random, randInt };
  }

  /** 해시값을 기반으로 항상 동일한 맵 데이터를 생성 */
  private generateMapData(hash: string, width: number, height: number): MapNode[][] {
    const { random, randInt } = this.buildSeededRandom(hash);

    const mapLayersData: MapNode[][] = [];
    let nodeId = 0;
    const layerSpacingY = (height - 600) / (MAP_NUM_LAYERS - 1);
    const isEdgeLayer   = (l: number) => l === 0 || l === MAP_NUM_LAYERS - 1;

    // ── 중간 레이어 행 그룹 사전 결정 ──────────────────────────────────────────
    // 레이어 1 ~ MAP_NUM_LAYERS-2 를 2개씩 묶어 페어링.
    // 각 페어에서 한 행은 반드시 전투(그룹A), 나머지 한 행은 비전투(그룹B or C).
    // 페어 내 순서(어느 레이어가 전투인지)는 seeded 랜덤.
    const intermediateLayers = MAP_NUM_LAYERS - 2; // 레이어 1..MAP_NUM_LAYERS-2
    const layerGroupAssign: Array<number[]> = new Array(MAP_NUM_LAYERS);
    const battleGroup  = NODE_TYPE_GROUPS[0];
    const nonBattleGroups = NODE_TYPE_GROUPS.slice(1);

    for (let pair = 0; pair < Math.ceil(intermediateLayers / 2); pair++) {
      const la = 1 + pair * 2;
      const lb = la + 1;
      // 이 페어의 비전투 그룹 (B 또는 C 중 랜덤)
      const nbGroup = nonBattleGroups[randInt(0, nonBattleGroups.length - 1)];
      // 어느 쪽이 전투인지 랜덤
      if (randInt(0, 1) === 0) {
        layerGroupAssign[la] = battleGroup;
        if (lb < MAP_NUM_LAYERS - 1) layerGroupAssign[lb] = nbGroup;
      } else {
        layerGroupAssign[la] = nbGroup;
        if (lb < MAP_NUM_LAYERS - 1) layerGroupAssign[lb] = battleGroup;
      }
    }

    // seeded Fisher-Yates 셔플 헬퍼
    const shuffled = (arr: number[]) => {
      const pool = [...arr];
      for (let j = pool.length - 1; j > 0; j--) {
        const k = Math.floor(random() * (j + 1));
        [pool[j], pool[k]] = [pool[k], pool[j]];
      }
      return pool;
    };

    // 행 내 중복 없이 numNodes 개 뽑기 (그룹 크기 < numNodes 이면 두 번 채워 보충)
    const pickUniqueFromGroup = (group: number[], numNodes: number): number[] => {
      const pool = shuffled(group);
      while (pool.length < numNodes) pool.push(...shuffled(group));
      return pool.slice(0, numNodes);
    };

    // 레이어별 노드 생성
    for (let layer = 0; layer < MAP_NUM_LAYERS; layer++) {
      const y        = height - 200 - layer * layerSpacingY;
      const numNodes = isEdgeLayer(layer) ? 1 : randInt(2, 3);
      const spacingX = width / (numNodes + 1);
      const nodes: MapNode[] = [];

      const isBossLayer = layer === MAP_NUM_LAYERS - 1;

      // 이 레이어의 노드 타입 목록을 미리 계산 (중복 없도록)
      let layerTypes: number[] | null = null;
      if (!isEdgeLayer(layer) && !isBossLayer) {
        layerTypes = pickUniqueFromGroup(layerGroupAssign[layer], numNodes);
      }

      for (let i = 0; i < numNodes; i++) {
        let nodeType: number;
        if (layer === 0) {
          nodeType = 0;
        } else if (isBossLayer) {
          const bossTypes: Record<string, number> = { water: 11, fire: 12, grass: 13, lightning: 15, earth: 16 };
          nodeType = bossTypes[this.currentMapElement] ?? 11;
        } else {
          nodeType = layerTypes![i];
        }

        nodes.push({
          id: nodeId++,
          layer,
          x: spacingX * (i + 1) + randInt(-40, 40),
          y: y + (isEdgeLayer(layer) ? 0 : randInt(-20, 20)),
          type: nodeType,
          nextNodes: [],
        });
      }
      mapLayersData.push(nodes);
    }

    // 각 레이어를 x 좌표 기준으로 정렬 → 좌우 교차 방지
    for (const layer of mapLayersData) {
      layer.sort((a, b) => a.x - b.x);
    }

    // 레이어 간 엣지(Edge) 연결
    for (let layer = 0; layer < MAP_NUM_LAYERS - 1; layer++) {
      const cur  = mapLayersData[layer];
      const next = mapLayersData[layer + 1];

      cur.forEach((node, idx) => {
        // cur 1개면 center로 매핑, 그 외엔 비율 기반
        const ratio   = cur.length === 1 ? 0.5 : idx / (cur.length - 1);
        const baseIdx = Math.round(ratio * (next.length - 1));

        // 주 연결
        node.nextNodes.push(next[baseIdx].id);

        // 보조 연결: 항상 추가, baseIdx ±1 인접만 허용 (wrap-around 없음)
        if (next.length > 1) {
          const candidates: number[] = [];
          if (baseIdx > 0)               candidates.push(baseIdx - 1);
          if (baseIdx < next.length - 1) candidates.push(baseIdx + 1);

          if (candidates.length > 0) {
            const best = candidates.reduce((a, b) =>
              Math.abs(next[a].x - node.x) < Math.abs(next[b].x - node.x) ? a : b,
            );
            if (!node.nextNodes.includes(next[best].id)) {
              node.nextNodes.push(next[best].id);
            }
          }
        }
      });

      // 고립 노드 방어: x 거리 기준 가장 가까운 cur 노드에 연결
      next.forEach(nextNode => {
        const isLinked = cur.some(n => n.nextNodes.includes(nextNode.id));
        if (isLinked) return;

        const closestIdx = cur.reduce((best, _, ci) =>
          Math.abs(cur[ci].x - nextNode.x) < Math.abs(cur[best].x - nextNode.x) ? ci : best, 0,
        );
        if (!cur[closestIdx].nextNodes.includes(nextNode.id)) {
          cur[closestIdx].nextNodes.push(nextNode.id);
        }
      });
    }

    return mapLayersData;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 노드 이벤트 트리거
  // ─────────────────────────────────────────────────────────────────────────────

  private triggerNodeEvent(node: MapNode) {
    this.isPaused = true;
    this.scene.pause();
    this.scene.launch('NodeEventScene', {
      nodeType:        node.type,
      mapElement:      this.currentMapElement,
      nodeId:          node.id,
      currentGold:     this.legacyGold,
      playerHp:        this.playerHp,
      playerMaxHp:     this.playerMaxHp,
      playerAtk:       this.playerAtk,
      playerDef:       this.playerDef,
      playerCrit:      this.playerCrit,
      playerCritDmg:   this.playerCritDmg,
      playerCardMult:  this.playerCardMult,
      playerShieldMult:this.playerShieldMult,
      playerEquipment: [...this.playerEquipment],
      maxEquipSlots:   this.maxEquipSlots,
      characterWeapon: this.character?.weapon ?? 'swordShield',
      deck:            this.playerDeck.map(e => ({ cardId: e.card.id, count: e.count, mult: this.cardMultipliers[e.card.id] || 1.0 })),
    });

    this.game.events.once('nodeEventComplete', (result: Record<string, unknown>) => {
      let persistentChanged = false; // 골드/장비 변경 여부 추적

      if (typeof result.goldDelta    === 'number') {
        this.legacyGold    = Math.max(0, this.legacyGold + result.goldDelta);
        if (result.goldDelta !== 0) persistentChanged = true;
      }
      if (typeof result.hpDelta      === 'number') this.playerHp      = Math.max(0, Math.min(this.playerMaxHp, this.playerHp + result.hpDelta));
      if (typeof result.maxHpDelta   === 'number') this.playerMaxHp   = Math.max(1, this.playerMaxHp + result.maxHpDelta);
      if (typeof result.atkDelta     === 'number') this.playerAtk     = Math.max(0, this.playerAtk + result.atkDelta);
      if (typeof result.defDelta     === 'number') this.playerDef     = Math.max(0, this.playerDef + result.defDelta);
      if (typeof result.critDelta    === 'number') this.playerCrit    = Math.min(100, Math.max(0, this.playerCrit + result.critDelta));
      if (typeof result.critDmgDelta === 'number') this.playerCritDmg = Math.max(1, this.playerCritDmg + result.critDmgDelta);
      if (typeof result.equipment === 'string') {
        const newEquip   = result.equipment as string;
        const replaceOld = result.replaceEquipment as string | undefined;
        if (replaceOld) {
          const idx = this.playerEquipment.indexOf(replaceOld);
          if (idx >= 0) this.playerEquipment[idx] = newEquip;
        } else if (this.playerEquipment.length < this.maxEquipSlots) {
          this.playerEquipment.push(newEquip);
        }
        persistentChanged = true;
      }

      // 덱 카드 변경 이벤트 처리
      if (typeof result.swapFrom === 'string' && typeof result.swapTo === 'string') {
        this.swapDeckElement(result.swapFrom, result.swapTo);
      }
      if (typeof result.starUpElement === 'string') {
        this.starUpDeckCard(result.starUpElement);
      }
      if (typeof result.upgradeStarCardId === 'number') {
        this.starUpDeckCardById(result.upgradeStarCardId);
      }
      if (typeof result.pokerCard === 'number' && result.pokerCard > 0) {
        this.addPokerCard(result.pokerCard);
      }
      if (typeof result.cardValueMultiplier === 'number') {
        this.playerCardMult = parseFloat((this.playerCardMult * result.cardValueMultiplier).toFixed(4));
      }
      if (typeof result.shieldMultiplier === 'number') {
        this.playerShieldMult = parseFloat((this.playerShieldMult * result.shieldMultiplier).toFixed(4));
      }
      if (typeof result.upgradeCardId === 'number' && typeof result.upgradeCardMult === 'number') {
        const cid = result.upgradeCardId as number;
        this.cardMultipliers[cid] = (this.cardMultipliers[cid] || 1.0) * (result.upgradeCardMult as number);
      }

      // 게임 오버 체크
      if (this.playerHp <= 0) {
        this.saveLegacyData(node.layer).then(() => {
          this.clearSaveAndReturn();
        });
        return;
      }

      this.saveGameState();
      // 골드/장비 변경 시 legacy.json에도 즉시 반영 (런 종료 후에도 보존)
      if (persistentChanged) this.savePersistentData();
      this.refreshDeckPanel(); // 스탯(HP 포함) 및 덱 UI 항상 최신화
      this.isPaused = false;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 덱 조작 헬퍼
  // ─────────────────────────────────────────────────────────────────────────────

  /** 원소 오프셋: water=0, fire=5, grass=10, lightning=15, earth=20 */
  private readonly ELEM_OFFSET: Record<string, number> = {
    water: 0, fire: 5, grass: 10, lightning: 15, earth: 20,
  };

  /** 카드 속성 전체 교환 (swapFrom 속성의 모든 카드를 swapTo 속성으로) */
  private swapDeckElement(from: string, to: string) {
    const offFrom = this.ELEM_OFFSET[from];
    const offTo   = this.ELEM_OFFSET[to];
    if (offFrom == null || offTo == null) return;
    this.playerDeck.forEach(entry => {
      if (entry.card.element === from && entry.card.stars >= 1 && entry.card.stars <= 5) {
        entry.card = CARD_DATA_LIST[offTo + entry.card.stars - 1];
      }
    });
    this.refreshDeckPanel();
  }

  /** 선택한 속성 카드 1장의 별 +1 업그레이드 */
  private starUpDeckCard(element: string) {
    const off = this.ELEM_OFFSET[element];
    if (off == null) return;
    const upgradable = this.playerDeck.filter(e => e.card.element === element && e.card.stars < 5);
    if (upgradable.length === 0) return;
    const target  = upgradable[Math.floor(Math.random() * upgradable.length)];
    const newCard = CARD_DATA_LIST[off + target.card.stars]; // stars → stars+1 (offset에 stars 더하면 됨)
    target.count--;
    if (target.count <= 0) {
      this.playerDeck = this.playerDeck.filter(e => e !== target);
    }
    const existing = this.playerDeck.find(e => e.card.id === newCard.id);
    if (existing) existing.count++;
    else this.playerDeck.push({ card: newCard, count: 1 });
    this.refreshDeckPanel();
  }

  /** 지정된 카드의 별 +1 업그레이드 */
  private starUpDeckCardById(cardId: number) {
    const upgradable = this.playerDeck.find(e => e.card.id === cardId);
    if (!upgradable || upgradable.card.stars >= 5) return;
    
    const off = this.ELEM_OFFSET[upgradable.card.element];
    if (off == null) return;

    const newCard = CARD_DATA_LIST[off + upgradable.card.stars]; // stars -> stars+1
    upgradable.count--;
    if (upgradable.count <= 0) {
      this.playerDeck = this.playerDeck.filter(e => e !== upgradable);
    }
    const existing = this.playerDeck.find(e => e.card.id === newCard.id);
    if (existing) existing.count++;
    else this.playerDeck.push({ card: newCard, count: 1 });
    this.refreshDeckPanel();
  }

  /** 인디언 포커 카드 획득: 랜덤 속성 + 지정 별 등급 1장 덱에 추가 */
  private addPokerCard(stars: number) {
    const ELEMS = Object.keys(this.ELEM_OFFSET);
    const el    = ELEMS[Math.floor(Math.random() * ELEMS.length)];
    const newCard = CARD_DATA_LIST[this.ELEM_OFFSET[el] + Math.min(Math.max(stars, 1), 5) - 1];
    const existing = this.playerDeck.find(e => e.card.id === newCard.id);
    if (existing) existing.count++;
    else this.playerDeck.push({ card: newCard, count: 1 });
    this.refreshDeckPanel();
  }

  /** 골드/장비를 legacy.json에 즉시 저장 (런 종료 후에도 보존) */
  private async savePersistentData() {
    // @ts-ignore
    if (typeof require === 'undefined') return;
    try {
      const { ipcRenderer } = require('electron');
      await ipcRenderer.invoke('save-persistent', {
        gold:      this.legacyGold,
        equipment: [...this.playerEquipment],
      });
    } catch (e) {
      console.warn('Persistent 저장 실패', e);
    }
  }

  /** 덱 패널 재생성 (덱 내용 변경 후 호출) */
  private refreshDeckPanel() {
    if (this.deckWindowContainer) this.deckWindowContainer.destroy(true);
    this.createDeckWindow(this.scale.width, this.scale.height);
    this.cameras.main.ignore(this.deckWindowContainer);
  }
}
