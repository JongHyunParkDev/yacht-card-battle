import Phaser from 'phaser';
import { CARD_DATA_LIST, CardData, CardElement, ELEMENT_ATTR_INDEX } from '@src/data/cardData';
import { i18n } from '@src/utils/localization';
import { WeaponType, CHAR_SPRITE_KEY, CHAR_FRAME_COUNT } from '@src/scenes/CharacterSelectScene';

// ─── 인터페이스 ───────────────────────────────────────────────────────────────

export interface BattleSceneData {
  nodeId:          number;
  isElemental:     boolean;
  mapElement:      CardElement;
  mobName:         string;
  playerHp:        number;
  playerMaxHp:     number;
  playerAtk:       number;
  playerDef:       number;
  playerCrit:      number;
  playerCritDmg:   number;
  characterWeapon: WeaponType;
  deck:            { cardId: number; count: number }[];
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const ELEM_COLORS: Record<string, number> = {
  water:     0x4db8ff,
  fire:      0xff6b35,
  grass:     0x5ddb7a,
  lightning: 0xffe033,
  earth:     0xc8a04a,
  normal:    0xcccccc,
};

// Water > Fire > Grass > Earth > Lightning > Water
const TYPE_BEATS: Record<string, string> = {
  water:     'fire',
  fire:      'grass',
  grass:     'earth',
  earth:     'lightning',
  lightning: 'water',
};

const HAND_SIZE   = 5;
const MAX_TURNS   = 20;
const CARD_SCALE  = 0.55;
const FONT_B      = 'SBAggroB';
const FONT_M      = 'SBAggroM';
const FONT_L      = 'SBAggroL';
const COLOR_GOLD  = 0xd4af37;
const COLOR_BG    = 0x0d1117;

// ─── BattleScene ──────────────────────────────────────────────────────────────

export default class BattleScene extends Phaser.Scene {
  private data_!: BattleSceneData;
  private W = 0;
  private H = 0;

  // ── 배틀 상태 ─────────────────────────────────────────────────────────────
  private playerCurrentHp = 0;
  private enemyCurrentHp  = 0;
  private enemyMaxHp      = 0;
  private enemyAtk        = 0;
  private enemyDef        = 0;
  private currentTurn     = 1;
  private isAnimating     = false;
  private battleEnded     = false;

  // ── 카드 상태 ─────────────────────────────────────────────────────────────
  private expandedDeck: CardData[] = [];
  private hand:         CardData[] = [];
  private rerollsUsed:  boolean[]  = Array(HAND_SIZE).fill(false);

  // ── UI ────────────────────────────────────────────────────────────────────
  private playerSprite!:    Phaser.GameObjects.Sprite;
  private enemyContainer!:  Phaser.GameObjects.Container;
  private enemyBody!:       Phaser.GameObjects.Rectangle;

  private playerHpBarFill!: Phaser.GameObjects.Rectangle;
  private enemyHpBarFill!:  Phaser.GameObjects.Rectangle;
  private playerHpText!:    Phaser.GameObjects.Text;
  private enemyHpText!:     Phaser.GameObjects.Text;

  private turnLabel!:       Phaser.GameObjects.Text;
  private statusText!:      Phaser.GameObjects.Text;

  private playerStatsPop!:  Phaser.GameObjects.Container;
  private enemyStatsPop!:   Phaser.GameObjects.Container;

  private cardContainers:   Phaser.GameObjects.Container[] = [];
  private rerollBtns:       Phaser.GameObjects.Container[] = [];
  private attackBtn!:       Phaser.GameObjects.Container;

  // ── idle 애니 트위너 (적 "숨쉬기") ────────────────────────────────────────
  private enemyIdleTween?: Phaser.Tweens.Tween;

  constructor() { super('BattleScene'); }

  init(data: BattleSceneData) { this.data_ = data; }

  // ───────────────────────────────────────────────────────────────────────────
  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;

    const { playerHp, playerAtk, playerDef, isElemental } = this.data_;

    // 적 스탯 계산
    this.playerCurrentHp = playerHp;
    this.enemyMaxHp      = isElemental ? 120 : 85;
    this.enemyAtk        = Math.max(4, Math.floor(playerAtk * (isElemental ? 0.85 : 0.65)));
    this.enemyDef        = Math.max(0, Math.floor(playerDef * (isElemental ? 1.0 : 0.7)));
    this.enemyCurrentHp  = this.enemyMaxHp;

    // 덱 확장
    this.expandDeck();

    // UI 생성
    this.createBackground();
    this.createCharacters();
    this.createHpBars();
    this.createCenterPanel();
    this.createCardArea();
    this.createStatusHover();
    this.createAttackButton();

    // 첫 손패 드로우
    this.drawHand();
    this.refreshCardDisplay();

    // ESC 차단
    this.input.keyboard?.on('keydown-ESC', () => { /* 전투 중 비활성 */ });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 덱 확장 (count 반영)
  // ───────────────────────────────────────────────────────────────────────────
  private expandDeck() {
    for (const entry of this.data_.deck) {
      const card = CARD_DATA_LIST.find(c => c.id === entry.cardId);
      if (card) {
        for (let i = 0; i < entry.count; i++) this.expandedDeck.push(card);
      }
    }
    if (this.expandedDeck.length === 0) {
      // 안전장치: 기본 카드로 채우기
      this.expandedDeck = CARD_DATA_LIST.slice(0, 5);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 배경
  // ───────────────────────────────────────────────────────────────────────────
  private createBackground() {
    const bg = this.add.graphics();
    bg.fillStyle(COLOR_BG, 1);
    bg.fillRect(0, 0, this.W, this.H);

    // 황금 테두리
    const border = this.add.graphics();
    border.lineStyle(2, COLOR_GOLD, 0.6);
    border.strokeRect(4, 4, this.W - 8, this.H - 8);

    // 구분선 (카드 영역 위)
    const divY = this.H * 0.62;
    const divLine = this.add.graphics();
    divLine.lineStyle(1, COLOR_GOLD, 0.3);
    divLine.lineBetween(20, divY, this.W - 20, divY);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 캐릭터 스프라이트 (플레이어) + 적 컨테이너
  // ───────────────────────────────────────────────────────────────────────────
  private createCharacters() {
    const charY   = this.H * 0.27;
    const playerX = this.W * 0.18;
    const enemyX  = this.W * 0.82;

    // ── 플레이어 ─────────────────────────────────────────────────────────────
    const weapon   = this.data_.characterWeapon;
    const animKey  = `char_idle_${weapon}`;
    const texKey   = CHAR_SPRITE_KEY[weapon];
    const frames   = CHAR_FRAME_COUNT[weapon];

    if (!this.anims.exists(animKey)) {
      this.anims.create({
        key:       animKey,
        frames:    this.anims.generateFrameNumbers(texKey, { start: 0, end: frames - 1 }),
        frameRate: 8,
        repeat:    -1,
      });
    }

    this.playerSprite = this.add.sprite(playerX, charY, texKey);
    this.playerSprite.setDisplaySize(180, 240);
    this.playerSprite.play(animKey);

    // 플레이어 이름 라벨
    this.add.text(playerX, charY + 130, i18n.t('player') || '플레이어', {
      fontFamily: FONT_L, fontSize: '14px', color: '#88aaff',
    }).setOrigin(0.5);

    // ── 적 ───────────────────────────────────────────────────────────────────
    const elemColor = ELEM_COLORS[this.data_.mapElement] ?? 0xff6666;
    this.enemyContainer = this.add.container(enemyX, charY);

    // 적 몸체 (컬러 사각형 + "idle 숨쉬기" 트위너)
    this.enemyBody = this.add.rectangle(0, 0, 160, 220, elemColor, 0.15);
    this.enemyBody.setStrokeStyle(3, elemColor, 0.9);
    this.enemyContainer.add(this.enemyBody);

    // 속성 아이콘
    const attrIdx  = ELEMENT_ATTR_INDEX[this.data_.mapElement] ?? 5;
    const attrIcon = this.add.image(0, -60, 'attr_icons', `attr_${attrIdx}`);
    attrIcon.setDisplaySize(56, 56);
    this.enemyContainer.add(attrIcon);

    // 적 이름
    const enemyNameTxt = this.add.text(0, 90, this.data_.mobName, {
      fontFamily: FONT_B, fontSize: '16px', color: '#ff8888',
    }).setOrigin(0.5);
    this.enemyContainer.add(enemyNameTxt);

    // 적 idle 숨쉬기 트위너
    this.enemyIdleTween = this.tweens.add({
      targets:  this.enemyContainer,
      scaleY:   1.04,
      duration: 900,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HP 바
  // ───────────────────────────────────────────────────────────────────────────
  private createHpBars() {
    const barW  = Math.round(this.W * 0.22);
    const barH  = 14;
    const barY  = this.H * 0.47;

    this.createHpBar(this.W * 0.18, barY, barW, barH, true);
    this.createHpBar(this.W * 0.82, barY, barW, barH, false);
  }

  private createHpBar(cx: number, cy: number, barW: number, barH: number, isPlayer: boolean) {
    const x = cx - barW / 2;

    // 배경
    const bgBar = this.add.rectangle(cx, cy, barW, barH, 0x333333);
    bgBar.setStrokeStyle(1, 0x666666);
    void bgBar;

    // fill
    const fill = this.add.rectangle(x + barW / 2, cy, barW, barH,
      isPlayer ? 0x2ecc71 : 0xe74c3c);
    fill.setOrigin(0.5, 0.5);

    // HP 텍스트
    const hpTxt = this.add.text(cx, cy + barH + 2,
      isPlayer
        ? `${this.data_.playerHp} / ${this.data_.playerMaxHp}`
        : `${this.enemyMaxHp} / ${this.enemyMaxHp}`,
      { fontFamily: FONT_L, fontSize: '12px', color: '#aaaaaa' },
    ).setOrigin(0.5, 0);

    if (isPlayer) {
      this.playerHpBarFill = fill;
      this.playerHpText    = hpTxt;
    } else {
      this.enemyHpBarFill = fill;
      this.enemyHpText    = hpTxt;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 중앙 패널 (턴 라벨 + 상태 텍스트)
  // ───────────────────────────────────────────────────────────────────────────
  private createCenterPanel() {
    const cx = this.W * 0.5;

    this.turnLabel = this.add.text(cx, this.H * 0.14, `TURN ${this.currentTurn} / ${MAX_TURNS}`, {
      fontFamily: FONT_B, fontSize: '22px', color: '#d4af37',
    }).setOrigin(0.5);

    this.statusText = this.add.text(cx, this.H * 0.52, '', {
      fontFamily: FONT_M, fontSize: '16px', color: '#cccccc',
      wordWrap: { width: this.W * 0.35 }, align: 'center',
    }).setOrigin(0.5);

    // 적 element 정보 (elemental battle 시)
    if (this.data_.isElemental) {
      const elemName  = i18n.t('elem' + this.data_.mapElement.charAt(0).toUpperCase() + this.data_.mapElement.slice(1));
      this.add.text(cx, this.H * 0.21, `[ ${elemName} ${i18n.t('battleTitleElemental').replace('[{elem}] ', '')} ]`, {
        fontFamily: FONT_M, fontSize: '13px', color: '#ffaa44',
      }).setOrigin(0.5);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 카드 영역 (손패 표시 + 리롤 버튼 원)
  // ───────────────────────────────────────────────────────────────────────────
  private createCardArea() {
    const areaY  = this.H * 0.65;
    const cardW  = Math.round(180 * CARD_SCALE);
    const cardH  = Math.round(252 * CARD_SCALE);
    const gap    = Math.round(this.W * 0.01);
    const totalW = HAND_SIZE * cardW + (HAND_SIZE - 1) * gap;
    const startX = (this.W - totalW) / 2;

    // 리롤 버튼 원 (카드 위쪽)
    const circleY = areaY - cardH / 2 - 28;
    for (let i = 0; i < HAND_SIZE; i++) {
      const cx = startX + i * (cardW + gap) + cardW / 2;
      const btn = this.makeRerollCircle(cx, circleY, i);
      this.rerollBtns.push(btn);
    }

    // 카드 슬롯 컨테이너 (처음엔 빈 자리)
    for (let i = 0; i < HAND_SIZE; i++) {
      const cx   = startX + i * (cardW + gap) + cardW / 2;
      const cont = this.add.container(cx, areaY);
      this.cardContainers.push(cont);
    }
  }

  /** 리롤 버튼: 속이 빈 원 + 'R' 텍스트 */
  private makeRerollCircle(cx: number, cy: number, idx: number): Phaser.GameObjects.Container {
    const RADIUS = 14;
    const cont   = this.add.container(cx, cy);

    const g = this.add.graphics();
    g.lineStyle(2, COLOR_GOLD, 0.8);
    g.fillStyle(0x1a1a2a, 1);
    g.fillCircle(0, 0, RADIUS);
    g.strokeCircle(0, 0, RADIUS);

    const lbl = this.add.text(0, 0, 'R', {
      fontFamily: FONT_B, fontSize: '12px', color: '#d4af37',
    }).setOrigin(0.5);

    cont.add([g, lbl]);
    cont.setInteractive(new Phaser.Geom.Circle(0, 0, RADIUS), Phaser.Geom.Circle.Contains);
    cont.on('pointerover', () => { if (!this.rerollsUsed[idx]) lbl.setColor('#ffffff'); });
    cont.on('pointerout',  () => { lbl.setColor(this.rerollsUsed[idx] ? '#444444' : '#d4af37'); });
    cont.on('pointerdown', () => this.onReroll(idx));
    return cont;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 공격 버튼
  // ───────────────────────────────────────────────────────────────────────────
  private createAttackButton() {
    const btnW = Math.round(this.W * 0.18);
    const btnH = 52;
    const btnX = this.W * 0.5;
    const btnY = this.H * 0.565;

    const cont = this.add.container(btnX, btnY);
    const bg   = this.add.graphics();
    bg.fillStyle(0x8b0000, 1);
    bg.lineStyle(2, COLOR_GOLD, 0.8);
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
    bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);

    const lbl = this.add.text(0, 0, i18n.t('bossStartFight') || '공격!', {
      fontFamily: FONT_B, fontSize: '20px', color: '#ffffff',
    }).setOrigin(0.5);

    cont.add([bg, lbl]);
    cont.setInteractive(
      new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
      Phaser.Geom.Rectangle.Contains,
    );
    cont.on('pointerover', () => lbl.setColor('#ffdb58').setScale(1.05));
    cont.on('pointerout',  () => lbl.setColor('#ffffff').setScale(1));
    cont.on('pointerdown', () => this.onAttack());
    this.attackBtn = cont;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 호버 상태 창
  // ───────────────────────────────────────────────────────────────────────────
  private createStatusHover() {
    const popW = Math.round(this.W * 0.20);
    const popH = 110;

    this.playerStatsPop = this.makeStatsPop(this.W * 0.32, this.H * 0.26, popW, popH, true);
    this.enemyStatsPop  = this.makeStatsPop(this.W * 0.68, this.H * 0.26, popW, popH, false);

    // 플레이어 캐릭터 영역 hover zone
    const playerZone = this.add.zone(this.W * 0.18, this.H * 0.27, 200, 280)
      .setInteractive();
    playerZone.on('pointerover', () => this.playerStatsPop.setVisible(true));
    playerZone.on('pointerout',  () => this.playerStatsPop.setVisible(false));

    // 적 hover zone
    const enemyZone = this.add.zone(this.W * 0.82, this.H * 0.27, 200, 280)
      .setInteractive();
    enemyZone.on('pointerover', () => this.enemyStatsPop.setVisible(true));
    enemyZone.on('pointerout',  () => this.enemyStatsPop.setVisible(false));
  }

  private makeStatsPop(
    x: number, y: number,
    w: number, h: number,
    isPlayer: boolean,
  ): Phaser.GameObjects.Container {
    const { playerAtk, playerDef, playerCrit, playerCritDmg } = this.data_;

    const cont = this.add.container(x, y);
    const bg   = this.add.graphics();
    bg.fillStyle(0x0d1117, 0.92);
    bg.lineStyle(1, COLOR_GOLD, 0.5);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    cont.add(bg);

    const lines = isPlayer
      ? [
          `ATK  ${playerAtk}`,
          `DEF  ${playerDef}`,
          `CRIT  ${playerCrit}%  ×${playerCritDmg.toFixed(1)}`,
          `HP  ${this.playerCurrentHp} / ${this.data_.playerMaxHp}`,
        ]
      : [
          `ATK  ${this.enemyAtk}`,
          `DEF  ${this.enemyDef}`,
          `HP  ${this.enemyCurrentHp} / ${this.enemyMaxHp}`,
        ];

    lines.forEach((line, i) => {
      cont.add(this.add.text(0, -h / 2 + 14 + i * 22, line, {
        fontFamily: FONT_L, fontSize: '13px', color: '#cccccc',
      }).setOrigin(0.5, 0));
    });

    cont.setVisible(false);
    return cont;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 손패 드로우
  // ───────────────────────────────────────────────────────────────────────────
  private drawHand() {
    // 덱을 섞어서 5장 뽑기
    const shuffled = [...this.expandedDeck].sort(() => Math.random() - 0.5);
    this.hand         = shuffled.slice(0, HAND_SIZE);
    this.rerollsUsed  = Array(HAND_SIZE).fill(false);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 카드 슬롯 렌더링 (손패 변경 시마다 호출)
  // ───────────────────────────────────────────────────────────────────────────
  private refreshCardDisplay() {
    const cardW = Math.round(180 * CARD_SCALE);
    const cardH = Math.round(252 * CARD_SCALE);

    this.cardContainers.forEach((cont, i) => {
      cont.removeAll(true);
      const card = this.hand[i];
      if (!card) return;

      const elemColor = ELEM_COLORS[card.element] ?? 0xffffff;

      // 카드 배경
      const g = this.add.graphics();
      g.fillStyle(0x1a1a2a, 1);
      g.lineStyle(2, elemColor, 0.85);
      g.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
      g.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
      cont.add(g);

      // 카드 이미지
      const frameKey = `card_${card.spriteRow}_${card.spriteCol}`;
      if (this.textures.exists('card_sprites')) {
        const img = this.add.image(0, -8, 'card_sprites', frameKey);
        img.setDisplaySize(cardW - 8, Math.round(cardH * 0.5));
        cont.add(img);
      }

      // 속성 아이콘
      const attrIcon = this.add.image(cardW / 2 - 10, -cardH / 2 + 10, 'attr_icons', `attr_${card.attrIndex}`);
      attrIcon.setDisplaySize(18, 18);
      cont.add(attrIcon);

      // 카드 이름
      const nameTxt = this.add.text(0, cardH / 2 - 28, i18n.t(card.nameKey) || card.nameKey, {
        fontFamily: FONT_M, fontSize: '11px', color: '#ffffff',
        wordWrap: { width: cardW - 8 }, align: 'center',
      }).setOrigin(0.5);
      cont.add(nameTxt);

      // ATK / DEF 스탯
      const statTxt = this.add.text(0, cardH / 2 - 12, `ATK ${card.attack}  DEF ${card.defense}`, {
        fontFamily: FONT_L, fontSize: '10px', color: '#aaaaaa',
      }).setOrigin(0.5);
      cont.add(statTxt);

      // 리롤 사용됨 표시
      if (this.rerollsUsed[i]) {
        const usedOverlay = this.add.graphics();
        usedOverlay.fillStyle(0x000000, 0.4);
        usedOverlay.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
        cont.add(usedOverlay);
      }
    });

    // 리롤 버튼 상태 갱신
    this.rerollBtns.forEach((btn, i) => {
      const lbl = btn.getAt(1) as Phaser.GameObjects.Text;
      if (this.rerollsUsed[i]) {
        lbl.setColor('#444444');
        btn.disableInteractive();
      } else {
        lbl.setColor('#d4af37');
        btn.setInteractive(new Phaser.Geom.Circle(0, 0, 14), Phaser.Geom.Circle.Contains);
      }
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 리롤 처리
  // ───────────────────────────────────────────────────────────────────────────
  private onReroll(idx: number) {
    if (this.isAnimating || this.rerollsUsed[idx] || this.battleEnded) return;

    // 현재 카드를 제외한 덱에서 랜덤 뽑기
    const candidates = this.expandedDeck.filter(c => c !== this.hand[idx]);
    if (candidates.length === 0) return;

    this.hand[idx]       = candidates[Math.floor(Math.random() * candidates.length)];
    this.rerollsUsed[idx] = true;
    this.refreshCardDisplay();

    // 리롤 원 애니메이션
    const btn = this.rerollBtns[idx];
    this.tweens.add({ targets: btn, scaleX: 1.3, scaleY: 1.3, duration: 80, yoyo: true });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 공격 처리
  // ───────────────────────────────────────────────────────────────────────────
  private onAttack() {
    if (this.isAnimating || this.battleEnded) return;
    this.isAnimating = true;
    this.attackBtn.disableInteractive();

    // ── 손패 분석 ──────────────────────────────────────────────────────────
    const elemCount: Record<string, number> = {};
    let totalCardAtk = 0;
    for (const card of this.hand) {
      elemCount[card.element] = (elemCount[card.element] ?? 0) + 1;
      totalCardAtk += card.attack;
    }

    // 가장 많은 속성 (dominant element)
    const dominantElem = Object.entries(elemCount)
      .sort((a, b) => b[1] - a[1])[0][0] as CardElement;
    const dominantCount = elemCount[dominantElem] ?? 0;

    // ── 데미지 계산 ────────────────────────────────────────────────────────
    let dmg = totalCardAtk + this.data_.playerAtk;

    // 3장 이상 동일 속성 → 보너스
    if (dominantCount >= 3) dmg = Math.floor(dmg * 1.3);

    // 속성 유불리
    const { mapElement } = this.data_;
    if (TYPE_BEATS[dominantElem] === mapElement) {
      dmg = Math.floor(dmg * 1.5);
    } else if (TYPE_BEATS[mapElement] === dominantElem) {
      dmg = Math.floor(dmg * 0.5);
    }

    // 크리티컬
    const isCrit = Math.random() * 100 < this.data_.playerCrit;
    if (isCrit) dmg = Math.floor(dmg * this.data_.playerCritDmg);

    // 적 방어력 적용: dmg × (50 / (50 + enemyDef))
    dmg = Math.max(1, Math.floor(dmg * (50 / (50 + this.enemyDef))));

    // ── 플레이어 공격 애니메이션 ───────────────────────────────────────────
    this.playPlayerAttack(dominantElem, () => {
      // 적 HP 감소
      this.enemyCurrentHp = Math.max(0, this.enemyCurrentHp - dmg);
      this.updateEnemyHpBar();
      this.playEnemyHit(dominantElem);

      // 상태 텍스트
      const critTxt = isCrit ? ' ★CRIT!' : '';
      const bonusTxt = dominantCount >= 3 ? ' (+속성 보너스)' : '';
      this.statusText.setText(`${this.data_.mobName}에게 ${dmg}${critTxt}${bonusTxt}`).setColor('#2ecc71');

      // 적 사망 체크
      if (this.enemyCurrentHp <= 0) {
        this.time.delayedCall(800, () => this.endBattle(true));
        return;
      }

      // 적 반격
      this.time.delayedCall(800, () => this.doEnemyTurn());
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 플레이어 공격 트위너 (속성별 다른 스타일)
  // ───────────────────────────────────────────────────────────────────────────
  private playPlayerAttack(elem: string, onComplete: () => void) {
    const startX = this.playerSprite.x;
    const dashX  = startX + this.W * 0.28;

    const easeMap: Record<string, string> = {
      water:     'Sine.easeInOut',
      fire:      'Expo.easeOut',
      grass:     'Bounce.easeOut',
      lightning: 'Power4.easeOut',
      earth:     'Power2.easeIn',
      normal:    'Power1.easeInOut',
    };
    const durMap: Record<string, number> = {
      water: 250, fire: 150, grass: 300, lightning: 80, earth: 350, normal: 200,
    };
    const ease     = easeMap[elem]  ?? 'Power1.easeInOut';
    const dashDur  = durMap[elem]   ?? 200;
    const elemColor = ELEM_COLORS[elem] ?? 0xffffff;

    // 속성 색 tint
    this.playerSprite.setTint(elemColor);

    this.tweens.add({
      targets:  this.playerSprite,
      x:        dashX,
      duration: dashDur,
      ease,
      onComplete: () => {
        this.playerSprite.clearTint();
        this.tweens.add({
          targets:  this.playerSprite,
          x:        startX,
          duration: dashDur + 50,
          ease:     'Power2.easeOut',
          onComplete: () => {
            this.isAnimating = false;
            onComplete();
          },
        });
      },
    });

    // lightning 특수: 빠른 shake 추가
    if (elem === 'lightning') {
      this.tweens.add({
        targets:   this.playerSprite,
        angle:     { from: -6, to: 6 },
        duration:  40,
        repeat:    4,
        yoyo:      true,
        onComplete: () => this.playerSprite.setAngle(0),
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 적 피격 이펙트
  // ───────────────────────────────────────────────────────────────────────────
  private playEnemyHit(elem: string) {
    const elemColor = ELEM_COLORS[elem] ?? 0xff0000;
    this.enemyIdleTween?.pause();

    this.enemyBody.setFillStyle(elemColor, 0.6);

    // shake
    const origX = this.enemyContainer.x;
    this.tweens.add({
      targets:  this.enemyContainer,
      x:        { from: origX - 12, to: origX + 12 },
      duration: 60,
      repeat:   3,
      yoyo:     true,
      onComplete: () => {
        this.enemyContainer.x = origX;
        this.enemyBody.setFillStyle(ELEM_COLORS[this.data_.mapElement] ?? 0xff6666, 0.15);
        this.enemyIdleTween?.resume();
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 적 턴
  // ───────────────────────────────────────────────────────────────────────────
  private doEnemyTurn() {
    // 적 공격력 계산 (플레이어 방어력 적용)
    let enemyDmg = this.enemyAtk;
    enemyDmg = Math.max(1, Math.floor(enemyDmg * (50 / (50 + this.data_.playerDef))));

    // 적 공격 애니
    this.tweens.add({
      targets:  this.enemyContainer,
      x:        this.enemyContainer.x - this.W * 0.25,
      duration: 200,
      ease:     'Expo.easeOut',
      onComplete: () => {
        this.playerCurrentHp = Math.max(0, this.playerCurrentHp - enemyDmg);
        this.updatePlayerHpBar();
        this.playPlayerHit();

        // 상태 텍스트
        this.statusText.setText(`${i18n.t('player') || '내'} HP -${enemyDmg}`).setColor('#e74c3c');

        this.tweens.add({
          targets:  this.enemyContainer,
          x:        this.W * 0.82,
          duration: 250,
          ease:     'Power2.easeOut',
          onComplete: () => {
            // 플레이어 사망 체크
            if (this.playerCurrentHp <= 0) {
              this.time.delayedCall(600, () => this.endBattle(false));
              return;
            }

            // 다음 턴
            this.currentTurn++;
            if (this.currentTurn > MAX_TURNS) {
              this.endBattle(this.playerCurrentHp >= this.enemyCurrentHp);
              return;
            }

            this.turnLabel.setText(`TURN ${this.currentTurn} / ${MAX_TURNS}`);
            this.drawHand();
            this.refreshCardDisplay();
            this.time.delayedCall(300, () => {
              this.statusText.setText('');
              this.attackBtn.setInteractive(
                new Phaser.Geom.Rectangle(
                  -Math.round(this.W * 0.09), -26,
                  Math.round(this.W * 0.18), 52,
                ),
                Phaser.Geom.Rectangle.Contains,
              );
            });
          },
        });
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 플레이어 피격
  // ───────────────────────────────────────────────────────────────────────────
  private playPlayerHit() {
    this.playerSprite.setTint(0xff4444);
    this.tweens.add({
      targets:  this.playerSprite,
      x:        { from: this.playerSprite.x - 8, to: this.playerSprite.x + 8 },
      duration: 60,
      repeat:   2,
      yoyo:     true,
      onComplete: () => {
        this.playerSprite.x = this.W * 0.18;
        this.playerSprite.clearTint();
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HP 바 업데이트
  // ───────────────────────────────────────────────────────────────────────────
  private updatePlayerHpBar() {
    const ratio = Math.max(0, this.playerCurrentHp / this.data_.playerMaxHp);
    const barW  = Math.round(this.W * 0.22);
    this.tweens.add({ targets: this.playerHpBarFill, displayWidth: barW * ratio, duration: 300 });
    this.playerHpText.setText(`${this.playerCurrentHp} / ${this.data_.playerMaxHp}`);
    this.playerHpBarFill.setFillStyle(ratio > 0.3 ? 0x2ecc71 : 0xe74c3c);
    this.updatePlayerStatsPop();
  }

  private updateEnemyHpBar() {
    const ratio = Math.max(0, this.enemyCurrentHp / this.enemyMaxHp);
    const barW  = Math.round(this.W * 0.22);
    this.tweens.add({ targets: this.enemyHpBarFill, displayWidth: barW * ratio, duration: 300 });
    this.enemyHpText.setText(`${this.enemyCurrentHp} / ${this.enemyMaxHp}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 플레이어 스탯 팝업 실시간 갱신
  // ───────────────────────────────────────────────────────────────────────────
  private updatePlayerStatsPop() {
    if (!this.playerStatsPop) return;
    const children = this.playerStatsPop.getAll() as Phaser.GameObjects.Text[];
    // HP 라인은 인덱스 4 (배경 포함 시 인덱스 4번째 text)
    const hpLine = children.find(c => c instanceof Phaser.GameObjects.Text
      && (c as Phaser.GameObjects.Text).text.startsWith('HP'));
    if (hpLine) {
      (hpLine as Phaser.GameObjects.Text).setText(
        `HP  ${this.playerCurrentHp} / ${this.data_.playerMaxHp}`,
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 전투 종료
  // ───────────────────────────────────────────────────────────────────────────
  private endBattle(playerWon: boolean) {
    this.battleEnded = true;
    this.isAnimating = true;
    this.enemyIdleTween?.stop();

    const resultColor = playerWon ? '#2ecc71' : '#e74c3c';
    const resultText  = playerWon
      ? `승리!\n(적 ${this.data_.mobName} 격파)`
      : `패배...\nHP가 0이 되었습니다.`;

    this.statusText.setText(resultText).setColor(resultColor);
    this.attackBtn.setVisible(false);

    // 결과 오버레이
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0);
    overlay.fillRect(0, 0, this.W, this.H);

    this.tweens.add({
      targets:  overlay,
      alpha:    { from: 0, to: 0.6 },
      duration: 600,
      onComplete: () => {
        const hpDelta = this.playerCurrentHp - this.data_.playerHp;
        this.game.events.emit('nodeEventComplete', {
          battleResult: playerWon ? 'win' : 'lose',
          hpDelta:      playerWon ? 0 : hpDelta,
          nodeId:       this.data_.nodeId,
        });
        this.scene.stop('NodeEventScene');
        this.scene.stop();
        this.scene.resume('MainScene');
      },
    });
  }
}
