import Phaser from 'phaser';
import { NODE_TYPE, BOSS_ELEMENT_NAME, isBossType } from '@src/data/nodeTypes';
import type { CardElement } from '@src/data/cardData';

// ─── 이벤트 데이터 타입 ────────────────────────────────────────────────────────

export interface NodeEventData {
  nodeType: number;
  mapElement: CardElement;
  nodeId: number;
  playerGold: number;
  playerHp: number;
  playerMaxHp: number;
  playerAtk: number;
  playerDef: number;
  playerCrit: number;
  playerCritDmg: number;
  playerEquipment: string[];
  maxEquipSlots: number;
}

// ─── 공통 상수 ─────────────────────────────────────────────────────────────────

const COLOR_PANEL = 0x0d1117;
const COLOR_GOLD  = 0xd4af37;

const FONT_B = 'SBAggroB';
const FONT_M = 'SBAggroM';
const FONT_L = 'SBAggroL';

// ─── 씬 ────────────────────────────────────────────────────────────────────────

export default class NodeEventScene extends Phaser.Scene {
  private data_!: NodeEventData;
  private root!: Phaser.GameObjects.Container;

  /** 화면 너비 / 높이 (create 시 저장) */
  private W = 0;
  private H = 0;

  constructor() { super('NodeEventScene'); }

  init(data: NodeEventData) { this.data_ = data; }

  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;

    // 입력 차단 + 전체화면 패널 배경 (불투명 — 맵이 보이지 않도록)
    const bg = this.add.graphics();
    bg.fillStyle(COLOR_PANEL, 1);
    bg.lineStyle(2, COLOR_GOLD, 0.8);
    bg.fillRect(0, 0, this.W, this.H);
    bg.strokeRect(4, 4, this.W - 8, this.H - 8);
    bg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, this.W, this.H),
      Phaser.Geom.Rectangle.Contains,
    );

    // 컨테이너는 화면 중심 기준
    this.root = this.add.container(this.W / 2, this.H / 2);

    const { nodeType } = this.data_;

    if      (nodeType === NODE_TYPE.SKULL || nodeType === NODE_TYPE.SWORD) this.createBattleEvent();
    else if (nodeType === NODE_TYPE.ENHANCE)      this.createEnhanceEvent();
    else if (nodeType === NODE_TYPE.TREASURE)     this.createTreasureEvent();
    else if (nodeType === NODE_TYPE.CARD_FLIP)    this.createCardFlipEvent();
    else if (nodeType === NODE_TYPE.CARD_SWAP)    this.createCardSwapEvent();
    else if (nodeType === NODE_TYPE.HEART)        this.createHeartEvent();
    else if (nodeType === NODE_TYPE.SHIELD_UP)    this.createShieldEvent();
    else if (nodeType === NODE_TYPE.STAR_UP)      this.createStarEvent();
    else if (nodeType === NODE_TYPE.INDIAN_POKER) this.createIndianPokerEvent();
    else if (isBossType(nodeType))                this.createBossEvent();
    else                                          this.closeEvent({});
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 공통 UI 헬퍼 (root 기준 상대 좌표)
  // ─────────────────────────────────────────────────────────────────────────────

  /** root 중심 기준 구분선 */
  private makeDivider(y: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.lineStyle(1, COLOR_GOLD, 0.3);
    g.lineBetween(-this.W * 0.4, y, this.W * 0.4, y);
    return g;
  }

  /** 타이틀 텍스트 */
  private makeTitle(text: string, y: number, color = '#d4af37'): Phaser.GameObjects.Text {
    return this.add.text(0, y, text, {
      fontFamily: FONT_B, fontSize: '34px', color,
    }).setOrigin(0.5);
  }

  /**
   * 노드 아이콘(map_nodes 프레임) + 타이틀 텍스트를 하나의 Container로 반환.
   * frame 예: 'row0_0', 'row1_2', 'row2_0' 등
   */
  private makeHeader(
    frame: string, text: string, y: number,
    iconSize = 64, color = '#d4af37',
  ): Phaser.GameObjects.Container {
    const cont = this.add.container(0, y);
    // 아이콘 + 텍스트를 임시로 그려서 실제 너비 측정 후 중앙 정렬
    const txt = this.add.text(0, 0, text, {
      fontFamily: FONT_B, fontSize: '32px', color,
    }).setOrigin(0, 0.5);
    const gap  = 14;
    const totalW = iconSize + gap + txt.width;
    const startX = -totalW / 2;
    const icon = this.add.image(startX + iconSize / 2, 0, 'map_nodes', frame);
    icon.setDisplaySize(iconSize, iconSize);
    txt.setX(startX + iconSize + gap);
    cont.add([icon, txt]);
    return cont;
  }

  /**
   * 속성 아이콘(attr_icons 프레임) 이미지를 반환.
   * attrIndex: 0=물 1=불 2=풀 3=번개 4=땅 5=일반 6=별
   */
  private makeAttrIcon(attrIndex: number, x: number, y: number, size = 48): Phaser.GameObjects.Image {
    const img = this.add.image(x, y, 'attr_icons', `attr_${attrIndex}`);
    img.setDisplaySize(size, size);
    return img;
  }

  /** 본문 텍스트 */
  private makeBody(text: string, y: number): Phaser.GameObjects.Text {
    return this.add.text(0, y, text, {
      fontFamily: FONT_M, fontSize: '18px', color: '#cccccc',
      wordWrap: { width: this.W * 0.7 }, align: 'center',
    }).setOrigin(0.5);
  }

  /** 버튼 */
  private makeButton(
    x: number, y: number, label: string,
    bgColor: number, onDown: () => void,
    w?: number, h = 54,
  ): Phaser.GameObjects.Container {
    const bw  = w ?? Math.round(this.W * 0.18);
    const btn = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 1);
    bg.lineStyle(1, COLOR_GOLD, 0.6);
    bg.fillRoundedRect(-bw / 2, -h / 2, bw, h, 10);
    bg.strokeRoundedRect(-bw / 2, -h / 2, bw, h, 10);

    const txt = this.add.text(0, 0, label, {
      fontFamily: FONT_M, fontSize: '20px', color: '#ffffff',
      wordWrap: { width: bw - 20 }, align: 'center',
    }).setOrigin(0.5);

    btn.add([bg, txt]);
    btn.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -h / 2, bw, h), Phaser.Geom.Rectangle.Contains);
    btn.on('pointerover', () => txt.setColor('#ffdb58').setScale(1.05));
    btn.on('pointerout',  () => txt.setColor('#ffffff').setScale(1));
    btn.on('pointerdown', onDown);
    return btn;
  }

  /** 이벤트 종료 */
  private closeEvent(result: Record<string, unknown>) {
    this.game.events.emit('nodeEventComplete', { ...result, nodeId: this.data_.nodeId });
    this.scene.stop();
    this.scene.resume('MainScene');
  }

  private elementName(el: string): string {
    const map: Record<string, string> = {
      water: '물', fire: '불', grass: '풀', lightning: '번개', earth: '땅', normal: '무속성',
    };
    return map[el] ?? el;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1·2 — 전투 이벤트
  // ─────────────────────────────────────────────────────────────────────────────

  private createBattleEvent() {
    const { nodeType, mapElement, playerHp, playerMaxHp, playerAtk, playerDef, playerCrit } = this.data_;
    const isElemental = nodeType === NODE_TYPE.SWORD;

    const H = this.H;
    const ATTR_IDX: Record<string, number> = { water:0, fire:1, grass:2, lightning:3, earth:4, normal:5 };
    const titleFrame = isElemental ? 'row0_1' : 'row0_0';
    const titleText  = isElemental ? `[${this.elementName(mapElement)}] 속성 몬스터 출현!` : '무속성 몬스터 출현!';
    const title = this.makeHeader(titleFrame, titleText, -H * 0.30);

    const mobName = isElemental ? this.randomElementalMobName(mapElement) : this.randomNormalMobName();

    // 몬스터 이름 + 속성 아이콘을 하나의 컨테이너로 중앙 정렬
    const mobRow = this.add.container(0, -H * 0.16);
    const mobText = this.add.text(0, 0, mobName, {
      fontFamily: FONT_B, fontSize: '28px', color: '#ff8888',
    }).setOrigin(0.5);
    if (isElemental) {
      const iconSize = 36;
      const gap = 10;
      const totalW = mobText.width + gap + iconSize;
      mobText.setX(-iconSize / 2 - gap / 2);
      const icon = this.makeAttrIcon(ATTR_IDX[mapElement] ?? 5, mobText.x + mobText.width / 2 + gap + iconSize / 2, 0, iconSize);
      mobRow.add([mobText, icon]);
      void totalW; // suppress unused
    } else {
      mobRow.add(mobText);
    }

    const divider = this.makeDivider(-H * 0.08);

    const descText = this.makeBody(
      isElemental
        ? `현재 맵 속성(${this.elementName(mapElement)}) 몬스터와 전투합니다.\n속성 유불리에 따라 데미지가 달라집니다.`
        : '일반 속성 몬스터와 전투합니다.',
      H * 0.02,
    );

    const statsText = this.add.text(0, H * 0.14,
      `HP ${playerHp}/${playerMaxHp}   공격 ${playerAtk}   방어 ${playerDef}   치명 ${playerCrit}%`,
      { fontFamily: FONT_L, fontSize: '15px', color: '#aaaaaa' },
    ).setOrigin(0.5);

    const battleBtn = this.makeButton(0, H * 0.28, '전투 시작', 0x8b0000, () => {
      this.closeEvent({ battleResult: 'win', mobName });
    }, Math.round(this.W * 0.25), 60);

    this.root.add([title, mobRow, divider, descText, statsText, battleBtn]);
  }

  private randomNormalMobName() {
    const n = ['고블린', '스켈레톤', '슬라임', '좀비', '배트', '쥐떼', '독충'];
    return n[Math.floor(Math.random() * n.length)];
  }

  private randomElementalMobName(el: string) {
    const m: Record<string, string[]> = {
      water:     ['물의 정령', '해파리 마법사', '얼음 기사'],
      fire:      ['화염 정령', '마그마 골렘', '불꽃 도깨비'],
      grass:     ['숲의 정령', '독초 마녀', '덩굴 골렘'],
      lightning: ['번개 정령', '전기 박쥐', '폭풍 마도사'],
      earth:     ['땅의 정령', '바위 거인', '모래 무사'],
    };
    const list = m[el] ?? ['정체불명의 몬스터'];
    return list[Math.floor(Math.random() * list.length)];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3 — 강화 이벤트
  // ─────────────────────────────────────────────────────────────────────────────

  private createEnhanceEvent() {
    const H = this.H;
    const W = this.W;
    const { playerMaxHp, playerCrit, playerCritDmg, playerDef, playerAtk } = this.data_;

    const passives = [
      { name: '강철 의지',     desc: `최대 HP +10  (현재 ${playerMaxHp} → ${playerMaxHp + 10})`,             result: { maxHpDelta: 10 } },
      { name: '예리한 감각',   desc: `치명 확률 +5%  (현재 ${playerCrit}% → ${playerCrit + 5}%)`,             result: { critDelta: 5 } },
      { name: '전투 광기',     desc: `치명 배율 +0.2×  (현재 ${playerCritDmg.toFixed(1)}× → ${(playerCritDmg + 0.2).toFixed(1)}×)`, result: { critDmgDelta: 0.2 } },
      { name: '철벽 방어',     desc: `방어력 +3  (현재 ${playerDef} → ${playerDef + 3})`,                     result: { defDelta: 3 } },
      { name: '날카로운 본능', desc: `공격력 +5  (현재 ${playerAtk} → ${playerAtk + 5})`,                     result: { atkDelta: 5 } },
    ];

    const title   = this.makeHeader('row0_2', '패시브 강화', -H * 0.38);
    const desc    = this.makeBody('하나를 선택하여 영구 강화합니다.\n또는 10G를 받고 지나칩니다.', -H * 0.29);
    const divider = this.makeDivider(-H * 0.22);

    // 구분선(-H*0.22) 아래에서 버튼 시작
    const BTN_SPACING = H * 0.10;
    const startY = -H * 0.17;
    const btns = passives.map((p, i) =>
      this.makeButton(
        0, startY + i * BTN_SPACING,
        `${p.name}  |  ${p.desc}`,
        0x1a3a1a, () => this.closeEvent(p.result),
        Math.round(W * 0.60), 48,
      ),
    );

    const lastBtnY = startY + (passives.length - 1) * BTN_SPACING;
    const skipBtn = this.makeButton(0, lastBtnY + BTN_SPACING * 0.85, '그냥 지나침  (+10G)', 0x3a3000, () => {
      this.closeEvent({ goldDelta: 10 });
    }, Math.round(W * 0.30), 44);

    this.root.add([title, desc, divider, ...btns, skipBtn]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4 — 보물 이벤트
  // ─────────────────────────────────────────────────────────────────────────────

  private createTreasureEvent() {
    const H = this.H;
    const W = this.W;
    const { playerEquipment, maxEquipSlots } = this.data_;
    const isFull = playerEquipment.length >= maxEquipSlots;

    const equipPool = [
      { label: '불꽃의 반지   — 불 속성 공격 +20%',       result: { equipment: '불꽃의 반지' } },
      { label: '바다의 부적   — 물 속성 방어 +15%',       result: { equipment: '바다의 부적' } },
      { label: '번개 팔찌     — 공격 시 번개 추가타 10%', result: { equipment: '번개 팔찌' } },
      { label: '대지의 목걸이 — 최대 HP +15',             result: { equipment: '대지의 목걸이', maxHpDelta: 15 } },
      { label: '폭풍의 망토   — 풀 속성 크리티컬 +8%',   result: { equipment: '폭풍의 망토' } },
      { label: '용의 비늘     — 전체 방어력 +5',          result: { equipment: '용의 비늘', defDelta: 5 } },
    ];
    const drawn = Phaser.Utils.Array.Shuffle([...equipPool]).slice(0, 3);

    const slotText = `장비 칸: ${playerEquipment.length} / ${maxEquipSlots}`;
    const title   = this.makeHeader('row0_3', '보물 상자', -H * 0.35);
    const slotLbl = this.add.text(0, -H * 0.27, slotText, {
      fontFamily: FONT_M, fontSize: '16px',
      color: isFull ? '#e74c3c' : '#aaaaaa',
    }).setOrigin(0.5);
    const desc    = this.makeBody(
      isFull ? '장비 칸이 가득 찼습니다.\n획득 시 기존 장비 중 하나와 교체합니다.' : '장비 3개 중 1개를 선택합니다.\n또는 10G를 받고 지나칩니다.',
      -H * 0.21,
    );
    const divider = this.makeDivider(-H * 0.14);

    // 장비 선택 → 슬롯 가득 차면 교체 화면으로 전환
    const pickEquip = (item: typeof drawn[0]) => {
      if (!isFull) {
        this.closeEvent(item.result);
        return;
      }
      // 교체 화면: 기존 장비 목록을 보여주고 교체할 것 선택
      this.root.removeAll(true);

      const replaceTitle = this.makeTitle('🔄 교체할 장비를 선택하세요', -H * 0.32);
      const newLbl       = this.add.text(0, -H * 0.22, `새 장비: ${item.label}`, {
        fontFamily: FONT_M, fontSize: '16px', color: '#f5cc4a',
      }).setOrigin(0.5);
      const divider2 = this.makeDivider(-H * 0.16);

      const replaceBtns = playerEquipment.map((eq, i) =>
        this.makeButton(0, -H * 0.08 + i * (H * 0.13), `❌ ${eq}`, 0x5c1a1a, () => {
          this.closeEvent({ ...item.result, replaceEquipment: eq });
        }, Math.round(W * 0.46), 56),
      );

      const cancelBtn = this.makeButton(0, H * 0.33, '취소  (+10G)', 0x3a3000, () => {
        this.closeEvent({ goldDelta: 10 });
      }, Math.round(W * 0.30), 48);

      this.root.add([replaceTitle, newLbl, divider2, ...replaceBtns, cancelBtn]);
    };

    const btns = drawn.map((item, i) =>
      this.makeButton(
        0, -H * 0.04 + i * (H * 0.13),
        item.label, 0x3a2800, () => pickEquip(item),
        Math.round(W * 0.52), 56,
      ),
    );

    const skipBtn = this.makeButton(0, H * 0.36, '그냥 지나침  (+10G)', 0x3a3000, () => {
      this.closeEvent({ goldDelta: 10 });
    }, Math.round(W * 0.30), 48);

    this.root.add([title, slotLbl, desc, divider, ...btns, skipBtn]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5 — 카드 뒤집기 골드 게임
  // ─────────────────────────────────────────────────────────────────────────────

  private createCardFlipEvent() {
    const H = this.H;
    const W = this.W;
    const INIT_GOLD  = 10;
    const CARD_COUNT = 5;
    const ELEMENTS: CardElement[] = ['water', 'fire', 'grass', 'lightning', 'earth'];

    const cards: CardElement[] = Array.from({ length: CARD_COUNT }, () =>
      ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)],
    );

    let currentGold = INIT_GOLD;
    let currentIdx  = 0;
    let baseElement: CardElement | null = null;
    let gameOver    = false;

    const title     = this.makeHeader('row0_4', '카드 도박', -H * 0.40);
    const ruleText  = this.makeBody('같은 속성이면 골드 ×2, 다른 속성이면 즉시 종료 0G\n언제든 10G 받고 나갈 수 있습니다.', -H * 0.31);
    const divider   = this.makeDivider(-H * 0.22);

    const goldLabel = this.add.text(0, -H * 0.14, `현재 골드: ${currentGold}G`, {
      fontFamily: FONT_B, fontSize: '26px', color: '#f5cc4a',
    }).setOrigin(0.5);

    // 카드 슬롯
    const CARD_W = Math.round(W * 0.08);
    const CARD_H = Math.round(H * 0.22);
    const GAP    = Math.round(W * 0.10);
    const startX = -(CARD_COUNT - 1) * GAP / 2;

    const ATTR_IDX: Record<string, number> = { water:0, fire:1, grass:2, lightning:3, earth:4 };

    // 카드 슬롯 — 아이콘 레이어(초기 숨김) 포함
    const cardSlots = cards.map((el, i) => {
      const cx = startX + i * GAP;
      const cy = H * 0.01;
      const g  = this.add.graphics();
      g.fillStyle(0x1e1e3a, 1);
      g.lineStyle(2, 0x4444aa, 1);
      g.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 8);
      g.strokeRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 8);
      const qMark = this.add.text(cx, cy, '?', {
        fontFamily: FONT_B, fontSize: '28px', color: '#6666bb',
      }).setOrigin(0.5);
      const icon = this.add.image(cx, cy, 'attr_icons', `attr_${ATTR_IDX[el] ?? 5}`);
      icon.setDisplaySize(CARD_W * 0.7, CARD_W * 0.7).setVisible(false);
      return { g, qMark, icon, cx, cy };
    });

    const statusText = this.add.text(0, H * 0.22, '첫 번째 카드를 뒤집습니다...', {
      fontFamily: FONT_M, fontSize: '17px', color: '#aaaaaa',
    }).setOrigin(0.5);

    // 10G 받고 나가기 (항상 보임)
    const exitBtn = this.makeButton(-W * 0.22, H * 0.34, '10G 받고 나가기', 0x3a3000, () => {
      if (gameOver) return;
      gameOver = true;
      this.closeEvent({ goldDelta: 10 });
    }, Math.round(W * 0.24), 56);

    const takeBtn = this.makeButton(W * 0.01, H * 0.34, '받기', 0x1a5c1a, () => {
      if (gameOver) return;
      gameOver = true;
      this.closeEvent({ goldDelta: currentGold });
    }, Math.round(W * 0.16), 56);
    takeBtn.setVisible(false);

    const flipBtn = this.makeButton(W * 0.20, H * 0.34, '뒤집기', 0x1a3a6c, () => {
      if (gameOver || currentIdx >= CARD_COUNT) return;
      const el = cards[currentIdx];
      const { g, qMark, icon, cx, cy } = cardSlots[currentIdx];

      // 카드 뒤집기 — 아이콘 표시
      qMark.setVisible(false);
      icon.setVisible(true);
      g.clear();
      g.fillStyle(0x1a3050, 1);
      g.lineStyle(2, COLOR_GOLD, 1);
      g.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 8);
      g.strokeRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 8);

      if (currentIdx === 0) {
        baseElement = el;
        statusText.setText(`기준 속성: ${this.elementName(el)}`).setColor('#ffdb58');
        currentIdx++;
        return;
      }

      if (el === baseElement) {
        currentGold *= 2;
        goldLabel.setText(`현재 골드: ${currentGold}G`);
        statusText.setText(`같은 속성! ${currentGold}G`).setColor('#2ecc71');
        currentIdx++;
        if (currentIdx >= CARD_COUNT) {
          gameOver = true;
          statusText.setText(`완주! 최종 골드: ${currentGold}G`).setColor('#f5cc4a');
          flipBtn.setVisible(false);
          takeBtn.setVisible(true);
        } else {
          takeBtn.setVisible(true);
        }
      } else {
        gameOver = true;
        currentGold = 0;
        goldLabel.setText('현재 골드: 0G').setColor('#e74c3c');
        statusText.setText('다른 속성! 골드 0G').setColor('#e74c3c');
        flipBtn.setVisible(false);
        exitBtn.setVisible(false);
        takeBtn.setVisible(false);
        const confirmBtn = this.makeButton(0, H * 0.34, '확인', 0x3a1a1a, () => {
          this.closeEvent({ goldDelta: 0 });
        }, Math.round(W * 0.18), 56);
        this.root.add(confirmBtn);
      }
    }, Math.round(W * 0.18), 56);

    this.root.add([
      title, ruleText, divider, goldLabel,
      ...cardSlots.map(s => s.g),
      ...cardSlots.map(s => s.lbl),
      statusText, exitBtn, takeBtn, flipBtn,
    ]);

    this.time.delayedCall(500, () => flipBtn.emit('pointerdown'));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6 — 대체 카드 (속성 교환)
  // ─────────────────────────────────────────────────────────────────────────────

  private createCardSwapEvent() {
    const H = this.H;
    const W = this.W;
    const ELEMENTS: CardElement[] = ['water', 'fire', 'grass', 'lightning', 'earth'];
    const symbols: Record<string, string> = {
      water: '💧\n물', fire: '🔥\n불', grass: '🌿\n풀', lightning: '⚡\n번개', earth: '🪨\n땅',
    };

    const title   = this.makeTitle('🔄 대체 카드', -H * 0.35);
    const desc    = this.makeBody(
      '교환할 속성을 선택합니다.\n선택한 속성 카드 → 다른 속성 카드로 교환 (일반 속성 카드 불가)',
      -H * 0.24,
    );
    const divider = this.makeDivider(-H * 0.16);

    const GAP    = W * 0.12;
    const startX = -(ELEMENTS.length - 1) * GAP / 2;
    const elBtns = ELEMENTS.map((el, i) =>
      this.makeButton(startX + i * GAP, H * 0.02, symbols[el], 0x1a2a4a, () => {
        const others = ELEMENTS.filter(e => e !== el);
        const to = others[Math.floor(Math.random() * others.length)];
        this.closeEvent({ swapFrom: el, swapTo: to });
      }, Math.round(W * 0.10), 80),
    );

    const skipBtn = this.makeButton(0, H * 0.32, '✖  그냥 지나침', 0x333333, () => {
      this.closeEvent({ swapFrom: null });
    }, Math.round(W * 0.22), 52);

    this.root.add([title, desc, divider, ...elBtns, skipBtn]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7 — 하트 카드 (HP -5, 카드 밸류 ×1.3)
  // ─────────────────────────────────────────────────────────────────────────────

  private createHeartEvent() {
    const H = this.H;
    const W = this.W;
    const { playerHp } = this.data_;
    const canAccept    = playerHp > 5;

    const title   = this.makeTitle('❤  하트 카드', -H * 0.32);
    const divider = this.makeDivider(-H * 0.22);
    const desc    = this.makeBody(
      `HP를 5 잃는 대신\n덱의 카드 밸류를 ×1.3 영구 강화합니다.\n\n현재 HP: ${playerHp}`,
      -H * 0.10,
    );

    const warning = canAccept ? null : this.add.text(0, H * 0.10, '⚠ HP가 부족합니다! (HP > 5 필요)', {
      fontFamily: FONT_M, fontSize: '16px', color: '#e74c3c',
    }).setOrigin(0.5);

    const acceptBtn = this.makeButton(-W * 0.13, H * 0.28, '✅ 수락  (HP -5)', 0x1a5c1a, () => {
      this.closeEvent({ accepted: true, hpDelta: -5, cardValueMultiplier: 1.3 });
    }, Math.round(W * 0.24), 56);

    const refuseBtn = this.makeButton(W * 0.13, H * 0.28, '✖  거절', 0x5c1a1a, () => {
      this.closeEvent({ accepted: false });
    }, Math.round(W * 0.24), 56);

    if (!canAccept) acceptBtn.setAlpha(0.35).disableInteractive();

    const items: Phaser.GameObjects.GameObject[] = [title, divider, desc, acceptBtn, refuseBtn];
    if (warning) items.push(warning);
    this.root.add(items);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8 — 방어 카드 (쉴드량 ×1.2)
  // ─────────────────────────────────────────────────────────────────────────────

  private createShieldEvent() {
    const H = this.H;

    const title   = this.makeTitle('🛡  방어 카드', -H * 0.28);
    const divider = this.makeDivider(-H * 0.18);
    const desc    = this.makeBody(
      '덱의 모든 방어(쉴드) 카드의\n쉴드량이 ×1.2 영구 증가합니다.',
      -H * 0.04,
    );

    const confirmBtn = this.makeButton(0, H * 0.28, '✅ 확인', 0x1a3a6c, () => {
      this.closeEvent({ shieldMultiplier: 1.2 });
    }, Math.round(this.W * 0.22), 56);

    this.root.add([title, divider, desc, confirmBtn]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9 — 별 카드 (속성 카드 별 +1)
  // ─────────────────────────────────────────────────────────────────────────────

  private createStarEvent() {
    const H = this.H;
    const W = this.W;
    const ELEMENTS: CardElement[] = ['water', 'fire', 'grass', 'lightning', 'earth'];
    const symbols: Record<string, string> = {
      water: '💧\n물', fire: '🔥\n불', grass: '🌿\n풀', lightning: '⚡\n번개', earth: '🪨\n땅',
    };

    const title   = this.makeTitle('⭐  별 카드', -H * 0.32);
    const divider = this.makeDivider(-H * 0.22);
    const desc    = this.makeBody(
      '선택한 속성의 카드 중 하나의 별(등급)을 +1 올립니다.',
      -H * 0.12,
    );

    const GAP    = W * 0.12;
    const startX = -(ELEMENTS.length - 1) * GAP / 2;
    const btns   = ELEMENTS.map((el, i) =>
      this.makeButton(startX + i * GAP, H * 0.04, symbols[el], 0x2a1a4a, () => {
        this.closeEvent({ starUpElement: el });
      }, Math.round(W * 0.10), 80),
    );

    const skipBtn = this.makeButton(0, H * 0.32, '✖  그냥 지나침', 0x333333, () => {
      this.closeEvent({ starUpElement: null });
    }, Math.round(W * 0.22), 52);

    this.root.add([title, divider, desc, ...btns, skipBtn]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10 — 인디언 포커
  // ─────────────────────────────────────────────────────────────────────────────

  private createIndianPokerEvent() {
    const H = this.H;
    const W = this.W;
    const { mapElement } = this.data_;
    const TOTAL_ROUNDS   = 5;

    let currentRound = 1;
    let foldTokens   = 1;
    let betAttempts  = 1;
    let winStreak    = 0;
    let gameEnded    = false;

    const gen = () => ({
      playerStars: Math.floor(Math.random() * 5) + 1,
      aiStars:     Math.floor(Math.random() * 5) + 1,
    });
    let cards = gen();

    // ── 고정 UI ──────────────────────────────────────────────────────────────
    const title = this.makeTitle(
      `❗  인디언 포커  (${this.elementName(mapElement)} 속성)`, -H * 0.38,
    );
    const divider = this.makeDivider(-H * 0.30);

    const roundLabel = this.add.text(0, -H * 0.25, `라운드  ${currentRound} / ${TOTAL_ROUNDS}`, {
      fontFamily: FONT_B, fontSize: '22px', color: '#cccccc',
    }).setOrigin(0.5);

    const tokenLabel = this.add.text(-W * 0.15, -H * 0.19, `포기 토큰: ${foldTokens}`, {
      fontFamily: FONT_M, fontSize: '16px', color: '#aaaaaa',
    }).setOrigin(0.5);

    const attemptLabel = this.add.text(W * 0.15, -H * 0.19, `남은 기회: ${betAttempts}`, {
      fontFamily: FONT_M, fontSize: '16px', color: '#aaaaaa',
    }).setOrigin(0.5);

    // 카드 영역
    const CARD_W = Math.round(W * 0.09);
    const CARD_H = Math.round(H * 0.24);
    const cardY  = -H * 0.04;

    const aiCardG = this.add.graphics();
    aiCardG.fillStyle(0x2a1a4a, 1); aiCardG.lineStyle(2, 0x9966cc, 1);
    aiCardG.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
    aiCardG.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
    aiCardG.setPosition(-W * 0.12, cardY);

    const aiStarTxt = this.add.text(-W * 0.12, cardY, `★ ${cards.aiStars}`, {
      fontFamily: FONT_B, fontSize: '28px', color: '#f5cc4a',
    }).setOrigin(0.5);
    const aiLbl = this.add.text(-W * 0.12, cardY + CARD_H * 0.6, '상대방', {
      fontFamily: FONT_L, fontSize: '14px', color: '#aaaaaa',
    }).setOrigin(0.5);

    const myCardG = this.add.graphics();
    myCardG.fillStyle(0x1a2a4a, 1); myCardG.lineStyle(2, 0x6699cc, 1);
    myCardG.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
    myCardG.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
    myCardG.setPosition(W * 0.12, cardY);

    const myCardTxt = this.add.text(W * 0.12, cardY, '?', {
      fontFamily: FONT_B, fontSize: '36px', color: '#6699cc',
    }).setOrigin(0.5);
    const myLbl = this.add.text(W * 0.12, cardY + CARD_H * 0.6, '나 (뒤집힘)', {
      fontFamily: FONT_L, fontSize: '14px', color: '#aaaaaa',
    }).setOrigin(0.5);

    const statusTxt = this.add.text(0, H * 0.17, '배팅 또는 배팅 포기를 선택하세요.', {
      fontFamily: FONT_M, fontSize: '17px', color: '#cccccc',
    }).setOrigin(0.5);

    const winLbl = this.add.text(0, H * 0.24, '확보 가능 카드: 없음', {
      fontFamily: FONT_M, fontSize: '16px', color: '#f5cc4a',
    }).setOrigin(0.5);

    // ── 라운드 갱신 ──────────────────────────────────────────────────────────
    const refresh = () => {
      roundLabel.setText(`라운드  ${currentRound} / ${TOTAL_ROUNDS}`);
      tokenLabel.setText(`포기 토큰: ${foldTokens}`);
      attemptLabel.setText(`남은 기회: ${betAttempts}`);
      aiStarTxt.setText(`★ ${cards.aiStars}`);
      winLbl.setText(`확보 가능 카드: ${winStreak > 0 ? `★ ${winStreak}` : '없음'}`);
    };

    const BW = Math.round(W * 0.18);
    const BY = H * 0.36;

    // ── 10G 받고 나가기 (항상 보임) ──────────────────────────────────────────
    const earlyExitBtn = this.makeButton(-W * 0.30, BY, '💰 10G 받고 나가기', 0x3a3000, () => {
      if (gameEnded) return;
      gameEnded = true;
      this.closeEvent({ goldDelta: 10 });
    }, Math.round(W * 0.22), 56);

    // ── 지금 받기 / 계속 버튼 (처음엔 숨김) ─────────────────────────────────
    const takeNowBtn = this.makeButton(-W * 0.08, BY, '✅ 받기', 0x1a5c1a, () => {
      gameEnded = true;
      this.closeEvent({ pokerCard: winStreak });
    }, BW, 56).setVisible(false) as Phaser.GameObjects.Container;

    const continueBtn = this.makeButton(W * 0.08, BY, '▶ 계속', 0x1a3a6c, () => {
      takeNowBtn.setVisible(false);
      continueBtn.setVisible(false);
      betBtn.setVisible(true);
      foldBtn.setVisible(true);
      statusTxt.setText('배팅 또는 배팅 포기를 선택하세요.').setColor('#cccccc');
      refresh();
    }, BW, 56).setVisible(false) as Phaser.GameObjects.Container;

    const promptTake = (onContinue: () => void) => {
      if (winStreak === 0 || currentRound > TOTAL_ROUNDS) { onContinue(); return; }
      statusTxt.setText(`★ ${winStreak}성 카드를 받고 끝내시겠습니까?`).setColor('#f5cc4a');
      betBtn.setVisible(false);
      foldBtn.setVisible(false);
      takeNowBtn.setVisible(true);
      continueBtn.setVisible(true);
    };

    // ── 배팅 버튼 ─────────────────────────────────────────────────────────────
    const betBtn = this.makeButton(-W * 0.08, BY, '💰 배팅', 0x1a5c1a, () => {
      if (gameEnded) return;
      const res = cards.playerStars > cards.aiStars ? 'win'
                : cards.playerStars < cards.aiStars ? 'lose' : 'draw';

      if (res === 'win') {
        winStreak++;
        currentRound++;
        foldTokens = 1; betAttempts = 1;
        statusTxt.setText(`✅ 승리! ★${winStreak} 카드 확보 가능`).setColor('#2ecc71');

        if (currentRound > TOTAL_ROUNDS) {
          gameEnded = true;
          statusTxt.setText(`🎉 전승! ★${winStreak}성 카드 획득!`).setColor('#f5cc4a');
          betBtn.setVisible(false); foldBtn.setVisible(false);
          this.time.delayedCall(1400, () => this.closeEvent({ pokerCard: winStreak }));
          return;
        }
        cards = gen();
        promptTake(() => {
          statusTxt.setText('배팅 또는 배팅 포기를 선택하세요.').setColor('#cccccc');
          betBtn.setVisible(true); foldBtn.setVisible(true);
          refresh();
        });

      } else if (res === 'draw') {
        statusTxt.setText('🤝 동점! 라운드 재시작').setColor('#ffdb58');
        cards = gen(); aiStarTxt.setText(`★ ${cards.aiStars}`);

      } else {
        betAttempts--;
        attemptLabel.setText(`남은 기회: ${betAttempts}`);
        statusTxt.setText('❌ 패배! 기회 -1').setColor('#e74c3c');
        if (betAttempts <= 0) {
          gameEnded = true;
          betBtn.setVisible(false); foldBtn.setVisible(false);
          statusTxt.setText('기회 소진. 이벤트 종료').setColor('#e74c3c');
          this.time.delayedCall(1400, () => this.closeEvent({ pokerCard: 0 }));
        } else {
          cards = gen(); aiStarTxt.setText(`★ ${cards.aiStars}`);
        }
      }
    }, BW, 56);

    // ── 배팅 포기 버튼 ────────────────────────────────────────────────────────
    const foldBtn = this.makeButton(W * 0.20, BY, '✋ 배팅 포기', 0x5c3a1a, () => {
      if (gameEnded) return;
      if (cards.playerStars === 5) {
        gameEnded = true;
        statusTxt.setText('5성 카드를 들고 배팅 포기! 이벤트 종료').setColor('#e74c3c');
        betBtn.setVisible(false); foldBtn.setVisible(false);
        this.time.delayedCall(1400, () => this.closeEvent({ pokerCard: 0 }));
        return;
      }
      if (foldTokens <= 0) {
        statusTxt.setText('⚠ 배팅 포기 토큰 없음!').setColor('#e74c3c');
        return;
      }
      foldTokens--;
      cards = gen();
      aiStarTxt.setText(`★ ${cards.aiStars}`);
      tokenLabel.setText(`포기 토큰: ${foldTokens}`);
      statusTxt.setText(`배팅 포기 (토큰 ${foldTokens}개 남음)`).setColor('#aaaaaa');
    }, BW, 56);

    this.root.add([
      title, divider, roundLabel, tokenLabel, attemptLabel,
      aiCardG, aiStarTxt, aiLbl,
      myCardG, myCardTxt, myLbl,
      statusTxt, winLbl,
      earlyExitBtn, betBtn, foldBtn, takeNowBtn, continueBtn,
    ]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 11~18 — 보스 이벤트
  // ─────────────────────────────────────────────────────────────────────────────

  private createBossEvent() {
    const H = this.H;
    const W = this.W;
    const { nodeType, playerHp, playerMaxHp, playerAtk, playerDef, playerCrit } = this.data_;
    const isFinal  = nodeType === NODE_TYPE.BOSS_FINAL;
    const rounds   = isFinal ? 3 : 2;
    const elName   = BOSS_ELEMENT_NAME[nodeType] ?? '???';

    const bossNames: Partial<Record<number, string>> = {
      [NODE_TYPE.BOSS_WATER]:     '해룡왕  아쿠아리스',
      [NODE_TYPE.BOSS_FIRE]:      '화염군주  이그니스',
      [NODE_TYPE.BOSS_GRASS]:     '대수목  실바나',
      [NODE_TYPE.BOSS_LIGHTNING]: '뇌신  토르무스',
      [NODE_TYPE.BOSS_EARTH]:     '대지의 왕  테라',
      [NODE_TYPE.BOSS_FINAL]:     '혼돈의 군주  카오스',
    };

    const title    = this.makeTitle(
      `💀  ${elName} 보스 등장`, -H * 0.32,
      isFinal ? '#ff4444' : '#d4af37',
    );
    const divider  = this.makeDivider(-H * 0.22);
    const nameTxt  = this.add.text(0, -H * 0.14, bossNames[nodeType] ?? '???', {
      fontFamily: FONT_B, fontSize: '32px', color: '#ffffff',
    }).setOrigin(0.5);
    const infoTxt  = this.makeBody(
      `${rounds}라운드 전투\n보스를 쓰러뜨리면 고유 보상을 획득합니다.`,
      H * 0.02,
    );
    const statsText = this.add.text(0, H * 0.14,
      `HP ${playerHp}/${playerMaxHp}   공격 ${playerAtk}   방어 ${playerDef}   치명 ${playerCrit}%`,
      { fontFamily: FONT_L, fontSize: '15px', color: '#aaaaaa' },
    ).setOrigin(0.5);

    const startBtn = this.makeButton(0, H * 0.28, '⚔  전투 시작', 0x8b0000, () => {
      this.closeEvent({ bossResult: 'win', bossType: nodeType });
    }, Math.round(W * 0.32), 64);

    this.root.add([title, divider, nameTxt, infoTxt, statsText, startBtn]);
  }
}
