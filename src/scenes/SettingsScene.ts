import Phaser from 'phaser';
import { i18n, Language } from '@src/utils/localization';
import '@src/styles/colors.css';

const getCssColor = (varName: string, defaultColor: string) => {
  if (typeof document === 'undefined') return defaultColor;
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || defaultColor;
};
export default class SettingsScene extends Phaser.Scene {
  private settings = {
    language: 'ko' as Language,
    resolution: '1280x720',
    fullscreen: false
  };

  private labels: { [key: string]: Phaser.GameObjects.Text } = {};

  constructor() {
    super('SettingsScene');
  }

  async create() {
    // Electron에서 설정 불러오기
    // @ts-ignore
    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        this.settings = await ipcRenderer.invoke('load-settings');
        i18n.setLanguage(this.settings.language);
      } catch (e) {
        console.error('Settings load failed', e);
      }
    }

    // CSS에서 메인 테마 색상 동적 가져오기
    const primaryColor = getCssColor('--cyber-primary', '#00ffcc');
    const surfaceColor = getCssColor('--cyber-surface', '#333333');
    const successColor = getCssColor('--forest-primary', '#0f4c75');

    // 타이틀 (더 크고 화려하게)
    this.labels['title'] = this.add.text(0, 0, i18n.t('settings'), {
      fontFamily: 'SBAggroB',
      fontSize: '56px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8
    }).setOrigin(0.5);

    // --- 언어 설정 (HTML Select) ---
    this.labels['langLabel'] = this.add.text(0, 0, i18n.t('language'), {
      fontFamily: 'SBAggroM', fontSize: '32px', color: primaryColor
    }).setOrigin(0, 0.5);

    const langHtml = `
      <select id="lang-select" class="settings-select">
        <option value="ko" ${this.settings.language === 'ko' ? 'selected' : ''}>KOREAN</option>
        <option value="en" ${this.settings.language === 'en' ? 'selected' : ''}>ENGLISH</option>
      </select>
    `;

    const langDom = this.add.dom(0, 0).createFromHTML(langHtml).setOrigin(0, 0.5);
    const langSelect = langDom.getChildByID('lang-select') as HTMLSelectElement;
    langSelect.addEventListener('change', (e: any) => {
      this.settings.language = e.target.value;
      i18n.setLanguage(this.settings.language);
      this.updateAllTexts();
    });

    // --- 해상도 설정 (HTML Select 태그) ---
    this.labels['resLabel'] = this.add.text(0, 0, i18n.t('resolution'), {
      fontFamily: 'SBAggroM', fontSize: '32px', color: primaryColor
    }).setOrigin(0, 0.5);

    const resOptions = [
      '1024x576',
      '1280x720',
      '1366x768',
      '1600x900',
      '1920x1080',
      '2560x1440',
      '3840x2160'
    ];
    
    // Select 태그 생성 (HTML + CSS)
    const resHtml = `
      <select id="res-select" class="settings-select">
        ${resOptions.map(res => `<option value="${res}" ${this.settings.resolution === res ? 'selected' : ''}>${res}</option>`).join('')}
      </select>
    `;

    const resDom = this.add.dom(0, 0).createFromHTML(resHtml).setOrigin(0, 0.5);
    const resSelect = resDom.getChildByID('res-select') as HTMLSelectElement;
    resSelect.addEventListener('change', (e: any) => {
      this.settings.resolution = e.target.value;
    });

    // --- 전체화면 설정 (HTML Checkbox) ---
    this.labels['fsLabel'] = this.add.text(0, 0, i18n.t('fullscreen'), {
      fontFamily: 'SBAggroM', fontSize: '32px', color: primaryColor
    }).setOrigin(0, 0.5);

    const fsHtml = `
      <input type="checkbox" id="fs-checkbox" class="settings-checkbox" ${this.settings.fullscreen ? 'checked' : ''} />
    `;

    const fsDom = this.add.dom(0, 0).createFromHTML(fsHtml).setOrigin(0, 0.5);
    const fsCheckbox = fsDom.getChildByID('fs-checkbox') as HTMLInputElement;
    fsCheckbox.addEventListener('change', (e: any) => {
      this.settings.fullscreen = e.target.checked;
    });

    // --- 하단 액션 버튼 ---
    const applyBtn = this.add.text(0, 0, i18n.t('apply'), {
      fontFamily: 'SBAggroM', fontSize: '32px', backgroundColor: successColor, padding: { x: 40, y: 15 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    applyBtn.on('pointerdown', async () => {
      // @ts-ignore
      if (typeof require !== 'undefined') {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('save-settings', this.settings);
        ipcRenderer.send('apply-settings', this.settings);
      }
      // 해상도 변경 후 UI 재배치를 위해 약간의 시간차를 둠
      this.time.delayedCall(100, () => updateLayout());
    });

    const backBtn = this.add.text(0, 0, i18n.t('back'), {
      fontFamily: 'SBAggroM', fontSize: '32px', backgroundColor: surfaceColor, padding: { x: 40, y: 15 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => this.scene.start('IntroScene'));

    const updateLayout = () => {
      const { width, height } = this.scale;
      const menuWidth = Math.min(width * 0.8, 800);
      const menuStartX = (width - menuWidth) / 2;
      const valueEndX = menuStartX + menuWidth;
      const startY = height * 0.35;
      const spacingY = 100;

      this.labels['title'].setPosition(width / 2, 80);
      
      // 언어 레이아웃
      this.labels['langLabel'].setPosition(menuStartX, startY);
      langDom.setPosition(valueEndX, startY).setOrigin(1, 0.5);

      // 해상도 레이아웃
      this.labels['resLabel'].setPosition(menuStartX, startY + spacingY);
      resDom.setPosition(valueEndX, startY + spacingY).setOrigin(1, 0.5);

      // 전체화면 레이아웃
      this.labels['fsLabel'].setPosition(menuStartX, startY + spacingY * 2);
      fsDom.setPosition(valueEndX, startY + spacingY * 2).setOrigin(1, 0.5);

      applyBtn.setPosition(width / 2 - 120, height - 100);
      backBtn.setPosition(width / 2 + 120, height - 100);
    };

    updateLayout();
    this.scale.on('resize', updateLayout);
    this.events.once('shutdown', () => {
      this.scale.off('resize', updateLayout);
    });

    this.labels['applyBtn'] = applyBtn;
    this.labels['backBtn'] = backBtn;
  }

  private updateAllTexts() {
    this.labels['title']?.setText(i18n.t('settings'));
    this.labels['langLabel']?.setText(i18n.t('language'));
    this.labels['resLabel']?.setText(i18n.t('resolution'));
    this.labels['fsLabel']?.setText(i18n.t('fullscreen'));
    this.labels['applyBtn']?.setText(i18n.t('apply'));
    this.labels['backBtn']?.setText(i18n.t('back'));
    this.labels['fsBtn']?.setText(this.settings.fullscreen ? i18n.t('on') : i18n.t('off'));
  }
}
