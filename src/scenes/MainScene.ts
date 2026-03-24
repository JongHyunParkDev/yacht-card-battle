import Phaser from 'phaser';
import { i18n } from '@src/utils/localization';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const MAP_WORLD_HEIGHT = 2400;
const MAP_NUM_LAYERS   = 12;
const MAP_ZOOM         = 1.1;

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

const TOKEN_SCALE_IDLE = 0.4;
const TOKEN_SCALE_LIFT = 0.6;

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
  private isContinue = false;
  private isPaused   = false;
  private isMoving   = false;
  private currentNodeId = -1;

  // ── 게임 오브젝트 참조 ────────────────────────────────────────────────────────
  private playerToken!: Phaser.GameObjects.Sprite;
  private pauseMenuContainer!: Phaser.GameObjects.Container;
  private deckWindowContainer!: Phaser.GameObjects.Container;

  constructor() {
    super('MainScene');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Phaser 라이프사이클
  // ─────────────────────────────────────────────────────────────────────────────

  /** IntroScene에서 전달된 data를 받습니다 */
  init(data: { isContinue?: boolean }) {
    this.isContinue = data?.isContinue ?? false;
  }

  async create() {
    const { width, height } = this.scale;
    const mapWorldWidth = Math.max(width, 1000);

    this.initCamera(mapWorldWidth);
    this.initBackground(mapWorldWidth);

    const mapHash      = await this.loadOrCreateMapHash();
    const mapLayersData = this.generateMapData(mapHash, mapWorldWidth, MAP_WORLD_HEIGHT);
    const allNodes      = mapLayersData.flat();
    const startNode     = mapLayersData[0][0];

    this.currentNodeId = startNode.id;

    this.drawNodePaths(allNodes);

    const nodeSpritesMap = this.createNodeSprites(allNodes);
    this.updateNodesVisibility(allNodes, nodeSpritesMap);

    this.createPlayerToken(startNode);
    this.setupInput(width, height);

    // 덱 패널 생성 전 월드 오브젝트 목록 스냅샷
    const worldObjects = [...this.children.list];
    this.createDeckWindow(width, height);

    // UI 카메라: zoom=1, scroll=0 → 스크린 좌표 = 월드 좌표 (완전 고정)
    const uiCam = this.cameras.add(0, 0, width, height).setZoom(1);
    uiCam.ignore(worldObjects);
    this.cameras.main.ignore(this.deckWindowContainer);

    // 노드 클릭 이벤트 등록 (allNodes, nodeSpritesMap 클로저로 사용)
    this.registerNodeClickEvents(allNodes, nodeSpritesMap);
  }

  update() { /* 덱 패널은 UI 카메라로 고정 — 매 프레임 positioning 불필요 */ }

  // ─────────────────────────────────────────────────────────────────────────────
  // create() 초기화 세부 메서드
  // ─────────────────────────────────────────────────────────────────────────────

  private initCamera(mapWorldWidth: number) {
    this.cameras.main.setBounds(0, 0, mapWorldWidth, MAP_WORLD_HEIGHT);
    this.cameras.main.setZoom(MAP_ZOOM);
  }

  private initBackground(mapWorldWidth: number) {
    const bg = this.add.image(mapWorldWidth / 2, MAP_WORLD_HEIGHT / 2, 'map_bg');
    bg.setDisplaySize(mapWorldWidth, MAP_WORLD_HEIGHT);
  }

  /** 이어하기면 세이브 파일에서 해시 로드, 없으면 새로 생성 후 저장 */
  private async loadOrCreateMapHash(): Promise<string> {
    if (this.isContinue) {
      const loaded = await this.loadGameFromElectron();
      if (loaded) return loaded;
    }
    return this.createAndSaveNewHash();
  }

  private async loadGameFromElectron(): Promise<string | null> {
    // @ts-ignore
    if (typeof require === 'undefined') return null;
    try {
      const { ipcRenderer } = require('electron');
      const result = await ipcRenderer.invoke('load-game');
      if (result?.success && result.data?.mapHash) {
        console.log('기존 맵 해시 자동 로드 성공(Electron):', result.data.mapHash);
        return result.data.mapHash;
      }
    } catch {
      console.warn('Electron 로드 실패, 새 해시 생성 대기');
    }
    return null;
  }

  private async createAndSaveNewHash(): Promise<string> {
    const mapHash = `stage_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
    console.log('새로운 맵 해시 생성됨:', mapHash);

    // @ts-ignore
    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('save-game', { mapHash });
      } catch (e) {
        console.warn('Electron 세이브 실패', e);
      }
    }
    return mapHash;
  }

  /** 노드 간 점선 경로 그리기 */
  private drawNodePaths(allNodes: MapNode[]) {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.lineStyle(2, 0x000000, 1);

    allNodes.forEach(node => {
      node.nextNodes.forEach(nextId => {
        const nextNode = allNodes.find(n => n.id === nextId);
        if (!nextNode) return;

        const dist     = Phaser.Math.Distance.Between(node.x, node.y, nextNode.x, nextNode.y);
        const dotCount = Math.floor(dist / 20);

        for (let i = 1; i < dotCount; i++) {
          const t = i / dotCount;
          const px = Phaser.Math.Linear(node.x, nextNode.x, t);
          const py = Phaser.Math.Linear(node.y, nextNode.y, t);
          g.fillCircle(px, py, 4);
          g.strokeCircle(px, py, 4);
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
        nodeSpritesMap.set(node.id, dot);
        return;
      }

      const frameName = this.getNodeFrameName(node.type);
      const sprite    = this.add.sprite(node.x, node.y, 'map_nodes', frameName);
      sprite.setScale(NODE_SCALE_DEFAULT);
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
        if (!currentNode) {
          this.cameras.main.shake(100, 0.005);
          return;
        }

        if (currentNode.nextNodes.includes(node.id)) {
          this.movePlayer(node.x, node.y);
          this.currentNodeId = node.id;
          this.updateNodesVisibility(allNodes, nodeSpritesMap);
        } else {
          this.cameras.main.shake(100, 0.005);
        }
      });
    });
  }

  private createPlayerToken(startNode: MapNode) {
    this.playerToken = this.add.sprite(startNode.x, startNode.y, 'map_nodes', 'row4_0');
    this.playerToken.setScale(TOKEN_SCALE_IDLE);
    this.playerToken.setOrigin(0.5, 0.5);
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

  private createDeckWindow(width: number, height: number) {
    // UI 카메라(zoom=1)로 렌더링 → 스크린 좌표 그대로 사용, zoom 보정 불필요
    const panelW  = width;
    const panelH  = height - DECK_PANEL_HANDLE_H;
    const handleX = (panelW - DECK_PANEL_HANDLE_W) / 2;
    const handleY = 0;

    // 초기 위치: 화면 하단 (핸들만 노출된 닫힌 상태)
    this.deckWindowContainer = this.add.container(0, height - DECK_PANEL_HANDLE_H);
    this.deckWindowContainer.setDepth(50);

    // 핸들 배경
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

    // 패널 본체
    const panelBg = this.add.graphics();
    panelBg.fillStyle(DECK_COLOR_BG, 0.95);
    panelBg.lineStyle(2, DECK_COLOR_GOLD, 1);
    panelBg.fillRoundedRect(0, DECK_PANEL_HANDLE_H, panelW, panelH, PANEL_RADIUS);
    panelBg.strokeRoundedRect(0, DECK_PANEL_HANDLE_H, panelW, panelH, PANEL_RADIUS);

    // 맵 터치 방지 투명 영역
    const panelBlockZone = this.add
      .zone(panelW / 2, DECK_PANEL_HANDLE_H + panelH / 2, panelW, panelH)
      .setInteractive();

    // 좌측: 캐릭터 정보
    const leftW      = panelW * 0.4;
    const leftTitle  = this.add.text(leftW / 2, DECK_PANEL_HANDLE_H + 25, '캐릭터 정보', {
      fontFamily: 'SBAggroB', fontSize: '16px', color: '#d4af37',
    }).setOrigin(0.5);
    const leftContent = this.add.text(20, DECK_PANEL_HANDLE_H + 55,
      '• HP: 100/100\n• MP: 50/50\n• 공격력: 15\n• 방어력: 5\n\n(캐릭터 이미지)',
      { fontFamily: 'SBAggroM', fontSize: '14px', color: '#e6d8b8', lineSpacing: 10 },
    );

    // 중앙 구분선
    panelBg.lineStyle(1, 0x666666, 1);
    panelBg.lineBetween(leftW, DECK_PANEL_HANDLE_H + 20, leftW, DECK_PANEL_HANDLE_H + panelH - 20);

    // 우측: 덱 카드 목록
    const rightW      = panelW * 0.6;
    const rightTitle  = this.add.text(leftW + rightW / 2, DECK_PANEL_HANDLE_H + 25, '현재 덱 리스트', {
      fontFamily: 'SBAggroB', fontSize: '16px', color: '#d4af37',
    }).setOrigin(0.5);
    const rightContent = this.add.text(leftW + 20, DECK_PANEL_HANDLE_H + 55,
      '[보유 카드 목록]\n\n• 일반 타격 (비용 1, 피해 6)\n• 일반 방어 (비용 1, 방어도 5)\n• 찌르기 (비용 1, 피해 9)\n• 불꽃 송곳니 (비용 2, 피해 12)\n\n* 실제 덱 정보가 연동될 예정입니다.',
      { fontFamily: 'SBAggroM', fontSize: '14px', color: '#e6d8b8', wordWrap: { width: rightW - 40 }, lineSpacing: 8 },
    );

    this.deckWindowContainer.add([
      panelBg, panelBlockZone,
      handleGraphics, handleText, handleZone,
      leftTitle, leftContent,
      rightTitle, rightContent,
    ]);

    // 패널 토글 애니메이션 — container.y를 스크린 좌표로 직접 트윈
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

  private updateNodesVisibility(allNodes: MapNode[], nodeSpritesMap: Map<number, NodeSprite>) {
    const currentNode = allNodes.find(n => n.id === this.currentNodeId);
    if (!currentNode) return;

    const currentLayer = currentNode.layer;

    allNodes.forEach(node => {
      const sprite = nodeSpritesMap.get(node.id);
      if (!sprite || node.layer === 0) return;
      if (!(sprite instanceof Phaser.GameObjects.Sprite)) return;

      if (node.layer <= currentLayer && node.id !== this.currentNodeId) {
        // 이미 지나간 노드
        sprite.setAlpha(0.3).setScale(NODE_SCALE_PASSED).setTint(0x888888);
      } else if (node.id === this.currentNodeId) {
        // 현재 위치
        sprite.setAlpha(1).setScale(NODE_SCALE_DEFAULT).clearTint();
      } else if (node.layer === currentLayer + 1 && currentNode.nextNodes.includes(node.id)) {
        // 다음 진행 가능 노드
        this.tweens.killTweensOf(sprite);
        sprite.setAlpha(1).setScale(NODE_SCALE_DEFAULT).clearTint();
      } else {
        // 아직 갈 수 없는 미래 노드
        sprite.setAlpha(0.6).setScale(NODE_SCALE_INACTIVE).clearTint();
        this.tweens.killTweensOf(sprite);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 플레이어 이동
  // ─────────────────────────────────────────────────────────────────────────────

  private movePlayer(targetX: number, targetY: number) {
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

  /**
   * 노드 type → 스프라이트 프레임 이름 변환
   *
   * type  0~ 4 : row0_0~4  (일반 아이콘 1행, 5개)
   * type  5~ 9 : row1_0~4  (일반 아이콘 2행, 5개)
   * type 10~12 : row2_0~2  (보스 1단계, 3개)
   * type 13~14 : row3_0~1  (보스 2단계, 2개 – row3_3 최종 보스는 맵 생성에서 제외)
   */
  private getNodeFrameName(type: number): string {
    if (type < 5)  return `row0_${type}`;
    if (type < 10) return `row1_${type - 5}`;
    if (type < 13) return `row2_${type - 10}`;  // row2_0, row2_1, row2_2
    return `row3_${type - 13}`;                  // row3_0, row3_1
  }

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

    // 레이어별 노드 생성
    for (let layer = 0; layer < MAP_NUM_LAYERS; layer++) {
      const y        = height - 200 - layer * layerSpacingY;
      const numNodes = isEdgeLayer(layer) ? 1 : randInt(2, 4);
      const spacingX = width / (numNodes + 1);
      const nodes: MapNode[] = [];

      for (let i = 0; i < numNodes; i++) {
        let nodeType: number;
        if (layer === 0)                       nodeType = 0;
        // 마지막 레이어: 보스 타입 10~14 (row2_0~2, row3_0~1); row3_3(최종 보스)은 제외
        else if (layer === MAP_NUM_LAYERS - 1) nodeType = randInt(10, 14);
        else                                   nodeType = randInt(0, 9);

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

    // 레이어 간 엣지(Edge) 연결
    for (let layer = 0; layer < MAP_NUM_LAYERS - 1; layer++) {
      const cur  = mapLayersData[layer];
      const next = mapLayersData[layer + 1];

      cur.forEach((node, idx) => {
        const ratio   = idx / Math.max(1, cur.length - 1);
        const nextIdx = Math.round(ratio * (next.length - 1));
        node.nextNodes.push(next[nextIdx].id);

        // 30% 확률로 이웃 노드에도 추가 연결
        if (random() < 0.3 && next.length > 1) {
          const extraIdx = (nextIdx + 1) % next.length;
          if (!node.nextNodes.includes(next[extraIdx].id)) {
            node.nextNodes.push(next[extraIdx].id);
          }
        }
      });

      // 고립 노드 방어: 연결되지 않은 다음 레이어 노드를 강제로 연결
      next.forEach((nextNode, nextIdx) => {
        const isLinked = cur.some(n => n.nextNodes.includes(nextNode.id));
        if (isLinked) return;

        const ratio   = nextIdx / Math.max(1, next.length - 1);
        const currIdx = Math.round(ratio * (cur.length - 1));
        if (!cur[currIdx].nextNodes.includes(nextNode.id)) {
          cur[currIdx].nextNodes.push(nextNode.id);
        }
      });
    }

    return mapLayersData;
  }
}
