import Phaser from 'phaser';
import { CardData, STAR_ATTR_INDEX } from '@src/data/cardData';
import { i18n } from '@src/utils/localization';
import { AudioManager } from '@src/utils/Audio';

// ─── 레이아웃 상수 ────────────────────────────────────────────────────────────

export const CARD_WIDTH  = 180;
export const CARD_HEIGHT = 252;

const PAD       = 8;   // 외부 여백
const INNER_PAD = 4;   // 박스 내부 여백
const ATTR_SIZE = 22;  // 속성 아이콘 크기 (px)
const STAR_SIZE = 10;  // 별 아이콘 크기 (px)
const STAR_GAP  = 2;   // 별 사이 간격 (px)

// 헤더: y=0 ~ y=44
const HEADER_H = 44;
// 일러스트 영역: y=48, h=104
const ILLUST_Y = HEADER_H + 4;
const ILLUST_H = 104;
// 묘사 영역: y=156, h=88
const DESC_Y = ILLUST_Y + ILLUST_H + 4;
const DESC_H = CARD_HEIGHT - DESC_Y - PAD; // = 88

// ─── 속성별 테두리 색상 ───────────────────────────────────────────────────────

const ELEMENT_BORDER: Record<string, number> = {
  water:     0x4db8ff,
  fire:      0xff6b35,
  grass:     0x5ddb7a,
  lightning: 0xffe033,
  earth:     0xc8a04a,
  normal:    0xb8a880,
};

// ─── Card 클래스 ─────────────────────────────────────────────────────────────

/**
 * 카드 한 장 (Container, origin = top-left).
 *
 * 레이아웃:
 *  ┌── outer border(속성 색 3px) ────────────────────┐
 *  │  [이름]                      [속성 아이콘 22px]  │ ← HEADER_H=44
 *  │  ★★★ (이름 아래 가로 행)                        │
 *  ├─────────────────────────────────────────────────┤
 *  │  ┌─ 일러스트 border ──────────────────────────┐ │ ← y=48, h=104
 *  │  │              [card image]                  │ │
 *  │  └────────────────────────────────────────────┘ │
 *  │  ┌─ 묘사 border ──────────────────────────────┐ │ ← y=156, h=88
 *  │  │  description text...                       │ │
 *  │  └────────────────────────────────────────────┘ │
 *  └─────────────────────────────────────────────────┘
 */
export default class Card extends Phaser.GameObjects.Container {
  private readonly cardInfo: CardData;
  private readonly overrideStars: number | undefined;

  constructor(scene: Phaser.Scene, x: number, y: number, cardData: CardData, overrideStars?: number) {
    super(scene, x, y);
    this.cardInfo = cardData;
    this.overrideStars = overrideStars;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scene.add.existing(this as any);
    this.build();
  }

  get cardData(): CardData {
    return this.cardInfo;
  }

  /** hover 확대 + pointerdown 이벤트 포워딩 */
  makeInteractive() {
    const hit = this.scene.add
      .zone(CARD_WIDTH / 2, CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT)
      .setInteractive({ useHandCursor: true });
    this.add(hit);

    hit.on('pointerover', () => {
      AudioManager.play('CARD_HOVER');
      this.scene.tweens.add({ targets: this, scaleX: 1.07, scaleY: 1.07, duration: 120, ease: 'Sine.easeOut' });
    });
    hit.on('pointerout', () =>
      this.scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 120, ease: 'Sine.easeOut' }),
    );
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      AudioManager.play('CARD_SELECT');
      this.emit('pointerdown', p);
    });
  }

  // ── 빌드 ────────────────────────────────────────────────────────────────────

  private build() {
    const g = this.scene.add.graphics();
    this.drawCardBase(g);
    this.add(g);
    this.drawTitle();
    this.drawAttrIcon();
    this.drawStars();
    this.drawIllustration();
    this.drawDescription();
  }

  /** 배경 + 모든 border */
  private drawCardBase(g: Phaser.GameObjects.Graphics) {
    const bc = ELEMENT_BORDER[this.cardInfo.element] ?? 0xb8a880;
    const effectiveStars = this.overrideStars ?? this.cardInfo.stars;
    const isUpgradedNormal = this.cardInfo.element === 'normal' && effectiveStars > 0;

    // 일반 카드 강화 글로우: 별 등급에 따라 황금빛 발광 테두리
    if (isUpgradedNormal) {
      const glowAlpha = 0.08 + effectiveStars * 0.06; // ★1=0.14 ~ ★5=0.38
      const glowColor = 0xffd700;
      for (let i = 3; i >= 1; i--) {
        g.lineStyle(i * 3, glowColor, glowAlpha * (4 - i) / 2);
        g.strokeRoundedRect(-i * 2, -i * 2, CARD_WIDTH + i * 4, CARD_HEIGHT + i * 4, 10 + i);
      }
    }

    // 그림자
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(4, 4, CARD_WIDTH, CARD_HEIGHT, 8);

    // 배경 — 강화된 일반 카드는 황금빛 음영
    if (isUpgradedNormal) {
      const bgBlend = Math.min(effectiveStars * 0.04, 0.18);
      g.fillStyle(0x2a2010, 1);
      g.fillRoundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);
      g.fillStyle(0xffd700, bgBlend);
      g.fillRoundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);
    } else {
      g.fillStyle(0x1c1612, 1);
      g.fillRoundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);
    }

    // 외곽 테두리 (속성 색, 3px) — 강화 시 황금
    const borderColor = isUpgradedNormal ? 0xffd700 : bc;
    const borderWidth = isUpgradedNormal ? 4 : 3;
    g.lineStyle(borderWidth, borderColor, 1);
    g.strokeRoundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);

    // 내부 장식 테두리 (속성 색 반투명)
    g.lineStyle(1, borderColor, isUpgradedNormal ? 0.5 : 0.25);
    g.strokeRoundedRect(5, 5, CARD_WIDTH - 10, CARD_HEIGHT - 10, 5);

    // 헤더 구분선
    g.lineStyle(1, borderColor, 0.65);
    g.lineBetween(PAD, HEADER_H, CARD_WIDTH - PAD, HEADER_H);

    // 일러스트 border
    g.lineStyle(1, borderColor, 0.8);
    g.strokeRect(PAD, ILLUST_Y, CARD_WIDTH - PAD * 2, ILLUST_H);

    // 묘사 border
    g.strokeRect(PAD, DESC_Y, CARD_WIDTH - PAD * 2, DESC_H);
  }

  /** 좌상단: 카드 이름 */
  private drawTitle() {
    this.add(
      this.scene.add.text(PAD, PAD, i18n.t(this.cardInfo.nameKey), {
        fontFamily: 'SBAggroB',
        fontSize: '11px',
        color: '#e8d9b0',
        wordWrap: { width: CARD_WIDTH - PAD - ATTR_SIZE - PAD * 2 },
      }).setOrigin(0, 0),
    );
  }

  /** 우상단: 속성 아이콘 – 헤더 높이 세로 중앙 정렬 */
  private drawAttrIcon() {
    const icon = this.scene.add.image(
      CARD_WIDTH - PAD - ATTR_SIZE / 2,
      HEADER_H / 2, // = 22, 헤더 정중앙
      'attr_icons',
    );
    icon.setFrame(`attr_${this.cardInfo.attrIndex}`);
    icon.setDisplaySize(ATTR_SIZE, ATTR_SIZE);
    this.add(icon);
  }

  /** 이름 바로 아래 가로 행 별 (강화된 일반 카드는 황금별로 표시) */
  private drawStars() {
    const effectiveStars = this.overrideStars ?? this.cardInfo.stars;
    if (effectiveStars <= 0) return;

    const isUpgradedNormal = this.cardInfo.element === 'normal' && effectiveStars > 0;
    const starRowY = PAD + 14; // 이름 아래

    for (let i = 0; i < effectiveStars; i++) {
      const star = this.scene.add.image(
        PAD + i * (STAR_SIZE + STAR_GAP) + STAR_SIZE / 2,
        starRowY + STAR_SIZE / 2,
        'attr_icons',
      );
      star.setFrame(`attr_${STAR_ATTR_INDEX}`);
      star.setDisplaySize(STAR_SIZE, STAR_SIZE);
      // 강화된 일반 카드는 황금빛 별
      if (isUpgradedNormal) star.setTint(0xffd700);
      this.add(star);
    }
  }

  /** 중앙 일러스트 */
  private drawIllustration() {
    const targetW = CARD_WIDTH - PAD * 2 - 2;
    const targetH = ILLUST_H - 2;
    const size = Math.min(targetW, targetH);
    
    const illust = this.scene.add.image(
      CARD_WIDTH / 2,
      ILLUST_Y + ILLUST_H / 2,
      'card_sprites',
    );
    illust.setFrame(`card_${this.cardInfo.spriteRow}_${this.cardInfo.spriteCol}`);
    illust.setDisplaySize(size, size);
    this.add(illust);
  }

  /** 하단 묘사 영역: 메인 스탯 + 이펙트 태그 자동 생성 */
  private drawDescription() {
    const { key, value, mult, bonusValue, effects } = this.cardInfo;
    const isGallery  = this.scene.scene.key === 'CardGalleryScene';
    const multVal    = mult ?? 1;
    const displayVal = value + (bonusValue || 0);
    const innerX     = PAD + INNER_PAD;
    const innerW     = CARD_WIDTH - PAD * 2 - INNER_PAD * 2;

    // ── 메인 스탯 라벨 ───────────────────────────────────────────────────────
    const KEY_COLOR: Record<string, string> = {
      attack:  '#f5cc4a',
      defense: '#56b4f7',
      shield:  '#56b4f7',
      hp:      '#2ecc71',
      arrow:   '#a0e080',
      spear:   '#c8a0f0',
    };
    const KEY_LABEL: Record<string, string> = {
      attack:  'ATK',
      defense: 'DEF',
      shield:  'DEF',
      hp:      'HP 회복',
      arrow:   'ARROW',
      spear:   'SPEAR',
    };
    const keyLabel = KEY_LABEL[key] ?? key.toUpperCase();
    const keyColor = KEY_COLOR[key]  ?? '#f5cc4a';

    const mainStatStr = isGallery
      ? `${keyLabel}  ${displayVal}`
      : `${keyLabel}  ${displayVal}  ×${multVal.toFixed(multVal === Math.floor(multVal) ? 0 : 2)}`;

    this.add(
      this.scene.add.text(innerX, DESC_Y + INNER_PAD, mainStatStr, {
        fontFamily: 'SBAggroB', fontSize: '12px', color: keyColor,
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0, 0),
    );

    // ── 이펙트 태그 자동 생성 ────────────────────────────────────────────────
    if (effects && effects.length > 0) {
      const EFFECT_META: Record<string, { icon: string; color: string; label: (v: number, d?: number) => string }> = {
        burn:        { icon: '🔥', color: '#ff8844', label: (v, d) => `화상 ${v}/턴 × ${d ?? 2}턴` },
        vulnerable:  { icon: '💀', color: '#cc88ff', label: (_v, d) => `취약 ${d ?? 1}턴` },
        stun:        { icon: '💫', color: '#aaaaff', label: () => '기절' },
        armor_break: { icon: '🔩', color: '#aaaaaa', label: (v) => `방깎 -${v}` },
        heal:        { icon: '💚', color: '#2ecc71', label: (v) => `회복 +${v}` },
        shield_add:  { icon: '🛡', color: '#56b4f7', label: (v) => `방어막 +${v}` },
        chain:       { icon: '⚡', color: '#ffe033', label: (v) => `연쇄 +${v}` },
        multi_hit:   { icon: '🔄', color: '#80e0ff', label: (v) => `${v}회 타격` },
        pierce:      { icon: '🗡', color: '#ff6666', label: () => '관통' },
      };

      let lineY = DESC_Y + INNER_PAD + 16; // 메인 스탯 아래
      for (const eff of effects) {
        const meta = EFFECT_META[eff.type];
        if (!meta) continue;
        const line = `${meta.icon} ${meta.label(eff.value, eff.duration)}`;
        this.add(
          this.scene.add.text(innerX, lineY, line, {
            fontFamily: 'SBAggroM', fontSize: '10px', color: meta.color,
            wordWrap: { width: innerW },
          }).setOrigin(0, 0),
        );
        lineY += 14;
      }
    } else {
      // 이펙트 없는 카드는 flavor 텍스트 표시
      this.add(
        this.scene.add.text(innerX, DESC_Y + INNER_PAD + 16, i18n.t(this.cardInfo.descKey), {
          fontFamily: 'SBAggroL', fontSize: '9px', color: '#888870',
          wordWrap: { width: innerW }, lineSpacing: 2,
        }).setOrigin(0, 0),
      );
    }
  }
}
