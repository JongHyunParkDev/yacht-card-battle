import Phaser from 'phaser';
import { addFullscreenBackground, setResponsiveScale } from '@src/utils/sceneUtils';
import { i18n } from '@src/utils/localization';
import '@src/styles/colors.css';

const getCssColor = (varName: string, defaultColor: string) => {
  if (typeof document === 'undefined') return defaultColor;
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || defaultColor;
};
export default class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');
  }

  async create() {
    // 1. 가장 뒷 배경 (공통 유틸 사용)
    addFullscreenBackground(this, 'bg1');

    // Electron에서 설정 불러와서 언어 적용
    // @ts-ignore
    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        const settings = await ipcRenderer.invoke('load-settings');
        i18n.setLanguage(settings.language);
      } catch (e) {
        console.error('설정 로드 실패:', e);
      }
    }

    // CSS 테마 연결
    const primaryColor = getCssColor('--medieval-primary', '#d4af37'); 
    const textColor = getCssColor('--medieval-text', '#e6d8b8');
    const disabledColor = '#705c44'; // 어두운 금색/구리 느낌
    const hoverColor = '#ffdb58'; // 밝은 금색

    // 2. 캐릭터 이미지 생성
    const character = this.add.image(0, 0, 'bg2').setOrigin(1, 1);

    // 3. 타이틀 텍스트
    const title = this.add.text(100, 0, 'CB Tower', {
      fontFamily: 'SBAggroB',
      fontSize: '64px',
      color: primaryColor,
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0, 0.5);

    // 버튼들을 담을 배열
    const buttons: Phaser.GameObjects.Text[] = [];

    // 레이아웃 업데이트 함수 (리사이즈 시 호출)
    const updateLayout = () => {
      const { width, height } = this.scale;

      // 캐릭터 반응형 크기 조절 (화면 높이의 80%)
      setResponsiveScale(character, 0.8);
      
      // 우측 하단 여백 계산 (패럴랙용 여유 공간 포함)
      const maxBg2OffsetX = (width / 2) * 0.04;
      const maxBg2OffsetY = (height / 2) * 0.04;
      character.setPosition(width + maxBg2OffsetX, height + maxBg2OffsetY);

      // 타이틀 위치 조정
      title.setY(height / 2 - 150);

      // 버튼들 위치 조정
      buttons.forEach((btn, index) => {
        btn.setPosition(100, height / 2 + (index * 80));
      });
    };

    // Button Style Helper (내부 사용)
    const createButton = (text: string, onClick: () => void, enabled: boolean = true) => {
      const button = this.add.text(100, 0, text, {
        fontFamily: 'SBAggroM',
        fontSize: '32px',
        color: enabled ? textColor : disabledColor, // 비활성화 시 어두운 톤
        fixedWidth: 300,
      }).setOrigin(0, 0.5);

      if (enabled) {
        button.setInteractive({ useHandCursor: true });
        // 애니메이션 및 이벤트
        button.on('pointerover', () => {
          button.setColor(hoverColor).setScale(1.05);
          this.add.tween({ targets: button, x: 110, duration: 100, ease: 'Power1' });
        });
        button.on('pointerout', () => {
          button.setColor(textColor).setScale(1).setX(100);
        });
        button.on('pointerdown', () => {
          button.setScale(0.95);
          onClick();
        });
        button.on('pointerup', () => button.setScale(1.05));
      } else {
        // 비활성화 텍스트
        button.setText(text + ` (${i18n.t('none')})`);
      }

      buttons.push(button);
      return button;
    };

    // 일렉트론 환경에서 세이브 파일 존재 여부 확인 후 버튼 생성
    const initButtons = async () => {
      let hasSaveFile = false;
      
      // @ts-ignore
      if (typeof require !== 'undefined') {
        try {
          const { ipcRenderer } = require('electron');
          hasSaveFile = await ipcRenderer.invoke('check-save-file');
        } catch (e) {
          console.error('세이브 파일 체크 실패:', e);
        }
      }

      // 1. 새로하기
      createButton(i18n.t('newGame'), () => {
        this.scene.start('MainScene');
      });

      // 2. 이어하기 (조건부 활성화)
      createButton(i18n.t('continue'), () => {
        this.scene.start('MainScene', { isContinue: true });
      }, hasSaveFile);

      // 3. 설정
      createButton(i18n.t('settings'), () => {
        this.scene.start('SettingsScene');
      });

      // 4. 게임 종료
      createButton(i18n.t('exit'), () => {
        if (typeof window !== 'undefined' && window.close) window.close();
      });

      updateLayout();
    };

    // 패럴랙스 효과 (실시간 화면 크기 반영)
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const { width, height } = this.scale;
      const offsetX = pointer.x - width / 2;
      const offsetY = pointer.y - height / 2;

      const maxBg2OffsetX = (width / 2) * 0.04;
      const maxBg2OffsetY = (height / 2) * 0.04;
      
      // 캐릭터 실시간 위치 보정
      character.setPosition(
        (width + maxBg2OffsetX) - offsetX * 0.04, 
        (height + maxBg2OffsetY) - offsetY * 0.04
      );
    });

    // 초기 실행
    initButtons();
    this.scale.on('resize', updateLayout);
    
    // 씬 종료 시 이벤트 해제
    this.events.once('shutdown', () => {
      this.scale.off('resize', updateLayout);
    });
  }
}
