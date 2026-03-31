import Phaser from 'phaser';
import { CardData, STAR_ATTR_INDEX } from '@src/data/cardData';
import { i18n } from '@src/utils/localization';

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

  constructor(scene: Phaser.Scene, x: number, y: number, cardData: CardData) {
    super(scene, x, y);
    this.cardInfo = cardData;
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

    hit.on('pointerover', () =>
      this.scene.tweens.add({ targets: this, scaleX: 1.07, scaleY: 1.07, duration: 120, ease: 'Sine.easeOut' }),
    );
    hit.on('pointerout', () =>
      this.scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 120, ease: 'Sine.easeOut' }),
    );
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => this.emit('pointerdown', p));
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

    // 그림자
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(4, 4, CARD_WIDTH, CARD_HEIGHT, 8);

    // 중세 양피지 느낌의 기본 배경
    g.fillStyle(0x1c1612, 1);
    g.fillRoundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);

    // 외곽 테두리 (속성 색, 3px)
    g.lineStyle(3, bc, 1);
    g.strokeRoundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);

    // 내부 장식 테두리 (속성 색 반투명)
    g.lineStyle(1, bc, 0.25);
    g.strokeRoundedRect(5, 5, CARD_WIDTH - 10, CARD_HEIGHT - 10, 5);

    // 헤더 구분선
    g.lineStyle(1, bc, 0.65);
    g.lineBetween(PAD, HEADER_H, CARD_WIDTH - PAD, HEADER_H);

    // 일러스트 border
    g.lineStyle(1, bc, 0.8);
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

  /** 이름 바로 아래 가로 행 별 (일반 카드 생략) */
  private drawStars() {
    if (this.cardInfo.stars <= 0) return;

    const starRowY = PAD + 14; // 이름 아래

    for (let i = 0; i < this.cardInfo.stars; i++) {
      const star = this.scene.add.image(
        PAD + i * (STAR_SIZE + STAR_GAP) + STAR_SIZE / 2,
        starRowY + STAR_SIZE / 2,
        'attr_icons',
      );
      star.setFrame(`attr_${STAR_ATTR_INDEX}`);
      star.setDisplaySize(STAR_SIZE, STAR_SIZE);
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

  /** 하단 묘사 텍스트 */
  private drawDescription() {
    this.add(
      this.scene.add.text(
        PAD + INNER_PAD,
        DESC_Y + INNER_PAD,
        i18n.t(this.cardInfo.descKey),
        {
          fontFamily: 'SBAggroL',
          fontSize: '9px',
          color: '#b8a880',
          wordWrap: { width: CARD_WIDTH - PAD * 2 - INNER_PAD * 2 },
          lineSpacing: 3,
        }
      ).setOrigin(0, 0),
    );

    // 하단 우측 스탯 (key : value (mult)) - 도감에서는 표기 제외
    const { key, value, mult } = this.cardInfo;
    const isGallery = this.scene.scene.key === 'CardGalleryScene';
    const multVal = mult ?? 1;
    const statText = isGallery
      ? `${key.toUpperCase()} : ${value}`
      : `${key.toUpperCase()} : ${value} (${multVal})`;
    
    const statObj = this.scene.add.text(CARD_WIDTH - PAD - 2, CARD_HEIGHT - PAD - 2, statText, {
      fontFamily: 'SBAggroB', fontSize: '14px', color: '#f5cc4a',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(1, 1);
    
    this.add(statObj);
  }
}
