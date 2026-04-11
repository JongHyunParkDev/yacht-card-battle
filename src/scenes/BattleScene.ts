import Phaser from 'phaser';
import { CARD_DATA_LIST, CardData, CardElement, ELEMENT_ATTR_INDEX } from '@src/data/cardData';
import { getRandomEnemy, EnemyDef } from '@src/data/enemyData';
import { getEquipmentById } from '@src/data/equipmentData';
import { i18n } from '@src/utils/localization';
import { WeaponType, CHAR_SPRITE_KEY, CHAR_FRAME_COUNT } from '@src/scenes/CharacterSelectScene';
import Card, { CARD_WIDTH, CARD_HEIGHT } from '@src/objects/Card';
import type { CardEffect } from '@src/data/cardData';
import { AudioManager } from '@src/utils/Audio';

// ─── 인터페이스 ───────────────────────────────────────────────────────────────

export interface BattleSceneData {
  nodeId:           number;
  isElemental:      boolean;
  isBoss?:          boolean;
  mapElement:       CardElement;
  mobName:          string;
  playerHp:         number;
  playerMaxHp:      number;
  playerAtk:        number;
  playerDef:        number;
  playerCrit:       number;
  playerCritDmg:    number;
  characterWeapon:  WeaponType;
  deck:             { cardId: number; count: number; mult?: number; stars?: number; bonusValue?: number }[];
  playerCardMult:   number;
  playerShieldMult: number;
  playerEquipment?: string[];  // 장비 ID 목록 (패시브 효과 적용용)
  isFinalBoss?:     boolean;   // 최종 보스 여부
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

  // ── 적 상태이상 ───────────────────────────────────────────────────────────
  private enemyBurnValue    = 0;   // 화상: 턴당 데미지
  private enemyBurnDur      = 0;   // 화상 남은 턴
  private enemyVulnerableDur = 0;  // 취약 남은 턴 (피해 +50%)
  private enemyStunned       = false; // 기절: 다음 적 공격 스킵
  private enemyArmorBreak    = 0;  // 방깎: 적 방어력 감소량

  // ── 적 행동 예고 UI ────────────────────────────────────────────────────────
  private enemyIntentCont: Phaser.GameObjects.Container | null = null;
  private enemyStatusCont: Phaser.GameObjects.Container | null = null;
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private rerollBtns: Phaser.GameObjects.Container[] = [];
  private attackBtn!: Phaser.GameObjects.Container;
  private comboInfoText!:   Phaser.GameObjects.Text;
  private shieldBadge!:     Phaser.GameObjects.Container; // 쉴드 표시 뱃지
  private currentTurnDefense = 0;

  // ── 장비 패시브 효과 (applyEquipmentPassives에서 계산) ──────────────────────
  private equipShieldPerTurn  = 0;   // shield_on_turn_end 합계
  private equipHealOnWin      = 0;   // heal_on_win 합계
  private equipHealOnWinPct   = 0;   // heal_on_win_pct 합계
  private equipElemAmplify    = 0;   // element_amplify 합계
  private equipLifestealPct   = 0;   // lifesteal_pct 합계
  private equipCardMultOnCrit = 0;   // card_mult_on_crit 합계
  private equipElemAtkBonus: Record<string, number> = {};  // elementAtkBonus
  private equipElemDmgReduce: Record<string, number> = {}; // elementDefBonus

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
    // 상태이상 초기화
    this.enemyBurnValue = 0;
    this.enemyBurnDur = 0;
    this.enemyVulnerableDur = 0;
    this.enemyStunned = false;
    this.enemyArmorBreak = 0;
    this.enemyIntentCont = null;
    this.enemyStatusCont = null;
    // 장비 패시브 초기화
    this.equipShieldPerTurn  = 0;
    this.equipHealOnWin      = 0;
    this.equipHealOnWinPct   = 0;
    this.equipElemAmplify    = 0;
    this.equipLifestealPct   = 0;
    this.equipCardMultOnCrit = 0;
    this.equipElemAtkBonus   = {};
    this.equipElemDmgReduce  = {};
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

    // 적 의도 및 상태이상 UI
    this.createEnemyIntentUI();

    // 장비 패시브 계산
    this.applyEquipmentPassives();

    // 첫 손패 드로우 (Guardian 패시브도 여기서)
    this.drawHand();
    this.refreshCardDisplay();
    this.updateAttackButtonState();

    // ESC 차단
    this.input.keyboard?.on('keydown-ESC', () => { /* 전투 중 비활성 */ });

    // ── 사운드 재생 ───────────────────────────────────────────────────────────
    this.playBattleBGM();
  }

  /** 배틀 타입에 따른 배경음 재생 */
  private playBattleBGM() {
    // 기존 배경음 중단
    this.sound.stopAll();

    let bgmKey = 'bgm_battle_normal';
    if (this.data_.isFinalBoss) {
      bgmKey = 'bgm_battle_final';
    } else if (this.data_.isBoss) {
      bgmKey = 'bgm_battle_boss';
    }

    this.sound.play(bgmKey, { loop: true, volume: AudioManager.bgmVol });
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
          this.drawPile.push({ ...cardDef, mult: entry.mult ?? 1, bonusValue: entry.bonusValue ?? 0, stars: entry.stars ?? cardDef.stars });
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
  // 장비 패시브 효과 계산 (create 시 한 번만 호출)
  // ───────────────────────────────────────────────────────────────────────────
  private applyEquipmentPassives() {
    const equips = this.data_.playerEquipment ?? [];
    for (const id of equips) {
      const eq = getEquipmentById(id);
      if (!eq) continue;

      // 속성별 공격 보너스
      if (eq.stats.elementAtkBonus) {
        for (const [elem, val] of Object.entries(eq.stats.elementAtkBonus)) {
          this.equipElemAtkBonus[elem] = (this.equipElemAtkBonus[elem] ?? 0) + (Number(val) || 0);
        }
      }
      // 속성별 피해 감소
      if (eq.stats.elementDefBonus) {
        for (const [elem, val] of Object.entries(eq.stats.elementDefBonus)) {
          this.equipElemDmgReduce[elem] = (this.equipElemDmgReduce[elem] ?? 0) + (Number(val) || 0);
        }
      }
      // 특수 효과
      if (!eq.special) continue;
      switch (eq.special.type) {
        case 'shield_on_turn_end': this.equipShieldPerTurn  += eq.special.value; break;
        case 'heal_on_win':        this.equipHealOnWin      += eq.special.value; break;
        case 'heal_on_win_pct':    this.equipHealOnWinPct   += eq.special.value; break;
        case 'element_amplify':    this.equipElemAmplify    += eq.special.value; break;
        case 'lifesteal_pct':      this.equipLifestealPct   += eq.special.value; break;
        case 'card_mult_on_crit':  this.equipCardMultOnCrit += eq.special.value; break;
      }
    }
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

    // fill — 초기 HP 비율 반영
    const initRatio = isPlayer
      ? Math.max(0, this.playerCurrentHp / this.data_.playerMaxHp)
      : 1;
    const fill = this.add.rectangle(x + barW * initRatio / 2, cy, barW * initRatio, barH,
      isPlayer ? (initRatio > 0.3 ? 0x2ecc71 : 0xe74c3c) : 0xe74c3c);
    fill.setOrigin(0.5, 0.5);

    // HP 텍스트
    const hpTxt = this.add.text(cx, cy + barH + 2,
      isPlayer
        ? `${this.playerCurrentHp} / ${this.data_.playerMaxHp}`
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
      fontFamily: FONT_B, fontSize: '26px', color: '#d4af37',
    }).setOrigin(0.5);

    this.statusText = this.add.text(cx, this.H * 0.65, '', {
      fontFamily: FONT_M, fontSize: '20px', color: '#cccccc',
      wordWrap: { width: this.W * 0.38 }, align: 'center',
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

    // [New Logic] Ranger/Lancer: 보장된 전용 카드 먼저 뽑기
    if (this.data_.characterWeapon === 'bow' || this.data_.characterWeapon === 'spear') {
      const targetId = this.data_.characterWeapon === 'bow' ? 28 : 27; // 28: Arrow, 27: Spear
      
      // 1. drawPile에서 찾기
      let targetIdx = this.drawPile.findIndex(c => c.id === targetId);
      
      // 2. drawPile에 없으면 discardPile에서 찾기
      if (targetIdx === -1) {
        const discIdx = this.discardPile.findIndex(c => c.id === targetId);
        if (discIdx !== -1) {
          // reshuffle (drawPile로 합친 뒤 random shuffle)
          this.drawPile.push(...this.discardPile);
          this.discardPile = [];
          this.drawPile.sort(() => Math.random() - 0.5);
          targetIdx = this.drawPile.findIndex(c => c.id === targetId);
        }
      }
      
      // 3. 찾았으면 손패로 (HAND_SIZE 1개 차지)
      if (targetIdx !== -1) {
        const card = this.drawPile.splice(targetIdx, 1)[0];
        this.hand.push(card);
      }
    }

    // 나머지 채우기
    while (this.hand.length < HAND_SIZE) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length > 0) {
          this.drawPile = [...this.discardPile].sort(() => Math.random() - 0.5);
          this.discardPile = [];
        } else {
          break;
        }
      }
      this.hand.push(this.drawPile.shift()!);
    }

    this.rerollsUsed   = Array(HAND_SIZE).fill(false);
    this.selectedCards = Array(HAND_SIZE).fill(false);
    this.selectionOrder = [];

    // 매 턴 시작 시 쉴드 초기화 (이전 턴 잔여 쉴드 제거)
    this.currentTurnDefense = 0;

    // Guardian 패시브: 매 턴 시작 시 방어막 +5
    if (this.data_.characterWeapon === 'swordShield') {
      this.currentTurnDefense += 5;
      this.updateShieldBadge();
    }

    // 적 행동 예고 갱신
    this.updateEnemyIntent();
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

      // Card 객체 생성 (일반 카드 stars 오버라이드)
      const overrideStars = cardData.element === 'normal' ? (cardData as any).stars : undefined;
      const cardObj = new Card(this, -cardW / 2, -cardH / 2, cardData, overrideStars);
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

    // 대체 카드 확보 (실패 시 토큰 소비 않음)
    if (this.drawPile.length === 0) {
      if (this.discardPile.length > 0) {
        this.drawPile = [...this.discardPile].sort(() => Math.random() - 0.5);
        this.discardPile = [];
      } else {
        return; // 대체 카드 없음 — 리롤 불가
      }
    }

    // 즉시 잠금 (Phaser가 같은 프레임에 이벤트 2개를 처리해도 2번 실행 방지)
    this.rerollsUsed[idx] = true;
    this.rerollBtns[idx]?.disableInteractive();

    // 기존 카드는 버림패로 보냄 (덱에서 카드 소실 방지)
    this.discardPile.push(this.hand[idx]);
    this.hand[idx] = this.drawPile.shift()!;

    this.selectedCards[idx] = false;
    this.selectionOrder = this.selectionOrder.filter(i => i !== idx);
    this.refreshCardDisplay();
    this.updateAttackButtonState();

    AudioManager.play('CARD_SELECT');
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
      if (this.selectionOrder.length >= 3) {
      AudioManager.play('ERROR');
      return;
    }
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
        // 속성 콤보가 카드 ID 콤보보다 크거나 같으면 속성 콤보 우선 표시
        if (sameElemsCount >= 2 && sameElemsCount >= sameCardsCount) {
          comboMsg = `동일 속성 ${sameElemsCount}장 효과 적용!`;
          this.comboInfoText.setColor('#ff9800');
        } else if (sameCardsCount >= 2) {
          comboMsg = `동일 카드 ${sameCardsCount}장 효과 적용!`;
          this.comboInfoText.setColor('#ffeb3b');
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
      AudioManager.play('CARD_PLAY');
      const baseVal = (card.value + (card.bonusValue || 0)) * (card.mult || 1.0) * (this.data_.playerCardMult || 1.0);
      let dmg = 0;
      let heal = 0;
      let shield = 0;

      // 0. 기초 수치 분배
      if (card.key === 'shield' || card.key === 'defense') {
        shield = baseVal * (this.data_.playerShieldMult || 1.0);
        // Guardian 패시브: 방어 카드 2배
        if (this.data_.characterWeapon === 'swordShield') shield *= 2;
      } else if (card.key === 'hp') {
        heal = baseVal;
      } else if (card.key === 'arrow') {
        // Ranger 패시브: 화살 카드 = (ATK + 카드밸류) × mult × cardMult
        if (this.data_.characterWeapon === 'bow') {
          dmg = (this.data_.playerAtk + card.value + (card.bonusValue || 0)) * (card.mult || 1.0) * (this.data_.playerCardMult || 1.0);
        } else {
          dmg = baseVal;
        }
      } else {
        dmg = baseVal;
      }

      // effects에 shield_add / heal이 있는 경우 비공격 카드처럼 먼저 적용
      const shieldEff = card.effects?.find(e => e.type === 'shield_add');
      const healEff   = card.effects?.find(e => e.type === 'heal');

      if (shieldEff) {
        let shieldVal = shieldEff.value * (card.mult || 1) * (this.data_.playerShieldMult || 1);
        if (this.data_.characterWeapon === 'swordShield') shieldVal *= 2; // Guardian
        this.currentTurnDefense += shieldVal;
        this.updateShieldBadge();
        AudioManager.play('SHIELD');
      }
      if (healEff) {
        const healAmt = Math.floor(healEff.value * (card.mult || 1));
        this.playerCurrentHp = Math.min(this.data_.playerMaxHp, this.playerCurrentHp + healAmt);
        this.updatePlayerHpBar();
        this.showFloatingHeal(this.playerSprite.x, this.playerSprite.y - 50, healAmt);
        AudioManager.play('HEAL');
      }

      if (dmg > 0) {
        // ── multi_hit 처리 ────────────────────────────────────────────────
        const multiHit = card.effects?.find(e => e.type === 'multi_hit');
        const hitCount = multiHit ? multiHit.value : 1;

        let hitsDone = 0;
        const doOneHit = () => {
          if (this.enemyCurrentHp <= 0 || this.battleEnded) { resolve(); return; }

          // 1. 속성 상성 (dmg = baseVal에 패시브 배율 적용된 값)
          let hitDmg = dmg;
          if (card.element !== 'normal') {
            const amplify = 1 + (this.equipElemAmplify ?? 0);
            if (TYPE_BEATS[card.element] === this.data_.mapElement) hitDmg *= 1.5 * amplify;
            else if (TYPE_BEATS[this.data_.mapElement] === card.element) hitDmg *= 0.5;
            // 장비 속성 공격 보너스
            const elemBonus = this.equipElemAtkBonus[card.element] ?? 0;
            if (elemBonus > 0) hitDmg *= (1 + elemBonus);
          }

          // 2. 취약 (Vulnerable)
          if (this.enemyVulnerableDur > 0) hitDmg *= 1.5;

          // 3. 크리티컬
          let critChance = this.data_.playerCrit;
          // Berserker 패시브: HP < 60% → 크리 확률 +20%
          if (this.data_.characterWeapon === 'greatsword' && this.playerCurrentHp < this.data_.playerMaxHp * 0.6) {
            critChance += 20;
          }
          // Lancer 패시브: spear 카드 항상 크리
          if (this.data_.characterWeapon === 'spear' && card.key === 'spear') critChance = 100;

          const isCrit = Math.random() * 100 < critChance;
          let critDmgMult = this.data_.playerCritDmg;
          // Berserker 패시브: HP < 60% → 크리뎀 +0.3
          if (this.data_.characterWeapon === 'greatsword' && this.playerCurrentHp < this.data_.playerMaxHp * 0.6) {
            critDmgMult += 0.3;
          }
          let cardDmg = isCrit ? hitDmg * (critDmgMult + (this.equipCardMultOnCrit ?? 0)) : hitDmg;

          // 4. 콤보 추뎀
          const sameCards = cards.slice(0, step + 1).filter(c => c.id === card.id);
          const sameElems = cards.slice(0, step + 1).filter(c => c.element === card.element && card.element !== 'normal');
          let comboBonusMult = 1;

          let bonusDmg = 0;
          if (sameCards.length === 2) bonusDmg = cardDmg * 0.5 * comboBonusMult;
          else if (sameCards.length === 3) bonusDmg = cardDmg * 1.0 * comboBonusMult;
          else if (sameElems.length === 2) {
            const vals = sameElems.map(c => c.value * (c.mult || 1) * (this.data_.playerCardMult || 1));
            bonusDmg = Math.min(...vals) * 0.2;
          } else if (sameElems.length === 3) {
            const sorted = [...sameElems].map(c => c.value * (c.mult || 1) * (this.data_.playerCardMult || 1)).sort((a, b) => a - b);
            bonusDmg = sorted[1] * 0.4;
          }

          // 5. 연쇄(chain) 효과: 적 상태이상 시 추가 피해
          let chainBonus = 0;
          const chainEff = card.effects?.find(e => e.type === 'chain');
          if (chainEff) {
            const hasStatus = this.enemyBurnDur > 0 || this.enemyVulnerableDur > 0 || this.enemyStunned;
            if (hasStatus) {
              chainBonus = chainEff.value * (card.mult || 1) * (this.data_.playerCardMult || 1);
              // Ranger 패시브: chain 데미지 +50%
              if (this.data_.characterWeapon === 'bow') chainBonus *= 1.5;
            }
          }

          let finalDmg = cardDmg + bonusDmg + chainBonus;

          // 6. 방어력 적용 (pierce 시 무시 / Titan 패시브: 항상 방어 무시)
          const isPierce = card.effects?.some(e => e.type === 'pierce') || this.data_.characterWeapon === 'hammer';
          if (!isPierce) {
            const effectiveDef = Math.max(0, this.enemyDef - this.enemyArmorBreak);
            finalDmg = Math.max(1, Math.floor(finalDmg * (50 / (50 + effectiveDef))));
          } else {
            finalDmg = Math.max(1, Math.floor(finalDmg));
          }

          // Lancer 패시브: spear 카드 크리 + 방어 전 크리뎀 >= 적 현재 HP → 즉사
          let isInstakill = false;
          if (this.data_.characterWeapon === 'spear' && card.key === 'spear' && isCrit) {
            const rawCritDmg = hitDmg * critDmgMult;
            if (rawCritDmg >= this.enemyCurrentHp) {
              finalDmg = this.enemyCurrentHp;
              isInstakill = true;
            }
          }

          // 7. 연출 → 데미지 적용
          console.log(`[카드 공격] ${card.nameKey} | baseVal=${card.value} dmg(패시브후)=${dmg} hitDmg(상성후)=${hitDmg.toFixed(1)} crit=${isCrit}(×${critDmgMult}) cardDmg=${cardDmg.toFixed(1)} bonus=${bonusDmg.toFixed(1)} pierce=${isPierce} finalDmg=${finalDmg}${isInstakill ? ' 즉사!' : ''}`);
          this.playPlayerAttack(card.element, () => {
            this.enemyCurrentHp = Math.max(0, this.enemyCurrentHp - finalDmg);
            this.updateEnemyHpBar();
            this.playEnemyHit(card.element, isCrit);
            this.showFloatingDamage(this.enemyContainer.x, this.enemyContainer.y - 40, finalDmg, isCrit, '#2ecc71');
            
            // 피격 사운드 (크리티컬은 별도 사운드)
        AudioManager.play(isCrit ? 'CRIT' : 'HIT');

            // 장비 흡혈 효과
            if (this.equipLifestealPct > 0) {
              const lifeSteal = Math.floor(finalDmg * this.equipLifestealPct);
              if (lifeSteal > 0) {
                this.playerCurrentHp = Math.min(this.data_.playerMaxHp, this.playerCurrentHp + lifeSteal);
                this.updatePlayerHpBar();
                this.showFloatingHeal(this.playerSprite.x, this.playerSprite.y - 50, lifeSteal);
                AudioManager.play('HEAL');
              }
            }

            // chain 연쇄 추가 피해 표시
            if (chainBonus > 0) {
              this.time.delayedCall(200, () => {
                this.showFloatingDamage(this.enemyContainer.x + 20, this.enemyContainer.y - 70, chainBonus, false, '#ffe033');
              });
            }

            const critTxt     = isCrit ? ' ★CRIT!' : '';
            const combotxt    = bonusDmg > 0 ? ' (콤보!)' : '';
            const chaintxt    = chainBonus > 0 ? ' ⚡연쇄!' : '';
            const instakillTxt = isInstakill ? ' 💥즉사!' : '';
            this.statusText.setText(`${this.data_.mobName}에게 ${Math.floor(finalDmg)}${critTxt}${instakillTxt}${combotxt}${chaintxt}`).setColor(isInstakill ? '#ff44ff' : '#2ecc71');

            // 8. 카드 효과 적용 (상태이상 부여)
            this.applyCardEffects(card.effects ?? []);
            this.updateEnemyStatusDisplay();

            hitsDone++;
            if (hitsDone < hitCount) {
              // 다중 타격: 잠시 후 다음 타격
              this.time.delayedCall(isFastForward ? 100 : 280, doOneHit);
            } else {
              this.time.delayedCall(isFastForward ? 120 : 300, () => resolve());
            }
          }, isFastForward, card.stars);
        };

        doOneHit();

      } else {
        // 비공격 카드 (defense/shield/hp key)
        if (shield > 0) {
          this.currentTurnDefense += shield;
          this.statusText.setText(`방어막 ${Math.floor(shield)} 생성!`).setColor('#56b4f7');
          this.updateShieldBadge();
          AudioManager.play('SHIELD');
        }
        if (heal > 0) {
          this.playerCurrentHp = Math.min(this.data_.playerMaxHp, this.playerCurrentHp + heal);
          this.updatePlayerHpBar();
          this.statusText.setText(`HP ${Math.floor(heal)} 회복!`).setColor('#2ecc71');
          AudioManager.play('HEAL');
        }
        this.time.delayedCall(isFastForward ? 200 : 450, () => resolve());
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
        AudioManager.play(isCrit ? 'CRIT' : 'HIT');
        this.time.delayedCall(isFastForward ? 200 : 450, () => resolve());
      }, isFastForward);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 플레이어 공격 트위너 (속성별 다른 스타일 + 프로젝타일 발사)
  // ───────────────────────────────────────────────────────────────────────────
  private playPlayerAttack(elem: string, onComplete: () => void, isFastForward = false, stars = 0) {
    const startX = this.playerSprite.x;
    const dashX  = startX + this.W * 0.20; // 살짝 짧게 대시 (프로젝타일 공간 확보)

    const easeMap: Record<string, string> = {
      water:     'Sine.easeInOut',
      fire:      'Expo.easeOut',
      grass:     'Bounce.easeOut',
      lightning: 'Power4.easeOut',
      earth:     'Power2.easeIn',
      normal:    'Power1.easeInOut',
    };
    const durMap: Record<string, number> = {
      water: 200, fire: 130, grass: 250, lightning: 70, earth: 300, normal: 180,
    };
    const ease    = easeMap[elem]  ?? 'Power1.easeInOut';
    let dashDur = durMap[elem]   ?? 180;
    if (isFastForward) {
      dashDur = Math.max(40, Math.floor(dashDur * 0.4));
    }
    const elemColor = ELEM_COLORS[elem] ?? 0xffffff;

    // 공격 사운드 (속성별 오버레이 톤 포함)
    AudioManager.playAttack(elem);

    // 속성 색 tint
    this.playerSprite.setTint(elemColor);

    this.tweens.add({
      targets:  this.playerSprite,
      x:        dashX,
      duration: dashDur,
      ease,
      onComplete: () => {
        this.playerSprite.clearTint();

        // 대시 정점에서 프로젝타일 발사
        const launchX = this.playerSprite.x;
        const launchY = this.playerSprite.y - 20;
        this.launchProjectile(elem, launchX, launchY, isFastForward, () => {
          onComplete(); // 프로젝타일이 적에 도달하면 데미지 콜백
        }, stars);

        // 플레이어는 프로젝타일과 동시에 복귀
        this.tweens.add({
          targets:  this.playerSprite,
          x:        startX,
          duration: dashDur + 80,
          ease:     'Power2.easeOut',
        });
      },
    });

    // lightning 특수: 빠른 shake 추가
    if (elem === 'lightning') {
      this.tweens.add({
        targets:   this.playerSprite,
        angle:     { from: -8, to: 8 },
        duration:  30,
        repeat:    5,
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
    // ── 화상(Burn) 처리 ─────────────────────────────────────────────────────
    if (this.enemyBurnDur > 0) {
      const burnDmg = this.enemyBurnValue;
      this.enemyCurrentHp = Math.max(0, this.enemyCurrentHp - burnDmg);
      this.updateEnemyHpBar();
      this.showFloatingDamage(this.enemyContainer.x, this.enemyContainer.y - 60, burnDmg, false, '#ff6600');
      this.statusText.setText(`🔥 화상 ${burnDmg} 피해! (${this.enemyBurnDur}턴 남음)`).setColor('#ff6600');
      AudioManager.play('BURN_TICK');
      this.enemyBurnDur--;
      this.updateEnemyStatusDisplay();
      if (this.enemyCurrentHp <= 0) {
        this.time.delayedCall(600, () => this.endBattle(true));
        return;
      }
    }

    // ── 취약 기간 차감 ───────────────────────────────────────────────────────
    if (this.enemyVulnerableDur > 0) {
      this.enemyVulnerableDur--;
      this.updateEnemyStatusDisplay();
    }

    // ── 기절(Stun): 이번 턴 적 공격 스킵 ───────────────────────────────────
    if (this.enemyStunned) {
      this.enemyStunned = false;
      this.statusText.setText(`💫 ${this.data_.mobName} 기절! 공격 스킵`).setColor('#aaaaff');
      this.cameras.main.shake(100, 0.005);
      this.updateEnemyStatusDisplay();
      this.time.delayedCall(900, () => this.advanceToNextTurn());
      return;
    }

    // ── 적 공격력 계산 ───────────────────────────────────────────────────────
    const enemyAtkOriginal = this.enemyAtk;
    let enemyDmg = this.enemyAtk;
    // 장비 속성 피해 감소
    const elemReduce = this.equipElemDmgReduce[this.data_.mapElement ?? ''] ?? 0;
    if (elemReduce > 0) enemyDmg *= Math.max(0, 1 - elemReduce);
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

            this.advanceToNextTurn();
          },
        });
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 플레이어 피격
  // ───────────────────────────────────────────────────────────────────────────
  private playPlayerHit() {
    AudioManager.play('HIT');
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
      fontSize: isCrit ? '58px' : '40px',
      color: color,
      stroke: '#000000',
      strokeThickness: isCrit ? 9 : 6,
      fontStyle: isCrit ? 'italic' : 'normal'
    }).setOrigin(0.5);

    // 크리 텍스트
    if (isCrit) {
      const critObj = this.add.text(x, y - 45, 'CRITICAL!', {
        fontFamily: FONT_B, fontSize: '30px', color: '#ffcc00', stroke: '#000', strokeThickness: 4
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

    // 장비 승리 시 회복 효과
    if (playerWon) {
      let healAmt = this.equipHealOnWin;
      if (this.equipHealOnWinPct > 0) {
        healAmt += Math.floor(this.data_.playerMaxHp * this.equipHealOnWinPct);
      }
      if (healAmt > 0) {
        this.playerCurrentHp = Math.min(this.data_.playerMaxHp, this.playerCurrentHp + healAmt);
        this.updatePlayerHpBar();
        AudioManager.play('HEAL');
      }
    }

    const resultColor = playerWon ? '#2ecc71' : '#e74c3c';
    const resultText  = playerWon
      ? `승리!\n(적 ${this.data_.mobName} 격파)`
      : `패배...\nHP가 0이 되었습니다.`;

    this.statusText.setText(resultText).setColor(resultColor);
    this.attackBtn.setVisible(false);

    // BGM 중단 및 결과 사운드 재생
    this.sound.stopAll();
    if (playerWon) {
      AudioManager.play('WIN');
    } else {
      AudioManager.play('LOSE');
    }

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

  // ───────────────────────────────────────────────────────────────────────────
  // 다음 턴 진행 (공통 로직 추출)
  // ───────────────────────────────────────────────────────────────────────────
  private advanceToNextTurn() {
    if (this.playerCurrentHp <= 0) {
      this.time.delayedCall(600, () => this.endBattle(false));
      return;
    }
    this.currentTurn++;
    if (this.currentTurn > MAX_TURNS) {
      this.endBattle(this.playerCurrentHp >= this.enemyCurrentHp);
      return;
    }
    this.turnLabel.setText(`TURN ${this.currentTurn} / ${MAX_TURNS}`);
    // 장비 턴마다 쉴드 부여
    if (this.equipShieldPerTurn > 0) {
      this.currentTurnDefense += this.equipShieldPerTurn;
      this.updateShieldBadge();
      AudioManager.play('SHIELD');
    }
    this.drawHand();
    this.refreshCardDisplay();
    this.updateAttackButtonState();
    this.time.delayedCall(300, () => {
      this.statusText.setText('');
      this.isAnimating = false;
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 카드 효과 적용 (상태이상 부여)
  // ───────────────────────────────────────────────────────────────────────────
  private applyCardEffects(effects: CardEffect[]) {
    for (const eff of effects) {
      switch (eff.type) {
        case 'burn':
          // 화상: 기존보다 강한 쪽으로 덮어씌움
          if (eff.value > this.enemyBurnValue || (this.enemyBurnDur === 0)) {
            this.enemyBurnValue = eff.value;
          }
          this.enemyBurnDur = Math.max(this.enemyBurnDur, eff.duration ?? 2);
          AudioManager.play('BUFF');
          break;
        case 'vulnerable':
          this.enemyVulnerableDur = Math.max(this.enemyVulnerableDur, eff.duration ?? 1);
          AudioManager.play('DEBUFF');
          break;
        case 'stun':
          this.enemyStunned = true;
          AudioManager.play('STUN');
          break;
        case 'armor_break':
          this.enemyArmorBreak += eff.value;
          AudioManager.play('DEBUFF');
          break;
        // heal / shield_add / multi_hit / pierce / chain 은 executeCardAction에서 직접 처리
        default: break;
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 회복 플로팅 텍스트
  // ───────────────────────────────────────────────────────────────────────────
  private showFloatingHeal(x: number, y: number, amount: number) {
    if (amount <= 0) return;
    const txt = this.add.text(x, y, `+${Math.floor(amount)} HP`, {
      fontFamily: FONT_B, fontSize: '24px', color: '#00e676',
      stroke: '#005020', strokeThickness: 3,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: txt, y: y - 45, alpha: 0, duration: 1000, ease: 'Power2.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 적 상태이상 배지 UI 생성
  // ───────────────────────────────────────────────────────────────────────────
  private createEnemyIntentUI() {
    const ex = this.W * 0.82;

    // 적 의도 (다음 공격 예고) — 적 위쪽
    this.enemyIntentCont = this.add.container(ex, this.H * 0.195);
    const iBg = this.add.graphics();
    iBg.fillStyle(0x1a0a0a, 0.85);
    iBg.lineStyle(1, 0xd4af37, 0.5);
    iBg.fillRoundedRect(-65, -14, 130, 28, 6);
    iBg.strokeRoundedRect(-65, -14, 130, 28, 6);
    const iTxt = this.add.text(0, 0, '', { fontFamily: FONT_M, fontSize: '13px', color: '#ffaaaa' })
      .setOrigin(0.5).setName('intentTxt');
    this.enemyIntentCont.add([iBg, iTxt]);

    // 상태이상 배지 — HP바 아래
    this.enemyStatusCont = this.add.container(ex, this.H * 0.645);
    const sTxt = this.add.text(0, 0, '', { fontFamily: FONT_M, fontSize: '12px', color: '#ff9944', align: 'center' })
      .setOrigin(0.5).setName('statusTxt');
    this.enemyStatusCont.add(sTxt);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 적 행동 예고 갱신
  // ───────────────────────────────────────────────────────────────────────────
  private updateEnemyIntent() {
    if (!this.enemyIntentCont) return;
    const txt = this.enemyIntentCont.getByName('intentTxt') as Phaser.GameObjects.Text;
    if (!txt) return;

    if (this.battleEnded) { txt.setText(''); return; }

    if (this.enemyStunned) {
      txt.setText('💫 기절 중').setColor('#aaaaff');
    } else {
      const rawDmg = Math.max(1, Math.floor(this.enemyAtk * (50 / (50 + this.data_.playerDef))));
      const shieldMitigated = Math.max(0, rawDmg - this.currentTurnDefense);
      txt.setText(`⚔ 예고 공격: -${rawDmg}`).setColor(shieldMitigated >= rawDmg * 0.5 ? '#ff7777' : '#ffaaaa');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 적 상태이상 표시 갱신
  // ───────────────────────────────────────────────────────────────────────────
  private updateEnemyStatusDisplay() {
    if (!this.enemyStatusCont) return;
    const txt = this.enemyStatusCont.getByName('statusTxt') as Phaser.GameObjects.Text;
    if (!txt) return;

    const parts: string[] = [];
    if (this.enemyBurnDur > 0)        parts.push(`🔥화상 ${this.enemyBurnValue}/턴 (${this.enemyBurnDur})`);
    if (this.enemyVulnerableDur > 0)  parts.push(`💧취약 (${this.enemyVulnerableDur})`);
    if (this.enemyStunned)            parts.push('💫기절');
    if (this.enemyArmorBreak > 0)     parts.push(`🪨방깎 -${this.enemyArmorBreak}`);
    txt.setText(parts.join('  '));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 속성별 프로젝타일 애니메이션
  // ───────────────────────────────────────────────────────────────────────────
  private launchProjectile(elem: string, fromX: number, fromY: number, fast: boolean, onHit: () => void, stars = 0) {
    const toX = this.enemyContainer.x;
    const toY = this.enemyContainer.y - 10;
    const travelDur = fast ? 130 : 260;

    // 별 등급에 따른 스케일 (1성: 1.0, 2성: 1.18, 3성: 1.36, 4성: 1.54, 5성: 1.72)
    const scaleFactor = stars > 0 ? 1 + (stars - 1) * 0.18 : 1.0;

    // 속성별 프로젝타일 그래픽 생성
    const proj = this.add.graphics();
    proj.setDepth(10);
    proj.setScale(scaleFactor);

    switch (elem) {
      case 'fire': {
        proj.fillStyle(0xff4500, 1);
        proj.fillCircle(0, 0, 13);
        proj.fillStyle(0xff8800, 0.7);
        proj.fillCircle(-2, -2, 7);
        proj.fillStyle(0xffdd00, 0.5);
        proj.fillCircle(-3, -3, 3);
        break;
      }
      case 'water': {
        proj.fillStyle(0x2288ff, 0.85);
        proj.fillCircle(0, 0, 11);
        proj.fillStyle(0xaaddff, 0.6);
        proj.fillCircle(-3, -3, 5);
        proj.lineStyle(2, 0x55aaff, 0.9);
        proj.strokeCircle(0, 0, 13);
        break;
      }
      case 'lightning': {
        // 번개 볼트 형태
        proj.fillStyle(0xffee00, 1);
        proj.fillTriangle(-6, -16, 4, 0, -2, 0);
        proj.fillTriangle(-2, 0, 8, 0, 2, 16);
        proj.fillStyle(0xffffff, 0.6);
        proj.fillCircle(0, 0, 5);
        break;
      }
      case 'grass': {
        proj.fillStyle(0x22cc55, 0.9);
        proj.fillEllipse(0, 0, 14, 22);
        proj.fillStyle(0x55ff88, 0.5);
        proj.fillEllipse(-2, -3, 7, 11);
        proj.lineStyle(1.5, 0x008833, 0.8);
        proj.strokeEllipse(0, 0, 14, 22);
        break;
      }
      case 'earth': {
        proj.fillStyle(0x8B5E2A, 1);
        proj.fillCircle(0, 0, 13);
        proj.fillStyle(0xAA8044, 0.6);
        proj.fillCircle(-3, -4, 7);
        proj.fillStyle(0x664422, 0.5);
        proj.fillCircle(3, 3, 5);
        break;
      }
      default: { // normal
        proj.fillStyle(0xffffff, 0.85);
        proj.fillRect(-3, -16, 6, 32);
        proj.fillStyle(0xd4af37, 0.7);
        proj.fillRect(-1, -12, 2, 24);
        break;
      }
    }

    proj.setPosition(fromX, fromY);

    // 이동 트윈
    const startAngle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY) * (180 / Math.PI);
    if (['earth', 'grass'].includes(elem)) proj.setAngle(startAngle);

    // 번개: 지그재그 경로
    if (elem === 'lightning') {
      const steps = fast ? 3 : 5;
      const stepDur = travelDur / steps;
      let s = 0;
      const doStep = () => {
        if (s >= steps) { this.playHitBurst(toX, toY, elem); proj.destroy(); onHit(); return; }
        const t = (s + 1) / steps;
        const mx = fromX + (toX - fromX) * t + (s % 2 === 0 ? 20 : -20);
        const my = fromY + (toY - fromY) * t + (Math.random() - 0.5) * 30;
        this.tweens.add({
          targets: proj, x: mx, y: my, duration: stepDur,
          ease: 'Linear', onComplete: () => { s++; doStep(); }
        });
      };
      doStep();
    } else {
      // 일반 포물선 이동
      const midY = Math.min(fromY, toY) - 40;
      this.tweens.add({
        targets: proj, x: toX,
        duration: travelDur,
        ease: 'Power1.easeIn',
        onUpdate: (tween) => {
          const p = tween.progress;
          proj.y = fromY + (toY - fromY) * p - Math.sin(p * Math.PI) * 40;
          if (['earth', 'grass'].includes(elem)) proj.angle += fast ? 8 : 5;
        },
        onComplete: () => {
          this.playHitBurst(toX, toY, elem);
          proj.destroy();
          onHit();
        }
      });
    }

    // 불 카드: 파티클 흔적
    if (elem === 'fire') {
      const trailCount = fast ? 3 : 6;
      for (let i = 0; i < trailCount; i++) {
        this.time.delayedCall(i * (travelDur / trailCount * 0.6), () => {
          if (!proj.active) return;
          const trail = this.add.graphics();
          trail.fillStyle(0xff6600, 0.5 - i * 0.06);
          trail.fillCircle(0, 0, 8 - i);
          trail.setPosition(proj.x, proj.y).setDepth(9);
          this.tweens.add({
            targets: trail, alpha: 0, scale: 0.3, duration: 250,
            onComplete: () => trail.destroy(),
          });
        });
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 프로젝타일 착탄 이펙트
  // ───────────────────────────────────────────────────────────────────────────
  private playHitBurst(x: number, y: number, elem: string) {
    const color = ELEM_COLORS[elem] ?? 0xffffff;
    const burstCount = 8;

    // 방사형 폭발 선
    for (let i = 0; i < burstCount; i++) {
      const angle = (i / burstCount) * Math.PI * 2;
      const line = this.add.graphics();
      line.lineStyle(2.5, color, 1);
      const len = elem === 'lightning' ? 30 : 22;
      line.lineBetween(0, 0, Math.cos(angle) * len, Math.sin(angle) * len);
      line.setPosition(x, y).setDepth(11);
      this.tweens.add({
        targets: line, scaleX: 1.8, scaleY: 1.8, alpha: 0,
        duration: elem === 'lightning' ? 250 : 350,
        ease: 'Power2.easeOut',
        onComplete: () => line.destroy(),
      });
    }

    // 중앙 플래시
    const flash = this.add.graphics();
    flash.fillStyle(color, 0.85);
    flash.fillCircle(0, 0, elem === 'fire' ? 30 : 22);
    flash.setPosition(x, y).setDepth(11);
    this.tweens.add({
      targets: flash, alpha: 0, scale: 2.2,
      duration: elem === 'lightning' ? 200 : 400,
      ease: 'Power3.easeOut',
      onComplete: () => flash.destroy(),
    });

    // 번개: 화면 순간 밝아짐
    if (elem === 'lightning') {
      const whiteFlash = this.add.graphics();
      whiteFlash.fillStyle(0xffffff, 0.2);
      whiteFlash.fillRect(0, 0, this.W, this.H);
      whiteFlash.setDepth(50);
      this.tweens.add({
        targets: whiteFlash, alpha: 0, duration: 120,
        onComplete: () => whiteFlash.destroy(),
      });
      this.cameras.main.shake(120, 0.012);
    }

    // 불: 히트 스탑 (80ms 게임 정지 느낌)
    if (elem === 'fire') {
      this.cameras.main.shake(80, 0.008);
    }
  }
}
