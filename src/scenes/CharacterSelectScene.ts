import Phaser from 'phaser';
import { i18n } from '@src/utils/localization';
import '@src/styles/colors.css';

// ─── 타입 / 상수 ──────────────────────────────────────────────────────────────

const WEAPON_TYPES = ['swordShield', 'bow', 'greatsword', 'hammer', 'spear'] as const;
type WeaponType = typeof WEAPON_TYPES[number];

/** 무기 타입별 색상 */
const WEAPON_COLORS: Record<WeaponType, { card: number; accent: string }> = {
  swordShield: { card: 0x4a90d9, accent: '#4a90d9' }, // 파란 강철
  bow:         { card: 0x6ab04c, accent: '#6ab04c' }, // 숲 녹색
  greatsword:  { card: 0xc0392b, accent: '#c0392b' }, // 진홍
  hammer:      { card: 0xa07040, accent: '#c8906a' }, // 구리/갈색
  spear:       { card: 0x8e44ad, accent: '#b57bee' }, // 보라
};

/** 무기 타입 → 캐릭터 idle 스프라이트 키 */
const CHAR_SPRITE_KEY: Record<WeaponType, string> = {
  swordShield: 'char_shield',
  bow:         'char_bow',
  greatsword:  'char_sword',
  hammer:      'char_hammer',
  spear:       'char_spear',
};

/** 무기 타입 → idle 프레임 수 */
const CHAR_FRAME_COUNT: Record<WeaponType, number> = {
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
  def:         number;     // 방력 (0~50)
  crit:        number;     // 크리티컬 % (0~100)
  critDmg:     number;     // 크리티컬 배율 (기본 1.5)
  description: string;
}

/** 무기 타입별 캐릭터 정의 */
const CHARACTERS: CharacterDef[] = [
  {
    id: 'guardian',
    weapon: 'swordShield',
    nameKey: 'weaponSwordShield',
    hp: 140, atk: 12, def: 18, crit: 8, critDmg: 1.5,
    description: '공격과 방어를 겸비한 수호자.\n높은 방어력으로 생존에 유리합니다.',
  },
  {
    id: 'ranger',
    weapon: 'bow',
    nameKey: 'weaponBow',
    hp: 100, atk: 16, def: 6, crit: 22, critDmg: 2.0,
    description: '원거리에서 정밀하게 공격하는 레인저.\n크리티컬 확률이 높습니다.',
  },
  {
    id: 'berserker',
    weapon: 'greatsword',
    nameKey: 'weaponGreatsword',
    hp: 110, atk: 22, def: 4, crit: 12, critDmg: 1.8,
    description: '두손으로 휘두르는 파괴적인 버서커.\n최강의 공격력을 자랑합니다.',
  },
  {
    id: 'titan',
    weapon: 'hammer',
    nameKey: 'weaponHammer',
    hp: 160, atk: 14, def: 24, crit: 5, critDmg: 1.5,
    description: '망치로 모든 것을 부수는 타이탄.\n체력과 방어력이 압도적입니다.',
  },
  {
    id: 'lancer',
    weapon: 'spear',
    nameKey: 'weaponSpear',
    hp: 120, atk: 18, def: 10, crit: 16, critDmg: 1.7,
    description: '창으로 거리를 지배하는 랜서.\n공격·방어· 크리티컬이 균형잡혀 있습니다.',
  },
];

// 스탯 최대 기준값 (바 정규화용)
const STAT_MAX = { hp: 160, atk: 22, def: 24, crit: 100 };

// ─── 씬 ───────────────────────────────────────────────────────────────────────

export default class CharacterSelectScene extends Phaser.Scene {
  private selectedIndex = 0;

  /** 각 카드(배경 Graphics + Container) */
  private cardGraphics:   Phaser.GameObjects.Graphics[]  = [];
  private cardContainers: Phaser.GameObjects.Container[] = [];

  /** 상세 패널 */
  private detailPanel!: Phaser.GameObjects.Container;

  /** 게임 시작 버튼 */
  private startBtn!: Phaser.GameObjects.Text;

  constructor() {
    super('CharacterSelectScene');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Phaser 라이프사이클
  // ─────────────────────────────────────────────────────────────────────────────

  create() {
    const { width, height } = this.scale;

    this.buildBackground(width, height);
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.buildTitle(width, height);
    this.createCharAnimations();

    const layout = this.calcLayout(width, height);
    this.buildCharacterCards(layout);
    this.buildDetailPanel(layout);
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
    const cardW   = Math.min((width - 80) / count - 12, 150);
    const cardH   = cardW * 1.65;
    const totalW  = count * (cardW + 12) - 12;
    const startX  = (width - totalW) / 2;
    const cardY   = 110 + cardH / 2;
    const panelY  = cardY + cardH / 2 + 20;
    const panelH  = height - panelY - 80;
    const panelW  = Math.min(width - 80, 720);
    const panelX  = (width - panelW) / 2;
    return { count, cardW, cardH, startX, cardY, panelX, panelY, panelW, panelH };
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
    this.add.text(width / 2, 42, i18n.t('selectCharacter'), {
      fontFamily: 'SBAggroB',
      fontSize: '40px',
      color: '#d4af37',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(width / 2, 76, i18n.t('selectCharacterDesc'), {
      fontFamily: 'SBAggroM',
      fontSize: '15px',
      color: '#9a8060',
    }).setOrigin(0.5);
  }

  private buildCharacterCards(layout: ReturnType<typeof this.calcLayout>) {
    const { count, cardW, cardH, startX, cardY } = layout;
    this.cardContainers = [];
    this.cardGraphics   = [];

    CHARACTERS.forEach((char, idx) => {
      const x = startX + idx * (cardW + 12) + cardW / 2;
      const container = this.add.container(x, cardY);

      // 카드 배경 Graphics
      const cardBg = this.add.graphics();
      this.drawCardBg(cardBg, cardW, cardH, char.weapon, false);
      this.cardGraphics.push(cardBg);

      // 캐릭터 idle 스프라이트
      const spriteScale = Math.min(cardW * 0.9 / 300, cardH * 0.55 / 400);
      const charSprite  = this.add.sprite(0, -cardH * 0.18, CHAR_SPRITE_KEY[char.weapon])
        .setScale(spriteScale)
        .play(`char_idle_${char.weapon}`);

      // 무기 이름
      const weaponName = this.add.text(0, cardH * 0.22, i18n.t(char.nameKey), {
        fontFamily: 'SBAggroB',
        fontSize: `${Math.round(cardW * 0.14)}px`,
        color: WEAPON_COLORS[char.weapon].accent,
        stroke: '#000',
        strokeThickness: 3,
      }).setOrigin(0.5);

      // 간략 스탯
      const statSummary = this.add.text(0, cardH * 0.38,
        `HP ${char.hp}  ATK ${char.atk}`,
        {
          fontFamily: 'SBAggroM',
          fontSize: `${Math.round(cardW * 0.10)}px`,
          color: '#b8a080',
        }
      ).setOrigin(0.5);

      container.add([cardBg, charSprite, weaponName, statSummary]);
      container.setSize(cardW, cardH);
      container.setInteractive({ useHandCursor: true });

      // 호버 / 클릭
      container.on('pointerover', () => {
        if (this.selectedIndex !== idx) {
          this.tweens.add({ targets: container, y: cardY - 6, duration: 110, ease: 'Power1' });
        }
      });
      container.on('pointerout', () => {
        if (this.selectedIndex !== idx) {
          this.tweens.add({ targets: container, y: cardY, duration: 110, ease: 'Power1' });
        }
      });
      container.on('pointerdown', () => this.selectCharacter(idx));

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

    // 이름 (큰 텍스트)
    const nameText = this.add.text(panelW / 2, panelH * 0.14, '', {
      fontFamily: 'SBAggroB',
      fontSize: '26px',
      color: '#ffffff',
    }).setOrigin(0.5).setName('nameText');

    // 설명
    const descText = this.add.text(panelW / 2, panelH * 0.34, '', {
      fontFamily: 'SBAggroM',
      fontSize: '14px',
      color: '#b8a880',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5).setName('descText');

    // 스탯 바 렌더링용 Graphics
    const statG = this.add.graphics().setName('statG');

    // 스탯 레이블 (고정)
    const statLabelDefs = [
      { key: 'HP',    label: `HP` },
      { key: 'ATK',   label: `ATK` },
      { key: 'DEF',   label: `DEF` },
      { key: 'CRIT',  label: `CRIT` },
    ];
    const barStartY = panelH * 0.56;
    const rowGap    = panelH * 0.115;
    const labelX    = panelW * 0.06;

    const labelTexts = statLabelDefs.map(({ label }, i) =>
      this.add.text(labelX, barStartY + i * rowGap, label, {
        fontFamily: 'SBAggroB',
        fontSize: '13px',
        color: '#d4af37',
      }).setOrigin(0, 0.5)
    );

    this.detailPanel.add([bg, nameText, descText, statG, ...labelTexts]);
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
      const char = CHARACTERS[this.selectedIndex];
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MainScene', { isContinue: false, character: char });
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

    // 현재 카드 강조
    this.drawCardBg(this.cardGraphics[idx], cardW, cardH, CHARACTERS[idx].weapon, true);
    this.tweens.add({
      targets: this.cardContainers[idx],
      y: cardY - 14,
      scaleX: 1.06, scaleY: 1.06,
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

    // 설명
    const descText = this.detailPanel.getByName('descText') as Phaser.GameObjects.Text;
    descText?.setText(char.description);

    // 스탯 바
    const statG = this.detailPanel.getByName('statG') as Phaser.GameObjects.Graphics;
    if (!statG) return;
    statG.clear();

    const barX      = panelW * 0.20;
    const barEndX   = panelW * 0.78;
    const barW      = barEndX - barX;
    const barH      = 13;
    const barStartY = panelH * 0.56;
    const rowGap    = panelH * 0.115;
    const col       = WEAPON_COLORS[char.weapon].card;

    const statValues = [
      { val: char.hp,   max: STAT_MAX.hp   },
      { val: char.atk,  max: STAT_MAX.atk  },
      { val: char.def,  max: STAT_MAX.def  },
      { val: char.crit, max: STAT_MAX.crit },
    ];

    statValues.forEach(({ val, max }, i) => {
      const y     = barStartY + i * rowGap - barH / 2;
      const ratio = Math.min(val / max, 1);

      // 배경
      statG.fillStyle(0x2a2a3a, 1);
      statG.fillRoundedRect(barX, y, barW, barH, 4);
      // 채움
      statG.fillStyle(col, 1);
      statG.fillRoundedRect(barX, y, barW * ratio, barH, 4);
    });

    // 수치 텍스트
    const valDefs = [
      `${char.hp}`,
      `${char.atk}`,
      `${char.def}`,
      `${char.crit}%  ×${char.critDmg}`,
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
