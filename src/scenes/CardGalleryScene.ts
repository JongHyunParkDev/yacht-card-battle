import Phaser from 'phaser';
import Card, { CARD_WIDTH, CARD_HEIGHT } from '@src/objects/Card';
import { CARD_DATA_LIST, CardData, CardElement } from '@src/data/cardData';

// ─── 상수 ────────────────────────────────────────────────────────────────────

const BG_COLOR      = 0x12100e;
const PANEL_COLOR   = 0x1e1b17;
const GOLD          = 0xd4af37;
const GOLD_HEX      = '#d4af37';
const WHITE_HEX     = '#ffffff';
const DIM_HEX       = '#888888';

const CARDS_PER_ROW = 5;
const CARD_GAP_X    = 20;
const CARD_GAP_Y    = 24;

/** 탭 영역 하단 y (카드 렌더링 시작 기준) */
const CARD_AREA_TOP = 112;
/** 하단 버튼 영역 높이 */
const FOOTER_H      = 44;

const TABS: { label: string; element: CardElement | 'all' }[] = [
  { label: '전체',    element: 'all' },
  { label: '💧 물',   element: 'water' },
  { label: '🔥 불',   element: 'fire' },
  { label: '🌿 풀',   element: 'grass' },
  { label: '⚡ 번개',  element: 'lightning' },
  { label: '🪨 돌',   element: 'earth' },
  { label: '⚔️ 일반', element: 'normal' },
];

// ─── 팝업 레이아웃 상수 ───────────────────────────────────────────────────────

const POPUP_W        = 400;
const POPUP_H        = 290;
/** 팝업 내 카드 미리보기 스케일 */
const PREVIEW_SCALE  = 0.82;
/** 팝업 내 카드 왼쪽 여백 */
const PREVIEW_PAD    = 16;
/** 미리보기 카드 너비 (scaled) */
const PREVIEW_CARD_W = Math.round(CARD_WIDTH * PREVIEW_SCALE);
/** 우측 정보 컬럼 시작 x */
const INFO_COL_X     = PREVIEW_PAD + PREVIEW_CARD_W + 14;
/** 우측 정보 컬럼 너비 */
const INFO_COL_W     = POPUP_W - INFO_COL_X - 12;

// ─── 씬 ──────────────────────────────────────────────────────────────────────

export default class CardGalleryScene extends Phaser.Scene {
  private activeTab: CardElement | 'all' = 'all';
  private scrollY     = 0;
  private maxScrollY  = 0;
  private isDragging  = false;
  private dragStartY  = 0;
  private dragScrollY = 0;

  private cardContainer!: Phaser.GameObjects.Container;
  private scrollThumb!:   Phaser.GameObjects.Graphics;
  private detailPopup:    Phaser.GameObjects.Container | null = null;

  constructor() {
    super('CardGalleryScene');
  }

  // ─────────────────────────────────────────────────────────────────────────────

  create() {
    const { width, height } = this.scale;
    this.scrollY    = 0;
    this.detailPopup = null;

    this.drawBackground(width, height);
    this.drawHeader(width);
    this.drawTabs(width);
    this.buildCards(width, height);
    this.drawBackButton(width, height);
    this.registerInput(width, height);
  }

  // ─── 레이아웃 ────────────────────────────────────────────────────────────────

  private drawBackground(w: number, h: number) {
    this.add.graphics().fillStyle(BG_COLOR, 1).fillRect(0, 0, w, h);
  }

  private drawHeader(w: number) {
    const g = this.add.graphics();
    g.fillStyle(PANEL_COLOR, 1);
    g.fillRect(0, 0, w, 54);
    g.lineStyle(1, GOLD, 0.6);
    g.lineBetween(0, 54, w, 54);

    this.add.text(w / 2, 27, '📖  카드 도감', {
      fontFamily: 'SBAggroB', fontSize: '22px', color: GOLD_HEX,
    }).setOrigin(0.5);
  }

  private drawTabs(w: number) {
    const tabY  = 82;
    const tabW  = Math.min(108, (w - 40) / TABS.length);
    const totalW = tabW * TABS.length;
    const startX = (w - totalW) / 2;

    const tabBg = this.add.graphics();

    TABS.forEach((tab, idx) => {
      const tx       = startX + idx * tabW + tabW / 2;
      const isActive = tab.element === this.activeTab;

      tabBg.fillStyle(isActive ? GOLD : 0x2a2520, 1);
      tabBg.fillRoundedRect(startX + idx * tabW + 2, tabY - 14, tabW - 4, 28, 5);

      const btn = this.add.text(tx, tabY, tab.label, {
        fontFamily: 'SBAggroM', fontSize: '11px',
        color: isActive ? '#000000' : DIM_HEX,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => { this.activeTab = tab.element; this.scrollY = 0; this.scene.restart(); });
      btn.on('pointerover', () => { if (tab.element !== this.activeTab) btn.setColor(WHITE_HEX); });
      btn.on('pointerout',  () => { if (tab.element !== this.activeTab) btn.setColor(DIM_HEX); });
    });
  }

  /** 카드 그리드 생성 – 카드 좌표는 top-left 기준 */
  private buildCards(w: number, h: number) {
    const filtered = this.activeTab === 'all'
      ? CARD_DATA_LIST
      : CARD_DATA_LIST.filter(c => c.element === this.activeTab);

    const gridW  = CARDS_PER_ROW * CARD_WIDTH + (CARDS_PER_ROW - 1) * CARD_GAP_X;
    const startX = Math.max(20, (w - gridW) / 2);
    const rows   = Math.ceil(filtered.length / CARDS_PER_ROW);
    const contentH = rows * CARD_HEIGHT + (rows - 1) * CARD_GAP_Y;
    const visibleH = h - CARD_AREA_TOP - FOOTER_H;

    this.maxScrollY = Math.max(0, contentH - visibleH);

    // Container는 카드 영역 시작 y에 배치
    this.cardContainer = this.add.container(0, CARD_AREA_TOP);

    filtered.forEach((cardData, i) => {
      const col = i % CARDS_PER_ROW;
      const row = Math.floor(i / CARDS_PER_ROW);
      // top-left 기준 좌표 (container 로컬)
      const cx = startX + col * (CARD_WIDTH + CARD_GAP_X);
      const cy = row * (CARD_HEIGHT + CARD_GAP_Y);

      const card = new Card(this, cx, cy, cardData);
      card.makeInteractive();
      card.on('pointerdown', () => this.showDetailPopup(cardData, w, h));
      this.cardContainer.add(card);
    });

    // 카드 영역 클리핑 마스크
    const maskGfx = this.make.graphics({ add: false });
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(0, CARD_AREA_TOP, w, visibleH);
    this.cardContainer.setMask(maskGfx.createGeometryMask());
  }

  private drawBackButton(w: number, h: number) {
    const btn = this.add.text(w - 20, h - 20, '← 뒤로', {
      fontFamily: 'SBAggroM', fontSize: '16px', color: GOLD_HEX,
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true }).setDepth(10);

    btn.on('pointerdown', () => this.scene.start('IntroScene'));
    btn.on('pointerover', () => btn.setColor(WHITE_HEX));
    btn.on('pointerout',  () => btn.setColor(GOLD_HEX));
  }

  // ─── 스크롤 ───────────────────────────────────────────────────────────────────

  private registerInput(w: number, h: number) {
    // 마우스 휠
    this.input.on('wheel', (_p: unknown, _go: unknown, _dx: unknown, deltaY: number) => {
      this.applyScroll(deltaY * 0.6);
    });

    // 드래그
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.detailPopup) return;
      this.isDragging  = true;
      this.dragStartY  = p.y;
      this.dragScrollY = this.scrollY;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      this.scrollY = Phaser.Math.Clamp(this.dragScrollY + (this.dragStartY - p.y), 0, this.maxScrollY);
      this.syncScroll();
    });
    this.input.on('pointerup', () => { this.isDragging = false; });

    // 스크롤바
    this.drawScrollbar(w, h);
  }

  private applyScroll(delta: number) {
    this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScrollY);
    this.syncScroll();
  }

  private syncScroll() {
    this.cardContainer?.setY(CARD_AREA_TOP - this.scrollY);
    this.updateScrollThumb();
  }

  private drawScrollbar(w: number, h: number) {
    if (this.maxScrollY <= 0) return;

    const barX   = w - 8;
    const barTop = CARD_AREA_TOP + 4;
    const barH   = h - CARD_AREA_TOP - FOOTER_H - 8;

    const track = this.add.graphics().setDepth(5);
    track.fillStyle(0x333333, 0.5);
    track.fillRoundedRect(barX - 3, barTop, 6, barH, 3);

    this.scrollThumb = this.add.graphics().setDepth(5);
    this.updateScrollThumb();
  }

  private updateScrollThumb() {
    if (!this.scrollThumb || this.maxScrollY <= 0) return;
    const { width, height } = this.scale;
    const barX   = width - 8;
    const barTop = CARD_AREA_TOP + 4;
    const barH   = height - CARD_AREA_TOP - FOOTER_H - 8;
    const visH   = height - CARD_AREA_TOP - FOOTER_H;
    const totalH = this.maxScrollY + visH;
    const thumbH = Math.max(30, barH * (visH / totalH));
    const thumbY = barTop + (this.scrollY / this.maxScrollY) * (barH - thumbH);

    this.scrollThumb.clear();
    this.scrollThumb.fillStyle(GOLD, 0.75);
    this.scrollThumb.fillRoundedRect(barX - 3, thumbY, 6, thumbH, 3);
  }

  // ─── 상세 팝업 ───────────────────────────────────────────────────────────────

  private showDetailPopup(cardData: CardData, w: number, h: number) {
    this.detailPopup?.destroy();
    this.detailPopup = null;

    const popX = Math.round((w - POPUP_W) / 2);
    const popY = Math.round((h - POPUP_H) / 2);

    const popup = this.add.container(popX, popY).setDepth(100);
    this.detailPopup = popup;

    // ── 딤 배경 ──
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.65);
    dim.fillRect(-popX, -popY, w, h);
    dim.setInteractive(new Phaser.Geom.Rectangle(-popX, -popY, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on('pointerdown', () => { this.detailPopup?.destroy(); this.detailPopup = null; });
    popup.add(dim);

    // ── 팝업 배경 ──
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1612, 1);
    bg.fillRoundedRect(0, 0, POPUP_W, POPUP_H, 12);
    bg.lineStyle(2, GOLD, 1);
    bg.strokeRoundedRect(0, 0, POPUP_W, POPUP_H, 12);
    popup.add(bg);

    // ── 카드 미리보기 (top-left = PREVIEW_PAD, 20) ──
    const previewCard = new Card(this, PREVIEW_PAD, 20, cardData);
    previewCard.setScale(PREVIEW_SCALE);
    popup.add(previewCard);

    // ── 우측 정보 컬럼 ──
    const ix = INFO_COL_X;
    let iy = 22;

    // 이름
    popup.add(this.add.text(ix, iy, cardData.name, {
      fontFamily: 'SBAggroB', fontSize: '15px', color: GOLD_HEX,
      wordWrap: { width: INFO_COL_W },
    }));
    iy += 24;

    // 속성
    popup.add(this.add.text(ix, iy, this.elementLabel(cardData.element), {
      fontFamily: 'SBAggroM', fontSize: '12px', color: '#cccccc',
    }));
    iy += 18;

    // 별
    if (cardData.stars > 0) {
      popup.add(this.add.text(ix, iy, '★'.repeat(cardData.stars), {
        fontFamily: 'SBAggroB', fontSize: '13px', color: '#ffe033',
      }));
    } else {
      popup.add(this.add.text(ix, iy, '(등급 없음)', {
        fontFamily: 'SBAggroL', fontSize: '11px', color: DIM_HEX,
      }));
    }
    iy += 22;

    // 능력치 박스
    const statBg = this.add.graphics();
    statBg.fillStyle(0x2a2520, 1);
    statBg.fillRoundedRect(ix - 4, iy, INFO_COL_W + 4, 82, 6);
    popup.add(statBg);
    iy += 8;

    popup.add(this.add.text(ix + 4, iy, [
      `⚔  공격력:  ${cardData.attack}`,
      `🛡  방어력:  ${cardData.defense}`,
      `💠  마나 비용:  ${cardData.cost}`,
    ], {
      fontFamily: 'SBAggroM', fontSize: '12px', color: '#e6d8b8', lineSpacing: 10,
    }));
    iy += 82;

    // 설명 박스
    const descBg = this.add.graphics();
    const descH  = POPUP_H - iy - 12;
    descBg.fillStyle(0x2a2520, 0.7);
    descBg.fillRoundedRect(ix - 4, iy, INFO_COL_W + 4, descH, 6);
    popup.add(descBg);

    popup.add(this.add.text(ix + 4, iy + 6, cardData.description, {
      fontFamily: 'SBAggroL', fontSize: '11px', color: '#cccccc',
      wordWrap: { width: INFO_COL_W - 8 }, lineSpacing: 5,
    }));

    // 닫기 버튼
    const close = this.add.text(POPUP_W - 14, 10, '✕', {
      fontFamily: 'SBAggroB', fontSize: '18px', color: DIM_HEX,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => { this.detailPopup?.destroy(); this.detailPopup = null; });
    close.on('pointerover', () => close.setColor(WHITE_HEX));
    close.on('pointerout',  () => close.setColor(DIM_HEX));
    popup.add(close);
  }

  private elementLabel(el: CardElement | 'all'): string {
    const map: Record<string, string> = {
      water: '💧 물', fire: '🔥 불', grass: '🌿 풀',
      lightning: '⚡ 번개', earth: '🪨 돌', normal: '⚔️ 일반',
    };
    return map[el] ?? el;
  }
}
