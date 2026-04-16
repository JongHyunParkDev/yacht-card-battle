import Phaser from 'phaser';
import { AudioManager } from '@src/utils/Audio';
import { NODE_TYPE, BOSS_ELEMENT_NAME, isBossType } from '@src/data/nodeTypes';
import { CARD_DATA_LIST, type CardElement, type CardData } from '@src/data/cardData';
import { i18n } from '@src/utils/localization';
import {
  drawEquipment, formatEquipStats, getEquipmentById,
  EQUIP_GRADE_LABEL, EQUIP_GRADE_COLOR,
  type EquipmentData,
} from '@src/data/equipmentData';
import type { WeaponType } from '@src/scenes/CharacterSelectScene';
import Card, { CARD_WIDTH, CARD_HEIGHT } from '@src/objects/Card';
import { createTreasureEvent as _createTreasureEvent } from '@src/events/TreasureEvent';
import { createIndianPokerEvent as _createIndianPokerEvent, createDeckPurificationEvent as _createDeckPurificationEvent } from '@src/events/IndianPokerEvent';

// ─── 이벤트 데이터 타입 ────────────────────────────────────────────────────────

export interface NodeEventData {
  nodeType:        number;
  mapElement:      CardElement;
  nodeId:          number;
  currentGold:     number;
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
  deck:            { cardId: number; count: number; mult?: number; stars?: number; bonusValue?: number }[];
  playerCardMult:  number;
  playerShieldMult: number;
  /** 클리어한 맵 수 (적 스케일링용). 0 = 첫 번째 맵 */
  mapStage:        number;
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
  private legacyGold = 0;
  private goldHUD: Phaser.GameObjects.Container | null = null;

  constructor() { super('NodeEventScene'); }

  init(data: NodeEventData) {
    this.data_ = data;
    this.legacyGold = data.currentGold ?? 0;
  }

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
    else if (nodeType === NODE_TYPE.INDIAN_POKER) this.createDeckPurificationEvent();
    else if (isBossType(nodeType))                this.createBossEvent();
    else                                          this.closeEvent({});
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 공통 UI 헬퍼 (root 기준 상대 좌표)
  // ─────────────────────────────────────────────────────────────────────────────

  public makeDivider(y: number, w?: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.lineStyle(1, COLOR_GOLD, 0.3);
    const width = w ?? this.W * 0.4;
    g.lineBetween(-width, y, width, y);
    return g;
  }

  /** 타이틀 텍스트 */
  public makeTitle(text: string, y: number, color = '#d4af37'): Phaser.GameObjects.Text {
    return this.add.text(0, y, text, {
      fontFamily: FONT_B, fontSize: '34px', color,
    }).setOrigin(0.5);
  }

  /**
   * 노드 아이콘(map_nodes 프레임) + 타이틀 텍스트를 하나의 Container로 반환.
   * frame 예: 'row0_0', 'row1_2', 'row2_0' 등
   */
  public makeHeader(
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
  public makeBody(text: string, y: number): Phaser.GameObjects.Text {
    return this.add.text(0, y, text, {
      fontFamily: FONT_M, fontSize: '18px', color: '#cccccc',
      wordWrap: { width: this.W * 0.7 }, align: 'center',
    }).setOrigin(0.5);
  }

  /** 버튼 */
  public makeButton(
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
    btn.on('pointerdown', () => {
      AudioManager.play('CLICK');
      onDown();
    });
    return btn;
  }

  public closeEvent(result: Record<string, unknown>) {
    // 골드 변화가 있으면 시각적으로 보여주고 결과 확인 버튼 생성
    if (result.goldDelta && typeof result.goldDelta === 'number') {
      const delta = result.goldDelta;
      const popupTitle = delta > 0 ? '보상 획득!' : '골드 소비';
      const popupMsg = delta > 0 ? `${delta}G 를 획득하셨습니다.` : `${Math.abs(delta)}G 를 소비하셨습니다.`;
      
      this.tweens.add({
        targets: this.root, alpha: 0, duration: 180,
        onComplete: () => {
          this.root.removeAll(true);
          this.root.setAlpha(1);
          const resTitle = this.makeHeader('row0_3', popupTitle, -this.H * 0.15);
          const resMsg = this.add.text(0, 0, popupMsg, {
            fontFamily: FONT_M, fontSize: '22px', color: '#f5cc4a'
          }).setOrigin(0.5);
          const confirmBtn = this.makeButton(0, this.H * 0.20, i18n.t('confirm') || '확인', 0x27ae60, () => {
             this.emitAndResume(result);
          }, 140, 50);
          this.root.add([resTitle, resMsg, confirmBtn]);
        }
      });
    } else {
      this.emitAndResume(result);
    }
  }

  private emitAndResume(result: Record<string, unknown>) {
    // 이벤트 종료 시 BGM 정지
    this.sound.stopAll();
    
    this.game.events.emit('nodeEventComplete', { ...result, nodeId: this.data_.nodeId });
    this.scene.stop();
    this.scene.resume('MainScene');
  }

  /** 골드 변경 연출 (잠시 나타났다 사라짐) */
  private showGoldChange(delta: number) {
    const { width: W } = this.scale;
    const txt = delta > 0 ? `+${delta} G` : `${delta} G`;
    const col = delta > 0 ? '#d4af37' : '#e74c3c';
    
    const popup = this.add.container(W / 2, 60).setDepth(2000);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8).fillRoundedRect(-80, -25, 160, 50, 10);
    const label = this.add.text(0, 0, txt, {
      fontFamily: FONT_B, fontSize: '28px', color: col, stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);
    popup.add([bg, label]);
    
    popup.setAlpha(0).setY(40);
    this.tweens.add({ targets: popup, alpha: 1, y: 60, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: popup, alpha: 0, y: 30, duration: 400, delay: 1500, onComplete: () => popup.destroy() });

    // 보상 획득 사운드
    AudioManager.play('REWARD');
  }

  private scrollCont: Phaser.GameObjects.Container | null = null;
  private scrollMask: Phaser.Display.Masks.GeometryMask | null = null;
  private isDragging = false;
  private startX = 0;
  private maxScrollX = 0;

  public elementName(el: string): string {
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
      playerCardMult:   this.data_.playerCardMult,
      playerShieldMult: this.data_.playerShieldMult,
      playerEquipment:  this.data_.playerEquipment ?? [],
      isFinalBoss:      false,
      mapStage:         this.data_.mapStage ?? 0,
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
    this.sound.stopAll();
    this.sound.play('bgm_event_enhance', { loop: true, volume: AudioManager.bgmVol });

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

    const showResult = (p: typeof passives[number]) => {
      this.tweens.add({
        targets: this.root, alpha: 0, duration: 180,
        onComplete: () => {
          this.root.removeAll(true);
          this.root.setAlpha(1);
          AudioManager.play('UPGRADE');
          const resTitle = this.makeHeader('row0_2', '강화 성공!', -H * 0.35);
          const resName  = this.add.text(0, -H * 0.18, p.name, {
            fontFamily: FONT_B, fontSize: '28px', color: '#2ecc71'
          }).setOrigin(0.5);
          const resDiff  = this.add.text(0, -H * 0.07, p.desc, {
            fontFamily: FONT_M, fontSize: '20px', color: '#dddddd', align: 'center'
          }).setOrigin(0.5);
          const confirmBtn = this.makeButton(0, H * 0.25, i18n.t('confirm') || '확인', 0x1a5c1a, () => {
            this.closeEvent(p.result);
          }, Math.round(W * 0.28), 56);
          this.root.add([resTitle, resName, resDiff, confirmBtn]);
        }
      });
    };

    const BTN_SPACING = H * 0.10;
    const startY = -H * 0.17;
    const btns = passives.map((p, i) =>
      this.makeButton(
        0, startY + i * BTN_SPACING,
        `${p.name}  |  ${p.desc}`,
        0x1a3a1a, () => showResult(p),
        Math.round(W * 0.60), 48,
      ),
    );

    this.root.add([title, desc, divider, ...btns]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4 — 보물 이벤트
  // ─────────────────────────────────────────────────────────────────────────────

  private createTreasureEvent() {
    this.sound.stopAll();
    this.sound.play('bgm_event_treasure', { loop: true, volume: AudioManager.bgmVol });
    _createTreasureEvent(this, this.root, this.data_, this.W, this.H);
  }



  // ─────────────────────────────────────────────────────────────────────────────
  // 5 — 카드 뒤집기 골드 게임
  // ─────────────────────────────────────────────────────────────────────────────

  private createCardFlipEvent() {
    this.sound.stopAll();
    this.sound.play('bgm_event_flip', { loop: true, volume: AudioManager.bgmVol });

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
      this.tweens.add({
        targets: this.root, alpha: 0, duration: 180,
        onComplete: () => {
          this.root.removeAll(true);
          this.root.setAlpha(1);
          const resTitle = this.makeHeader('row0_4', '안전하게 나가기', -H * 0.35);
          const goldTxt  = this.add.text(0, -H * 0.1, '+10G', {
            fontFamily: FONT_B, fontSize: '48px', color: '#f5cc4a', stroke: '#000', strokeThickness: 4
          }).setOrigin(0.5);
          const confirmBtn = this.makeButton(0, H * 0.25, i18n.t('confirm') || '확인', 0x3a3000, () => {
            this.closeEvent({ goldDelta: 10 });
          }, Math.round(W * 0.28), 56);
          this.root.add([resTitle, goldTxt, confirmBtn]);
        }
      });
    }, Math.round(W * 0.24), 56);

    const takeBtn = this.makeButton(W * 0.01, H * 0.34, i18n.t('receive'), 0x1a5c1a, () => {
      if (gameOver) return;
      gameOver = true;
      // 받은 골드 결과 화면 보여주기
      this.tweens.add({
        targets: this.root, alpha: 0, duration: 180,
        onComplete: () => {
          this.root.removeAll(true);
          this.root.setAlpha(1);
          AudioManager.play('COIN');
          const resTitle = this.makeHeader('row0_4', '골드 획득!', -H * 0.35);
          const goldTxt  = this.add.text(0, -H * 0.1, `+${currentGold}G`, {
            fontFamily: FONT_B, fontSize: '48px', color: '#f5cc4a', stroke: '#000', strokeThickness: 4
          }).setOrigin(0.5);
          const confirmBtn = this.makeButton(0, H * 0.25, i18n.t('confirm') || '확인', 0x1a5c1a, () => {
            this.closeEvent({ goldDelta: currentGold });
          }, Math.round(W * 0.28), 56);
          this.root.add([resTitle, goldTxt, confirmBtn]);
        }
      });
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
  // 6 — 속성 변환 (카드 선택 → 목표 속성 선택 → 변환)
  // ─────────────────────────────────────────────────────────────────────────────

  private createCardSwapEvent() {
    this.sound.stopAll();
    this.sound.play('bgm_event_swap', { loop: true, volume: AudioManager.bgmVol });

    const H = this.H, W = this.W;
    const ELEMENTS: CardElement[]           = ['water', 'fire', 'grass', 'lightning', 'earth'];
    const ELEM_OFFSET: Record<string, number> = { water:0, fire:5, grass:10, lightning:15, earth:20 };
    const ATTR_IDX:   Record<string, number>  = { water:0, fire:1, grass:2, lightning:3, earth:4 };
    // 속성별 강조색 (숫자 → Phaser 색, 문자열 → CSS)
    const ECOL: Record<string, { n: number; s: string }> = {
      water:     { n: 0x56b4f7, s: '#56b4f7' },
      fire:      { n: 0xff6b35, s: '#ff6b35' },
      grass:     { n: 0x4caf50, s: '#4caf50' },
      lightning: { n: 0xffeb3b, s: '#ffeb3b' },
      earth:     { n: 0xc8906a, s: '#c8906a' },
    };

    // ── Step 1: 교환할 카드 선택 ───────────────────────────────────────────────
    const title   = this.makeHeader('row1_0', '속성 변환', -H * 0.38);
    const desc    = this.makeBody('교환할 속성 카드 1장을 선택하세요.\n어떤 속성으로 변환할지 직접 고를 수 있습니다.', -H * 0.29);
    const divider = this.makeDivider(-H * 0.21);
    this.root.add([title, desc, divider]);

    const elementalCards = this.data_.deck.filter(e => {
      const cd = CARD_DATA_LIST.find(c => c.id === e.cardId);
      return cd && cd.element !== 'normal';
    });

    if (elementalCards.length === 0) {
      this.root.add([
        this.makeBody('교환할 수 있는 속성 카드가 없습니다.', H * 0.02),
        this.makeButton(0, H * 0.22, '확인', 0x333333, () => this.closeEvent({}), Math.round(W * 0.22), 50),
      ]);
      return;
    }

    this.createScrollableCardGrid(elementalCards, 1.0, (entry, cardData) => {
      // ── Step 2: 목표 속성 선택 ──────────────────────────────────────────────
      this.tweens.add({ targets: this.root, alpha: 0, duration: 180, onComplete: () => {
        this.root.removeAll(true);
        this.root.setAlpha(1);

        this.root.add([
          this.makeHeader('row1_0', '변환할 속성 선택', -H * 0.38),
          this.add.text(0, -H * 0.27, `[${i18n.t(cardData.nameKey)}]를 어떤 속성으로?`, {
            fontFamily: FONT_B, fontSize: '20px', color: '#f39c12', align: 'center',
          }).setOrigin(0.5),
          this.makeDivider(-H * 0.19),
        ]);

        const targets = ELEMENTS.filter(e => e !== cardData.element);
        const BW = Math.round(Math.min(W * 0.15, 100));
        const BH = 110;
        const totalW = targets.length * (BW + 16) - 16;
        const startX = -totalW / 2 + BW / 2;

        targets.forEach((toElem, i) => {
          const col    = ECOL[toElem];
          const off    = ELEM_OFFSET[toElem];
          const toCard = off != null ? CARD_DATA_LIST[off + cardData.stars - 1] : null;
          const bx     = startX + i * (BW + 16);
          const by     = H * 0.02;

          const cont = this.add.container(bx, by);
          const bg   = this.add.graphics();
          bg.fillStyle(col.n, 0.12);
          bg.lineStyle(2, col.n, 0.7);
          bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 10);
          bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 10);
          const icon = this.add.image(0, -18, 'attr_icons', `attr_${ATTR_IDX[toElem]}`);
          icon.setDisplaySize(40, 40);
          const lbl = this.add.text(0, 32, this.elementName(toElem), {
            fontFamily: FONT_B, fontSize: '14px', color: col.s,
          }).setOrigin(0.5);

          cont.add([bg, icon, lbl]);
          cont.setSize(BW, BH);
          cont.setInteractive({ useHandCursor: true });
          cont.on('pointerover', () => this.tweens.add({ targets: cont, scaleX: 1.08, scaleY: 1.08, duration: 70 }));
          cont.on('pointerout',  () => this.tweens.add({ targets: cont, scaleX: 1,    scaleY: 1,    duration: 70 }));
          cont.on('pointerdown', () => {
            // ── Step 3: 결과 확인 ──────────────────────────────────────────
            this.tweens.add({ targets: this.root, alpha: 0, duration: 180, onComplete: () => {
              this.root.removeAll(true);
              this.root.setAlpha(1);
              AudioManager.play('UPGRADE');
              const group: Phaser.GameObjects.GameObject[] = [
                this.makeHeader('row1_0', '속성 변환 완료!', -H * 0.38),
                this.add.text(0, -H * 0.27,
                  `${i18n.t(cardData.nameKey)}  →  ${toCard ? i18n.t(toCard.nameKey) : this.elementName(toElem)}`, {
                  fontFamily: FONT_B, fontSize: '20px', color: '#f5cc4a', align: 'center',
                }).setOrigin(0.5),
              ];
              if (toCard) {
                const SC = 0.88, sw = CARD_WIDTH * SC, sh = CARD_HEIGHT * SC, gx = W * 0.22;
                group.push(
                  new Card(this, -gx - sw / 2, -H * 0.07 - sh / 2, cardData).setScale(SC),
                  this.add.text(0, -H * 0.07, '▶', { fontFamily: FONT_B, fontSize: '40px', color: '#fff' }).setOrigin(0.5),
                  new Card(this,  gx - sw / 2, -H * 0.07 - sh / 2, toCard).setScale(SC),
                );
              }
              group.push(this.makeButton(0, H * 0.34, '확인', 0x27ae60, () => {
                this.closeEvent({ swapCardId: entry.cardId, swapTo: toElem });
              }, Math.round(W * 0.28), 60));
              this.root.add(group);
            }});
          });
          this.root.add(cont);
        });
      }});
    }, '#f39c12');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7 — 하트 카드 (생명력 제단: 희생 티어 선택)
  // ─────────────────────────────────────────────────────────────────────────────

  private createHeartEvent() {
    this.sound.stopAll();
    this.sound.play('bgm_event_heart', { loop: true, volume: AudioManager.bgmVol });

    const H = this.H;
    const W = this.W;
    const { playerHp, playerMaxHp } = this.data_;

    const title   = this.makeHeader('row1_1', '생명력 제단', -H * 0.40);
    const divider = this.makeDivider(-H * 0.32);
    const hpTxt   = this.add.text(0, -H * 0.25, `현재 HP: ${playerHp} / ${playerMaxHp}`, {
      fontFamily: FONT_M, fontSize: '18px', color: '#aaaaaa',
    }).setOrigin(0.5);
    const desc = this.add.text(0, -H * 0.18, '생명력을 바쳐 카드 밸류를 강화합니다.\n더 많이 희생할수록 더 큰 강화를 얻습니다.', {
      fontFamily: FONT_M, fontSize: '16px', color: '#cccccc', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5);
    this.root.add([title, divider, hpTxt, desc]);

    // 희생 티어 정의
    const tiers = [
      { hpCost: 5,  mult: 1.05, label: '소 희생  −5 HP  →  +5%', color: 0x8b4513 },
      { hpCost: 10, mult: 1.10, label: '중 희생  −10 HP  →  +10%', color: 0x8b0000 },
      { hpCost: 20, mult: 1.20, label: '대 희생  −20 HP  →  +20%', color: 0x4a0000 },
    ];

    const BW = Math.round(W * 0.40);
    const BH = 52;
    const startY = -H * 0.06;
    const gap = H * 0.11;

    tiers.forEach((tier, i) => {
      const canUse = playerHp > tier.hpCost;
      const btn = this.makeButton(0, startY + i * gap, tier.label, tier.color, () => {
        this.tweens.add({ targets: this.root, alpha: 0, duration: 180, onComplete: () => {
          this.root.removeAll(true);
          this.root.setAlpha(1);
          AudioManager.play('UPGRADE');
          const resTitle = this.makeHeader('row1_1', '제단 강화 완료!', -H * 0.20);
          const resDesc  = this.add.text(0, -H * 0.04,
            `HP  ${playerHp}  →  ${Math.max(1, playerHp - tier.hpCost)}\n모든 카드 밸류  +${((tier.mult - 1) * 100).toFixed(0)}% 증가`, {
            fontFamily: FONT_B, fontSize: '28px', color: '#2ecc71',
            align: 'center', lineSpacing: 10,
          }).setOrigin(0.5);
          const confirmBtn = this.makeButton(0, H * 0.22, '확인', 0x1a5c1a, () => {
            this.closeEvent({ hpDelta: -tier.hpCost, cardValueMultiplier: tier.mult });
          }, Math.round(W * 0.28), 56);
          this.root.add([resTitle, resDesc, confirmBtn]);
        }});
      }, BW, BH);
      if (!canUse) btn.setAlpha(0.35).disableInteractive();
      this.root.add(btn);
    });

    // 거절 버튼
    const refuseBtn = this.makeButton(0, startY + tiers.length * gap, '제단을 떠난다', 0x333333, () => {
      this.closeEvent({});
    }, Math.round(W * 0.28), 46);
    this.root.add(refuseBtn);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8 — 방어 카드 (쉴드 강화 OR HP 회복 선택)
  // ─────────────────────────────────────────────────────────────────────────────

  private createShieldEvent() {
    this.sound.stopAll();
    this.sound.play('bgm_event_shield', { loop: true, volume: AudioManager.bgmVol });

    const H = this.H;
    const W = this.W;
    const { playerHp, playerMaxHp } = this.data_;
    const healAmt = Math.floor(playerMaxHp * 0.28);

    // 덱에서 방어 카드 필터링
    const shieldCards = this.data_.deck.filter(e => {
      const cd = CARD_DATA_LIST.find(c => c.id === e.cardId);
      return cd && (cd.key === 'defense' || cd.key === 'shield' || cd.effects?.some(eff => eff.type === 'shield_add'));
    });
    const hasShieldCards = shieldCards.length > 0;
    const alreadyFull = playerHp >= playerMaxHp;

    const title   = this.makeHeader('row1_2', '회복의 샘', -H * 0.38);
    const divider = this.makeDivider(-H * 0.30, W * 0.7);
    const desc    = this.add.text(0, -H * 0.22,
      '두 가지 중 하나를 선택하세요.', {
      fontFamily: FONT_M, fontSize: '17px', color: '#cccccc', align: 'center',
    }).setOrigin(0.5);
    this.root.add([title, divider, desc]);

    // ── 선택지 A: HP 회복 ──────────────────────────────────────────────────────
    const hpLabel = alreadyFull
      ? `HP 회복  (이미 최대치)`
      : `HP 회복  (+${healAmt}  ${playerHp} → ${Math.min(playerMaxHp, playerHp + healAmt)})`;

    const healBtn = this.makeButton(-W * 0.18, -H * 0.06, hpLabel, 0x1a5c1a, () => {
      this.tweens.add({ targets: this.root, alpha: 0, duration: 180, onComplete: () => {
        this.root.removeAll(true);
        this.root.setAlpha(1);
        this.root.add([
          this.makeHeader('row1_2', 'HP 회복!', -H * 0.20),
          this.add.text(0, -H * 0.04,
            `HP  ${playerHp}  →  ${Math.min(playerMaxHp, playerHp + healAmt)}`, {
            fontFamily: FONT_B, fontSize: '30px', color: '#2ecc71', align: 'center',
          }).setOrigin(0.5),
          this.makeButton(0, H * 0.20, '확인', 0x1a5c1a, () => {
            this.closeEvent({ hpDelta: healAmt });
          }, Math.round(W * 0.26), 54),
        ]);
      }});
    }, Math.round(W * 0.30), 60);
    if (alreadyFull) healBtn.setAlpha(0.4).disableInteractive();

    // ── 선택지 B: 방어 카드 강화 ──────────────────────────────────────────────
    const shieldBtnLabel = hasShieldCards
      ? '방어 카드 강화  (×1.2)'
      : '방어 카드 강화  (덱에 방어 카드 없음)';

    const shieldBtn = this.makeButton(W * 0.18, -H * 0.06, shieldBtnLabel, 0x1a3a6c, () => {
      this.tweens.add({ targets: this.root, alpha: 0, duration: 180, onComplete: () => {
        this.root.removeAll(true);
        this.root.setAlpha(1);

        this.root.add([
          this.makeHeader('row1_2', '방어막 강화', -H * 0.38),
          this.makeDivider(-H * 0.30, W * 0.7),
          this.add.text(0, -H * 0.23, '강화할 방어 카드를 선택하세요.\n효과가 ×1.2 증가합니다.', {
            fontFamily: FONT_M, fontSize: '17px', color: '#dddddd', align: 'center',
          }).setOrigin(0.5),
        ]);

        this.createScrollableCardGrid(shieldCards, 1.2, (entry, cardData, curM, nextM) => {
          this.tweens.add({ targets: this.root, alpha: 0, duration: 200, onComplete: () => {
            this.root.removeAll(true);
            this.root.setAlpha(1);
            const SC2 = Math.min(1.15, H * 0.46 / CARD_HEIGHT);
            const previewCard = new Card(this, -(CARD_WIDTH * SC2) / 2, -H * 0.17, cardData);
            previewCard.setScale(SC2);
            this.root.add([
              this.makeHeader('row1_2', '방어막 강화!', -H * 0.35),
              previewCard,
              this.add.text(0, H * 0.18,
                `[${i18n.t(cardData.nameKey)}]\n×${curM.toFixed(1)}  →  ×${nextM.toFixed(1)}`, {
                fontFamily: FONT_B, fontSize: '24px', color: '#56b4f7', align: 'center',
              }).setOrigin(0.5),
              this.makeButton(0, H * 0.32, '확인', 0x1a3a6c, () => {
                this.closeEvent({ upgradeCardId: entry.cardId, upgradeCardMult: 1.2 });
              }, Math.round(W * 0.28), 56),
            ]);
          }});
        }, '#56b4f7');
      }});
    }, Math.round(W * 0.30), 60);
    if (!hasShieldCards) shieldBtn.setAlpha(0.4).disableInteractive();

    this.root.add([healBtn, shieldBtn]);

    // 둘 다 불가 시 안내
    if (alreadyFull && !hasShieldCards) {
      const noneBtn = this.makeButton(0, H * 0.12, '이용할 수 없습니다  (통과)', 0x333333, () => {
        this.closeEvent({});
      }, Math.round(W * 0.30), 48);
      this.root.add(noneBtn);
    }
  }

  /** 카드 선택 버튼 목록을 렌더링하고, 선택 시 결과 화면 → closeEvent 흐름 처리 */
  private renderCardSelectButtons(
    entries: { cardId: number; count: number; mult?: number }[],
    multGain: number,
    H: number, W: number,
    eventResKey: string,
  ) {
    const COLS      = Math.min(entries.length, 5);
    const CARD_SC   = Math.min(0.72, (W * 0.85) / (COLS * (CARD_WIDTH + 14)));
    const scaledW   = CARD_WIDTH  * CARD_SC;
    const scaledH   = CARD_HEIGHT * CARD_SC;
    const gapX      = 16;
    const gapY      = 18;
    const totalW    = COLS * scaledW + (COLS - 1) * gapX;
    const startX    = -totalW / 2 + scaledW / 2;
    const startY    = -H * 0.05;

    entries.forEach((entry, i) => {
      const cardData = CARD_DATA_LIST.find(c => c.id === entry.cardId);
      if (!cardData) return;

      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx  = startX + col * (scaledW + gapX);
      const cy  = startY + row * (scaledH + gapY);

      const currentMult  = entry.mult ?? 1.0;
      const nextMult     = parseFloat((currentMult + (multGain - 1)).toFixed(2));
      const globalMult   = this.data_.playerCardMult ?? 1.0;
      const effCurrent   = parseFloat((currentMult * globalMult).toFixed(2));
      const effNext      = parseFloat((nextMult     * globalMult).toFixed(2));

      const isElem = cardData.element !== 'normal';
      const card = new Card(this, cx - scaledW / 2, cy - scaledH / 2,
        isElem
          ? { ...cardData, mult: effCurrent }
          : { ...cardData, bonusValue: (entry as any).bonusValue, mult: effCurrent },
        isElem ? undefined : ((entry as any).stars ?? 0));
      card.setScale(CARD_SC).setInteractive(new Phaser.Geom.Rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT), Phaser.Geom.Rectangle.Contains);

      const multTxt = this.add.text(cx, cy - scaledH / 2 - 8,
        `×${effCurrent.toFixed(1)} → ×${effNext.toFixed(1)}`, {
          fontFamily: FONT_B, fontSize: '11px', color: '#ffb347', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 1);

      card.on('pointerover', () => this.tweens.add({ targets: card, scaleX: CARD_SC * 1.1, scaleY: CARD_SC * 1.1, duration: 100 }));
      card.on('pointerout', () => this.tweens.add({ targets: card, scaleX: CARD_SC, scaleY: CARD_SC, duration: 100 }));

      card.on('pointerdown', () => {
        this.tweens.add({
          targets: this.root, alpha: 0, duration: 200,
          onComplete: () => {
            this.root.removeAll(true);
            this.root.setAlpha(1);
            const resTitle = this.makeHeader('row1_2', '카드 강화 완료!', -H * 0.35);

            const SC2 = Math.min(1.15, H * 0.46 / CARD_HEIGHT);
            const previewCard = new Card(this, -(CARD_WIDTH * SC2) / 2, -H * 0.17,
              isElem
                ? { ...cardData, mult: effNext }
                : { ...cardData, bonusValue: (entry as any).bonusValue, mult: effNext },
              isElem ? undefined : ((entry as any).stars ?? 0));
            previewCard.setScale(SC2);
            this.root.add(previewCard);

            const resDesc = this.add.text(0, H * 0.18,
              `[${i18n.t(cardData.nameKey)}]\n×${effCurrent.toFixed(1)}  →  ×${effNext.toFixed(1)}`, {
                fontFamily: FONT_B, fontSize: '24px', color: '#56b4f7', align: 'center'
              }).setOrigin(0.5);

            const confirmBtn = this.makeButton(0, H * 0.32, i18n.t('confirm') || '확인', 0x1a3a6c, () => {
              const res: Record<string, unknown> = { upgradeCardId: entry.cardId, upgradeCardMult: multGain };
              if (eventResKey === 'accepted') res.accepted = true;
              this.closeEvent(res);
            }, Math.round(W * 0.28), 56);
            this.root.add([resTitle, resDesc, confirmBtn]);
          }
        });
      });
      this.root.add([multTxt, card]);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9 — 별 카드 (속성 카드 별 +1)
  // ─────────────────────────────────────────────────────────────────────────────

  private createStarEvent() {
    this.sound.stopAll();
    this.sound.play('bgm_event_star', { loop: true, volume: AudioManager.bgmVol });

    const H = this.H;
    const W = this.W;

    const title   = this.makeHeader('row1_3', i18n.t('starTitle'), -H * 0.37);
    const divider = this.makeDivider(-H * 0.28, W * 0.7);
    const desc    = this.add.text(0, -H * 0.21, '별(등급)을 하나 추가할 카드를 선택하세요 (드래그하여 탐색)', {
      fontFamily: FONT_M, fontSize: '17px', color: '#dddddd', align: 'center'
    }).setOrigin(0.5);

    this.root.add([title, divider, desc]);

    const deckList = this.data_.deck;

    // 전체 덱을 그리드로 보여주되, 업그레이드 가능 여부에 따라 인터랙션 제어
    this.createScrollableCardGrid(deckList, 1.0, (entry, cardData) => {
      const isElemental  = cardData.element !== 'normal';
      const starsNow     = isElemental ? cardData.stars : (entry.stars ?? 0);
      const isMaxed      = starsNow >= 5;

      if (isMaxed) return;

      const starsNext = starsNow + 1;
      const SC2 = Math.min(1.1, H * 0.44 / CARD_HEIGHT);

      this.tweens.add({
        targets: this.root, alpha: 0, duration: 200,
        onComplete: () => {
          this.root.removeAll(true);
          this.root.setAlpha(1);
          AudioManager.play('UPGRADE');
          const resTitle = this.makeHeader('row1_3', '⭐ 별 업그레이드!', -H * 0.37);

          // 속성 카드: 다음 등급 카드 미리보기 / 일반 카드: 별 증가 미리보기
          let previewCard: Card | null = null;
          if (isElemental) {
            const off = this.ELEM_OFFSET[cardData.element];
            const nextCardData = off != null ? CARD_DATA_LIST[off + cardData.stars] : null;
            if (nextCardData) {
              previewCard = new Card(this, -(CARD_WIDTH * SC2) / 2, -H * 0.27, nextCardData);
            }
          } else {
            // 일반 카드: stars + bonusValue 반영된 미리보기
            const BONUS_PER_STAR_PRV: Record<number, number> = { 25: 5, 26: 5, 27: 3, 28: 2, 29: 5 };
            const bonusAmtPrv = BONUS_PER_STAR_PRV[cardData.id] ?? 3;
            const nextBonus   = (entry.bonusValue || 0) + bonusAmtPrv;
            const nextMult    = parseFloat(((entry.mult || 1.0) * 1.25).toFixed(2));
            previewCard = new Card(this, -(CARD_WIDTH * SC2) / 2, -H * 0.27,
              { ...cardData, bonusValue: nextBonus, mult: nextMult }, starsNext);
          }

          if (previewCard) {
            previewCard.setScale(SC2);
            this.root.add(previewCard);
          }

          // 일반 카드: 데미지 보너스 정보도 표시
          const BONUS_PER_STAR: Record<number, number> = { 25: 5, 26: 5, 27: 3, 28: 2, 29: 5 };
          const KEY_LABEL_SHORT: Record<string, string> = { attack: 'ATK', defense: 'DEF', spear: 'SPEAR', arrow: 'ARROW', hp: 'HP' };
          const bonusAmt = !isElemental ? (BONUS_PER_STAR[cardData.id] ?? 3) : 0;
          const curBonus = !isElemental ? (entry.bonusValue ?? 0) : 0;
          const bonusLabel = !isElemental
            ? `\n+${KEY_LABEL_SHORT[cardData.key] ?? 'VAL'} ${curBonus} → ${curBonus + bonusAmt}` +
              `\n밸류 ×${(entry.mult ?? 1).toFixed(2)} → ×${((entry.mult ?? 1) * 1.25).toFixed(2)}`
            : '';

          const resDesc = this.add.text(0, H * 0.24,
            `[${i18n.t(cardData.nameKey)}]\n${'★'.repeat(starsNow)}  →  ${'★'.repeat(starsNext)}${bonusLabel}`, {
              fontFamily: FONT_B, fontSize: '20px', color: '#f1c40f', align: 'center'
            }).setOrigin(0.5);

          const confirmBtn = this.makeButton(0, H * 0.40, i18n.t('confirm') || '확인', 0x1a5c1a, () => {
            if (isElemental) {
              this.closeEvent({ upgradeStarCardId: entry.cardId });
            } else {
              this.closeEvent({ upgradeNormalStarCardId: entry.cardId });
            }
          }, Math.round(W * 0.26), 56);

          this.root.add([resTitle, resDesc, confirmBtn]);
        }
      });
    }, '#f1c40f', true);
  }

  private readonly ELEM_OFFSET: Record<string, number> = { water:0, fire:5, grass:10, lightning:15, earth:20 };

  /**
   * 스크롤 가능한 카드 그리드 (가로 1행, 씬 레벨 드래그)
   *
   * ─ 구조 변경 이유 ─
   * 기존: bgZone을 listCont 위에 추가 → bgZone이 Z-order상 최상위가 되어
   *        카드 위에 올라가 모든 포인터 이벤트를 가로챔 → 카드 클릭 불가.
   * 현재: bgZone 제거, 씬(scene.input) 레벨에서 드래그를 감지.
   *        카드는 직접 setInteractive 후 pointerup으로 클릭을 처리.
   *
   * ─ 2행 레이아웃 제거 이유 ─
   * 2행 시 카드가 마스크 밖으로 넘어가 잘리는 문제 → 1행 가로 스크롤로 통일.
   */
  public createScrollableCardGrid(
    list: { cardId: number; count: number; mult?: number }[],
    multGain: number,
    onClick: (entry: any, data: CardData, curM: number, nextM: number) => void,
    color: string,
    isStar = false
  ) {
    const { width: W, height: H } = this.scale;

    // 개별 카드로 펼치기
    const flatList: any[] = [];
    list.forEach(e => {
      for (let i = 0; i < (e.count || 1); i++) {
        flatList.push({ ...e, count: 1 });
      }
    });

    // 카드 스케일: 그리드가 화면 하단(버튼 영역 포함)에 맞도록 적응형 결정
    // 가용 높이 = 화면 절반에서 그리드 위치(GRID_Y)를 더한 위치까지 ~45%H
    const CARD_SC = Math.min(0.68, H * 0.30 / CARD_HEIGHT);
    const scaledW = CARD_WIDTH  * CARD_SC;
    const scaledH = CARD_HEIGHT * CARD_SC;
    const gapX    = 16;
    const LABEL_H = 18;                      // 라벨 공간
    const GRID_Y  = H * 0.07;               // 제목 영역 아래로 내림

    // 마스크: 1행 카드 + 라벨이 정확히 들어오는 높이
    const maskW = W * 0.92;
    const maskH = scaledH + LABEL_H + 14;
    const maskX = W / 2 - maskW / 2;
    const maskY = H / 2 + GRID_Y - maskH / 2;

    const shape = this.make.graphics({});
    shape.fillStyle(0xffffff);
    shape.fillRect(maskX, maskY, maskW, maskH);
    const mask = shape.createGeometryMask();

    const listCont = this.add.container(0, GRID_Y);
    listCont.setMask(mask);
    this.root.add(listCont);

    // 전체 그리드 너비 계산 → 스크롤 한계
    const totalGridW = flatList.length * (scaledW + gapX) - gapX;
    this.maxScrollX = Math.max(0, totalGridW - maskW + 40);

    flatList.forEach((entry, i) => {
      const cardData = CARD_DATA_LIST.find(c => c.id === entry.cardId);
      if (!cardData) return;
      const currentMult = entry.mult ?? 1.0;
      const nextMult    = parseFloat((currentMult + (multGain - 1)).toFixed(2));
      const globalMult  = this.data_.playerCardMult ?? 1.0;
      const effCurrent  = parseFloat((currentMult * globalMult).toFixed(2));
      const effNext     = parseFloat((nextMult     * globalMult).toFixed(2));

      // cx = 카드 중심 X (listCont 기준)
      const cx = i * (scaledW + gapX) - maskW / 2 + scaledW / 2 + 20;
      const cy = LABEL_H / 2;  // 라벨 공간만큼 아래로

      const isElemental    = cardData.element !== 'normal';
      const effectiveStars = isElemental ? cardData.stars : (entry.stars ?? 0);
      const isMaxed        = effectiveStars >= 5;
      const canUpgrade     = isStar ? !isMaxed : true;

      const totalMult = parseFloat((currentMult * globalMult).toFixed(4));
      const card = new Card(this, cx - scaledW / 2, cy - scaledH / 2,
        !isElemental
          ? { ...cardData, bonusValue: entry.bonusValue, mult: totalMult }
          : { ...cardData, mult: totalMult },
        !isElemental ? effectiveStars : undefined);
      card.setScale(CARD_SC);

      if (canUpgrade) {
        card.setInteractive(
          new Phaser.Geom.Rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT),
          Phaser.Geom.Rectangle.Contains,
        );
      } else {
        card.setAlpha(0.35);
      }

      // 강화 수치 라벨
      let label: Phaser.GameObjects.Text | null = null;
      if (isStar && canUpgrade) {
        const sn = effectiveStars;
        label = this.add.text(cx, cy - scaledH / 2 - 4,
          `${'★'.repeat(sn)}→${'★'.repeat(Math.min(sn + 1, 5))}`, {
          fontFamily: FONT_B, fontSize: '11px', color, stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 1);
      } else if (multGain !== 1.0 && canUpgrade) {
        label = this.add.text(cx, cy - scaledH / 2 - 4,
          `×${effCurrent.toFixed(1)}→×${effNext.toFixed(1)}`, {
          fontFamily: FONT_B, fontSize: '12px', color, stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 1);
      }

      card.on('pointerover', () => {
        if (!this.isDragging) {
            AudioManager.play('CARD_HOVER');
          this.tweens.add({ targets: card, scaleX: CARD_SC * 1.07, scaleY: CARD_SC * 1.07, duration: 80 });
        }
      });
      card.on('pointerout', () =>
        this.tweens.add({ targets: card, scaleX: CARD_SC, scaleY: CARD_SC, duration: 80 }),
      );
      // 클릭 = pointerup 시 isDragging이 false인 경우만
      card.on('pointerup', () => {
        if (!this.isDragging) {
            AudioManager.play('CARD_SELECT');
          onClick(entry, cardData, currentMult, nextMult);
        }
      });

      listCont.add(card);
      if (label) listCont.add(label);
    });

    // ── 씬 레벨 드래그 (bgZone 불필요 — 카드 클릭 차단 문제 원천 제거) ──────────
    let contStartX = 0;

    const onDown = (pointer: Phaser.Input.Pointer) => {
      this.startX  = pointer.x;
      contStartX   = listCont.x;
      this.isDragging = false;
    };
    const onMove = (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !listCont.active) return;
      const dx = pointer.x - this.startX;
      if (Math.abs(dx) > 10) this.isDragging = true;
      if (this.isDragging) {
        let tx = contStartX + dx;
        if (tx > 0)                   tx *= 0.25;
        if (tx < -this.maxScrollX)    tx  = -this.maxScrollX + (tx + this.maxScrollX) * 0.25;
        listCont.setX(tx);
      }
    };
    const onUp = () => {
      if (!listCont.active) return;
      if (listCont.x > 0)
        this.tweens.add({ targets: listCont, x: 0, duration: 250, ease: 'Back.easeOut' });
      else if (listCont.x < -this.maxScrollX)
        this.tweens.add({ targets: listCont, x: -this.maxScrollX, duration: 250, ease: 'Back.easeOut' });
    };

    this.input.on('pointerdown', onDown);
    this.input.on('pointermove', onMove);
    this.input.on('pointerup',   onUp);

    // 씬 종료 시 리스너 정리
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', onDown);
      this.input.off('pointermove', onMove);
      this.input.off('pointerup',   onUp);
      shape.destroy();
    });

    // 드래그 안내 (카드 4장 초과 시)
    if (flatList.length > 4) {
      const guide = this.add.text(0, GRID_Y + scaledH / 2 + LABEL_H + 14,
        '◀  좌우로 드래그하여 카드 탐색  ▶', {
        fontFamily: FONT_M, fontSize: '13px', color: '#888888',
      }).setOrigin(0.5);
      this.root.add(guide);
      this.tweens.add({ targets: guide, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10 — 인디언 포커
  // ─────────────────────────────────────────────────────────────────────────────

  private createIndianPokerEvent() {
    this.sound.stopAll();
    this.sound.play('bgm_event_poker', { loop: true, volume: AudioManager.bgmVol });
    _createIndianPokerEvent(this, this.root, this.data_, this.W, this.H);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10 — 덱 정화 (카드 1장 제거 + 보너스 1성 강화)
  // ─────────────────────────────────────────────────────────────────────────────

  private createDeckPurificationEvent() {
    this.sound.stopAll();
    this.sound.play('bgm_event_poker', { loop: true, volume: AudioManager.bgmVol });
    _createDeckPurificationEvent(this, this.root, this.data_, this.W, this.H);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 11~18 — 보스 이벤트
  // ─────────────────────────────────────────────────────────────────────────────

  private createBossEvent() {
    const H = this.H;
    const W = this.W;
    const {
      nodeType, playerHp, playerMaxHp, playerAtk, playerDef, playerCrit, playerCritDmg,
      characterWeapon, deck, nodeId,
    } = this.data_;
    const isFinal  = nodeType === NODE_TYPE.BOSS_FINAL;
    const rounds   = isFinal ? 3 : 2;
    const elName   = BOSS_ELEMENT_NAME[nodeType] ?? '???';

    // 보스 타입 → mapElement 매핑
    const BOSS_ELEMENT_MAP: Partial<Record<number, string>> = {
      [NODE_TYPE.BOSS_WATER]:     'water',
      [NODE_TYPE.BOSS_FIRE]:      'fire',
      [NODE_TYPE.BOSS_GRASS]:     'grass',
      [NODE_TYPE.BOSS_LIGHTNING]: 'lightning',
      [NODE_TYPE.BOSS_EARTH]:     'earth',
      [NODE_TYPE.BOSS_FINAL]:     'normal',
    };
    const bossElement = (BOSS_ELEMENT_MAP[nodeType] ?? 'normal') as import('@src/data/cardData').CardElement;

    const bossNames: Partial<Record<number, string>> = {
      [NODE_TYPE.BOSS_WATER]:     i18n.t('bossNameWater'),
      [NODE_TYPE.BOSS_FIRE]:      i18n.t('bossNameFire'),
      [NODE_TYPE.BOSS_GRASS]:     i18n.t('bossNameGrass'),
      [NODE_TYPE.BOSS_LIGHTNING]: i18n.t('bossNameLightning'),
      [NODE_TYPE.BOSS_EARTH]:     i18n.t('bossNameEarth'),
      [NODE_TYPE.BOSS_FINAL]:     i18n.t('bossNameFinal'),
    };

    const bossFrame: Partial<Record<number, string>> = {
      [NODE_TYPE.BOSS_WATER]: 'row2_0', [NODE_TYPE.BOSS_FIRE]: 'row2_1',
      [NODE_TYPE.BOSS_GRASS]: 'row2_2', [NODE_TYPE.BOSS_LIGHTNING]: 'row3_0',
      [NODE_TYPE.BOSS_EARTH]: 'row3_1', [NODE_TYPE.BOSS_FINAL]: 'row3_3',
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
      // 실제 보스 배틀 씬 실행
      this.scene.launch('BattleScene', {
        nodeId,
        isBoss:      true,
        isElemental: bossElement !== 'normal',
        mapElement:  bossElement,
        mobName:     bossNames[nodeType] ?? 'Boss',
        playerHp,
        playerMaxHp,
        playerAtk,
        playerDef,
        playerCrit,
        playerCritDmg,
        characterWeapon,
        deck,
        playerCardMult:   this.data_.playerCardMult,
        playerShieldMult: this.data_.playerShieldMult,
        playerEquipment:  this.data_.playerEquipment ?? [],
        isFinalBoss:      isFinal,
        mapStage:         this.data_.mapStage ?? 0,
      });
      // NodeEventScene 자신은 종료 (BattleScene이 nodeEventComplete 직접 발행)
      this.scene.stop();
    }, Math.round(W * 0.32), 64);

    this.root.add([title, divider, nameTxt, infoTxt, statsText, startBtn]);
  }
}
