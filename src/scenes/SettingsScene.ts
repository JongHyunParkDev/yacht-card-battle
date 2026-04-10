import Phaser from 'phaser';
import { i18n, Language } from '@src/utils/localization';
import { AudioManager } from '@src/utils/Audio';
import '@src/styles/colors.css';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface GameSettings {
  language:   Language;
  resolution: string;
  fullscreen: boolean;
  bgmVolume:  number; // 0~100
  sfxVolume:  number; // 0~100
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

const getCssColor = (varName: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
};

const DEFAULT_SETTINGS: GameSettings = {
  language:   'ko',
  resolution: '1280x720',
  fullscreen: false,
  bgmVolume:  20,
  sfxVolume:  90,
};

const RESOLUTION_OPTIONS = [
  '1024x576', '1280x720', '1366x768',
  '1600x900', '1920x1080', '2560x1440', '3840x2160',
];

// ─── 씬 ───────────────────────────────────────────────────────────────────────

export default class SettingsScene extends Phaser.Scene {
  private settings:         GameSettings = { ...DEFAULT_SETTINGS };
  private originalSettings: GameSettings = { ...DEFAULT_SETTINGS };
  private labels: Record<string, Phaser.GameObjects.Text | Phaser.GameObjects.GameObject> = {};

  constructor() { super('SettingsScene'); }

  // ─────────────────────────────────────────────────────────────────────────────

  async create() {
    await this.loadSettings();

    const primaryColor = getCssColor('--medieval-primary', '#d4af37');
    const surfaceColor = getCssColor('--medieval-surface', '#2c1e16');
    const accentColor  = getCssColor('--medieval-accent',  '#8b0000');
    const textColor    = getCssColor('--medieval-text',    '#e6d8b8');

    // 배경 오버레이
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0e14, 0.92);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);

    // ── 타이틀 ────────────────────────────────────────────────────────────────
    this.labels['title'] = this.add.text(0, 0, i18n.t('settings'), {
      fontFamily: 'SBAggroB', fontSize: '52px',
      color: primaryColor, stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5);

    // ── 언어 ─────────────────────────────────────────────────────────────────
    this.labels['langLabel'] = this.add.text(0, 0, i18n.t('language'), {
      fontFamily: 'SBAggroM', fontSize: '28px', color: primaryColor,
    }).setOrigin(0, 0.5);

    const langHtml = `
      <select id="lang-select" class="settings-select">
        <option value="ko" ${this.settings.language === 'ko' ? 'selected' : ''}>${i18n.t('langKorean')}</option>
        <option value="en" ${this.settings.language === 'en' ? 'selected' : ''}>${i18n.t('langEnglish')}</option>
      </select>`;
    const langDom    = this.add.dom(0, 0).createFromHTML(langHtml).setOrigin(0, 0.5);
    const langSelect = langDom.getChildByID('lang-select') as HTMLSelectElement;
    langSelect.addEventListener('change', (e) => {
      this.settings.language = (e.target as HTMLSelectElement).value as Language;
      i18n.setLanguage(this.settings.language);
      this.updateAllTexts();
    });

    // ── 해상도 ───────────────────────────────────────────────────────────────
    this.labels['resLabel'] = this.add.text(0, 0, i18n.t('resolution'), {
      fontFamily: 'SBAggroM', fontSize: '28px', color: primaryColor,
    }).setOrigin(0, 0.5);

    const resHtml = `
      <select id="res-select" class="settings-select">
        ${RESOLUTION_OPTIONS.map(r => `<option value="${r}" ${this.settings.resolution === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select>`;
    const resDom    = this.add.dom(0, 0).createFromHTML(resHtml).setOrigin(0, 0.5);
    const resSelect = resDom.getChildByID('res-select') as HTMLSelectElement;
    resSelect.addEventListener('change', (e) => {
      this.settings.resolution = (e.target as HTMLSelectElement).value;
      this.applyWindowSettings({ ...this.settings });
    });

    // ── 전체화면 ─────────────────────────────────────────────────────────────
    this.labels['fsLabel'] = this.add.text(0, 0, i18n.t('fullscreen'), {
      fontFamily: 'SBAggroM', fontSize: '28px', color: primaryColor,
    }).setOrigin(0, 0.5);

    const fsHtml = `<input type="checkbox" id="fs-checkbox" class="settings-checkbox" ${this.settings.fullscreen ? 'checked' : ''} />`;
    const fsDom      = this.add.dom(0, 0).createFromHTML(fsHtml).setOrigin(0, 0.5);
    const fsCheckbox = fsDom.getChildByID('fs-checkbox') as HTMLInputElement;
    fsCheckbox.addEventListener('change', (e) => {
      this.settings.fullscreen = (e.target as HTMLInputElement).checked;
      this.applyWindowSettings({ ...this.settings });
    });

    // ── BGM 볼륨 슬라이더 ─────────────────────────────────────────────────────
    this.labels['bgmLabel'] = this.add.text(0, 0, i18n.t('bgmVolume'), {
      fontFamily: 'SBAggroM', fontSize: '28px', color: primaryColor,
    }).setOrigin(0, 0.5);

    const bgmValTxt = this.add.text(0, 0, String(this.settings.bgmVolume), {
      fontFamily: 'SBAggroB', fontSize: '22px', color: textColor,
    }).setOrigin(0.5);
    this.labels['bgmVal'] = bgmValTxt;

    const bgmHtml = `
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="range" id="bgm-slider" min="0" max="100" value="${this.settings.bgmVolume}"
          style="width:200px;accent-color:#d4af37;cursor:pointer;" />
      </div>`;
    const bgmDom    = this.add.dom(0, 0).createFromHTML(bgmHtml).setOrigin(0, 0.5);
    const bgmSlider = bgmDom.getChildByID('bgm-slider') as HTMLInputElement;
    bgmSlider.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      this.settings.bgmVolume = v;
      bgmValTxt.setText(String(v));
      AudioManager.setBgmVolume(v, this);
    });

    // ── SFX 볼륨 슬라이더 ─────────────────────────────────────────────────────
    this.labels['sfxLabel'] = this.add.text(0, 0, i18n.t('sfxVolume'), {
      fontFamily: 'SBAggroM', fontSize: '28px', color: primaryColor,
    }).setOrigin(0, 0.5);

    const sfxValTxt = this.add.text(0, 0, String(this.settings.sfxVolume), {
      fontFamily: 'SBAggroB', fontSize: '22px', color: textColor,
    }).setOrigin(0.5);
    this.labels['sfxVal'] = sfxValTxt;

    const sfxHtml = `
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="range" id="sfx-slider" min="0" max="100" value="${this.settings.sfxVolume}"
          style="width:200px;accent-color:#d4af37;cursor:pointer;" />
      </div>`;
    const sfxDom    = this.add.dom(0, 0).createFromHTML(sfxHtml).setOrigin(0, 0.5);
    const sfxSlider = sfxDom.getChildByID('sfx-slider') as HTMLInputElement;
    sfxSlider.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      this.settings.sfxVolume = v;
      sfxValTxt.setText(String(v));
      AudioManager.setSfxVolume(v);
      // 미리 듣기
      this.time.delayedCall(50, () => AudioManager.play('CLICK'));
    });

    // ── 적용/취소 버튼 ───────────────────────────────────────────────────────
    const applyBtn = this.add.text(0, 0, i18n.t('apply'), {
      fontFamily: 'SBAggroM', fontSize: '30px',
      backgroundColor: accentColor, color: textColor, padding: { x: 40, y: 14 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    applyBtn.on('pointerover', () => applyBtn.setAlpha(0.8));
    applyBtn.on('pointerout',  () => applyBtn.setAlpha(1));
    applyBtn.on('pointerdown', async () => {
      AudioManager.play('CLICK');
      await this.saveSettings(this.settings);
      this.applyWindowSettings(this.settings);
      this.scene.start('IntroScene');
    });

    const cancelBtn = this.add.text(0, 0, i18n.t('cancel'), {
      fontFamily: 'SBAggroM', fontSize: '30px',
      backgroundColor: surfaceColor, color: textColor, padding: { x: 40, y: 14 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerover', () => cancelBtn.setAlpha(0.8));
    cancelBtn.on('pointerout',  () => cancelBtn.setAlpha(1));
    cancelBtn.on('pointerdown', () => {
      AudioManager.play('CLICK');
      // 원본 볼륨 복원
      AudioManager.setBgmVolume(this.originalSettings.bgmVolume, this);
      AudioManager.setSfxVolume(this.originalSettings.sfxVolume);
      this.applyWindowSettings(this.originalSettings);
      i18n.setLanguage(this.originalSettings.language);
      this.scene.start('IntroScene');
    });

    this.labels['applyBtn']  = applyBtn;
    this.labels['cancelBtn'] = cancelBtn;

    // ── 레이아웃 ──────────────────────────────────────────────────────────────
    const ROWS = [
      { label: 'langLabel', ctrl: langDom, val: null },
      { label: 'resLabel',  ctrl: resDom,  val: null },
      { label: 'fsLabel',   ctrl: fsDom,   val: null },
      { label: 'bgmLabel',  ctrl: bgmDom,  val: bgmValTxt },
      { label: 'sfxLabel',  ctrl: sfxDom,  val: sfxValTxt },
    ];

    const updateLayout = () => {
      const { width, height } = this.scale;
      bg.clear();
      bg.fillStyle(0x0a0e14, 0.92);
      bg.fillRect(0, 0, width, height);

      const menuW    = Math.min(width * 0.82, 820);
      const startX   = (width - menuW) / 2;
      const valueX   = startX + menuW;        // 우측 끝 (DOM origin 1)
      const valNumX  = valueX - 220;          // 숫자 표시 위치 (슬라이더 왼쪽)
      const startY   = height * 0.22;
      const spacingY = Math.min(82, (height * 0.62) / ROWS.length);

      (this.labels['title'] as Phaser.GameObjects.Text).setPosition(width / 2, height * 0.10);

      ROWS.forEach(({ label, ctrl, val }, i) => {
        const y = startY + i * spacingY;
        (this.labels[label] as Phaser.GameObjects.Text).setPosition(startX, y);
        ctrl.setPosition(valueX, y).setOrigin(1, 0.5);
        if (val) val.setPosition(valNumX - 16, y);
      });

      applyBtn.setPosition(width / 2 - 110, height - 68);
      cancelBtn.setPosition(width / 2 + 110, height - 68);
    };

    updateLayout();
    this.scale.on('resize', updateLayout);
    this.events.once('shutdown', () => this.scale.off('resize', updateLayout));
  }

  // ─────────────────────────────────────────────────────────────────────────────

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
    this.originalSettings = { ...this.settings };
    i18n.setLanguage(this.settings.language);
    AudioManager.setBgmVolume(this.settings.bgmVolume);
    AudioManager.setSfxVolume(this.settings.sfxVolume);
  }

  private async saveSettings(s: GameSettings): Promise<void> {
    // @ts-ignore
    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('save-settings', s);
      } catch (e) {
        console.error('Settings save failed', e);
      }
    }
  }

  private applyWindowSettings(s: GameSettings): void {
    // @ts-ignore
    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('apply-settings', s);
      } catch (e) {
        console.error('apply-settings failed', e);
      }
    }
  }

  private updateAllTexts() {
    (this.labels['title']     as Phaser.GameObjects.Text)?.setText(i18n.t('settings'));
    (this.labels['langLabel'] as Phaser.GameObjects.Text)?.setText(i18n.t('language'));
    (this.labels['resLabel']  as Phaser.GameObjects.Text)?.setText(i18n.t('resolution'));
    (this.labels['fsLabel']   as Phaser.GameObjects.Text)?.setText(i18n.t('fullscreen'));
    (this.labels['bgmLabel']  as Phaser.GameObjects.Text)?.setText(i18n.t('bgmVolume'));
    (this.labels['sfxLabel']  as Phaser.GameObjects.Text)?.setText(i18n.t('sfxVolume'));
    (this.labels['applyBtn']  as Phaser.GameObjects.Text)?.setText(i18n.t('apply'));
    (this.labels['cancelBtn'] as Phaser.GameObjects.Text)?.setText(i18n.t('cancel'));
  }
}
