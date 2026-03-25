import Phaser from 'phaser';
import { i18n } from '@src/utils/localization';

import bg1 from '@src/assets/img/background/background_1.png';
import bg2 from '@src/assets/img/background/background_2.png';

import charBowIdle    from '@src/assets/img/char/bow-idle.png';
import charHammerIdle from '@src/assets/img/char/hammer-idle.png';
import charShieldIdle from '@src/assets/img/char/shield-idle.png';
import charSpearIdle  from '@src/assets/img/char/spear-idle.png';
import charSwordIdle  from '@src/assets/img/char/sword-idle.png';

// Import map assets
import mapBg from '@src/assets/img/map/map_bg.png';
// map_nodes.png: 스프라이트 이미지
// width: 640, height: 800 (5행 × 가변열)
import mapNodes from '@src/assets/img/map/map_nodes.png';

// Import card assets
// card-sprite.png: 6행 × 5열, 프레임 크기 370px × 370px
import cardSprite from '@src/assets/img/card/card-sprite.png';
// attr-sprite.png: 7개 속성 아이콘 (물/불/풀/번개/돌/일반/별), 각 128px × 128px
import attrSprite from '@src/assets/img/config/attr-sprite.png';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    // 폰트를 강제로 로드하기 위해 화면 밖에서 렌더링
    this.add.text(-100, -100, '.', { fontFamily: 'SBAggroB' });
    this.add.text(-100, -100, '.', { fontFamily: 'SBAggroM' });
    this.add.text(-100, -100, '.', { fontFamily: 'SBAggroL' });

    // 로딩 프로그레스 바 UI
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.add.text(width / 2, height / 2 - 50, i18n.t('loading'), {
      fontFamily: 'SBAggroM',
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);

    const percentText = this.add.text(width / 2, height / 2, '0%', {
      fontFamily: 'SBAggroB',
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);

    this.load.on('progress', (value: number) => {
      percentText.setText(parseInt(String(value * 100)) + '%');
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', async () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();

      try {
        await document.fonts.load('10px "SBAggroB"');
        await document.fonts.load('10px "SBAggroM"');
        await document.fonts.load('10px "SBAggroL"');
      } catch (e) {
        console.warn('Font loading await failed', e);
      }
      
      // 로딩 및 준비 완료 시 IntroScene으로 전환
      this.scene.start('IntroScene');
    });

    // 특정 이미지가 로드되었을 때 즉시 텍스처 분할 (100% 진행도에서 멈추는 현상 방지)
    this.load.once('filecomplete-image-map_nodes', () => {
      const tex = this.textures.get('map_nodes'); 
      if (tex && tex.key !== '__DEFAULT') {
        const rowH = 160; 

        // --- Row 1 & 2 (일반 아이콘: 각 128px 너비) ---
        for (let r = 0; r < 2; r++) {
            for (let i = 0; i < 5; i++) {
                tex.add(`row${r}_${i}`, 0, i * 128, r * rowH, 128, rowH);
            }
        }

        // --- Row 3 (보스 1단계: index 0~2, 각 160px 너비) ---
        // row2_0, row2_1, row2_2 (총 3개; row2_3 미사용)
        for (let i = 0; i < 3; i++) {
            tex.add(`row2_${i}`, 0, i * 160, 2 * rowH, 160, rowH);
        }

        // --- Row 4 (보스 2단계: index 0~3, 각 160px 너비) ---
        // row3_0, row3_1 = 일반 보스 / row3_3 = 최종 보스 (맵에서 제외)
        for (let i = 0; i < 4; i++) {
            tex.add(`row3_${i}`, 0, i * 160, 3 * rowH, 160, rowH);
        }

        // --- Row 5 (위치 핀: 각 106.66 너비) ---
        for (let i = 0; i < 3; i++) {
            tex.add(`row4_${i}`, 0, i * (640/6), 4 * rowH, 640/6, rowH);
        }
      }
    });

    // 카드 스프라이트 프레임 분할
    // card-sprite.png: 6행 × 5열, 각 프레임 370 × 370px
    this.load.once('filecomplete-image-card_sprites', () => {
      const cardTex = this.textures.get('card_sprites');
      if (cardTex && cardTex.key !== '__DEFAULT') {
        const fw = 370;
        const fh = 370;
        for (let row = 0; row < 6; row++) {
          for (let col = 0; col < 5; col++) {
            cardTex.add(`card_${row}_${col}`, 0, col * fw, row * fh, fw, fh);
          }
        }
      }
    });

    // 속성 아이콘 프레임 분할
    // attr-sprite.png: 7개 아이콘 (물/불/풀/번개/돌/일반/별), 각 128 × 128px
    this.load.once('filecomplete-image-attr_icons', () => {
      const attrTex = this.textures.get('attr_icons');
      if (attrTex && attrTex.key !== '__DEFAULT') {
        const iconSize = 128;
        for (let i = 0; i < 7; i++) {
          attrTex.add(`attr_${i}`, 0, i * iconSize, 0, iconSize, iconSize);
        }
      }
    });

    // 캐릭터 idle 스프라이트시트 로드 (300×400px / 프레임)
    this.load.spritesheet('char_bow',    charBowIdle,    { frameWidth: 300, frameHeight: 400 });
    this.load.spritesheet('char_hammer', charHammerIdle, { frameWidth: 300, frameHeight: 400 });
    this.load.spritesheet('char_shield', charShieldIdle, { frameWidth: 300, frameHeight: 400 });
    this.load.spritesheet('char_spear',  charSpearIdle,  { frameWidth: 300, frameHeight: 400 });
    this.load.spritesheet('char_sword',  charSwordIdle,  { frameWidth: 300, frameHeight: 400 });

    // 백그라운드 이미지 로드
    this.load.image('bg1', bg1);
    this.load.image('bg2', bg2);

    // 맵 이미지 로드
    this.load.image('map_bg', mapBg);
    this.load.image('map_nodes', mapNodes);

    // 카드 이미지 로드
    this.load.image('card_sprites', cardSprite);
    this.load.image('attr_icons', attrSprite);
  }

  create() {
    //

  }
}
