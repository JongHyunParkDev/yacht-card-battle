import Phaser from 'phaser';
import { addFullscreenBackground, setResponsiveScale } from '@src/utils/sceneUtils';
import { i18n } from '@src/utils/localization';
import '@src/styles/colors.css';

const getCssColor = (varName: string, defaultColor: string) => {
  if (typeof document === 'undefined') return defaultColor;
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || defaultColor;
};
import { AudioManager } from '@src/utils/Audio';

export default class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');
  }
  async create() {
    AudioManager.init(this);
    // 1. 가장 뒷 배경 (공통 유틸 사용)
    addFullscreenBackground(this, 'bg1');

    // ── 설정 로드 (볼륨 포함) → BGM 재생 ────────────────────────────────────
    // @ts-ignore
    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        const settings = await ipcRenderer.invoke('load-settings');
        i18n.setLanguage(settings.language);
        if (typeof settings.bgmVolume === 'number') AudioManager.setBgmVolume(settings.bgmVolume);
        if (typeof settings.sfxVolume === 'number') AudioManager.setSfxVolume(settings.sfxVolume);
      } catch (e) {
        console.error('설정 로드 실패:', e);
      }
    }

    this.sound.stopAll();
    this.sound.play('bgm_intro', { loop: true, volume: AudioManager.bgmVol });

    this.cameras.main.fadeIn(250, 0, 0, 0);

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

    // ── 패시브 강화 정의 ──────────────────────────────────────────────────────
    const PASSIVE_DEFS = [
      { id: 'maxHp',     labelKey: 'upgradeMaxHp',     cost: 100, maxLv: 5 },
      { id: 'atk',       labelKey: 'upgradeAtk',        cost: 80,  maxLv: 5 },
      { id: 'def',       labelKey: 'upgradeDef',        cost: 80,  maxLv: 5 },
      { id: 'crit',      labelKey: 'upgradeCrit',       cost: 120, maxLv: 5 },
      { id: 'cardMult',  labelKey: 'upgradeCardMult',   cost: 200, maxLv: 3 },
      { id: 'equipSlot', labelKey: 'upgradeEquipSlot',  cost: 300, maxLv: 2 },
    ] as const;

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
          AudioManager.play('CLICK');
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

    // ── 패시브 강화 오버레이 ──────────────────────────────────────────────────
    const showPassiveUpgradeOverlay = (
      passiveUpgrades: Record<string, number>,
      totalGoldRef: { value: number },
      onClose: () => void,
    ) => {
      const { width, height } = this.scale;
      const overlay = this.add.container(0, 0).setDepth(100);

      // 반투명 배경 (클릭 시 닫기)
      const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
        .setInteractive();
      dim.on('pointerdown', () => { overlay.destroy(); onClose(); });
      overlay.add(dim);

      // 패널
      const PW = Math.min(660, width - 40);
      const ITEM_H = 52;
      const PH = 80 + 14 + PASSIVE_DEFS.length * ITEM_H + 20 + 50;
      const px = (width - PW) / 2;
      const py = (height - PH) / 2;

      const panelBg = this.add.graphics();
      panelBg.fillStyle(0x0a0e14, 0.97);
      panelBg.lineStyle(2, 0xd4af37, 0.8);
      panelBg.fillRoundedRect(px, py, PW, PH, 12);
      panelBg.strokeRoundedRect(px, py, PW, PH, 12);
      overlay.add(panelBg);

      // 제목
      const titleTxt = this.add.text(px + PW / 2, py + 24, i18n.t('passiveUpgradeTitle'), {
        fontFamily: 'SBAggroB', fontSize: '14px', color: '#d4af37',
        wordWrap: { width: PW - 24 }, align: 'center',
      }).setOrigin(0.5, 0);
      overlay.add(titleTxt);

      // 구분선
      const divG = this.add.graphics();
      divG.lineStyle(1, 0xd4af37, 0.3);
      divG.lineBetween(px + 16, py + 58, px + PW - 16, py + 58);
      overlay.add(divG);

      // 보유 골드 표시 (갱신 가능하게 참조 보관)
      const goldTxt = this.add.text(px + PW - 16, py + 68, `${i18n.t('yourGold')}:  ${totalGoldRef.value} G`, {
        fontFamily: 'SBAggroM', fontSize: '15px', color: '#d4af37',
      }).setOrigin(1, 0.5);
      overlay.add(goldTxt);

      // 강화 항목 행들
      const rowStartY = py + 80 + 14;
      const buyBtns: Phaser.GameObjects.Text[] = [];

      PASSIVE_DEFS.forEach((def, i) => {
        const ry = rowStartY + i * ITEM_H;
        const lv = passiveUpgrades[def.id] ?? 0;
        const nextCost = def.cost * (lv + 1);
        const maxed = lv >= def.maxLv;

        // 행 배경 (짝수/홀수 줄무늬)
        const rowBg = this.add.graphics();
        rowBg.fillStyle(i % 2 === 0 ? 0x111820 : 0x0d1218, 0.6);
        rowBg.fillRect(px + 8, ry, PW - 16, ITEM_H - 2);
        overlay.add(rowBg);

        // 이름
        const nameTxt = this.add.text(px + 18, ry + ITEM_H / 2, i18n.t(def.labelKey), {
          fontFamily: 'SBAggroM', fontSize: '15px', color: maxed ? '#888888' : '#e6d8b8',
        }).setOrigin(0, 0.5);
        overlay.add(nameTxt);

        // 레벨 표시
        const lvTxt = this.add.text(px + PW * 0.52, ry + ITEM_H / 2,
          `${i18n.t('upgradeLevel')} ${lv} / ${def.maxLv}`, {
          fontFamily: 'SBAggroM', fontSize: '14px', color: maxed ? '#888888' : '#aaaaaa',
        }).setOrigin(0.5, 0.5);
        overlay.add(lvTxt);

        // 비용 / 최대 레이블
        const costTxt = this.add.text(px + PW * 0.73, ry + ITEM_H / 2,
          maxed ? '' : `${nextCost} G`, {
          fontFamily: 'SBAggroM', fontSize: '14px', color: '#d4af37',
        }).setOrigin(0.5, 0.5);
        overlay.add(costTxt);

        // 구매 버튼
        const btnLabel = maxed ? i18n.t('upgradeMaxed') : i18n.t('upgradeBuy');
        const btnColor = maxed ? '#555555' : '#1a1a1a';
        const btnBg    = maxed ? '#444444' : '#d4af37';
        const btn = this.add.text(px + PW - 24, ry + ITEM_H / 2, btnLabel, {
          fontFamily: 'SBAggroB', fontSize: '13px',
          color: btnColor, backgroundColor: btnBg,
          padding: { x: 12, y: 6 },
        }).setOrigin(1, 0.5);

        if (!maxed) {
          btn.setInteractive({ useHandCursor: true });
          btn.on('pointerover', () => btn.setBackgroundColor('#f5cc4a'));
          btn.on('pointerout',  () => btn.setBackgroundColor('#d4af37'));
          btn.on('pointerdown', async () => {
            const curLv  = passiveUpgrades[def.id] ?? 0;
            const cost   = def.cost * (curLv + 1);
            if (totalGoldRef.value < cost) {
              // 골드 부족 — 흔들기 애니메이션
              this.tweens.add({
                targets: goldTxt, x: goldTxt.x + 6, duration: 60,
                yoyo: true, repeat: 3,
              });
              return;
            }
            AudioManager.play('CLICK');
            totalGoldRef.value -= cost;
            passiveUpgrades[def.id] = curLv + 1;

            // legacy.json 저장 (passiveUpgrades + totalGold 함께)
            // @ts-ignore
            if (typeof require !== 'undefined') {
              try {
                const { ipcRenderer } = require('electron');
                await ipcRenderer.invoke('save-passive-upgrades', {
                  passiveUpgrades,
                  totalGold: totalGoldRef.value,
                });
              } catch (e) {
                console.error('패시브 저장 실패:', e);
              }
            }

            // UI 갱신 (오버레이 재빌드)
            overlay.destroy();
            showPassiveUpgradeOverlay(passiveUpgrades, totalGoldRef, onClose);
          });
        }
        overlay.add(btn);
        buyBtns.push(btn);
      });

      // 닫기 버튼
      const closeBtn = this.add.text(px + PW / 2, py + PH - 26, '✕  닫기', {
        fontFamily: 'SBAggroM', fontSize: '16px', color: '#8a7060',
        padding: { x: 20, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      closeBtn.on('pointerover', () => closeBtn.setColor('#d4af37'));
      closeBtn.on('pointerout',  () => closeBtn.setColor('#8a7060'));
      closeBtn.on('pointerdown', () => { overlay.destroy(); onClose(); });
      overlay.add(closeBtn);
    };

    // 일렉트론 환경에서 세이브 파일 존재 여부 + 레거시 로드
    const initButtons = async () => {
      let hasSaveFile = false;
      let totalGold   = 0;
      let allEquipment: string[] = [];
      let passiveUpgrades: Record<string, number> = {};

      // @ts-ignore
      if (typeof require !== 'undefined') {
        try {
          const { ipcRenderer } = require('electron');
          [hasSaveFile] = await Promise.all([
            ipcRenderer.invoke('check-save-file'),
          ]);
          const legacyRes = await ipcRenderer.invoke('load-legacy');
          if (legacyRes.success && legacyRes.data) {
            totalGold       = legacyRes.data.totalGold    ?? 0;
            allEquipment    = legacyRes.data.allEquipment ?? [];
            passiveUpgrades = legacyRes.data.passiveUpgrades ?? {};
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

      // 3. 영구 강화
      createButton(i18n.t('passiveUpgrade'), () => {
        const goldRef = { value: totalGold };
        showPassiveUpgradeOverlay(passiveUpgrades, goldRef, () => {
          // 오버레이 닫힌 후 골드 갱신 반영
          totalGold = goldRef.value;
          buildLegacyPanel(totalGold, allEquipment);
        });
      });

      // 4. 카드 도감
      createButton(i18n.t('cardGallery'), () => {
        goScene('CardGalleryScene');
      });

      // 5. 설정
      createButton(i18n.t('settings'), () => {
        goScene('SettingsScene');
      });

      // 6. 게임 종료
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
