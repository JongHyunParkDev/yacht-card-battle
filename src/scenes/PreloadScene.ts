import Phaser from 'phaser';

import bg1 from '../assets/img/background/background_1.png';
import bg2 from '../assets/img/background/background_2.png';
import bg3 from '../assets/img/background/background_3.png';

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

    const loadingText = this.add.text(width / 2, height / 2 - 50, '로딩 중...', {
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
      
      this.scene.start('IntroScene');
    });

    // 백그라운드 이미지 로드
    this.load.image('bg1', bg1);
    this.load.image('bg2', bg2);
    this.load.image('bg3', bg3);
  }

  create() {
    //
  }
}
