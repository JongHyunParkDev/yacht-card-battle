import Phaser from 'phaser';
import { CARD_DATA_LIST, CardData, CardElement, ELEMENT_ATTR_INDEX } from '@src/data/cardData';
import { getRandomEnemy, EnemyDef } from '@src/data/enemyData';
import { getEquipmentById } from '@src/data/equipmentData';
import { i18n } from '@src/utils/localization';
import { WeaponType, CHAR_SPRITE_KEY, CHAR_FRAME_COUNT } from '@src/scenes/CharacterSelectScene';
import Card, { CARD_WIDTH, CARD_HEIGHT } from '@src/objects/Card';
import type { CardEffect } from '@src/data/cardData';
import { AudioManager } from '@src/utils/Audio';
import { TYPE_BEATS } from '@src/battle/BattleCalc';
import { playPlayerAttack as _playPlayerAttack, playEnemyHit as _playEnemyHit, playPlayerHit as _playPlayerHit, showFloatingDamage as _showFloatingDamage, showFloatingHeal as _showFloatingHeal, launchProjectile as _launchProjectile, playHitBurst as _playHitBurst } from '@src/battle/BattleFX';

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
  /** 클리어한 맵 수 (적 스케일링용). 0 = 첫 번째 맵 */
  mapStage?:        number;
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


const HAND_SIZE   = 5;
const MAX_TURNS   = 20;
const CARD_SCALE  = 0.55;

// BOSS_FINAL 3페이즈 데이터
// HP는 페이즈마다 100 고정 (보스 턴 종료 후 100으로 리셋)
const FINAL_BOSS_HP        = 100;   // 페이즈당 HP (매 보스 턴 종료 후 리셋)
const FINAL_BOSS_SHIELD    = 50;    // 보스 턴 종료 후 부여되는 쉴드
const FINAL_BOSS_MAX_TURNS = 5;     // 페이즈당 최대 플레이어 턴
const FINAL_BOSS_PHASES = [
  { atk: 22, def: 10, label: '1형태',    color: '#ffffff', desc: '일반 공격 패턴' },
  { atk: 30, def:  5, label: '분노 형태', color: '#ff8800', desc: '3번째 턴마다 분노 일격 (2× ATK)' },
  { atk: 38, def:  0, label: '절망 형태', color: '#ff2222', desc: '매 턴 ATK+4, 짝수 턴 이중 타격' },
];
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

  // ── BOSS_FINAL 페이즈 ─────────────────────────────────────────────────────
  private finalBossPhase       = 0;  // 현재 페이즈 인덱스 (0/1/2)
  private finalBossPatternTurn = 0;  // 페이즈 내 보스 턴 카운터 (최대 5)
  private finalBossEnrageBonus = 0;  // 3페이즈 분노 ATK 누적값
  private finalBossShield      = 0;  // 보스 쉴드 (보스 턴 종료 후 50 세팅)
  private finalBossShieldLabel!: Phaser.GameObjects.Text;

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

  // ── 적 속성별 패턴 상태 ───────────────────────────────────────────────────
  private playerBurnValue  = 0;   // fire: 플레이어 화상 데미지/턴
  private playerBurnDur    = 0;   // fire: 플레이어 화상 남은 턴
  private enemyEarthShield = 0;   // earth: 매 턴 방어막 (플레이어 공격 흡수)
  private enemyGrassHealCd = 0;   // grass: 자기회복 쿨다운 (0=발동 가능)

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
    // BOSS_FINAL 초기화
    this.finalBossPhase       = 0;
    this.finalBossPatternTurn = 0;
    this.finalBossEnrageBonus = 0;
    this.finalBossShield      = 0;
    // 상태이상 초기화
    this.enemyBurnValue = 0;
    this.enemyBurnDur = 0;
    this.enemyVulnerableDur = 0;
    this.enemyStunned = false;
    this.enemyArmorBreak = 0;
    this.playerBurnValue  = 0;
    this.playerBurnDur    = 0;
    this.enemyEarthShield = 0;
    this.enemyGrassHealCd = 0;
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

    // 맵 진행에 따른 적 스케일링 (mapStage 0=첫 맵, 1=두 번째 맵, ...)
    // 최종 보스(isFinalBoss)는 고정 수치이므로 스케일링 제외
    const mapStage     = this.data_.mapStage ?? 0;
    const stageHpMult  = 1 + mapStage * 0.25;   // HP:  맵당 +25%
    const stageAtkMult = 1 + mapStage * 0.20;   // ATK: 맵당 +20%

    // BOSS_FINAL은 페이즈 0 데이터로 오버라이드 (HP=100 고정, 스케일링 없음)
    if (this.data_.isFinalBoss) {
      this.enemyMaxHp     = FINAL_BOSS_HP;
      this.enemyAtk       = FINAL_BOSS_PHASES[0].atk;
      this.enemyDef       = FINAL_BOSS_PHASES[0].def;
    } else {
      const stageDefMult  = 1 + mapStage * 0.15;  // DEF: 맵당 +15%
      this.enemyMaxHp     = Math.round(this.enemyDefData.hp  * stageHpMult);
      this.enemyAtk       = Math.round(this.enemyDefData.atk * stageAtkMult);
      this.enemyDef       = Math.round(this.enemyDefData.def * stageDefMult);
    }
    this.enemyCurrentHp = this.enemyMaxHp;

    console.log(`[스테이지 스케일링] mapStage=${mapStage} hpMult=×${stageHpMult.toFixed(2)} atkMult=×${stageAtkMult.toFixed(2)} → 적HP=${this.enemyMaxHp} 적ATK=${this.enemyAtk} 적DEF=${this.enemyDef}`);
    
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

    // BOSS_FINAL 쉴드 라벨
    if (this.data_.isFinalBoss) {
      const barY = this.H * 0.59;
      this.finalBossShieldLabel = this.add.text(this.W * 0.82, barY - 20,
        '', { fontFamily: FONT_B, fontSize: '14px', color: '#88ccff', stroke: '#000', strokeThickness: 3 }
      ).setOrigin(0.5, 1).setVisible(false);
    }

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

      // 속성별 공격 보너스 — 장비 데이터는 % 정수(예: 10 = 10%), 소수로 변환해서 저장
      if (eq.stats.elementAtkBonus) {
        for (const [elem, val] of Object.entries(eq.stats.elementAtkBonus)) {
          this.equipElemAtkBonus[elem] = (this.equipElemAtkBonus[elem] ?? 0) + (Number(val) || 0) / 100;
        }
      }
      // 속성별 피해 감소
      // 속성별 피해 감소 — 장비 데이터는 % 정수(예: 15 = 15%), 소수로 변환해서 저장
      if (eq.stats.elementDefBonus) {
        for (const [elem, val] of Object.entries(eq.stats.elementDefBonus)) {
          this.equipElemDmgReduce[elem] = (this.equipElemDmgReduce[elem] ?? 0) + (Number(val) || 0) / 100;
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

    // ── 전투 시작 장비 패시브 요약 로그 ──────────────────────────────────────
    console.log(`====== [전투 시작 - 장비 패시브 현황] ======`);
    console.log(`> 장착 장비: [${equips.join(', ') || '없음'}]`);
    console.log(`> 플레이어 스탯: ATK=${this.data_.playerAtk} DEF=${this.data_.playerDef} CRIT=${this.data_.playerCrit}% critDmg=${this.data_.playerCritDmg} cardMult=${this.data_.playerCardMult} shieldMult=${this.data_.playerShieldMult}`);
    console.log(`> 장비 누적 패시브:`);
    console.log(`  - 속성 공격 보너스(elemAtkBonus): ${JSON.stringify(this.equipElemAtkBonus) || '{}'}`);
    console.log(`  - 속성 피해 감소(elemDmgReduce):  ${JSON.stringify(this.equipElemDmgReduce) || '{}'}`);
    console.log(`  - 턴 종료 방어막(shieldPerTurn):  ${this.equipShieldPerTurn}`);
    console.log(`  - 승리 시 회복(healOnWin):         ${this.equipHealOnWin} + ${this.equipHealOnWinPct}%`);
    console.log(`  - 속성 배율 증폭(elemAmplify):     ${this.equipElemAmplify}`);
    console.log(`  - 흡혈(lifestealPct):              ${(this.equipLifestealPct * 100).toFixed(1)}%`);
    console.log(`  - 크리 시 추가 카드배율(cardMultOnCrit): ${this.equipCardMultOnCrit}`);
    console.log(`==========================================`);
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

    // fill — 초기 HP 비율 반영 (origin 왼쪽 고정 → 오른쪽으로만 줄어듦)
    const initRatio = isPlayer
      ? Math.max(0, this.playerCurrentHp / this.data_.playerMaxHp)
      : 1;
    const fill = this.add.rectangle(x, cy, barW * initRatio, barH,
      isPlayer ? (initRatio > 0.3 ? 0x2ecc71 : 0xe74c3c) : 0xe74c3c);
    fill.setOrigin(0, 0.5);

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

      // Card 객체 생성 — 실제 전투 계산과 동일한 배율을 표시값에 반영
      // 공격/기타: value × cardMult × playerCardMult
      // 방어/쉴드: value × cardMult × playerCardMult × playerShieldMult
      const overrideStars = cardData.element === 'normal' ? (cardData as any).stars : undefined;
      const isDefCard = cardData.key === 'defense' || cardData.key === 'shield';
      const displayMult = parseFloat(((cardData.mult || 1.0)
        * (this.data_.playerCardMult || 1.0)
        * (isDefCard ? (this.data_.playerShieldMult || 1.0) : 1.0)).toFixed(4));
      const displayCardData = { ...cardData, mult: displayMult };
      const cardObj = new Card(this, -cardW / 2, -cardH / 2, displayCardData, overrideStars);
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
      this.time.delayedCall(800, () => this.checkEnemyDeath());
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
        console.log(`--- [카드 사용: ${card.nameKey} (방어)] ---`);
        console.log(`> baseVal=${baseVal.toFixed(2)} shieldMult=${this.data_.playerShieldMult}${this.data_.characterWeapon === 'swordShield' ? ' Guardian×2' : ''}`);
        console.log(`> 방어막 생성량: ${Math.floor(shield)} (현재 누적 쉴드: ${this.currentTurnDefense} → ${this.currentTurnDefense + shield})`);
        console.log(`------------------------------------------------------`);
      } else if (card.key === 'hp') {
        heal = baseVal;
        console.log(`--- [카드 사용: ${card.nameKey} (HP 회복)] ---`);
        console.log(`> baseVal=${baseVal.toFixed(2)} → 회복량: ${Math.floor(heal)}`);
        console.log(`> 플레이어 HP: ${this.playerCurrentHp} → ${Math.min(this.data_.playerMaxHp, this.playerCurrentHp + Math.floor(heal))} / ${this.data_.playerMaxHp}`);
        console.log(`------------------------------------------------------`);
      } else if (card.key === 'arrow') {
        // Ranger 패시브: 화살 카드 = (ATK + 카드밸류) × mult × cardMult
        if (this.data_.characterWeapon === 'bow') {
          dmg = (this.data_.playerAtk + card.value + (card.bonusValue || 0)) * (card.mult || 1.0) * (this.data_.playerCardMult || 1.0);
          console.log(`--- [카드 사용: ${card.nameKey} (화살 — Ranger 패시브)] ---`);
          console.log(`> (ATK ${this.data_.playerAtk} + value ${card.value} + bonus ${card.bonusValue ?? 0}) × mult ${card.mult ?? 1} × cardMult ${this.data_.playerCardMult} = ${dmg.toFixed(2)}`);
          console.log(`------------------------------------------------------`);
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
        console.log(`  [effect: shield_add] value=${shieldEff.value} mult=${card.mult ?? 1} shieldMult=${this.data_.playerShieldMult}${this.data_.characterWeapon === 'swordShield' ? ' Guardian×2' : ''} → 방어막 +${Math.floor(shieldVal)}`);
        this.currentTurnDefense += shieldVal;
        this.updateShieldBadge();
        AudioManager.play('SHIELD');
      }
      if (healEff) {
        const healAmt = Math.floor(healEff.value * (card.mult || 1));
        console.log(`  [effect: heal] value=${healEff.value} mult=${card.mult ?? 1} → HP +${healAmt}`);
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
          const effectiveDef2 = Math.max(0, this.enemyDef - this.enemyArmorBreak);
          const elemAtkBonus  = this.equipElemAtkBonus[card.element] ?? 0;
          const elemStr = (() => {
            if (card.element === 'normal') return '속성없음';
            const parts: string[] = [];
            if (TYPE_BEATS[card.element] === this.data_.mapElement) parts.push(`유리×1.5`);
            else if (TYPE_BEATS[this.data_.mapElement] === card.element) parts.push(`불리×0.5`);
            else parts.push(`중립`);
            if (this.equipElemAmplify > 0) parts.push(`elemAmplify+${this.equipElemAmplify}(유리 시)`);
            if (elemAtkBonus > 0) parts.push(`elemAtkBonus×${(1 + elemAtkBonus).toFixed(2)}`);
            return parts.join(' ');
          })();
          const critLine = isCrit
            ? `치명타! critChance=${critChance}%(기본${this.data_.playerCrit}%) ×${critDmgMult}(기본${this.data_.playerCritDmg}${this.equipCardMultOnCrit > 0 ? `+equip크리배율${this.equipCardMultOnCrit}` : ''})`
            : `일반 (critChance=${critChance}%)`;
          console.log(`--- [카드 공격: ${card.nameKey} (${card.element} ★${card.stars})] ${hitsDone + 1}/${hitCount}타 ---`);
          console.log(`> 기초값: card.value=${card.value} bonusValue=${card.bonusValue ?? 0} mult=${card.mult ?? 1} cardMult=${this.data_.playerCardMult} → baseVal=${dmg.toFixed(2)}`);
          console.log(`> 속성 상성: ${elemStr} → hitDmg=${hitDmg.toFixed(2)}`);
          if (this.enemyVulnerableDur > 0) console.log(`> 취약(×1.5) 적용 → hitDmg=${hitDmg.toFixed(2)} (${this.enemyVulnerableDur}턴 남음)`);
          console.log(`> 크리티컬: ${critLine} → cardDmg=${cardDmg.toFixed(2)}`);
          if (bonusDmg > 0) console.log(`> 콤보 추뎀: +${bonusDmg.toFixed(2)} (같은카드${sameCards.length}장 / 같은속성${sameElems.length}장)`);
          if (chainBonus > 0) console.log(`> 연쇄(chain) 추뎀: +${chainBonus.toFixed(2)}${this.data_.characterWeapon === 'bow' ? ' (Ranger×1.5)' : ''}`);
          console.log(`> 방어력 적용: ${isPierce ? `관통(방어 무시)${this.data_.characterWeapon === 'hammer' ? ' — Titan패시브' : ''}` : `적DEF=${this.enemyDef} 방깎=${this.enemyArmorBreak} 유효DEF=${effectiveDef2} → ×${(50 / (50 + effectiveDef2)).toFixed(3)}`}`);
          if (this.equipLifestealPct > 0) console.log(`> 흡혈 예정: finalDmg × ${(this.equipLifestealPct * 100).toFixed(1)}% = ${Math.floor(finalDmg * this.equipLifestealPct)} HP`);
          if (isInstakill) console.log(`> Lancer 즉사 조건 충족! (rawCritDmg=${hitDmg * critDmgMult} >= 적HP ${this.enemyCurrentHp})`);
          console.log(`> 최종 피해량: ${finalDmg} (적 현재HP: ${this.enemyCurrentHp})`);
          console.log(`------------------------------------------------------`);
          this.playPlayerAttack(card.element, () => {
            const actualDmg = this.damageEnemy(finalDmg);
            this.updateEnemyHpBar();
            if (actualDmg > 0) this.playEnemyHit(card.element, isCrit);
            this.showFloatingDamage(this.enemyContainer.x, this.enemyContainer.y - 40, actualDmg || finalDmg, isCrit, '#2ecc71');
            
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
        const actualDmg = this.damageEnemy(finalDmg);
        this.updateEnemyHpBar();
        if (actualDmg > 0) this.playEnemyHit('normal', isCrit);

        this.showFloatingDamage(this.enemyContainer.x, this.enemyContainer.y - 40, actualDmg || finalDmg, isCrit, '#2ecc71');
        
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
    _playPlayerAttack({ scene: this, playerSprite: this.playerSprite, enemyContainer: this.enemyContainer, elem, W: this.W, onComplete, isFastForward, stars });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 적 피격 이펙트
  // ───────────────────────────────────────────────────────────────────────────
  private playEnemyHit(elem: string, isCrit: boolean = false) {
    _playEnemyHit({ scene: this, enemyContainer: this.enemyContainer, enemyBody: this.enemyBody, enemyIdleTween: this.enemyIdleTween, elem, isCrit, mapElement: this.data_.mapElement });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 적 턴
  // ───────────────────────────────────────────────────────────────────────────
  private doEnemyTurn() {
    // ── 화상(Burn) 처리 — BOSS_FINAL은 보스 턴 후 HP 리셋되므로 스킵 ─────────
    if (this.enemyBurnDur > 0 && !this.data_.isFinalBoss) {
      const burnDmg = this.enemyBurnValue;
      this.enemyCurrentHp = Math.max(0, this.enemyCurrentHp - burnDmg);
      this.updateEnemyHpBar();
      this.showFloatingDamage(this.enemyContainer.x, this.enemyContainer.y - 60, burnDmg, false, '#ff6600');
      this.statusText.setText(`🔥 화상 ${burnDmg} 피해! (${this.enemyBurnDur}턴 남음)`).setColor('#ff6600');
      AudioManager.play('BURN_TICK');
      this.enemyBurnDur--;
      this.updateEnemyStatusDisplay();
      if (this.enemyCurrentHp <= 0) {
        this.time.delayedCall(600, () => this.checkEnemyDeath());
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

    // ── 속성별 고유 행동 패턴 (일반/보스 적, FINAL_BOSS 제외) ─────────────────
    if (!this.data_.isFinalBoss) {
      const elem = this.data_.mapElement;

      // Water: 짝수 턴마다 방어력 +5 누적
      if (elem === 'water' && this.currentTurn % 2 === 0) {
        this.enemyDef += 5;
        this.statusText.setText(`💧 ${this.data_.mobName} 방어력 강화! DEF +5 (현재 ${this.enemyDef})`).setColor('#4db8ff');
        this.cameras.main.shake(60, 0.003);
      }

      // Fire: 매 3턴마다 플레이어에게 화상 부여 (5 데미지 × 2턴)
      if (elem === 'fire' && this.currentTurn % 3 === 0) {
        this.playerBurnValue = 5;
        this.playerBurnDur   = 2;
        this.statusText.setText(`🔥 ${this.data_.mobName} 화염 공격! 화상 5×2턴 부여`).setColor('#ff6b35');
        AudioManager.play('BURN_TICK');
      }

      // Grass: HP 50% 이하 시 자기회복 (최대HP의 15%), 4턴 쿨다운
      if (elem === 'grass') {
        if (this.enemyGrassHealCd > 0) this.enemyGrassHealCd--;
        if (this.enemyCurrentHp <= this.enemyMaxHp * 0.5 && this.enemyGrassHealCd === 0) {
          const healAmt = Math.round(this.enemyMaxHp * 0.15);
          this.enemyCurrentHp = Math.min(this.enemyMaxHp, this.enemyCurrentHp + healAmt);
          this.updateEnemyHpBar();
          this.enemyGrassHealCd = 4;
          this.showFloatingHeal(this.enemyContainer.x, this.enemyContainer.y - 60, healAmt);
          this.statusText.setText(`🌿 ${this.data_.mobName} 자기회복! HP +${healAmt}`).setColor('#5ddb7a');
        }
      }

      // Earth: 매 턴 방어막 10 생성 (플레이어 공격 흡수)
      if (elem === 'earth') {
        this.enemyEarthShield += 10;
        this.statusText.setText(`🪨 ${this.data_.mobName} 방어막 생성! 쉴드 +10 (현재 ${this.enemyEarthShield})`).setColor('#c8a04a');
      }

      // Lightning: 기절 면역은 applyCardEffects에서 처리됨
    }

    // ── BOSS_FINAL 페이즈 패턴 ───────────────────────────────────────────────
    if (this.data_.isFinalBoss) {
      this.finalBossPatternTurn++;

      // 페이즈 2: 매 3번째 턴 분노 일격 (2× ATK)
      if (this.finalBossPhase === 1 && this.finalBossPatternTurn % 3 === 0) {
        return this.doFinalBossRageStrike();
      }

      // 페이즈 3: 매 턴 ATK 증가 + 매 2번째 턴 이중 타격
      if (this.finalBossPhase === 2) {
        this.finalBossEnrageBonus += 4;
        this.enemyAtk = FINAL_BOSS_PHASES[2].atk + this.finalBossEnrageBonus;
        if (this.finalBossPatternTurn % 2 === 0) {
          return this.doFinalBossDoubleStrike();
        }
      }
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
    console.log(`> 적 기초 공격력: ${enemyAtkOriginal}`);
    if (elemReduce > 0) console.log(`> 장비 속성 피해 감소(elemDmgReduce[${this.data_.mapElement}]=${elemReduce}): ×${(1 - elemReduce).toFixed(2)} 적용`);
    console.log(`> 내 방어력(DEF=${this.data_.playerDef}) 감쇄 ×${(50 / (50 + this.data_.playerDef)).toFixed(3)} → ${dmgAfterDef}`);
    if (this.currentTurnDefense > 0) {
      console.log(`> 쉴드 차감: -${this.currentTurnDefense} → 남은 피해: ${enemyDmg}`);
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

            if (this.data_.isFinalBoss) {
              this.afterFinalBossTurn();
            } else {
              this.advanceToNextTurn();
            }
          },
        });
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 플레이어 피격
  // ───────────────────────────────────────────────────────────────────────────
  private playPlayerHit() {
    _playPlayerHit({ scene: this, playerSprite: this.playerSprite });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 데미지 플로팅 텍스트 이펙트
  // ───────────────────────────────────────────────────────────────────────────
  private showFloatingDamage(x: number, y: number, amount: number, isCrit: boolean, color: string) {
    _showFloatingDamage({ scene: this, x, y, amount, isCrit, color });
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
  // BOSS_FINAL 전용 메서드
  // ───────────────────────────────────────────────────────────────────────────

  /** 보스/속성 쉴드 흡수 후 적 HP 감소. 실제 피해량 반환 */
  private damageEnemy(rawDmg: number): number {
    // Earth 방어막 흡수 (일반/보스 earth 속성)
    if (!this.data_.isFinalBoss && this.enemyEarthShield > 0) {
      const absorbed = Math.min(this.enemyEarthShield, rawDmg);
      this.enemyEarthShield -= absorbed;
      rawDmg -= absorbed;
      if (absorbed > 0 && rawDmg === 0) {
        const bx = this.enemyContainer.x;
        const by = this.enemyContainer.y - 40;
        const t = this.add.text(bx, by, `🪨 BLOCK`, {
          fontFamily: FONT_B, fontSize: '18px', color: '#c8a04a', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);
        this.tweens.add({ targets: t, y: by - 40, alpha: 0, duration: 800, onComplete: () => t.destroy() });
      }
    }

    if (this.data_.isFinalBoss && this.finalBossShield > 0) {
      const absorbed = Math.min(this.finalBossShield, rawDmg);
      this.finalBossShield -= absorbed;
      rawDmg -= absorbed;
      this.updateFinalBossShieldDisplay();
      if (absorbed > 0 && rawDmg === 0) {
        // 쉴드가 전부 막았을 때 BLOCK 표시
        const bx = this.enemyContainer.x;
        const by = this.enemyContainer.y - 40;
        const t = this.add.text(bx, by, `🛡 BLOCK`, {
          fontFamily: FONT_B, fontSize: '20px', color: '#88ccff', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);
        this.tweens.add({ targets: t, y: by - 40, alpha: 0, duration: 800, onComplete: () => t.destroy() });
      }
    }
    if (rawDmg > 0) {
      this.enemyCurrentHp = Math.max(0, this.enemyCurrentHp - rawDmg);
    }
    return rawDmg;
  }

  /** BOSS_FINAL: 쉴드 라벨 갱신 */
  private updateFinalBossShieldDisplay() {
    if (!this.finalBossShieldLabel) return;
    if (this.finalBossShield > 0) {
      this.finalBossShieldLabel.setText(`🛡 ${this.finalBossShield}`).setVisible(true);
    } else {
      this.finalBossShieldLabel.setVisible(false);
    }
  }

  /** BOSS_FINAL: 보스 턴 종료 후 — HP 리셋, 쉴드 50 부여, 5턴 제한 체크 */
  private afterFinalBossTurn() {
    if (this.playerCurrentHp <= 0) {
      this.time.delayedCall(600, () => this.endBattle(false));
      return;
    }

    // HP 100 리셋 + 쉴드 50 (상태이상 적용 X)
    this.enemyCurrentHp   = FINAL_BOSS_HP;
    this.finalBossShield  = FINAL_BOSS_SHIELD;
    this.enemyBurnValue   = 0;
    this.enemyBurnDur     = 0;
    this.enemyVulnerableDur = 0;
    this.enemyArmorBreak  = 0;
    this.updateEnemyHpBar();
    this.updateEnemyStatusDisplay();
    this.updateFinalBossShieldDisplay();

    // 5턴 제한 초과 → 플레이어 패배
    if (this.finalBossPatternTurn >= FINAL_BOSS_MAX_TURNS) {
      this.cameras.main.flash(400, 255, 0, 0);
      this.statusText.setText(`⏰ ${FINAL_BOSS_MAX_TURNS}턴 초과! 고대 신의 분노에 쓰러지다...`).setColor('#ff4444');
      this.time.delayedCall(2000, () => this.endBattle(false));
      return;
    }

    this.advanceToNextTurn();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BOSS_FINAL 페이즈 전환 / 적 사망 체크
  // ───────────────────────────────────────────────────────────────────────────

  /** 적 HP 0 처리 — 최종 보스 페이즈 남으면 전환, 아니면 종료 */
  private checkEnemyDeath() {
    if (this.data_.isFinalBoss && this.finalBossPhase < FINAL_BOSS_PHASES.length - 1) {
      this.nextFinalBossPhase();
    } else {
      this.endBattle(true);
    }
  }

  /** BOSS_FINAL 다음 페이즈로 전환 */
  private nextFinalBossPhase() {
    this.finalBossPhase++;
    this.finalBossPatternTurn = 0;
    this.finalBossEnrageBonus = 0;

    const phase = FINAL_BOSS_PHASES[this.finalBossPhase];

    // 상태이상 초기화
    this.enemyBurnDur      = 0;
    this.enemyBurnValue    = 0;
    this.enemyVulnerableDur = 0;
    this.enemyStunned      = false;
    this.enemyArmorBreak   = 0;
    this.updateEnemyStatusDisplay();

    // 새 페이즈 스탯 적용 (HP=100 고정, 쉴드 리셋)
    this.enemyMaxHp       = FINAL_BOSS_HP;
    this.enemyCurrentHp   = FINAL_BOSS_HP;
    this.enemyAtk         = phase.atk;
    this.enemyDef         = phase.def;
    this.finalBossShield  = 0;
    this.updateEnemyHpBar();
    this.updateFinalBossShieldDisplay();

    // 화면 연출 — 페이즈 전환 연출 (더 극적으로)
    this.sound.stopAll();
    this.cameras.main.shake(600, 0.04);

    const cx = this.W / 2;
    const cy = this.H / 2;

    // 완전 암전 후 페이즈 정보 표시
    const overlay = this.add.graphics().setDepth(200);
    overlay.fillStyle(0x000000, 1);
    overlay.fillRect(0, 0, this.W, this.H);
    overlay.setAlpha(0);

    const phaseNumTxt = this.add.text(cx, cy - 80,
      `— PHASE ${this.finalBossPhase} —`, {
        fontFamily: FONT_B, fontSize: '22px', color: '#888888',
        align: 'center',
      }).setOrigin(0.5).setDepth(201).setAlpha(0);

    const phaseTxt = this.add.text(cx, cy - 20,
      `${phase.label}`, {
        fontFamily: FONT_B, fontSize: '48px', color: phase.color,
        align: 'center', stroke: '#000000', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(201).setAlpha(0);

    const descTxt = this.add.text(cx, cy + 50, phase.desc, {
      fontFamily: FONT_M, fontSize: '18px', color: '#dddddd',
      align: 'center',
    }).setOrigin(0.5).setDepth(201).setAlpha(0);

    const hintTxt = this.add.text(cx, cy + 100,
      `HP 100  |  ATK ${phase.atk}  |  DEF ${phase.def}`, {
        fontFamily: FONT_L, fontSize: '15px', color: '#aaaaaa',
        align: 'center',
      }).setOrigin(0.5).setDepth(201).setAlpha(0);

    // 1단계: 암전
    this.tweens.add({
      targets: overlay, alpha: 1, duration: 400,
      onComplete: () => {
        this.cameras.main.flash(300, 255, 80, 0);
        // 2단계: 텍스트 등장
        this.tweens.add({
          targets: [phaseNumTxt, phaseTxt, descTxt, hintTxt], alpha: 1, duration: 400,
          onComplete: () => {
            // 3단계: 2.5초 유지 후 페이드 아웃
            this.time.delayedCall(2500, () => {
              this.tweens.add({
                targets: [overlay, phaseNumTxt, phaseTxt, descTxt, hintTxt], alpha: 0, duration: 500,
                onComplete: () => {
                  overlay.destroy(); phaseNumTxt.destroy(); phaseTxt.destroy();
                  descTxt.destroy(); hintTxt.destroy();
                  this.statusText.setText('');
                  this.advanceToNextTurn();
                },
              });
            });
          },
        });
      },
    });
  }

  /** BOSS_FINAL 페이즈 2 — 분노 일격 (2× ATK) */
  private doFinalBossRageStrike() {
    const elemReduce = this.equipElemDmgReduce[this.data_.mapElement ?? ''] ?? 0;
    let rawDmg = this.enemyAtk * 2;
    if (elemReduce > 0) rawDmg *= Math.max(0, 1 - elemReduce);
    rawDmg = Math.max(1, Math.floor(rawDmg * (50 / (50 + this.data_.playerDef))));

    const shieldAbs = Math.min(this.currentTurnDefense, rawDmg);
    const finalDmg  = Math.max(0, rawDmg - shieldAbs);
    this.currentTurnDefense = 0;
    this.shieldBadge?.setVisible(false);

    this.statusText.setText(`💢 분노 일격!`).setColor('#ff6600');
    this.cameras.main.flash(200, 255, 100, 0);

    this.tweens.add({
      targets: this.enemyContainer, x: this.enemyContainer.x - this.W * 0.28,
      duration: 180, ease: 'Expo.easeOut',
      onComplete: () => {
        this.playerCurrentHp = Math.max(0, this.playerCurrentHp - finalDmg);
        this.updatePlayerHpBar();
        this.playPlayerHit();
        this.showFloatingDamage(this.playerSprite.x, this.playerSprite.y - 40, finalDmg, false, '#ff6600');

        this.tweens.add({
          targets: this.enemyContainer, x: this.W * 0.82, duration: 250, ease: 'Power2.easeOut',
          onComplete: () => {
            if (this.playerCurrentHp <= 0) { this.time.delayedCall(600, () => this.endBattle(false)); return; }
            this.afterFinalBossTurn();
          },
        });
      },
    });
  }

  /** BOSS_FINAL 페이즈 3 — 이중 타격 (0.8× ATK × 2회) */
  private doFinalBossDoubleStrike() {
    const elemReduce = this.equipElemDmgReduce[this.data_.mapElement ?? ''] ?? 0;
    const calcHit = (mult: number) => {
      let d = this.enemyAtk * mult;
      if (elemReduce > 0) d *= Math.max(0, 1 - elemReduce);
      return Math.max(1, Math.floor(d * (50 / (50 + this.data_.playerDef))));
    };

    const hit1Raw = calcHit(0.8);
    const shieldAbs = Math.min(this.currentTurnDefense, hit1Raw);
    const hit1 = Math.max(0, hit1Raw - shieldAbs);
    const hit2 = calcHit(0.8); // 2nd hit ignores shield (already consumed)
    this.currentTurnDefense = 0;
    this.shieldBadge?.setVisible(false);

    this.statusText.setText(`⚡⚡ 이중 타격!`).setColor('#ff2222');

    const doHit = (dmg: number, onDone: () => void) => {
      this.tweens.add({
        targets: this.enemyContainer, x: this.enemyContainer.x - this.W * 0.22,
        duration: 160, ease: 'Expo.easeOut',
        onComplete: () => {
          this.playerCurrentHp = Math.max(0, this.playerCurrentHp - dmg);
          this.updatePlayerHpBar();
          this.playPlayerHit();
          this.showFloatingDamage(this.playerSprite.x, this.playerSprite.y - 40, dmg, false, '#ff4444');
          this.tweens.add({
            targets: this.enemyContainer, x: this.W * 0.82, duration: 200, ease: 'Power2.easeOut',
            onComplete: onDone,
          });
        },
      });
    };

    doHit(hit1, () => {
      if (this.playerCurrentHp <= 0) { this.time.delayedCall(600, () => this.endBattle(false)); return; }
      this.time.delayedCall(250, () => {
        doHit(hit2, () => {
          if (this.playerCurrentHp <= 0) { this.time.delayedCall(600, () => this.endBattle(false)); return; }
          this.afterFinalBossTurn();
        });
      });
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 전투 종료
  // ───────────────────────────────────────────────────────────────────────────
  private endBattle(playerWon: boolean) {
    this.battleEnded = true;
    this.isAnimating = true;
    this.enemyIdleTween?.stop();

    // 패배 시 HP를 0으로 강제 설정 (5턴 초과 등 HP가 남은 채로 패배해도 사망 처리)
    if (!playerWon) this.playerCurrentHp = 0;

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

    // ── 플레이어 화상 처리 (fire 적 속성 패턴) ──────────────────────────────
    if (this.playerBurnDur > 0) {
      const burnDmg = this.playerBurnValue;
      this.playerCurrentHp = Math.max(0, this.playerCurrentHp - burnDmg);
      this.updatePlayerHpBar();
      this.showFloatingDamage(this.playerSprite.x, this.playerSprite.y - 40, burnDmg, false, '#ff6600');
      this.statusText.setText(`🔥 화상! 내 HP -${burnDmg} (${this.playerBurnDur}턴 남음)`).setColor('#ff6600');
      AudioManager.play('BURN_TICK');
      this.playerBurnDur--;
      if (this.playerCurrentHp <= 0) {
        this.time.delayedCall(600, () => this.endBattle(false));
        return;
      }
    }

    this.currentTurn++;
    if (this.data_.isFinalBoss) {
      // FINAL BOSS: MAX_TURNS 체크 없이 페이즈 턴 표시
      const remainingTurns = FINAL_BOSS_MAX_TURNS - this.finalBossPatternTurn;
      const color = remainingTurns <= 2 ? '#ff4444' : '#d4af37';
      this.turnLabel.setText(`PHASE ${this.finalBossPhase + 1}  ⏳${remainingTurns}턴 남음`).setColor(color);
    } else {
      if (this.currentTurn > MAX_TURNS) {
        this.endBattle(this.playerCurrentHp >= this.enemyCurrentHp);
        return;
      }
      this.turnLabel.setText(`TURN ${this.currentTurn} / ${MAX_TURNS}`).setColor('#d4af37');
    }
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
          // lightning 속성 적은 기절 면역
          if (this.data_.mapElement === 'lightning') {
            this.statusText.setText(`⚡ ${this.data_.mobName}은 기절에 면역!`).setColor('#ffe033');
          } else {
            this.enemyStunned = true;
            AudioManager.play('STUN');
          }
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
    _showFloatingHeal({ scene: this, x, y, amount });
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
    } else if (this.data_.isFinalBoss) {
      // BOSS_FINAL 페이즈별 예고
      const nextPatternTurn = this.finalBossPatternTurn + 1;
      if (this.finalBossPhase === 1 && nextPatternTurn % 3 === 0) {
        const rageDmg = Math.max(1, Math.floor(this.enemyAtk * 2 * (50 / (50 + this.data_.playerDef))));
        txt.setText(`💢 분노 일격 예고: -${rageDmg}`).setColor('#ff6600');
      } else if (this.finalBossPhase === 2 && nextPatternTurn % 2 === 0) {
        const singleDmg = Math.max(1, Math.floor(this.enemyAtk * 0.8 * (50 / (50 + this.data_.playerDef))));
        txt.setText(`⚡⚡ 이중 타격 예고: -${singleDmg}×2`).setColor('#ff2222');
      } else {
        const rawDmg = Math.max(1, Math.floor(this.enemyAtk * (50 / (50 + this.data_.playerDef))));
        const suffix = this.finalBossPhase === 2 ? ' (↑분노)' : '';
        txt.setText(`⚔ 예고 공격: -${rawDmg}${suffix}`).setColor('#ff7777');
      }
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
    _launchProjectile({ scene: this, elem, fromX, fromY, toX: this.enemyContainer.x, toY: this.enemyContainer.y - 10, fast, stars, onHit });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 프로젝타일 착탄 이펙트
  // ───────────────────────────────────────────────────────────────────────────
  private playHitBurst(x: number, y: number, elem: string) {
    _playHitBurst({ scene: this, x, y, elem, W: this.W, H: this.H });
  }
}
