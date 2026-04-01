import Phaser from 'phaser';
import { CARD_DATA_LIST, CardData, CardElement, ELEMENT_ATTR_INDEX } from '@src/data/cardData';
import { getRandomEnemy, EnemyDef } from '@src/data/enemyData';
import { i18n } from '@src/utils/localization';
import { WeaponType, CHAR_SPRITE_KEY, CHAR_FRAME_COUNT } from '@src/scenes/CharacterSelectScene';
import Card, { CARD_WIDTH, CARD_HEIGHT } from '@src/objects/Card';

// ─── 인터페이스 ───────────────────────────────────────────────────────────────

export interface BattleSceneData {
  nodeId:          number;
  isElemental:     boolean;
  isBoss?:         boolean;  // 보스 전투 여부
  mapElement:      CardElement;
  mobName:         string;
  playerHp:        number;
  playerMaxHp:     number;
  playerAtk:       number;
  playerDef:       number;
  playerCrit:      number;
  playerCritDmg:   number;
  characterWeapon: WeaponType;
  deck:            { cardId: number; count: number; mult?: number }[];
  playerCardMult:  number;
  playerShieldMult: number;
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
  private uiScale = 1;

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
  private drawPile: CardData[] = []; // 뽑을 카드 뭉치
  private discardPile: CardData[] = []; // 버린 카드 뭉치
  private hand:         CardData[] = [];
  private rerollsUsed:  boolean[]  = [];
  private selectedCards: boolean[] = [];
  private selectionOrder: number[] = [];
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private rerollBtns: Phaser.GameObjects.Container[] = [];
  private attackBtn!: Phaser.GameObjects.Container;
  private comboInfoText!:   Phaser.GameObjects.Text;
  private shieldBadge!:     Phaser.GameObjects.Container; // 쉴드 표시 뱃지
  private currentTurnDefense = 0;

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
  private enemyDefData!:    EnemyDef;

  // ── idle 애니 트위너 (적 "숨쉬기") ────────────────────────────────────────
  private enemyIdleTween?: Phaser.Tweens.Tween;

  constructor() { super('BattleScene'); }

  init(data: BattleSceneData) { 
    this.data_ = data; 
    this.currentTurn = 1;
    this.isAnimating = false;
    this.battleEnded = false;
    this.drawPile = [];
    this.discardPile = [];
    this.hand = [];
    this.rerollsUsed = Array(HAND_SIZE).fill(false);
    this.selectedCards = Array(HAND_SIZE).fill(false);
    this.cardContainers = [];
    this.rerollBtns = [];
    this.currentTurnDefense = 0;
  }

  // ───────────────────────────────────────────────────────────────────────────
  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.uiScale = Math.min(1.2, this.W / 600, this.H / 800);

    const { playerHp, playerAtk, playerDef, isElemental } = this.data_;

    // 적 스탯 계산
    this.playerCurrentHp = playerHp;
    const rank = this.data_.isBoss ? 'boss' : (isElemental ? 'elite' : 'normal');
    const elem = isElemental ? this.data_.mapElement : 'normal';
    this.enemyDefData = getRandomEnemy(elem, rank);

    this.enemyMaxHp      = this.enemyDefData.hp;
    this.enemyAtk        = this.enemyDefData.atk;
    this.enemyDef        = this.enemyDefData.def;
    this.enemyCurrentHp  = this.enemyDefData.hp;
    
    // UI에 보여질 이름: 보스는 전달받은 mobName 사용, 일반은 enemyData에서
    if (!this.data_.isBoss) {
      this.data_.mobName = i18n.t(this.enemyDefData.nameKey) || this.enemyDefData.nameKey;
    }

    // 덱 초기화 (첫 드로우 전 drawPile 채움)
    this.initBattleDeck();

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
    this.updateAttackButtonState();

    // ESC 차단
    this.input.keyboard?.on('keydown-ESC', () => { /* 전투 중 비활성 */ });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 배틀 덱 초기 생성 및 초기 셔플
  private initBattleDeck() {
    this.drawPile = [];
    this.discardPile = [];
    
    this.data_.deck.forEach(entry => {
      const cardDef = CARD_DATA_LIST.find(c => c.id === entry.cardId);
      if (cardDef) {
        for (let i = 0; i < entry.count; i++) {
          this.drawPile.push({ ...cardDef, mult: entry.mult ?? 1 });
        }
      }
    });
    
    if (this.drawPile.length === 0) {
      // 안전장치: 기본 카드로 채우기
      this.drawPile = CARD_DATA_LIST.slice(0, 5).map(c => ({ ...c, mult: 1 }));
    }
    
    // 초기 셔플
    this.drawPile.sort(() => Math.random() - 0.5);

    // 덱 로그 (중복 체크용)
    console.log(`[Battle] Final deck count: ${this.drawPile.length}`);
    this.drawPile.forEach((c, idx) => {
      console.log(` - Slot ${idx}: ID=${c.id}, Name=${c.nameKey}, Stars=${c.stars}, Mult=${c.mult}`);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 배경
  // ───────────────────────────────────────────────────────────────────────────
  private createBackground() {
    const bg = this.add.graphics();
    bg.fillStyle(COLOR_BG, 1);
    bg.fillRect(0, 0, this.W, this.H);

    const elemToBg: Record<string, string> = {
      fire: 'bg_battle_fire',
      grass: 'bg_battle_grass',
      earth: 'bg_battle_earth',
      lightning: 'bg_battle_lightning',
      water: 'bg_battle_water',
    };
    
    // 맵 타입 속성에 따른 bg_battle_* 선택 (없는 경우 bg1 폴백)
    const bgKey = elemToBg[this.data_.mapElement] || 'bg1';

    const bgImage = this.add.image(this.W / 2, this.H / 2, bgKey);
    // 화면 크기에 꽉 차게 덮기
    const scaleX = this.W / bgImage.width;
    const scaleY = this.H / bgImage.height;
    const scale = Math.max(scaleX, scaleY);
    bgImage.setScale(scale);
    
    // 카드와 텍스트가 잘 보이도록 배경을 살짝 어둡게 처리
    bgImage.setTint(0x777777);

    // 황금 테두리
    const border = this.add.graphics();
    border.lineStyle(2, COLOR_GOLD, 0.6);
    border.strokeRect(4, 4, this.W - 8, this.H - 8);

    // 구분선 (카드 영역 위)
    const divY = this.H * 0.65;
    const divLine = this.add.graphics();
    divLine.lineStyle(1, COLOR_GOLD, 0.3);
    divLine.lineBetween(20, divY, this.W - 20, divY);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 캐릭터 스프라이트 (플레이어) + 적 컨테이너
  // ───────────────────────────────────────────────────────────────────────────
  private createCharacters() {
    const charY   = this.H * 0.39;
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
    this.playerSprite.setDisplaySize(180 * this.uiScale, 240 * this.uiScale);
    this.playerSprite.play(animKey);
    this.playerSprite.setFlipX(true); // 유저 요청: 배틀 시 캐릭터가 반대를 보게 함

    // 플레이어 이름 라벨
    this.add.text(playerX, charY + 130 * this.uiScale, i18n.t('player') || '플레이어', {
      fontFamily: FONT_L, fontSize: '14px', color: '#88aaff',
    }).setOrigin(0.5);

    // ── 적 ───────────────────────────────────────────────────────────────────
    const actualElem = this.enemyDefData.element;
    const elemColor = ELEM_COLORS[actualElem] ?? 0xcccccc;
    this.enemyContainer = this.add.container(enemyX, charY);

    // 적 몸체 (컬러 사각형 + "idle 숨쉬기" 트위너)
    this.enemyBody = this.add.rectangle(0, 0, 160 * this.uiScale, 220 * this.uiScale, elemColor, 0.15);
    this.enemyBody.setStrokeStyle(3, elemColor, 0.9);
    this.enemyContainer.add(this.enemyBody);

    // 속성 아이콘 (무속성이 아닐 때만 표시)
    if (actualElem !== 'normal') {
      const attrIdx  = ELEMENT_ATTR_INDEX[actualElem] ?? 5;
      const attrIcon = this.add.image(0, -60 * this.uiScale, 'attr_icons', `attr_${attrIdx}`);
      attrIcon.setDisplaySize(56 * this.uiScale, 56 * this.uiScale);
      this.enemyContainer.add(attrIcon);
    }

    // 적 이름
    const enemyNameTxt = this.add.text(0, 90 * this.uiScale, this.data_.mobName, {
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
    const barY  = this.H * 0.59;

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

    this.statusText = this.add.text(cx, this.H * 0.65, '', {
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
    const cardScale = Math.min(CARD_SCALE, (this.W * 0.75) / (CARD_WIDTH * HAND_SIZE));
    const cardH  = Math.round(CARD_HEIGHT * cardScale);
    const cardW  = Math.round(CARD_WIDTH * cardScale);
    const gap    = Math.round(this.W * 0.02);
    const totalW = HAND_SIZE * cardW + (HAND_SIZE - 1) * gap;
    // 카드들을 좀 더 촘촘하게 중앙 좌측에 배치해 공격 버튼 공간 확보
    const startX = (this.W - totalW) / 2 - (this.W * 0.05);
    const areaY  = this.H - cardH / 2 - 20;

    // 리롤 버튼 원 (카드 위쪽)
    const circleY = areaY - cardH / 2 - 28 * this.uiScale;
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
    const btnH = Math.round(52 * this.uiScale);
    
    // 우측 하단에 배치
    const btnX = this.W - btnW / 2 - 20 * this.uiScale;
    const btnY = this.H - btnH / 2 - 20 * this.uiScale;

    const cont = this.add.container(btnX, btnY);
    const bg   = this.add.graphics();
    bg.fillStyle(0x8b0000, 1);
    bg.lineStyle(2, COLOR_GOLD, 0.8);
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
    bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);

    const lbl = this.add.text(0, 0, i18n.t('bossStartFight') || '공격!', {
      fontFamily: FONT_B, fontSize: `${Math.round(20 * this.uiScale)}px`, color: '#ffffff',
    }).setOrigin(0.5);

    cont.add([bg, lbl]);
    cont.setData('w', btnW).setData('h', btnH);
    cont.setInteractive(
      new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
      Phaser.Geom.Rectangle.Contains,
    );
    cont.on('pointerover', () => { if (this.attackBtn.alpha === 1) lbl.setColor('#ffdb58').setScale(1.05); });
    cont.on('pointerout',  () => { lbl.setColor('#ffffff').setScale(1); });
    cont.on('pointerdown', () => this.onAttack());
    this.attackBtn = cont;

    // 콤보 정보 텍스트 (공격 버튼 바로 위)
    this.comboInfoText = this.add.text(this.W * 0.5, btnY - 45, '', {
      fontFamily: FONT_B, fontSize: '15px', color: '#ffeb3b', align: 'center', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    // 쉴드 뱃지 (플레이어 HP바 아래)
    const badgeX = this.W * 0.18;
    const badgeY = this.H * 0.48;
    this.shieldBadge = this.add.container(badgeX, badgeY);
    this.shieldBadge.setVisible(false);
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(0x1a3a6c, 0.92);
    badgeBg.lineStyle(2, 0x56b4f7, 1);
    badgeBg.fillRoundedRect(-58, -16, 116, 32, 8);
    badgeBg.strokeRoundedRect(-58, -16, 116, 32, 8);
    const badgeTxt = this.add.text(0, 0, '', {
      fontFamily: FONT_B, fontSize: '16px', color: '#56b4f7', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setName('badgeTxt');
    this.shieldBadge.add([badgeBg, badgeTxt]);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 호버 상태 창
  // ───────────────────────────────────────────────────────────────────────────
  private createStatusHover() {
    const popW = Math.round(this.W * 0.20);
    const popH = 110;

    this.playerStatsPop = this.makeStatsPop(this.W * 0.32, this.H * 0.38, popW, popH, true);
    this.enemyStatsPop  = this.makeStatsPop(this.W * 0.68, this.H * 0.38, popW, popH, false);

    // 플레이어 캐릭터 영역 hover zone
    const playerZone = this.add.zone(this.W * 0.18, this.H * 0.39, 200, 280)
      .setInteractive();
    playerZone.on('pointerover', () => this.playerStatsPop.setVisible(true));
    playerZone.on('pointerout',  () => this.playerStatsPop.setVisible(false));

    // 적 hover zone
    const enemyZone = this.add.zone(this.W * 0.82, this.H * 0.39, 200, 280)
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
    // 이전 손패는 discardPile로
    if (this.hand.length > 0) {
      this.discardPile.push(...this.hand);
      this.hand = [];
    }
    
    for (let i = 0; i < HAND_SIZE; i++) {
      if (this.drawPile.length === 0) {
        // 뽑을 카드가 없으면 discardPile을 다시 셔플해서 채움
        if (this.discardPile.length > 0) {
          this.drawPile = [...this.discardPile].sort(() => Math.random() - 0.5);
          this.discardPile = [];
          console.log(`[Battle] Draw pile empty. Reshuffling ${this.drawPile.length} cards from discard pile.`);
        } else {
          // 진짜 없으면 종료 (보통 발생하지 않음)
          break;
        }
      }
      this.hand.push(this.drawPile.shift()!);
    }
    
    this.rerollsUsed  = Array(HAND_SIZE).fill(false);
    this.selectedCards= Array(HAND_SIZE).fill(false);
    this.selectionOrder = [];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 카드 슬롯 렌더링 (손패 변경 시마다 호출)
  // ───────────────────────────────────────────────────────────────────────────
  private refreshCardDisplay() {
    const cardScale = Math.min(CARD_SCALE, (this.W * 0.75) / (CARD_WIDTH * HAND_SIZE));
    const cardW = Math.round(CARD_WIDTH * cardScale);
    const cardH = Math.round(CARD_HEIGHT * cardScale);
    const areaY = this.H - cardH / 2 - 20;

    this.cardContainers.forEach((cont, i) => {
      cont.removeAll(true);
      const cardData = this.hand[i];
      if (!cardData) return;

      const isSelected = this.selectedCards[i];
      cont.y = areaY;

      // Card 객체 생성
      const cardObj = new Card(this, -cardW / 2, -cardH / 2, cardData);
      cardObj.setScale(cardScale);
      cont.add(cardObj);

      // 선택 표시 테두리 및 순위 배지
      if (isSelected) {
        const selBorder = this.add.graphics();
        selBorder.lineStyle(4, 0x2ecc71, 1);
        selBorder.strokeRoundedRect(-cardW / 2 + 2, -cardH / 2 + 2, cardW - 4, cardH - 4, 8);
        const orderIdx = this.selectionOrder.indexOf(i) + 1;
        const badgeBg = this.add.graphics();
        badgeBg.fillStyle(0x2ecc71, 1);
        badgeBg.fillCircle(cardW / 2 - 10, -cardH / 2 + 10, 14);
        const badgeTxt = this.add.text(cardW / 2 - 10, -cardH / 2 + 10, orderIdx.toString(), { fontFamily: FONT_B, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
        cont.add([selBorder, badgeBg, badgeTxt]);
      }

      // 리롤 사용됨 표시
      if (this.rerollsUsed[i]) {
        const usedOverlay = this.add.graphics();
        usedOverlay.fillStyle(0x000000, 0.4);
        usedOverlay.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
        cont.add(usedOverlay);
      }

      cont.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH), Phaser.Geom.Rectangle.Contains);
      cont.off('pointerdown');
      cont.on('pointerdown', () => this.toggleCardSelection(i));
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

    if (this.drawPile.length === 0) {
      if (this.discardPile.length > 0) {
        this.drawPile = [...this.discardPile].sort(() => Math.random() - 0.5);
        this.discardPile = [];
        console.log(`[Battle] Draw pile empty on Reroll. Reshuffling.`);
      } else {
        return;
      }
    }

    this.hand[idx] = this.drawPile.shift()!;
    this.rerollsUsed[idx] = true;
    this.selectedCards[idx] = false;
    this.selectionOrder = this.selectionOrder.filter(i => i !== idx);
    this.refreshCardDisplay();
    this.updateAttackButtonState();

    // 리롤 원 애니메이션
    const btn = this.rerollBtns[idx];
    this.tweens.add({ targets: btn, scaleX: 1.3, scaleY: 1.3, duration: 80, yoyo: true });
  }

  private toggleCardSelection(idx: number) {
    if (this.isAnimating || this.battleEnded) return;
    
    if (this.selectedCards[idx]) {
      this.selectedCards[idx] = false;
      this.selectionOrder = this.selectionOrder.filter(i => i !== idx);
    } else {
      if (this.selectionOrder.length >= 3) return; // 3개까지만 제한
      this.selectedCards[idx] = true;
      this.selectionOrder.push(idx);
    }
    this.refreshCardDisplay();
    this.updateAttackButtonState();
  }
  
  private updateAttackButtonState() {
    if (!this.attackBtn || this.battleEnded || this.isAnimating) return;
    const count = this.selectionOrder.length;
    const lbl = this.attackBtn.getAt(1) as Phaser.GameObjects.Text;
    const bw = this.attackBtn.getData('w');
    const bh = this.attackBtn.getData('h');
    
    if (count === 3) {
      this.attackBtn.setAlpha(1);
      this.attackBtn.setInteractive(
        new Phaser.Geom.Rectangle(-bw/2, -bh/2, bw, bh),
        Phaser.Geom.Rectangle.Contains
      );
      lbl.setText(i18n.t('bossStartFight') || '공격!');
    } else {
      this.attackBtn.setAlpha(0.6);
      this.attackBtn.disableInteractive();
      lbl.setText(`카드 3장 선택 (${count}/3)`);
    }

    // 콤보 텍스트 업데이트
    if (this.comboInfoText) {
      this.comboInfoText.setText('');
      if (count >= 2) {
        const activeCards = this.selectionOrder.map(i => this.hand[i]);
        const sameCardsCount = Math.max(...activeCards.map(c => activeCards.filter(ac => ac.id === c.id).length));
        const sameElemsCount = Math.max(...activeCards.map(c => c.element !== 'normal' ? activeCards.filter(ac => ac.element === c.element).length : 0));
        
        let comboMsg = '';
        if (sameCardsCount >= 2) {
          comboMsg = `동일 카드 ${sameCardsCount}장 효과 적용!`;
          this.comboInfoText.setColor('#ffeb3b');
        } else if (sameElemsCount >= 2) {
          comboMsg = `동일 속성 ${sameElemsCount}장 효과 적용!`;
          this.comboInfoText.setColor('#ff9800');
        }
        this.comboInfoText.setText(comboMsg);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 공격 처리
  // ───────────────────────────────────────────────────────────────────────────
  private async onAttack() {
    if (this.isAnimating || this.battleEnded) return;
    if (this.selectionOrder.length !== 3) return;

    this.isAnimating = true;
    this.attackBtn.disableInteractive();

    if (this.comboInfoText) this.comboInfoText.setText('');

    const activeCards = this.selectionOrder.map(i => this.hand[i]);
    const elemTypes = activeCards.map(c => c.element);
    const isFastForward = elemTypes[0] !== 'normal' && elemTypes.every(e => e === elemTypes[0]);

    this.currentTurnDefense = 0;

    // 0~6: 계산 식을 3장 각각 반복
    for (let step = 0; step < 3; step++) {
      if (this.enemyCurrentHp <= 0 || this.playerCurrentHp <= 0) break;
      await this.executeCardAction(step, activeCards, isFastForward);
    }

    // 카드 3회 공격 이후: 플레이어 순수 기본 공격력(무기 연산값)으로 마지막 4번째 체술 타격
    if (this.enemyCurrentHp > 0 && this.playerCurrentHp > 0) {
      if (this.data_.playerAtk > 0) {
        await this.executePlayerBaseAttack(isFastForward);
      }
    }

    if (this.enemyCurrentHp <= 0) {
      this.time.delayedCall(800, () => this.endBattle(true));
      return;
    }

    // 적 반격
    this.time.delayedCall(800, () => this.doEnemyTurn());
  }

  private async executeCardAction(step: number, cards: CardData[], isFastForward: boolean): Promise<void> {
    return new Promise(resolve => {
      const card = cards[step];
      const baseVal = card.value * (card.mult || 1.0) * (this.data_.playerCardMult || 1.0);
      let dmg = 0;
      let heal = 0;
      let shield = 0;

      // 0. 기초 수치 분배
      if (card.key === 'shield' || card.key === 'defense') {
        shield = baseVal * (this.data_.playerShieldMult || 1.0);
      } else if (card.key === 'hp') {
        heal = baseVal;
      } else if (card.key === 'arrow') {
        dmg = baseVal;
      } else {
        // attack, spear 등
        dmg = baseVal;
      }

      if (dmg > 0) {
        // 1. 속성 데미지 계산
        if (card.element !== 'normal') {
          if (TYPE_BEATS[card.element] === this.data_.mapElement) dmg *= 1.5;
          else if (TYPE_BEATS[this.data_.mapElement] === card.element) dmg *= 0.5;
        }

        // 2. 크리티컬 여부
        let critChance = this.data_.playerCrit;
        if (card.key === 'spear') {
          if (this.enemyCurrentHp <= dmg * this.data_.playerCritDmg) {
            critChance = 100;
          }
        }
        const isCrit = Math.random() * 100 < critChance;

        // 3. 데미지 * 크리뎀 계산
        let cardDmg = isCrit ? dmg * this.data_.playerCritDmg : dmg;

        // 4. 추뎀 산출 (콤보 계산)
        const sameCards = cards.slice(0, step + 1).filter(c => c.id === card.id);
        const sameElems = cards.slice(0, step + 1).filter(c => c.element === card.element && card.element !== 'normal');

        let bonusDmg = 0;
        if (sameCards.length === 2) {
          bonusDmg = cardDmg * 0.5;
        } else if (sameCards.length === 3) {
          bonusDmg = cardDmg * 1.0;
        } else if (sameElems.length === 2) {
          const vals = sameElems.map(c => c.value * (c.mult || 1.0) * (this.data_.playerCardMult || 1.0));
          bonusDmg = Math.min(...vals) * 0.2;
        } else if (sameElems.length === 3) {
          const sorted = [...sameElems].map(c => c.value * (c.mult || 1.0) * (this.data_.playerCardMult || 1.0)).sort((a, b) => a - b);
          const median = sorted[1];
          bonusDmg = median * 0.4;
        }

        let finalDmg = cardDmg + bonusDmg;
        const totalBeforeDef = finalDmg;

        // 5. 적 방어력 적용
        finalDmg = Math.max(1, Math.floor(finalDmg * (50 / (50 + Math.max(0, this.enemyDef)))));

        console.log(`--- [플레이어 타격 - Step ${step + 1}] ---`);
        console.log(`> 기초 발동 수치(무기/버프 포함 baseVal): ${baseVal.toFixed(2)}`);
        console.log(`> 속성 유리/불리 적용 후: ${dmg.toFixed(2)}`);
        console.log(`> 크리티컬 발동여부: ${isCrit ? '치명타!' : '일반'} (크리적용 후: ${cardDmg.toFixed(2)})`);
        console.log(`> 중첩/연계 보너스 추뎀 (bonusDmg): ${bonusDmg.toFixed(2)}`);
        console.log(`> 적 방어력 적용 전 총합: ${totalBeforeDef.toFixed(2)} | 적 방어력: ${this.enemyDef}`);
        console.log(`> 최종 피해량: ${finalDmg}`);
        console.log(`----------------------------------`);

        // 6. 적용 및 연출
        this.playPlayerAttack(card.element, () => {
          this.enemyCurrentHp = Math.max(0, this.enemyCurrentHp - finalDmg);
          this.updateEnemyHpBar();
          this.playEnemyHit(card.element, isCrit);

          this.showFloatingDamage(this.enemyContainer.x, this.enemyContainer.y - 40, finalDmg, isCrit, '#2ecc71');
          
          const critTxt = isCrit ? ' ★CRIT!' : '';
          const comboTxt = bonusDmg > 0 ? ' (추가 데미지!)' : '';
          this.statusText.setText(`${this.data_.mobName}에게 ${Math.floor(finalDmg)}${critTxt}${comboTxt}`).setColor('#2ecc71');
          
          this.time.delayedCall(isFastForward ? 150 : 350, () => resolve());
        }, isFastForward);

      } else {
        // 비공격성 카드 처리
        if (shield > 0) {
          this.currentTurnDefense += shield;
          this.statusText.setText(`방어력 ${Math.floor(shield)} 증가!`).setColor('#3498db');
          // 쉴드 뱃지 표시
          this.updateShieldBadge();
        }
        if (heal > 0) {
          this.playerCurrentHp = Math.min(this.data_.playerMaxHp, this.playerCurrentHp + heal);
          this.updatePlayerHpBar();
          this.statusText.setText(`HP ${Math.floor(heal)} 회복!`).setColor('#2ecc71');
        }
        this.time.delayedCall(isFastForward ? 250 : 550, () => resolve());
      }
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 플레이어 기본 체술 타격 (카드 적용 후)
  // ───────────────────────────────────────────────────────────────────────────
  private executePlayerBaseAttack(isFastForward: boolean): Promise<void> {
    return new Promise(resolve => {
      let dmg = this.data_.playerAtk;
      if (dmg <= 0) {
        resolve();
        return;
      }
      
      const isCrit = Math.random() * 100 < this.data_.playerCrit;
      let cardDmg = isCrit ? dmg * this.data_.playerCritDmg : dmg;
      let finalDmg = cardDmg;

      // 적 방어력 적용
      finalDmg = Math.max(1, Math.floor(finalDmg * (50 / (50 + Math.max(0, this.enemyDef)))));

      console.log(`--- [플레이어 타격 - 최종 체술] ---`);
      console.log(`> 기초 발동 수치(나의 무기 공격력): ${dmg.toFixed(2)}`);
      console.log(`> 크리티컬 발동여부: ${isCrit ? '치명타!' : '일반'} (크리적용 후: ${cardDmg.toFixed(2)})`);
      console.log(`> 적 방어력 적용 전 총합: ${cardDmg.toFixed(2)} | 적 방어력: ${this.enemyDef}`);
      console.log(`> 최종 피해량: ${finalDmg}`);
      console.log(`----------------------------------`);

      this.playPlayerAttack('normal', () => {
        this.enemyCurrentHp = Math.max(0, this.enemyCurrentHp - finalDmg);
        this.updateEnemyHpBar();
        this.playEnemyHit('normal', isCrit);

        this.showFloatingDamage(this.enemyContainer.x, this.enemyContainer.y - 40, finalDmg, isCrit, '#2ecc71');
        
        const critTxt = isCrit ? ' ★CRIT!' : '';
        this.statusText.setText(`마무리 타격! ${this.data_.mobName}에게 ${Math.floor(finalDmg)}${critTxt}`).setColor('#2ecc71');
        this.time.delayedCall(isFastForward ? 200 : 450, () => resolve());
      }, isFastForward);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 플레이어 공격 트위너 (속성별 다른 스타일)
  // ───────────────────────────────────────────────────────────────────────────
  private playPlayerAttack(elem: string, onComplete: () => void, isFastForward = false) {
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
    let dashDur  = durMap[elem]   ?? 200;
    if (isFastForward) {
      dashDur = Math.max(50, Math.floor(dashDur * 0.4));
    }
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
          duration: dashDur + 100, // 돌아오는 모션 소폭 감속
          ease:     'Power2.easeOut',
          onComplete: () => {
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
  private playEnemyHit(elem: string, isCrit: boolean = false) {
    const elemColor = ELEM_COLORS[elem] ?? 0xff0000;
    this.enemyIdleTween?.pause();

    this.enemyBody.setFillStyle(elemColor, 0.6);

    const origX = this.enemyContainer.x;
    
    // 크리티컬이면 화면 흔들림 효과
    if (isCrit) {
      this.cameras.main.shake(200, 0.01);
      this.enemyContainer.setScale(1.1);
    }
    
    this.tweens.add({
      targets:  this.enemyContainer,
      x:        { from: origX - (isCrit ? 18 : 12), to: origX + (isCrit ? 18 : 12) },
      duration: isCrit ? 40 : 60,
      repeat:   isCrit ? 5 : 3,
      yoyo:     true,
      onComplete: () => {
        this.enemyContainer.x = origX;
        this.enemyContainer.setScale(1.0);
        this.enemyBody.setFillStyle(ELEM_COLORS[this.data_.mapElement] ?? 0xff6666, 0.15);
        this.enemyIdleTween?.resume();
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 적 턴
  // ───────────────────────────────────────────────────────────────────────────
  private doEnemyTurn() {
    // 적 방어력 무시하고 적 공격력에서 내 방어력 상쇄 (방어력 효율)
    const enemyAtkOriginal = this.enemyAtk;
    let enemyDmg = this.enemyAtk;
    enemyDmg = Math.max(1, Math.floor(enemyDmg * (50 / (50 + this.data_.playerDef))));
    const dmgAfterDef = enemyDmg;

    // 쉴드 효과 (데미지 직접 상쇄)
    if (this.currentTurnDefense > 0) {
      enemyDmg = Math.max(0, enemyDmg - this.currentTurnDefense);
    }

    // 쉴드 뱃지 숨기기 (적 턴 시작 = 쉴드 소멸)
    this.currentTurnDefense = 0;
    this.shieldBadge?.setVisible(false);

    console.log(`--- [적 타격 이벤트] ---`);
    console.log(`> 적군 기초 공격력: ${enemyAtkOriginal}`);
    console.log(`> 내 방어력(${this.data_.playerDef}) 감쇄 적용 후: ${dmgAfterDef}`);
    if (this.currentTurnDefense > 0) {
      console.log(`> 쉴드 직접 삭감값: -${this.currentTurnDefense}`);
    }
    console.log(`> 최종으로 받는 HP 피해: ${enemyDmg}`);
    console.log(`------------------------`);

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

        this.showFloatingDamage(this.playerSprite.x, this.playerSprite.y - 40, enemyDmg, false, '#e74c3c');

        // 상태 텍스트
        this.statusText.setText(`${i18n.t('player') || '내'} HP -${Math.floor(enemyDmg)}`).setColor('#e74c3c');

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
            this.updateAttackButtonState();
            this.time.delayedCall(300, () => {
              this.statusText.setText('');
              this.isAnimating = false;
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
    this.playerSprite.setTint(0xff0000);
    this.cameras.main.shake(200, 0.015); // 화면 흔들림

    const origX = this.playerSprite.x;
    this.tweens.add({
      targets:  this.playerSprite,
      x:        { from: origX - 15, to: origX + 15 },
      duration: 50,
      repeat:   4,
      yoyo:     true,
      onComplete: () => {
        this.playerSprite.x = origX;
        this.playerSprite.clearTint();
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 데미지 플로팅 텍스트 이펙트
  // ───────────────────────────────────────────────────────────────────────────
  private showFloatingDamage(x: number, y: number, amount: number, isCrit: boolean, color: string) {
    if (amount <= 0 && color !== '#e74c3c') return;

    const txt = this.add.text(x, y, `-${Math.floor(amount)}`, {
      fontFamily: FONT_B,
      fontSize: isCrit ? '42px' : '28px',
      color: color,
      stroke: '#000000',
      strokeThickness: isCrit ? 6 : 4,
      fontStyle: isCrit ? 'italic' : 'normal'
    }).setOrigin(0.5);

    // 크리 텍스트
    if (isCrit) {
      const critObj = this.add.text(x, y - 35, 'CRITICAL!', {
        fontFamily: FONT_B, fontSize: '20px', color: '#ffcc00', stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5);
      
      this.tweens.add({
        targets: critObj, y: y - 60, alpha: 0, duration: 800, ease: 'Power2.easeOut',
        onComplete: () => critObj.destroy()
      });
    }

    this.tweens.add({
      targets: txt,
      y: y - (isCrit ? 80 : 50),
      alpha: 0,
      scale: isCrit ? 1.5 : 1,
      duration: isCrit ? 1400 : 1100, // 더 오래 표시되도록 증가
      ease: 'Power2.easeOut',
      onComplete: () => txt.destroy()
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
  // 쉴드 뱃지 텍스트 업데이트
  // ───────────────────────────────────────────────────────────────────────────
  private updateShieldBadge() {
    if (!this.shieldBadge) return;
    const txt = this.shieldBadge.getByName('badgeTxt') as Phaser.GameObjects.Text;
    if (txt) txt.setText(`쉴드 ${Math.floor(this.currentTurnDefense)}`);
    this.shieldBadge.setVisible(this.currentTurnDefense > 0);
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

    // 결과 오버레이 및 팝업
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, this.W, this.H);
    overlay.setDepth(100);

    const resultCont = this.add.container(this.W / 2, this.H / 2).setDepth(101);
    
    // 배경 박스
    const boxW = 320;
    const boxH = 220;
    const box = this.add.graphics();
    box.fillStyle(0x1a1a2a, 0.95);
    box.lineStyle(2, playerWon ? 0x2ecc71 : 0xe74c3c, 1);
    box.fillRoundedRect(-boxW/2, -boxH/2, boxW, boxH, 12);
    box.strokeRoundedRect(-boxW/2, -boxH/2, boxW, boxH, 12);
    
    // 타이틀
    const titleTxt = this.add.text(0, -60, playerWon ? 'VICTORY' : 'DEFEAT', {
      fontFamily: FONT_B, fontSize: '36px', color: resultColor
    }).setOrigin(0.5);
    
    // 상세 메시지
    const detailTxt = this.add.text(0, -10, resultText, {
      fontFamily: FONT_M, fontSize: '16px', color: '#ffffff', align: 'center'
    }).setOrigin(0.5);
    
    // 확인 버튼
    const btnW = 140;
    const btnH = 45;
    const btnCont = this.add.container(0, 70);
    const btnBg = this.add.graphics();
    btnBg.fillStyle(playerWon ? 0x27ae60 : 0xc0392b, 1);
    btnBg.fillRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 8);
    const btnTxt = this.add.text(0, 0, i18n.t('confirm') || '확인', {
      fontFamily: FONT_B, fontSize: '18px', color: '#ffffff'
    }).setOrigin(0.5);
    btnCont.add([btnBg, btnTxt]);
    
    btnCont.setInteractive(new Phaser.Geom.Rectangle(-btnW/2, -btnH/2, btnW, btnH), Phaser.Geom.Rectangle.Contains);
    btnCont.on('pointerdown', () => {
      const hpDelta = this.playerCurrentHp - this.data_.playerHp;
      this.game.events.emit('nodeEventComplete', {
        battleResult: playerWon ? 'win' : 'lose',
        hpDelta,
        nodeId:       this.data_.nodeId,
      });
      this.scene.stop('NodeEventScene');
      this.scene.stop();
      this.scene.resume('MainScene');
    });

    resultCont.add([box, titleTxt, detailTxt, btnCont]);
    
    // 등장 애니메이션
    resultCont.setScale(0.8);
    resultCont.setAlpha(0);
    this.tweens.add({
      targets: resultCont,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });
  }
}
