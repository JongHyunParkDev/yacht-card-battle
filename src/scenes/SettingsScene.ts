import Phaser from 'phaser';
import { i18n, Language } from '@src/utils/localization';
import '@src/styles/colors.css';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface GameSettings {
  language: Language;
  resolution: string;
  fullscreen: boolean;
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

const getCssColor = (varName: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
};

const DEFAULT_SETTINGS: GameSettings = {
  language: 'ko',
  resolution: '1280x720',
  fullscreen: false,
};

const RESOLUTION_OPTIONS = [
  '1024x576',
  '1280x720',
  '1366x768',
  '1600x900',
  '1920x1080',
  '2560x1440',
  '3840x2160',
];

// ─── 씬 ───────────────────────────────────────────────────────────────────────

export default class SettingsScene extends Phaser.Scene {
  /** 현재 편집 중인 설정 (변경 내용 추적) */
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  /** 씬 진입 시 저장된 원본 설정 (취소 시 복원용) */
  private originalSettings: GameSettings = { ...DEFAULT_SETTINGS };

  private labels: Record<string, Phaser.GameObjects.Text> = {};

  constructor() {
    super('SettingsScene');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Phaser 라이프사이클
  // ─────────────────────────────────────────────────────────────────────────────

  async create() {
    await this.loadSettings();

    const primaryColor = getCssColor('--medieval-primary', '#d4af37');
    const surfaceColor = getCssColor('--medieval-surface', '#2c1e16');
    const accentColor  = getCssColor('--medieval-accent',  '#8b0000');
    const textColor    = getCssColor('--medieval-text',    '#e6d8b8');

    // ── 타이틀 ────────────────────────────────────────────────────────────────
    this.labels['title'] = this.add.text(0, 0, i18n.t('settings'), {
      fontFamily: 'SBAggroB',
      fontSize: '56px',
      color: primaryColor,
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5);

    // ── 언어 선택 ─────────────────────────────────────────────────────────────
    this.labels['langLabel'] = this.add.text(0, 0, i18n.t('language'), {
      fontFamily: 'SBAggroM', fontSize: '32px', color: primaryColor,
    }).setOrigin(0, 0.5);

    const langHtml = `
      <select id="lang-select" class="settings-select">
        <option value="ko" ${this.settings.language === 'ko' ? 'selected' : ''}>KOREAN</option>
        <option value="en" ${this.settings.language === 'en' ? 'selected' : ''}>ENGLISH</option>
      </select>
    `;
    const langDom    = this.add.dom(0, 0).createFromHTML(langHtml).setOrigin(0, 0.5);
    const langSelect = langDom.getChildByID('lang-select') as HTMLSelectElement;

    langSelect.addEventListener('change', (e: Event) => {
      this.settings.language = (e.target as HTMLSelectElement).value as Language;
      i18n.setLanguage(this.settings.language);
      this.updateAllTexts();
    });

    // ── 해상도 선택 ───────────────────────────────────────────────────────────
    this.labels['resLabel'] = this.add.text(0, 0, i18n.t('resolution'), {
      fontFamily: 'SBAggroM', fontSize: '32px', color: primaryColor,
    }).setOrigin(0, 0.5);

    const resHtml = `
      <select id="res-select" class="settings-select">
        ${RESOLUTION_OPTIONS.map(res =>
          `<option value="${res}" ${this.settings.resolution === res ? 'selected' : ''}>${res}</option>`
        ).join('')}
      </select>
    `;
    const resDom    = this.add.dom(0, 0).createFromHTML(resHtml).setOrigin(0, 0.5);
    const resSelect = resDom.getChildByID('res-select') as HTMLSelectElement;

    resSelect.addEventListener('change', (e: Event) => {
      this.settings.resolution = (e.target as HTMLSelectElement).value;
      // 해상도 변경을 즉시 창에 적용 (저장은 하지 않음)
      this.applyWindowSettings({ ...this.settings });
    });

    // ── 전체화면 체크박스 ─────────────────────────────────────────────────────
    this.labels['fsLabel'] = this.add.text(0, 0, i18n.t('fullscreen'), {
      fontFamily: 'SBAggroM', fontSize: '32px', color: primaryColor,
    }).setOrigin(0, 0.5);

    const fsHtml = `
      <input type="checkbox" id="fs-checkbox" class="settings-checkbox" ${this.settings.fullscreen ? 'checked' : ''} />
    `;
    const fsDom      = this.add.dom(0, 0).createFromHTML(fsHtml).setOrigin(0, 0.5);
    const fsCheckbox = fsDom.getChildByID('fs-checkbox') as HTMLInputElement;

    fsCheckbox.addEventListener('change', (e: Event) => {
      this.settings.fullscreen = (e.target as HTMLInputElement).checked;
      // 전체화면 상태 변경을 즉시 창에 적용 (저장은 하지 않음)
      this.applyWindowSettings({ ...this.settings });
    });

    // ── 적용 버튼 ─────────────────────────────────────────────────────────────
    const applyBtn = this.add.text(0, 0, i18n.t('apply'), {
      fontFamily: 'SBAggroM', fontSize: '32px',
      backgroundColor: accentColor, color: textColor,
      padding: { x: 40, y: 15 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    applyBtn.on('pointerover', () => applyBtn.setAlpha(0.8));
    applyBtn.on('pointerout',  () => applyBtn.setAlpha(1));
    applyBtn.on('pointerdown', async () => {
      await this.saveSettings(this.settings);
      this.applyWindowSettings(this.settings);
      this.scene.start('IntroScene');
    });

    // ── 취소 버튼 ─────────────────────────────────────────────────────────────
    const cancelBtn = this.add.text(0, 0, i18n.t('cancel'), {
      fontFamily: 'SBAggroM', fontSize: '32px',
      backgroundColor: surfaceColor, color: textColor,
      padding: { x: 40, y: 15 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    cancelBtn.on('pointerover', () => cancelBtn.setAlpha(0.8));
    cancelBtn.on('pointerout',  () => cancelBtn.setAlpha(1));
    cancelBtn.on('pointerdown', () => {
      // 변경 사항을 버리고 원본 설정으로 창 복원
      this.applyWindowSettings(this.originalSettings);
      i18n.setLanguage(this.originalSettings.language);
      this.scene.start('IntroScene');
    });

    this.labels['applyBtn']  = applyBtn;
    this.labels['cancelBtn'] = cancelBtn;

    // ── 레이아웃 ──────────────────────────────────────────────────────────────
    const updateLayout = () => {
      const { width, height } = this.scale;
      const menuWidth  = Math.min(width * 0.8, 800);
      const menuStartX = (width - menuWidth) / 2;
      const valueEndX  = menuStartX + menuWidth;
      const startY     = height * 0.35;
      const spacingY   = 100;

      this.labels['title'].setPosition(width / 2, 80);

      this.labels['langLabel'].setPosition(menuStartX, startY);
      langDom.setPosition(valueEndX, startY).setOrigin(1, 0.5);

      this.labels['resLabel'].setPosition(menuStartX, startY + spacingY);
      resDom.setPosition(valueEndX, startY + spacingY).setOrigin(1, 0.5);

      this.labels['fsLabel'].setPosition(menuStartX, startY + spacingY * 2);
      fsDom.setPosition(valueEndX, startY + spacingY * 2).setOrigin(1, 0.5);

      applyBtn.setPosition(width / 2 - 120, height - 100);
      cancelBtn.setPosition(width / 2 + 120, height - 100);
    };

    updateLayout();
    this.scale.on('resize', updateLayout);
    this.events.once('shutdown', () => this.scale.off('resize', updateLayout));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 내부 메서드
  // ─────────────────────────────────────────────────────────────────────────────

  /** Electron에서 설정을 로드하고 원본 백업 */
  private async loadSettings() {
    // @ts-ignore
    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        const loaded = await ipcRenderer.invoke('load-settings');
        this.settings = { ...DEFAULT_SETTINGS, ...loaded };
      } catch (e) {
        console.error('Settings load failed', e);
        this.settings = { ...DEFAULT_SETTINGS };
      }
    }
    // 원본 설정 백업 (취소 시 복원용)
    this.originalSettings = { ...this.settings };
    // 현재 언어 적용
    i18n.setLanguage(this.settings.language);
  }

  /** Electron으로 설정을 저장 */
  private async saveSettings(settings: GameSettings): Promise<void> {
    // @ts-ignore
    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('save-settings', settings);
      } catch (e) {
        console.error('Settings save failed', e);
      }
    }
  }

  /** Electron에 창 크기/전체화면 즉시 적용 요청 */
  private applyWindowSettings(settings: GameSettings): void {
    // @ts-ignore
    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('apply-settings', settings);
      } catch (e) {
        console.error('apply-settings failed', e);
      }
    }
  }

  /** 언어 변경 시 모든 텍스트 일괄 갱신 */
  private updateAllTexts() {
    this.labels['title']?.setText(i18n.t('settings'));
    this.labels['langLabel']?.setText(i18n.t('language'));
    this.labels['resLabel']?.setText(i18n.t('resolution'));
    this.labels['fsLabel']?.setText(i18n.t('fullscreen'));
    this.labels['applyBtn']?.setText(i18n.t('apply'));
    this.labels['cancelBtn']?.setText(i18n.t('cancel'));
  }
}
