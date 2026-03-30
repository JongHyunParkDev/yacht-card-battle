import Phaser from 'phaser';
import { NODE_TYPE, BOSS_ELEMENT_NAME, isBossType } from '@src/data/nodeTypes';
import type { CardElement } from '@src/data/cardData';
import { i18n } from '@src/utils/localization';
import {
  drawEquipment, formatEquipStats, getEquipmentById,
  EQUIP_GRADE_LABEL, EQUIP_GRADE_COLOR,
  type EquipmentData,
} from '@src/data/equipmentData';
import type { WeaponType } from '@src/scenes/CharacterSelectScene';

// ─── 이벤트 데이터 타입 ────────────────────────────────────────────────────────

export interface NodeEventData {
  nodeType:        number;
  mapElement:      CardElement;
  nodeId:          number;
  playerGold:      number;
  playerHp:        number;
  playerMaxHp:     number;
  playerAtk:       number;
  playerDef:       number;
  playerCrit:      number;
  playerCritDmg:   number;
  playerEquipment: string[];
  maxEquipSlots:   number;
  // 전투 이벤트용 추가 필드
  characterWeapon: WeaponType;
  deck:            { cardId: number; count: number }[];
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

    // 이벤트 중 ESC 차단
    this.input.keyboard?.on('keydown-ESC', () => { /* 이벤트 중 비활성 */ });

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
    const key = 'elem' + el.charAt(0).toUpperCase() + el.slice(1);
    return i18n.t(key) || el;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1·2 — 전투 이벤트
  // ─────────────────────────────────────────────────────────────────────────────

  private createBattleEvent() {
    const {
      nodeType, mapElement,
      playerHp, playerMaxHp, playerAtk, playerDef, playerCrit, playerCritDmg,
      characterWeapon, deck, nodeId,
    } = this.data_;
    const isElemental = nodeType === NODE_TYPE.SWORD;
    const mobName = isElemental
      ? this.randomElementalMobName(mapElement)
      : this.randomNormalMobName();

    // NodeEventScene 대신 BattleScene을 런치
    this.scene.launch('BattleScene', {
      nodeId,
      isElemental,
      mapElement,
      mobName,
      playerHp,
      playerMaxHp,
      playerAtk,
      playerDef,
      playerCrit,
      playerCritDmg,
      characterWeapon,
      deck,
    });

    // NodeEventScene 자신은 종료 (BattleScene이 nodeEventComplete 직접 발행)
    this.scene.stop();
  }

  private randomNormalMobName() {
    const keys = ['mobGoblin', 'mobSkeleton', 'mobSlime', 'mobZombie', 'mobBat', 'mobRat', 'mobPoison'];
    return i18n.t(keys[Math.floor(Math.random() * keys.length)]);
  }

  private randomElementalMobName(el: string) {
    const m: Record<string, string[]> = {
      water:     ['mobWaterSpirit', 'mobJellyfishMage', 'mobIceKnight'],
      fire:      ['mobFireSpirit', 'mobMagmaGolem', 'mobFlameDemon'],
      grass:     ['mobGrassSpirit', 'mobPoisonWitch', 'mobVineGolem'],
      lightning: ['mobLightningSpirit', 'mobElectricBat', 'mobStormMage'],
      earth:     ['mobEarthSpirit', 'mobRockGiant', 'mobSandWarrior'],
    };
    const list = m[el] ?? ['mobUnknown'];
    return i18n.t(list[Math.floor(Math.random() * list.length)]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3 — 강화 이벤트
  // ─────────────────────────────────────────────────────────────────────────────

  private createEnhanceEvent() {
    const H = this.H;
    const W = this.W;
    const { playerMaxHp, playerCrit, playerCritDmg, playerDef, playerAtk } = this.data_;

    const passives = [
      { name: i18n.t('passiveIronWill'),      desc: i18n.f('passiveIronWillDesc',      { cur: playerMaxHp,                   next: playerMaxHp + 10 }),             result: { maxHpDelta: 10 } },
      { name: i18n.t('passiveSharpSense'),    desc: i18n.f('passiveSharpSenseDesc',    { cur: playerCrit,                    next: playerCrit + 5 }),               result: { critDelta: 5 } },
      { name: i18n.t('passiveBattleFrenzy'),  desc: i18n.f('passiveBattleFrenzyDesc',  { cur: playerCritDmg.toFixed(1),      next: (playerCritDmg + 0.2).toFixed(1) }), result: { critDmgDelta: 0.2 } },
      { name: i18n.t('passiveIronWall'),      desc: i18n.f('passiveIronWallDesc',      { cur: playerDef,                    next: playerDef + 3 }),                 result: { defDelta: 3 } },
      { name: i18n.t('passiveSharpInstinct'), desc: i18n.f('passiveSharpInstinctDesc', { cur: playerAtk,                    next: playerAtk + 5 }),                 result: { atkDelta: 5 } },
    ];

    const title   = this.makeHeader('row0_2', i18n.t('enhanceTitle'), -H * 0.38);
    const desc    = this.makeBody(i18n.t('enhanceDesc'), -H * 0.29);
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

    this.root.add([title, desc, divider, ...btns]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4 — 보물 이벤트
  // ─────────────────────────────────────────────────────────────────────────────

  private createTreasureEvent() {
    const H = this.H;
    const W = this.W;
    const { playerEquipment, maxEquipSlots } = this.data_;
    const isFull = playerEquipment.length >= maxEquipSlots;

    // 이미 보유한 장비 제외 후 가중치 랜덤으로 3개 추출
    const drawn = drawEquipment(3, playerEquipment);

    const slotText = i18n.f('treasureSlot', { cur: playerEquipment.length, max: maxEquipSlots });
    const title   = this.makeHeader('row0_3', i18n.t('treasureTitle'), -H * 0.35);
    const slotLbl = this.add.text(0, -H * 0.275, slotText, {
      fontFamily: FONT_M, fontSize: '16px',
      color: isFull ? '#e74c3c' : '#aaaaaa',
    }).setOrigin(0.5);
    const desc = this.makeBody(
      isFull ? i18n.t('treasureDescFull') : i18n.t('treasureDescNormal'),
      -H * 0.22,
    );
    const divider = this.makeDivider(-H * 0.15);

    /** 장비 선택 결과 빌드: 스탯 델타 포함 */
    const buildResult = (equip: EquipmentData) => {
      const r: Record<string, unknown> = { equipment: equip.id };
      const s = equip.stats;
      if (s.atk)       r.atkDelta    = s.atk;
      if (s.def)       r.defDelta    = s.def;
      if (s.crit)      r.critDelta   = s.crit;
      if (s.critDmg)   r.critDmgDelta = s.critDmg;
      if (s.maxHp)     r.maxHpDelta  = s.maxHp;
      if (s.cardMult)  r.cardValueMultiplier = s.cardMult;
      if (s.shieldMult) r.shieldMultiplier   = s.shieldMult;
      return r;
    };

    /** 장비 버튼 라벨: [등급] 이름 | 스탯 요약 */
    const makeLabel = (equip: EquipmentData) => {
      const gradeLabel = EQUIP_GRADE_LABEL[equip.grade];
      const stats      = formatEquipStats(equip.stats);
      const special    = equip.special ? `  ★ ${equip.special.desc}` : '';
      return `[${gradeLabel}]  ${equip.name}\n${stats}${special}`;
    };

    /** 장비 버튼 색상 (등급별) */
    const GRADE_BG: Record<string, number> = {
      common: 0x2a2a2a, uncommon: 0x0d2a3a, rare: 0x2a0a3a,
      unique: 0x3a2800, legendary: 0x3a0a00,
    };

    // 장비 선택 → 슬롯 가득 차면 교체 화면으로 전환
    const pickEquip = (equip: EquipmentData) => {
      const result = buildResult(equip);
      if (!isFull) {
        this.closeEvent(result);
        return;
      }
      // 교체 화면
      this.root.removeAll(true);

      const replaceTitle = this.makeTitle(i18n.t('treasureReplaceTitle'), -H * 0.32);
      const newLbl = this.add.text(0, -H * 0.23, `${i18n.t('newEquip')}: ${equip.name}`, {
        fontFamily: FONT_M, fontSize: '16px', color: EQUIP_GRADE_COLOR[equip.grade],
      }).setOrigin(0.5);
      const div2 = this.makeDivider(-H * 0.17);

      const replaceBtns = playerEquipment.map((eqId, i) => {
        const owned = getEquipmentById(eqId);
        const lbl   = owned ? `${owned.name}  [${EQUIP_GRADE_LABEL[owned.grade]}]` : eqId;
        return this.makeButton(0, -H * 0.09 + i * (H * 0.13), lbl, 0x5c1a1a, () => {
          this.closeEvent({ ...result, replaceEquipment: eqId });
        }, Math.round(W * 0.46), 56);
      });

      this.root.add([replaceTitle, newLbl, div2, ...replaceBtns]);
    };

    const btns = drawn.map((equip, i) =>
      this.makeButton(
        0, -H * 0.05 + i * (H * 0.135),
        makeLabel(equip),
        GRADE_BG[equip.grade] ?? 0x2a2a2a,
        () => pickEquip(equip),
        Math.round(W * 0.60), 60,
      ),
    );

    // 장비가 모두 소진된 경우
    if (drawn.length === 0) {
      const noEquip = this.makeBody(i18n.t('noNewEquip'), H * 0.02);
      const skipBtn = this.makeButton(0, H * 0.22, i18n.t('confirm'), 0x333333, () => {
        this.closeEvent({});
      }, Math.round(W * 0.22), 48);
      this.root.add([title, slotLbl, divider, noEquip, skipBtn]);
      return;
    }

    this.root.add([title, slotLbl, desc, divider, ...btns]);
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

    const title     = this.makeHeader('row0_4', i18n.t('flipTitle'), -H * 0.40);
    const ruleText  = this.makeBody(i18n.t('flipRuleText'), -H * 0.31);
    const divider   = this.makeDivider(-H * 0.22);

    const goldLabel = this.add.text(0, -H * 0.14, `${i18n.t('currentGoldLabel')}: ${currentGold}G`, {
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

    const statusText = this.add.text(0, H * 0.22, i18n.t('flipFirstCard'), {
      fontFamily: FONT_M, fontSize: '17px', color: '#aaaaaa',
    }).setOrigin(0.5);

    // 10G 받고 나가기 (항상 보임)
    const exitBtn = this.makeButton(-W * 0.22, H * 0.34, i18n.t('exitWithGold'), 0x3a3000, () => {
      if (gameOver) return;
      gameOver = true;
      this.closeEvent({ goldDelta: 10 });
    }, Math.round(W * 0.24), 56);

    const takeBtn = this.makeButton(W * 0.01, H * 0.34, i18n.t('receive'), 0x1a5c1a, () => {
      if (gameOver) return;
      gameOver = true;
      this.closeEvent({ goldDelta: currentGold });
    }, Math.round(W * 0.16), 56);
    takeBtn.setVisible(false);

    const flipBtn = this.makeButton(W * 0.20, H * 0.34, i18n.t('flipCard'), 0x1a3a6c, () => {
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
        statusText.setText(`${i18n.t('baseAttrLabel')}: ${this.elementName(el)}`).setColor('#ffdb58');
        currentIdx++;
        return;
      }

      if (el === baseElement) {
        currentGold *= 2;
        goldLabel.setText(`${i18n.t('currentGoldLabel')}: ${currentGold}G`);
        statusText.setText(i18n.f('sameAttr', { gold: currentGold })).setColor('#2ecc71');
        currentIdx++;
        if (currentIdx >= CARD_COUNT) {
          gameOver = true;
          statusText.setText(i18n.f('allFlipped', { gold: currentGold })).setColor('#f5cc4a');
          flipBtn.setVisible(false);
          takeBtn.setVisible(true);
        } else {
          takeBtn.setVisible(true);
        }
      } else {
        gameOver = true;
        currentGold = 0;
        goldLabel.setText(`${i18n.t('currentGoldLabel')}: 0G`).setColor('#e74c3c');
        statusText.setText(i18n.t('diffAttr')).setColor('#e74c3c');
        flipBtn.setVisible(false);
        exitBtn.setVisible(false);
        takeBtn.setVisible(false);
        const confirmBtn = this.makeButton(0, H * 0.34, i18n.t('confirm'), 0x3a1a1a, () => {
          this.closeEvent({ goldDelta: 0 });
        }, Math.round(W * 0.18), 56);
        this.root.add(confirmBtn);
      }
    }, Math.round(W * 0.18), 56);

    this.root.add([
      title, ruleText, divider, goldLabel,
      ...cardSlots.map(s => s.g),
      ...cardSlots.map(s => s.qMark),
      ...cardSlots.map(s => s.icon),
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
    const ATTR_IDX: Record<string, number> = { water:0, fire:1, grass:2, lightning:3, earth:4 };
    const title   = this.makeHeader('row1_0', i18n.t('swapTitle'), -H * 0.35);
    const desc    = this.makeBody(i18n.t('swapDesc'), -H * 0.24);
    const divider = this.makeDivider(-H * 0.16);

    const BTN_SIZE = Math.round(W * 0.10);
    const GAP    = W * 0.12;
    const startX = -(ELEMENTS.length - 1) * GAP / 2;

    // 속성 버튼: 아이콘 이미지 + 이름 텍스트, makeButton 대신 직접 컨테이너 구성
    const elBtns = ELEMENTS.map((el, i) => {
      const bx = startX + i * GAP;
      const by = H * 0.04;
      const cont = this.add.container(bx, by);
      const bg = this.add.graphics();
      bg.fillStyle(0x1a2a4a, 1);
      bg.lineStyle(1, COLOR_GOLD, 0.5);
      bg.fillRoundedRect(-BTN_SIZE / 2, -BTN_SIZE * 0.65, BTN_SIZE, BTN_SIZE * 1.3, 8);
      bg.strokeRoundedRect(-BTN_SIZE / 2, -BTN_SIZE * 0.65, BTN_SIZE, BTN_SIZE * 1.3, 8);
      const icon = this.add.image(0, -BTN_SIZE * 0.12, 'attr_icons', `attr_${ATTR_IDX[el]}`);
      icon.setDisplaySize(BTN_SIZE * 0.55, BTN_SIZE * 0.55);
      const lbl = this.add.text(0, BTN_SIZE * 0.38, this.elementName(el), {
        fontFamily: FONT_M, fontSize: '14px', color: '#cccccc',
      }).setOrigin(0.5);
      cont.add([bg, icon, lbl]);
      cont.setInteractive(
        new Phaser.Geom.Rectangle(-BTN_SIZE / 2, -BTN_SIZE * 0.65, BTN_SIZE, BTN_SIZE * 1.3),
        Phaser.Geom.Rectangle.Contains,
      );
      cont.on('pointerover', () => bg.setAlpha(1.3));
      cont.on('pointerout',  () => bg.setAlpha(1));
      cont.on('pointerdown', () => {
        const others = ELEMENTS.filter(e => e !== el);
        const to = others[Math.floor(Math.random() * others.length)];
        this.closeEvent({ swapFrom: el, swapTo: to });
      });
      return cont;
    });

    this.root.add([title, desc, divider, ...elBtns]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7 — 하트 카드 (HP -5, 카드 밸류 ×1.3)
  // ─────────────────────────────────────────────────────────────────────────────

  private createHeartEvent() {
    const H = this.H;
    const W = this.W;
    const { playerHp } = this.data_;
    const canAccept    = playerHp > 5;

    const title   = this.makeHeader('row1_1', i18n.t('heartTitle'), -H * 0.32);
    const divider = this.makeDivider(-H * 0.22);
    const desc    = this.makeBody(i18n.f('heartDesc', { hp: playerHp }), -H * 0.10);

    const warning = canAccept ? null : this.add.text(0, H * 0.10, i18n.t('heartWarning'), {
      fontFamily: FONT_M, fontSize: '16px', color: '#e74c3c',
    }).setOrigin(0.5);

    const acceptBtn = this.makeButton(-W * 0.13, H * 0.28, i18n.t('heartAccept'), 0x1a5c1a, () => {
      this.closeEvent({ accepted: true, hpDelta: -5, cardValueMultiplier: 1.3 });
    }, Math.round(W * 0.24), 56);

    const refuseBtn = this.makeButton(W * 0.13, H * 0.28, i18n.t('heartRefuse'), 0x5c1a1a, () => {
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

    const title   = this.makeHeader('row1_2', i18n.t('shieldTitle'), -H * 0.28);
    const divider = this.makeDivider(-H * 0.18);
    const desc    = this.makeBody(i18n.t('shieldDesc'), -H * 0.04);

    const confirmBtn = this.makeButton(0, H * 0.28, i18n.t('confirm'), 0x1a3a6c, () => {
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
    const ATTR_IDX: Record<string, number> = { water:0, fire:1, grass:2, lightning:3, earth:4 };

    const title   = this.makeHeader('row1_3', i18n.t('starTitle'), -H * 0.32);
    const divider = this.makeDivider(-H * 0.22);
    const desc    = this.makeBody(i18n.t('starDesc'), -H * 0.12);

    const BTN_SIZE = Math.round(W * 0.10);
    const GAP    = W * 0.12;
    const startX = -(ELEMENTS.length - 1) * GAP / 2;
    const btns = ELEMENTS.map((el, i) => {
      const bx = startX + i * GAP;
      const by = H * 0.04;
      const cont = this.add.container(bx, by);
      const bg = this.add.graphics();
      bg.fillStyle(0x2a1a4a, 1);
      bg.lineStyle(1, COLOR_GOLD, 0.5);
      bg.fillRoundedRect(-BTN_SIZE / 2, -BTN_SIZE * 0.65, BTN_SIZE, BTN_SIZE * 1.3, 8);
      bg.strokeRoundedRect(-BTN_SIZE / 2, -BTN_SIZE * 0.65, BTN_SIZE, BTN_SIZE * 1.3, 8);
      const icon = this.add.image(0, -BTN_SIZE * 0.12, 'attr_icons', `attr_${ATTR_IDX[el]}`);
      icon.setDisplaySize(BTN_SIZE * 0.55, BTN_SIZE * 0.55);
      const lbl = this.add.text(0, BTN_SIZE * 0.38, this.elementName(el), {
        fontFamily: FONT_M, fontSize: '14px', color: '#cccccc',
      }).setOrigin(0.5);
      cont.add([bg, icon, lbl]);
      cont.setInteractive(
        new Phaser.Geom.Rectangle(-BTN_SIZE / 2, -BTN_SIZE * 0.65, BTN_SIZE, BTN_SIZE * 1.3),
        Phaser.Geom.Rectangle.Contains,
      );
      cont.on('pointerover', () => bg.setAlpha(1.3));
      cont.on('pointerout',  () => bg.setAlpha(1));
      cont.on('pointerdown', () => this.closeEvent({ starUpElement: el }));
      return cont;
    });

    this.root.add([title, divider, desc, ...btns]);
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
    let locked       = false; // 카드 공개 애니 중 버튼 잠금

    const gen = () => ({
      playerStars: Math.floor(Math.random() * 5) + 1,
      aiStars:     Math.floor(Math.random() * 5) + 1,
    });
    let cards = gen();

    // ── 고정 UI ──────────────────────────────────────────────────────────────
    const title = this.makeHeader('row1_4', i18n.f('indianPokerTitle', { elem: this.elementName(mapElement) }), -H * 0.38);
    const divider = this.makeDivider(-H * 0.30);

    const roundLabel = this.add.text(0, -H * 0.25, `${i18n.t('round')}  ${currentRound} / ${TOTAL_ROUNDS}`, {
      fontFamily: FONT_B, fontSize: '22px', color: '#cccccc',
    }).setOrigin(0.5);

    const tokenLabel = this.add.text(-W * 0.15, -H * 0.19, `${i18n.t('foldToken')}: ${foldTokens}`, {
      fontFamily: FONT_M, fontSize: '16px', color: '#aaaaaa',
    }).setOrigin(0.5);

    const attemptLabel = this.add.text(W * 0.15, -H * 0.19, `${i18n.t('remainChance')}: ${betAttempts}`, {
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
    const aiLbl = this.add.text(-W * 0.12, cardY + CARD_H * 0.6, i18n.t('opponent'), {
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
    const myLbl = this.add.text(W * 0.12, cardY + CARD_H * 0.6, i18n.t('myCardHidden'), {
      fontFamily: FONT_L, fontSize: '14px', color: '#aaaaaa',
    }).setOrigin(0.5);

    const statusTxt = this.add.text(0, H * 0.17, i18n.t('betOrFold'), {
      fontFamily: FONT_M, fontSize: '17px', color: '#cccccc',
    }).setOrigin(0.5);

    const winLbl = this.add.text(0, H * 0.24, `${i18n.t('obtainableCard')}: ${i18n.t('none')}`, {
      fontFamily: FONT_M, fontSize: '16px', color: '#f5cc4a',
    }).setOrigin(0.5);

    // ── 라운드 갱신 ──────────────────────────────────────────────────────────
    const refresh = () => {
      roundLabel.setText(`${i18n.t('round')}  ${currentRound} / ${TOTAL_ROUNDS}`);
      tokenLabel.setText(`${i18n.t('foldToken')}: ${foldTokens}`);
      attemptLabel.setText(`${i18n.t('remainChance')}: ${betAttempts}`);
      aiStarTxt.setText(`★ ${cards.aiStars}`);
      winLbl.setText(`${i18n.t('obtainableCard')}: ${winStreak > 0 ? `★ ${winStreak}` : i18n.t('none')}`);
    };

    const BW  = Math.round(W * 0.20); // 버튼 너비
    const BG  = Math.round(W * 0.03); // 버튼 간격
    const BY  = H * 0.36;

    // 2개 버튼 중앙 정렬 (배팅/확인 단계 공통)
    const B2_LEFT  = -(BW / 2 + BG / 2);
    const B2_RIGHT =  (BW / 2 + BG / 2);

    // ── 받기 / 계속 버튼 (승리 후 확인 단계) ────────────────────────────────
    const takeNowBtn = this.makeButton(B2_LEFT, BY, i18n.t('receive'), 0x1a5c1a, () => {
      gameEnded = true;
      this.closeEvent({ pokerCard: winStreak });
    }, BW, 52).setVisible(false) as Phaser.GameObjects.Container;

    const continueBtn = this.makeButton(B2_RIGHT, BY, i18n.t('continueBtn'), 0x1a3a6c, () => {
      takeNowBtn.setVisible(false);
      continueBtn.setVisible(false);
      myCardTxt.setText('?').setColor('#6699cc'); myLbl.setText(i18n.t('myCardHidden'));
      locked = false; betBtn.setAlpha(1).setVisible(true); foldBtn.setAlpha(1).setVisible(true);
      statusTxt.setText(i18n.t('betOrFold')).setColor('#cccccc');
      refresh();
    }, BW, 52).setVisible(false) as Phaser.GameObjects.Container;

    const promptTake = (onContinue: () => void) => {
      if (winStreak === 0 || currentRound > TOTAL_ROUNDS) { onContinue(); return; }
      statusTxt.setText(i18n.f('pokerTakeConfirm', { n: winStreak })).setColor('#f5cc4a');
      betBtn.setVisible(false);
      foldBtn.setVisible(false);
      takeNowBtn.setVisible(true);
      continueBtn.setVisible(true);
    };

    // ── 카드 공개 후 결과 처리 (배팅 시 호출) ────────────────────────────────
    const revealAndResolve = () => {
      locked = true;
      betBtn.setAlpha(0.4); foldBtn.setAlpha(0.4);

      // 1단계: 내 카드 공개 (플래시 + 별 표시)
      myCardTxt.setText(`★ ${cards.playerStars}`).setColor('#f5cc4a');
      myLbl.setText(i18n.t('myCardRevealed'));
      this.tweens.add({ targets: myCardTxt, scaleX: 1.3, scaleY: 1.3, duration: 180, yoyo: true, ease: 'Power2' });
      statusTxt.setText(i18n.t('cardReveal')).setColor('#cccccc');

      // 2단계: 잠시 후 결과 표시
      this.time.delayedCall(700, () => {
        const res = cards.playerStars > cards.aiStars ? 'win'
                  : cards.playerStars < cards.aiStars ? 'lose' : 'draw';

        if (res === 'win') {
          winStreak++;
          currentRound++;
          foldTokens = 1; betAttempts = 1;
          statusTxt.setText(i18n.f('pokerWin', { n: winStreak })).setColor('#2ecc71');
          refresh();

          if (currentRound > TOTAL_ROUNDS) {
            gameEnded = true;
            statusTxt.setText(i18n.f('pokerSweep', { n: winStreak })).setColor('#f5cc4a');
            betBtn.setVisible(false); foldBtn.setVisible(false);
            this.time.delayedCall(1800, () => this.closeEvent({ pokerCard: winStreak }));
            return;
          }

          // 3단계: 다음 라운드로 넘어가기 전 대기
          this.time.delayedCall(1400, () => {
            cards = gen();
            myCardTxt.setText('?').setColor('#6699cc');
            myLbl.setText(i18n.t('myCardHidden'));
            aiStarTxt.setText(`★ ${cards.aiStars}`);
            locked = false; betBtn.setAlpha(1); foldBtn.setAlpha(1);
            promptTake(() => {
              statusTxt.setText(i18n.t('betOrFold')).setColor('#cccccc');
              betBtn.setVisible(true); foldBtn.setVisible(true);
              refresh();
            });
          });

        } else if (res === 'draw') {
          statusTxt.setText(i18n.t('pokerDraw')).setColor('#ffdb58');
          this.time.delayedCall(1200, () => {
            cards = gen();
            myCardTxt.setText('?').setColor('#6699cc');
            myLbl.setText(i18n.t('myCardHidden'));
            aiStarTxt.setText(`★ ${cards.aiStars}`);
            locked = false; betBtn.setAlpha(1); foldBtn.setAlpha(1);
            statusTxt.setText(i18n.t('betOrFold')).setColor('#cccccc');
          });

        } else {
          betAttempts--;
          statusTxt.setText(i18n.f('pokerLose', { n: betAttempts })).setColor('#e74c3c');
          attemptLabel.setText(`${i18n.t('remainChance')}: ${betAttempts}`);

          if (betAttempts <= 0) {
            gameEnded = true;
            betBtn.setVisible(false); foldBtn.setVisible(false);
            this.time.delayedCall(1400, () => {
              statusTxt.setText(i18n.t('pokerExhausted')).setColor('#e74c3c');
              this.time.delayedCall(1200, () => this.closeEvent({ pokerCard: 0 }));
            });
          } else {
            this.time.delayedCall(1200, () => {
              cards = gen();
              myCardTxt.setText('?').setColor('#6699cc');
              myLbl.setText(i18n.t('myCardHidden'));
              aiStarTxt.setText(`★ ${cards.aiStars}`);
              locked = false; betBtn.setAlpha(1); foldBtn.setAlpha(1);
              statusTxt.setText(i18n.t('betOrFold')).setColor('#cccccc');
            });
          }
        }
      });
    };

    // ── 배팅 버튼 ─────────────────────────────────────────────────────────────
    const betBtn = this.makeButton(B2_LEFT, BY, i18n.t('bet'), 0x1a5c1a, () => {
      if (gameEnded || locked) return;
      revealAndResolve();
    }, BW, 52);

    // ── 배팅 포기 버튼 ────────────────────────────────────────────────────────
    const foldBtn = this.makeButton(B2_RIGHT, BY, i18n.t('pokerFold'), 0x5c3a1a, () => {
      if (gameEnded || locked) return;
      if (foldTokens <= 0) {
        statusTxt.setText(i18n.t('noFoldToken')).setColor('#e74c3c');
        return;
      }
      // 내 카드 공개 후 포기 처리
      locked = true;
      betBtn.setAlpha(0.4); foldBtn.setAlpha(0.4);
      myCardTxt.setText(`★ ${cards.playerStars}`).setColor('#aaaaaa');
      myLbl.setText(i18n.t('myCardRevealed'));
      this.tweens.add({ targets: myCardTxt, scaleX: 1.2, scaleY: 1.2, duration: 150, yoyo: true });

      if (cards.playerStars === 5) {
        statusTxt.setText(i18n.t('pokerFiveStarFold')).setColor('#e74c3c');
        this.time.delayedCall(900, () => {
          myCardTxt.setText('?').setColor('#6699cc'); myLbl.setText(i18n.t('myCardHidden'));
          locked = false; betBtn.setAlpha(1); foldBtn.setAlpha(1);
          statusTxt.setText(i18n.t('betOrFold')).setColor('#cccccc');
        });
        return;
      }

      foldTokens--;
      statusTxt.setText(i18n.f('pokerFolded', { n: foldTokens })).setColor('#aaaaaa');
      this.time.delayedCall(900, () => {
        cards = gen();
        myCardTxt.setText('?').setColor('#6699cc'); myLbl.setText(i18n.t('myCardHidden'));
        aiStarTxt.setText(`★ ${cards.aiStars}`);
        tokenLabel.setText(`${i18n.t('foldToken')}: ${foldTokens}`);
        locked = false; betBtn.setAlpha(1); foldBtn.setAlpha(1);
        statusTxt.setText(i18n.t('betOrFold')).setColor('#cccccc');
      });
    }, BW, 56);

    this.root.add([
      title, divider, roundLabel, tokenLabel, attemptLabel,
      aiCardG, aiStarTxt, aiLbl,
      myCardG, myCardTxt, myLbl,
      statusTxt, winLbl,
      betBtn, foldBtn, takeNowBtn, continueBtn,
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
      [NODE_TYPE.BOSS_WATER]:     i18n.t('bossNameWater'),
      [NODE_TYPE.BOSS_FIRE]:      i18n.t('bossNameFire'),
      [NODE_TYPE.BOSS_GRASS]:     i18n.t('bossNameGrass'),
      [NODE_TYPE.BOSS_LIGHTNING]: i18n.t('bossNameLightning'),
      [NODE_TYPE.BOSS_EARTH]:     i18n.t('bossNameEarth'),
      [NODE_TYPE.BOSS_FINAL]:     i18n.t('bossNameFinal'),
    };

    // 보스 타입별 프레임
    const bossFrame: Partial<Record<number, string>> = {
      [NODE_TYPE.BOSS_WATER]: 'row2_0', [NODE_TYPE.BOSS_FIRE]: 'row2_1',
      [NODE_TYPE.BOSS_GRASS]: 'row2_2', [NODE_TYPE.BOSS_LIGHTNING]: 'row3_0',
      [NODE_TYPE.BOSS_EARTH]: 'row3_1', [NODE_TYPE.BOSS_FINAL]: 'row3_2',
    };
    const title = this.makeHeader(
      bossFrame[nodeType] ?? 'row2_0',
      i18n.f('bossAppear', { elem: elName }),
      -H * 0.32,
      72,
      isFinal ? '#ff4444' : '#d4af37',
    );
    const divider  = this.makeDivider(-H * 0.22);
    const nameTxt  = this.add.text(0, -H * 0.14, bossNames[nodeType] ?? '???', {
      fontFamily: FONT_B, fontSize: '32px', color: '#ffffff',
    }).setOrigin(0.5);
    const infoTxt  = this.makeBody(
      i18n.f('bossRoundInfo', { rounds }),
      H * 0.02,
    );
    const statsText = this.add.text(0, H * 0.14,
      i18n.f('bossStats', { hp: playerHp, maxHp: playerMaxHp, atk: playerAtk, def: playerDef, crit: playerCrit }),
      { fontFamily: FONT_L, fontSize: '15px', color: '#aaaaaa' },
    ).setOrigin(0.5);

    const startBtn = this.makeButton(0, H * 0.28, i18n.t('bossStartFight'), 0x8b0000, () => {
      this.closeEvent({ bossResult: 'win', bossType: nodeType });
    }, Math.round(W * 0.32), 64);

    this.root.add([title, divider, nameTxt, infoTxt, statsText, startBtn]);
  }
}
