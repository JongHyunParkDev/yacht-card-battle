import Phaser from 'phaser';
import { i18n } from '@src/utils/localization';
import { getEquipmentById, formatEquipStats, EQUIP_GRADE_COLOR, EQUIP_GRADE_LABEL } from '@src/data/equipmentData';
import { AudioManager } from '@src/utils/Audio';
import '@src/styles/colors.css';

// ─── 타입 / 상수 ──────────────────────────────────────────────────────────────

const WEAPON_TYPES = ['swordShield', 'bow', 'greatsword', 'hammer', 'spear'] as const;
export type WeaponType = typeof WEAPON_TYPES[number];

/** 무기 타입별 색상 */
export const WEAPON_COLORS: Record<WeaponType, { card: number; accent: string }> = {
  swordShield: { card: 0x4a90d9, accent: '#4a90d9' }, // 파란 강철
  bow:         { card: 0x6ab04c, accent: '#6ab04c' }, // 숲 녹색
  greatsword:  { card: 0xc0392b, accent: '#c0392b' }, // 진홍
  hammer:      { card: 0xa07040, accent: '#c8906a' }, // 구리/갈색
  spear:       { card: 0x8e44ad, accent: '#b57bee' }, // 보라
};

/** 무기 타입 → 캐릭터 idle 스프라이트 키 */
export const CHAR_SPRITE_KEY: Record<WeaponType, string> = {
  swordShield: 'char_shield',
  bow:         'char_bow',
  greatsword:  'char_sword',
  hammer:      'char_hammer',
  spear:       'char_spear',
};

/** 무기 타입 → idle 프레임 수 */
export const CHAR_FRAME_COUNT: Record<WeaponType, number> = {
  swordShield: 6,
  bow:         5,
  greatsword:  7,
  hammer:      7,
  spear:       5,
};

export interface CharacterDef {
  id:          string;
  weapon:      WeaponType;
  nameKey:     string;     // i18n 키
  hp:          number;
  atk:         number;
  def:         number;     // 방어력 (0~50)
  crit:        number;     // 크리티컬 % (0~100)
  critDmg:     number;     // 크리티컬 배율 (기본 1.5)
  descKey:     string;     // 고유 특성 설명 i18n 키
}

/** 무기 타입별 초기 덱 구성 요약 (캐릭터 선택 화면 미리보기용) */
export const INITIAL_DECK_SUMMARY: Record<WeaponType, string> = {
  swordShield: '공격×3  수비×3  포션×2\n흙★×4  물★×3  풀★×2  불★×1  번개★×1',
  bow:         '화살×5  공격×2  수비×2  포션×2\n번개★×3  풀★×3  물★×1  불★×1  흙★×1',
  greatsword:  '공격×4  수비×1  포션×1\n불★×4  번개★×3  물★×2  흙★×2  풀★×1',
  hammer:      '공격×3  수비×3  포션×2\n흙★×4  불★×3  물★×2  풀★×1  번개★×1',
  spear:       '투창×5  공격×2  수비×2  포션×2\n물★×2  불★×2  풀★×2  번개★×2  흙★×1',
};

/** 무기 타입별 캐릭터 정의 */
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'guardian',
    weapon: 'swordShield',
    nameKey: 'weaponSwordShield',
    hp: 110, atk: 10, def: 12, crit: 10, critDmg: 1.5,
    descKey: 'descGuardian',
  },
  {
    id: 'ranger',
    weapon: 'bow',
    nameKey: 'weaponBow',
    hp: 55, atk: 14, def: 0, crit: 25, critDmg: 1.5,
    descKey: 'descRanger',
  },
  {
    id: 'berserker',
    weapon: 'greatsword',
    nameKey: 'weaponGreatsword',
    hp: 75, atk: 12, def: 10, crit: 15, critDmg: 1.5,
    descKey: 'descBerserker',
  },
  {
    id: 'titan',
    weapon: 'hammer',
    nameKey: 'weaponHammer',
    hp: 115, atk: 13, def: 0, crit: 10, critDmg: 1.5,
    descKey: 'descTitan',
  },
  {
    id: 'lancer',
    weapon: 'spear',
    nameKey: 'weaponSpear',
    hp: 80, atk: 10, def: 0, crit: 15, critDmg: 1.8,
    descKey: 'descLancer',
  },
];

// 스탯 최대 기준값 (바 정규화용)
const STAT_MAX = { hp: 200, def: 50, atk: 100, crit: 100, critDmg: 2.5 };

// ─── 씬 ───────────────────────────────────────────────────────────────────────

export default class CharacterSelectScene extends Phaser.Scene {
  private selectedIndex   = 0;
  private allEquipment:   string[] = [];
  private selectedEquip:  string | null = null;

  /** 각 카드(배경 Graphics + Container) */
  private cardGraphics:   Phaser.GameObjects.Graphics[]  = [];
  private cardContainers: Phaser.GameObjects.Container[] = [];

  /** 상세 패널 */
  private detailPanel!: Phaser.GameObjects.Container;

  /** 게임 시작 버튼 */
  private startBtn!: Phaser.GameObjects.Text;

  private equipTooltip!: Phaser.GameObjects.Container;
  private equipTooltipBg!: Phaser.GameObjects.Graphics;
  private equipTooltipText!: Phaser.GameObjects.Text;

  private charTooltip!: Phaser.GameObjects.Container;
  private charTooltipBg!: Phaser.GameObjects.Graphics;
  private charTooltipText!: Phaser.GameObjects.Text;

  constructor() {
    super('CharacterSelectScene');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Phaser 라이프사이클
  // ─────────────────────────────────────────────────────────────────────────────

  async create() {
    const { width, height } = this.scale;

    // ── 사운드 재생 (await 이전에 즉시 재생) ──────────────────────────────────
    if (!this.sound.get('bgm_intro')?.isPlaying) {
      this.sound.stopAll();
      this.sound.play('bgm_intro', { loop: true, volume: AudioManager.bgmVol });
    }

    // legacy 장비 컬렉션 로드
    // @ts-ignore
    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        const res = await ipcRenderer.invoke('load-legacy');
        if (res.success && res.data) {
          this.allEquipment = res.data.allEquipment ?? [];
        }
      } catch {}
    }

    this.buildBackground(width, height);

    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.buildTitle(width, height);
    this.createCharAnimations();

    const layout = this.calcLayout(width, height);
    this.buildCharacterCards(layout);
    this.buildDetailPanel(layout);
    this.buildEquipmentPanel(width, height, layout);
    this.buildTooltip();
    this.buildCharTooltip();
    this.buildButtons(width, height);

    this.selectCharacter(0);

    // 반응형: 씬 재시작으로 전체 재구성
    const onResize = () => this.scene.restart();
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 레이아웃 계산 (공통 수치 한 곳에서 관리)
  // ─────────────────────────────────────────────────────────────────────────────

  private calcLayout(width: number, height: number) {
    const count   = CHARACTERS.length;
    // 남은 높이 대비 카드와 정보창 비율 계산
    const maxCardH = Math.max(100, height - 380);
    
    let cardW   = Math.min((width - 80) / count - 10, 175);
    let cardH   = cardW * 1.85;

    if (cardH > maxCardH) {
      cardH = maxCardH;
      cardW = cardH / 1.85;
    }

    const totalW  = count * (cardW + 10) - 10;
    const startX  = (width - totalW) / 2;
    const cardY   = 96 + cardH / 2; // 상단 여백 소폭 줄임
    const panelY  = cardY + cardH / 2 + 12;
    
    // 패널이 최소 130 픽셀은 되도록 보장하고, 장비창(54)과 아래여백(68)을 고려하여 H 도출
    const btnAreaTop = height - 68;
    let panelH  = Math.min(btnAreaTop - panelY - 70, 210);
    if (panelH < 130) panelH = 130; // 절대적인 최소 크기 보장

    const panelW  = totalW;
    const panelX  = startX;
    return { count, cardW, cardH, totalW, startX, cardY, panelX, panelY, panelW, panelH };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UI 빌더
  // ─────────────────────────────────────────────────────────────────────────────

  private createCharAnimations() {
    CHARACTERS.forEach((char) => {
      const key      = `char_idle_${char.weapon}`;
      const frames   = CHAR_FRAME_COUNT[char.weapon];
      const texKey   = CHAR_SPRITE_KEY[char.weapon];
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames:    this.anims.generateFrameNumbers(texKey, { start: 0, end: frames - 1 }),
          frameRate: 8,
          repeat:    -1,
        });
      }
    });
  }

  private buildBackground(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0d0d18, 0x0d0d18, 0x191928, 0x191928, 1);
    bg.fillRect(0, 0, width, height);

    // 장식선
    const deco = this.add.graphics();
    deco.lineStyle(1.5, 0xd4af37, 0.5);
    deco.lineBetween(40, 92, width - 40, 92);
    deco.lineBetween(40, height - 70, width - 40, height - 70);
  }

  private buildTitle(width: number, _height: number) {
    this.add.text(width / 2, 36, i18n.t('selectCharacter'), {
      fontFamily: 'SBAggroB',
      fontSize: '36px',
      color: '#d4af37',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(width / 2, 68, i18n.t('selectCharacterDesc'), {
      fontFamily: 'SBAggroM',
      fontSize: '14px',
      color: '#9a8060',
    }).setOrigin(0.5);
  }

  private buildCharacterCards(layout: ReturnType<typeof this.calcLayout>) {
    const { count, cardW, cardH, startX, cardY } = layout;
    this.cardContainers = [];
    this.cardGraphics   = [];

    CHARACTERS.forEach((char, idx) => {
      const x = startX + idx * (cardW + 10) + cardW / 2;
      const container = this.add.container(x, cardY);

      // 카드 배경 Graphics
      const cardBg = this.add.graphics();
      this.drawCardBg(cardBg, cardW, cardH, char.weapon, false);
      this.cardGraphics.push(cardBg);

      // 캐릭터 idle 스프라이트 (크게)
      const spriteScale = Math.min(cardW / 260, cardH * 0.68 / 360);
      const charSprite  = this.add.sprite(0, -cardH * 0.10, CHAR_SPRITE_KEY[char.weapon])
        .setScale(spriteScale)
        .play(`char_idle_${char.weapon}`);

      // 무기 이름만 표시 (스펙은 클릭 시 하단 패널에서 확인)
      const weaponName = this.add.text(0, cardH * 0.41, i18n.t(char.nameKey), {
        fontFamily: 'SBAggroB',
        fontSize: `${Math.round(cardW * 0.13)}px`,
        color: WEAPON_COLORS[char.weapon].accent,
        stroke: '#000',
        strokeThickness: 3,
      }).setOrigin(0.5);

      container.add([cardBg, charSprite, weaponName]);
      container.setSize(cardW, cardH);
      container.setInteractive({ useHandCursor: true });

      // 호버 / 클릭
      container.on('pointerover', () => {
        if (this.selectedIndex !== idx) {
          this.tweens.add({ targets: container, y: cardY - 6, duration: 110, ease: 'Power1' });
        }
        const cx = startX + idx * (cardW + 10) + cardW / 2;
        this.showCharTooltip(char, cx, cardY, cardH);
      });
      container.on('pointerout', () => {
        if (this.selectedIndex !== idx) {
          this.tweens.add({ targets: container, y: cardY, duration: 110, ease: 'Power1' });
        }
        this.hideCharTooltip();
      });
      container.on('pointerdown', () => { AudioManager.play('CLICK'); this.selectCharacter(idx); });

      this.cardContainers.push(container);
    });
  }

  private buildDetailPanel(layout: ReturnType<typeof this.calcLayout>) {
    const { panelX, panelY, panelW, panelH } = layout;
    this.detailPanel = this.add.container(panelX, panelY);

    // 패널 배경
    const bg = this.add.graphics();
    bg.fillStyle(0x10101e, 0.94);
    bg.lineStyle(1, 0xd4af37, 0.35);
    bg.fillRoundedRect(0, 0, panelW, panelH, 10);
    bg.strokeRoundedRect(0, 0, panelW, panelH, 10);

    // ── 좌측: 이름 + 특성 설명 ─────────────────────────────────────────────────
    const leftCx = panelW * 0.19;

    const nameText = this.add.text(leftCx, panelH * 0.24, '', {
      fontFamily: 'SBAggroB',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5).setName('nameText');

    const descText = this.add.text(leftCx, panelH * 0.42, '', {
      fontFamily: 'SBAggroM',
      fontSize: '13px',
      color: '#b8a880',
      align: 'center',
      lineSpacing: 4,
      wordWrap: { width: panelW * 0.34 },
    }).setOrigin(0.5).setName('descText');

    // 초기 덱 미리보기
    const deckLabel = this.add.text(leftCx, panelH * 0.62, '초기 덱', {
      fontFamily: 'SBAggroB',
      fontSize: '11px',
      color: '#d4af37',
      align: 'center',
    }).setOrigin(0.5).setName('deckLabel');

    const deckText = this.add.text(leftCx, panelH * 0.80, '', {
      fontFamily: 'SBAggroM',
      fontSize: '11px',
      color: '#9ab8cc',
      align: 'center',
      lineSpacing: 3,
      wordWrap: { width: panelW * 0.36 },
    }).setOrigin(0.5).setName('deckText');

    // 세로 구분선
    const divider = this.add.graphics();
    divider.lineStyle(1, 0xd4af37, 0.2);
    divider.lineBetween(panelW * 0.38, panelH * 0.08, panelW * 0.38, panelH * 0.92);

    // ── 우측: 스탯 바 ───────────────────────────────────────────────────────────
    const statG = this.add.graphics().setName('statG');

    const statLabelDefs = ['statHp', 'statDef', 'statAtk', 'statCrit', 'statCritDmg'].map(k => i18n.t(k));
    const barStartY = panelH * 0.12;
    const rowGap    = panelH * 0.165;
    const labelX    = panelW * 0.41;

    const labelTexts = statLabelDefs.map((label, i) =>
      this.add.text(labelX, barStartY + i * rowGap, label, {
        fontFamily: 'SBAggroB',
        fontSize: '12px',
        color: '#d4af37',
      }).setOrigin(0, 0.5)
    );

    this.detailPanel.add([bg, nameText, descText, deckLabel, deckText, divider, statG, ...labelTexts]);
  }

  private buildEquipmentPanel(_width: number, height: number, layout: ReturnType<typeof this.calcLayout>) {
    const { panelX, panelY, panelW, panelH } = layout;
    const panelBottom = panelY + panelH;
    const btnAreaTop  = height - 68;
    const sectionH    = Math.max(54, Math.min(btnAreaTop - panelBottom - 8, 80));
    const sectionY    = panelBottom + 6;

    // 섹션 배경
    const secBg = this.add.graphics();
    secBg.fillStyle(0x10101e, 0.92);
    secBg.lineStyle(1, 0xd4af37, 0.3);
    secBg.fillRoundedRect(panelX, sectionY, panelW, sectionH, 8);
    secBg.strokeRoundedRect(panelX, sectionY, panelW, sectionH, 8);

    // 레이블
    this.add.text(panelX + 14, sectionY + sectionH / 2, i18n.t('startEquip'), {
      fontFamily: 'SBAggroB', fontSize: '13px', color: '#d4af37',
    }).setOrigin(0, 0.5);

    const labelW  = 70;
    const startX  = panelX + labelW + 10;

    if (this.allEquipment.length === 0) {
      this.add.text(startX, sectionY + sectionH / 2,
        i18n.t('noEquipCollected'), {
          fontFamily: 'SBAggroL', fontSize: '12px', color: '#555555',
        }).setOrigin(0, 0.5);
      return;
    }

    // 장비 툴팁은 별도로 buildTooltip에서 만듦
    // 레이아웃
    const targetSize = 44;
    const padding = 6;
    const slotSize = targetSize + padding * 2;
    // max cols based on panel width
    const cols = Math.floor((panelW - labelW - 20) / slotSize);
    
    // 다시 그리기 함수 목록 (선택 변경 시 전부 호출)
    const redraws: (() => void)[] = [];

    this.allEquipment.forEach((eq, i) => {
      const eqData = getEquipmentById(eq);
      if (!eqData) return;

      const row = Math.floor(i / cols);
      const col = i % cols;
      
      const bx = startX + col * slotSize + slotSize / 2;
      const actualY = sectionY + 28 + row * slotSize;

      const cont = this.add.container(bx, actualY);

      const bg  = this.add.graphics();
      // Icon Sprite
      const sprite = this.add.sprite(0, 0, eqData.texture, eqData.frame);
      sprite.setDisplaySize(targetSize, targetSize);

      const redraw = () => {
        const sel = this.selectedEquip === eq;
        bg.clear();
        bg.fillStyle(sel ? 0x3a2800 : 0x1a1a2e, 1);
        bg.lineStyle(sel ? 2 : 1, sel ? 0xd4af37 : 0x444466, 1);
        bg.fillRoundedRect(-slotSize / 2, -slotSize / 2, slotSize, slotSize, 5);
        bg.strokeRoundedRect(-slotSize / 2, -slotSize / 2, slotSize, slotSize, 5);
        if (sel) {
          sprite.setTint(0xffffee);
        } else {
          sprite.clearTint();
        }
      };
      redraw();
      redraws.push(redraw);

      cont.add([bg, sprite]);
      cont.setSize(slotSize, slotSize);
      cont.setInteractive({ useHandCursor: true });

      // tooltip content
      const gradeColor = EQUIP_GRADE_COLOR[eqData.grade];
      const gradeLabel = EQUIP_GRADE_LABEL[eqData.grade];
      let ttpText = `[${gradeLabel}] ${eqData.name}\n\n`;
      ttpText += formatEquipStats(eqData.stats);
      if (eqData.special) {
        ttpText += `\n★ ${eqData.special.desc}`;
      }

      cont.on('pointerover', () => {
        if (this.selectedEquip !== eq) bg.setAlpha(1.4);
        // Show tooltip
        this.equipTooltipText.setText(ttpText);
        // color top line
        // We use setTint or we can just keep text basic. Let's just use simple text.
        this.equipTooltip.setVisible(true);
        const b = this.equipTooltipText.getBounds();
        this.equipTooltipBg.clear();
        this.equipTooltipBg.fillStyle(0x0d1117, 0.95);
        this.equipTooltipBg.lineStyle(1.5, parseInt(gradeColor.replace('#', '0x')), 1);
        this.equipTooltipBg.fillRoundedRect(0, 0, b.width + 20, b.height + 20, 6);
        this.equipTooltipBg.strokeRoundedRect(0, 0, b.width + 20, b.height + 20, 6);
        
        let tx = bx;
        let ty = actualY - slotSize/2 - b.height - 25;
        // screen bounds check
        if (ty < 0) ty = actualY + slotSize/2 + 5;
        this.equipTooltip.setPosition(tx - (b.width+20)/2, ty);
      });
      cont.on('pointerout', () => {
        bg.setAlpha(1);
        this.equipTooltip.setVisible(false);
      });
      cont.on('pointerdown', () => {
        AudioManager.play('CLICK');
        this.selectedEquip = this.selectedEquip === eq ? null : eq;
        redraws.forEach(fn => fn());
      });
    });
  }

  private buildTooltip() {
    this.equipTooltip = this.add.container(-1000, -1000).setDepth(2000).setVisible(false);
    this.equipTooltipBg = this.add.graphics();
    this.equipTooltipText = this.add.text(10, 10, '', {
      fontFamily: 'SBAggroM', fontSize: '13px', color: '#eeeeee', lineSpacing: 5
    });
    this.equipTooltip.add([this.equipTooltipBg, this.equipTooltipText]);
  }

  private buildCharTooltip() {
    this.charTooltip = this.add.container(-1000, -1000).setDepth(1900).setVisible(false);
    this.charTooltipBg = this.add.graphics();
    this.charTooltipText = this.add.text(12, 10, '', {
      fontFamily: 'SBAggroM', fontSize: '13px', color: '#eeeeee', lineSpacing: 6,
      wordWrap: { width: 240 },
    });
    this.charTooltip.add([this.charTooltipBg, this.charTooltipText]);
  }

  private showCharTooltip(char: CharacterDef, cardX: number, cardY: number, cardH: number) {
    const hintKey = `charHint${char.id.charAt(0).toUpperCase()}${char.id.slice(1)}`;
    const text = i18n.t(hintKey) || '';
    if (!text) return;

    this.charTooltipText.setText(text);
    const tw = this.charTooltipText.width + 24;
    const th = this.charTooltipText.height + 20;

    this.charTooltipBg.clear();
    this.charTooltipBg.fillStyle(0x0d0d20, 0.95);
    this.charTooltipBg.lineStyle(1, WEAPON_COLORS[char.weapon].card, 0.8);
    this.charTooltipBg.fillRoundedRect(0, 0, tw, th, 8);
    this.charTooltipBg.strokeRoundedRect(0, 0, tw, th, 8);

    // 카드 아래쪽에 표시, 화면 밖으로 나가면 위쪽으로
    const { width, height } = this.scale;
    let tx = cardX - tw / 2;
    let ty = cardY + cardH / 2 + 8;
    if (tx + tw > width - 10) tx = width - tw - 10;
    if (tx < 10) tx = 10;
    if (ty + th > height - 10) ty = cardY - cardH / 2 - th - 8;

    this.charTooltip.setPosition(tx, ty).setVisible(true);
  }

  private hideCharTooltip() {
    this.charTooltip.setVisible(false);
  }


  private buildButtons(width: number, height: number) {
    // 게임 시작
    this.startBtn = this.add.text(width / 2, height - 38, i18n.t('startGame'), {
      fontFamily: 'SBAggroB',
      fontSize: '24px',
      color: '#1a1a1a',
      backgroundColor: '#d4af37',
      padding: { x: 44, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.startBtn.on('pointerover',  () => this.startBtn.setBackgroundColor('#f5cc4a'));
    this.startBtn.on('pointerout',   () => this.startBtn.setBackgroundColor('#d4af37'));
    this.startBtn.on('pointerdown',  () => {
      AudioManager.play('REWARD');
      const char = CHARACTERS[this.selectedIndex];
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MainScene', {
          isContinue: false,
          character: char,
          startEquipment: this.selectedEquip ? [this.selectedEquip] : [],
        });
      });
    });

    // 뒤로가기
    const backBtn = this.add.text(50, height - 38, '← ' + i18n.t('back'), {
      fontFamily: 'SBAggroM',
      fontSize: '17px',
      color: '#8a7060',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#d4af37'));
    backBtn.on('pointerout',  () => backBtn.setColor('#8a7060'));
    backBtn.on('pointerdown', () => {
      AudioManager.play('CLICK');
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('IntroScene');
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 선택 / 갱신 로직
  // ─────────────────────────────────────────────────────────────────────────────

  private selectCharacter(idx: number) {
    const prev = this.selectedIndex;
    this.selectedIndex = idx;

    const { cardW, cardH, cardY } = this.calcLayout(this.scale.width, this.scale.height);

    // 이전 카드 원복
    if (prev !== idx) {
      this.drawCardBg(this.cardGraphics[prev], cardW, cardH, CHARACTERS[prev].weapon, false);
      this.tweens.add({ targets: this.cardContainers[prev], y: cardY, scaleX: 1, scaleY: 1, duration: 160 });
    }

    // 현재 카드 강조 (중심에서 사방으로 확대)
    this.drawCardBg(this.cardGraphics[idx], cardW, cardH, CHARACTERS[idx].weapon, true);
    this.tweens.add({
      targets: this.cardContainers[idx],
      y: cardY,
      scaleX: 1.08, scaleY: 1.08,
      duration: 200,
      ease: 'Back.easeOut',
    });

    this.refreshDetailPanel(CHARACTERS[idx]);
  }

  private refreshDetailPanel(char: CharacterDef) {
    const { panelW, panelH } = this.calcLayout(this.scale.width, this.scale.height);

    // 이름
    const nameText = this.detailPanel.getByName('nameText') as Phaser.GameObjects.Text;
    nameText?.setText(i18n.t(char.nameKey))
             .setColor(WEAPON_COLORS[char.weapon].accent);

    // 고유 특성
    const descText = this.detailPanel.getByName('descText') as Phaser.GameObjects.Text;
    descText?.setText(i18n.t(char.descKey));

    // 초기 덱 미리보기
    const deckText = this.detailPanel.getByName('deckText') as Phaser.GameObjects.Text;
    deckText?.setText(INITIAL_DECK_SUMMARY[char.weapon]);

    // 스탯 바
    const statG = this.detailPanel.getByName('statG') as Phaser.GameObjects.Graphics;
    if (!statG) return;
    statG.clear();

    const barX      = panelW * 0.51;
    const barEndX   = panelW * 0.87;
    const barW      = barEndX - barX;
    const barH      = 11;
    const barStartY = panelH * 0.12;
    const rowGap    = panelH * 0.165;
    const col       = WEAPON_COLORS[char.weapon].card;

    const statValues = [
      { val: char.hp,      max: STAT_MAX.hp      },
      { val: char.def,     max: STAT_MAX.def      },
      { val: char.atk,     max: STAT_MAX.atk      },
      { val: char.crit,    max: STAT_MAX.crit     },
      { val: char.critDmg, max: STAT_MAX.critDmg  },
    ];

    statValues.forEach(({ val, max }, i) => {
      const y     = barStartY + i * rowGap - barH / 2;
      const ratio = Math.min(val / max, 1);

      statG.fillStyle(0x2a2a3a, 1);
      statG.fillRoundedRect(barX, y, barW, barH, 4);
      statG.fillStyle(col, 1);
      statG.fillRoundedRect(barX, y, barW * ratio, barH, 4);
    });

    // 수치 텍스트
    const valDefs = [
      `${char.hp}`,
      `${char.def}`,
      `${char.atk}`,
      `${char.crit}%`,
      `×${char.critDmg}`,
    ];

    valDefs.forEach((txt, i) => {
      const key = `statVal${i}`;
      let tv = this.detailPanel.getByName(key) as Phaser.GameObjects.Text | null;
      if (!tv) {
        tv = this.add.text(0, 0, '', {
          fontFamily: 'SBAggroM',
          fontSize: '12px',
          color: '#d8c8a8',
        }).setName(key);
        this.detailPanel.add(tv);
      }
      tv.setText(txt);
      tv.setPosition(barEndX + 8, barStartY + i * rowGap);
      tv.setOrigin(0, 0.5);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 카드 배경 redraw 헬퍼
  // ─────────────────────────────────────────────────────────────────────────────

  private drawCardBg(
    g: Phaser.GameObjects.Graphics,
    w: number, h: number,
    weapon: WeaponType,
    selected: boolean,
  ) {
    g.clear();
    const col = WEAPON_COLORS[weapon].card;

    if (selected) {
      g.fillStyle(col, 0.22);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      g.lineStyle(2.5, col, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    } else {
      g.fillStyle(0x1c1c2c, 0.9);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      g.lineStyle(1, col, 0.28);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    }
  }
}
