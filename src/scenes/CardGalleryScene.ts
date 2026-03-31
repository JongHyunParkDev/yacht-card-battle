import Phaser from 'phaser';
import Card, { CARD_WIDTH, CARD_HEIGHT } from '@src/objects/Card';
import { CARD_DATA_LIST, CardData, CardElement } from '@src/data/cardData';
import { i18n } from '@src/utils/localization';

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

const TABS: { labelKey: string; element: CardElement | 'all' }[] = [
  { labelKey: 'tabAll',       element: 'all' },
  { labelKey: 'tabWater',     element: 'water' },
  { labelKey: 'tabFire',      element: 'fire' },
  { labelKey: 'tabGrass',     element: 'grass' },
  { labelKey: 'tabLightning', element: 'lightning' },
  { labelKey: 'tabEarth',     element: 'earth' },
  { labelKey: 'tabNormal',    element: 'normal' },
];

// ─── 팝업 레이아웃 상수 ───────────────────────────────────────────────────────

const POPUP_W        = 660;
const POPUP_H        = 480;
/** 팝업 내 카드 미리보기 스케일 */
const PREVIEW_SCALE  = 1.7;
/** 팝업 내 카드 왼쪽 여백 */
const PREVIEW_PAD    = 24;
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

  private tabBg!: Phaser.GameObjects.Graphics;
  private tabTextObjs: Phaser.GameObjects.Text[] = [];
  private maskGfx!: Phaser.GameObjects.Graphics;

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

    this.add.text(w / 2, 27, i18n.t('cardGallery'), {
      fontFamily: 'SBAggroB', fontSize: '22px', color: GOLD_HEX,
    }).setOrigin(0.5);
  }

  private drawTabs(w: number) {
    const tabY  = 82;
    const tabW  = Math.min(108, (w - 40) / TABS.length);
    const totalW = tabW * TABS.length;
    const startX = (w - totalW) / 2;

    this.tabBg = this.add.graphics();
    this.tabTextObjs = [];

    TABS.forEach((tab, idx) => {
      const tx       = startX + idx * tabW + tabW / 2;
      const isActive = tab.element === this.activeTab;

      this.tabBg.fillStyle(isActive ? GOLD : 0x2a2520, 1);
      this.tabBg.fillRoundedRect(startX + idx * tabW + 2, tabY - 14, tabW - 4, 28, 5);

      const btn = this.add.text(tx, tabY, i18n.t(tab.labelKey), {
        fontFamily: 'SBAggroM', fontSize: '11px',
        color: isActive ? '#000000' : DIM_HEX,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        if (tab.element === this.activeTab) return;
        this.activeTab = tab.element;
        this.scrollY = 0;
        this.refreshTabs(w);
        this.rebuildCards(w, this.scale.height);
      });
      btn.on('pointerover', () => { if (tab.element !== this.activeTab) btn.setColor(WHITE_HEX); });
      btn.on('pointerout',  () => { if (tab.element !== this.activeTab) btn.setColor(DIM_HEX); });

      this.tabTextObjs.push(btn);
    });
  }

  /** 탭 배경만 다시 그리기 */
  private refreshTabs(w: number) {
    const tabY   = 82;
    const tabW   = Math.min(108, (w - 40) / TABS.length);
    const totalW = tabW * TABS.length;
    const startX = (w - totalW) / 2;

    this.tabBg.clear();

    TABS.forEach((tab, idx) => {
      const isActive = tab.element === this.activeTab;

      this.tabBg.fillStyle(isActive ? GOLD : 0x2a2520, 1);
      this.tabBg.fillRoundedRect(startX + idx * tabW + 2, tabY - 14, tabW - 4, 28, 5);

      const btn = this.tabTextObjs[idx];
      if (btn) {
        btn.setColor(isActive ? '#000000' : DIM_HEX);
      }
    });
  }

  /** 카드 영역만 재구성 */
  private rebuildCards(w: number, h: number) {
    this.cardContainer?.destroy();
    this.maskGfx?.destroy();
    this.scrollThumb?.destroy();
    this.buildCards(w, h);
    this.drawScrollbar(w, h);
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

    // 카드 영역 클리핑 마스크 (setVisible(false)로 화면에 노출 안 됨)
    this.maskGfx = this.add.graphics().setVisible(false);
    this.maskGfx.fillStyle(0xffffff, 1);
    this.maskGfx.fillRect(0, CARD_AREA_TOP, w, visibleH);
    this.cardContainer.setMask(this.maskGfx.createGeometryMask());
  }

  private drawBackButton(w: number, h: number) {
    const btn = this.add.text(w - 20, h - 20, '← ' + i18n.t('back'), {
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
    
    const popX = Math.round(w / 2);
    const popY = Math.round(h / 2);

    const popup = this.add.container(popX, popY).setDepth(100);
    this.detailPopup = popup;

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.85);
    dim.fillRect(-popX, -popY, w, h);
    dim.setInteractive(new Phaser.Geom.Rectangle(-popX, -popY, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on('pointerdown', () => { this.detailPopup?.destroy(); this.detailPopup = null; });
    popup.add(dim);

    const PREVIEW_SCALE = 2.2;
    // Container는 기준이 좌상단이므로, 카드의 중심이 popX, popY에 오도록 x,y 이동
    const previewCard = new Card(this, (-CARD_WIDTH / 2) * PREVIEW_SCALE, (-CARD_HEIGHT / 2) * PREVIEW_SCALE, cardData);
    previewCard.setScale(PREVIEW_SCALE);
    popup.add(previewCard);

    // 닫기 안내 텍스트
    const close = this.add.text(0, (CARD_HEIGHT / 2) * PREVIEW_SCALE + 30, '닫기 (여백 클릭)', {
      fontFamily: 'SBAggroM', fontSize: '18px', color: '#aaaaaa',
    }).setOrigin(0.5);
    popup.add(close);
    
    // 약간의 등장 애니메이션
    popup.setScale(0.8);
    popup.setAlpha(0);
    this.tweens.add({ targets: popup, scale: 1, alpha: 1, duration: 250, ease: 'Back.easeOut' });
  }

  private elementLabel(el: CardElement | 'all'): string {
    const keyMap: Record<string, string> = {
      water: 'tabWater', fire: 'tabFire', grass: 'tabGrass',
      lightning: 'tabLightning', earth: 'tabEarth', normal: 'tabNormal',
    };
    return keyMap[el] ? i18n.t(keyMap[el]) : el;
  }
}
