import Phaser from 'phaser';

import bg1 from '@src/assets/img/background/background_1.png';
import bg2 from '@src/assets/img/background/background_2.png';

// Import map assets
import mapBg from '@src/assets/img/map/map_bg.png';
// map_nodes.png is a sprite image. Width and height comments for slicing:
// width: 1024, height: 1024 (1x5 layout -> frameWidth: 204.8, frameHeight: 1024 or 204.8 with offset)
// for simplicity we will treat it as frameWidth: 204, frameHeight: 204 
import mapNodes from '@src/assets/img/map/map_nodes.png';
import playerToken from '@src/assets/img/map/player_token.png';

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

    // 맵 이미지 로드
    this.load.image('map_bg', mapBg);
    // 맵 노드 이미지를 160x160 기준(가로 4칸, 세로 5칸 예상)으로 스프라이트 분할
    this.load.spritesheet('map_nodes', mapNodes, { frameWidth: 160, frameHeight: 160 });
  }

  create() {
    //
  }
}
