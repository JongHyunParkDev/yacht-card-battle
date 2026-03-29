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

    this.cameras.main.fadeIn(250, 0, 0, 0);

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

    // 씬 전환 헬퍼 (fadeOut 후 전환)
    const goScene = (key: string, data?: object) => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(key, data);
      });
    };

    // 레거시 패널 참조 + 크기 (updateLayout에서 위치 갱신용)
    let legacyPanel: Phaser.GameObjects.Container | null = null;
    let legacyPanelW = 280;
    let legacyPanelH = 0;

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
      const spacing = buttons.length > 0
        ? Math.min(80, (height * 0.45) / buttons.length)
        : 80;
      buttons.forEach((btn, index) => {
        btn.setPosition(100, height / 2 + (index * spacing));
      });

      // 레거시 패널 위치 갱신 (우측 하단)
      if (legacyPanel) legacyPanel.setPosition(width - legacyPanelW - 16, height - legacyPanelH - 16);
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

    // 레거시 패널 (누적 골드 + 장비 컬렉션) — 우측 하단 고정
    const buildLegacyPanel = (totalGold: number, allEquipment: string[]) => {
      if (legacyPanel) legacyPanel.destroy();

      const ICON  = 20;   // 아이콘 크기
      const PAD   = 14;   // 내부 여백
      const LINE  = 26;   // 줄 높이
      const DIVH  = 1;    // 구분선 높이
      const panelW = 280;

      // 높이: 골드행 + 구분선 + 장비 헤더 + 장비 목록(최소 1줄)
      const eqRows = Math.max(1, allEquipment.length);
      const panelH = PAD + LINE + 8 + DIVH + 8 + LINE + eqRows * LINE + PAD;
      legacyPanelW = panelW;
      legacyPanelH = panelH;

      const cont = this.add.container(0, 0); // setPosition은 아래에서

      // 배경
      const bg = this.add.graphics();
      bg.fillStyle(0x0a0e14, 0.90);
      bg.lineStyle(1, 0xd4af37, 0.45);
      bg.fillRoundedRect(0, 0, panelW, panelH, 10);
      bg.strokeRoundedRect(0, 0, panelW, panelH, 10);
      cont.add(bg);

      // 골드 아이콘 + 텍스트 (attr_6 = 별)
      const goldIcon = this.add.image(PAD + ICON / 2, PAD + LINE / 2, 'attr_icons', 'attr_6');
      goldIcon.setDisplaySize(ICON, ICON);
      const goldTxt = this.add.text(PAD + ICON + 8, PAD + 2, `${i18n.t('totalGold')}  ${totalGold} G`, {
        fontFamily: 'SBAggroB', fontSize: '15px', color: '#d4af37',
      });
      cont.add([goldIcon, goldTxt]);

      // 구분선
      const divY = PAD + LINE + 8;
      const div = this.add.graphics();
      div.lineStyle(1, 0xd4af37, 0.25);
      div.lineBetween(PAD, divY, panelW - PAD, divY);
      cont.add(div);

      // 장비 헤더 (attr_5 = 일반)
      const eqIcon = this.add.image(PAD + ICON / 2, divY + 8 + LINE / 2, 'attr_icons', 'attr_5');
      eqIcon.setDisplaySize(ICON, ICON);
      const eqLabel = this.add.text(PAD + ICON + 8, divY + 10, `${i18n.t('collectedEquip')}  ${allEquipment.length}종`, {
        fontFamily: 'SBAggroM', fontSize: '14px', color: '#aaaaaa',
      });
      cont.add([eqIcon, eqLabel]);

      // 장비 목록
      const listStartY = divY + 8 + LINE;
      if (allEquipment.length === 0) {
        const t = this.add.text(PAD + ICON + 8, listStartY + 4, i18n.t('noEquipYet'), {
          fontFamily: 'SBAggroL', fontSize: '13px', color: '#555555',
        });
        cont.add(t);
      } else {
        allEquipment.forEach((eq, i) => {
          const t = this.add.text(PAD + ICON + 8, listStartY + i * LINE + 4, eq, {
            fontFamily: 'SBAggroL', fontSize: '13px', color: '#cccccc',
          });
          cont.add(t);
        });
      }

      legacyPanel = cont;
      cont.setPosition(this.scale.width - panelW - 16, this.scale.height - panelH - 16);
    };

    // 일렉트론 환경에서 세이브 파일 존재 여부 + 레거시 로드
    const initButtons = async () => {
      let hasSaveFile = false;
      let totalGold   = 0;
      let allEquipment: string[] = [];

      // @ts-ignore
      if (typeof require !== 'undefined') {
        try {
          const { ipcRenderer } = require('electron');
          [hasSaveFile] = await Promise.all([
            ipcRenderer.invoke('check-save-file'),
          ]);
          const legacyRes = await ipcRenderer.invoke('load-legacy');
          if (legacyRes.success && legacyRes.data) {
            totalGold    = legacyRes.data.totalGold    ?? 0;
            allEquipment = legacyRes.data.allEquipment ?? [];
          }
        } catch (e) {
          console.error('초기 로드 실패:', e);
        }
      }

      buildLegacyPanel(totalGold, allEquipment);

      // 1. 새로하기
      createButton(i18n.t('newGame'), () => {
        if (hasSaveFile) {
          const isConfirmed = confirm(i18n.t('newGameConfirm'));
          if (isConfirmed) goScene('CharacterSelectScene');
        } else {
          goScene('CharacterSelectScene');
        }
      });

      // 2. 이어하기 (조건부 활성화)
      createButton(i18n.t('continue'), () => {
        goScene('MainScene', { isContinue: true });
      }, hasSaveFile);

      // 3. 카드 도감
      createButton(i18n.t('cardGallery'), () => {
        goScene('CardGalleryScene');
      });

      // 4. 설정
      createButton(i18n.t('settings'), () => {
        goScene('SettingsScene');
      });

      // 5. 게임 종료
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
