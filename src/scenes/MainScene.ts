import Phaser from 'phaser';

export default class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
  }

  preload() {
    // Load assets here
  }

  create() {
    const { width, height } = this.scale;
    
    this.add.text(100, height / 2 - 50, 'CB-Tower - Main Game', { 
      fontFamily: 'SBAggroB',
      fontSize: '48px', 
      color: '#0f0' 
    }).setOrigin(0, 0.5);
    
    // Add button to go back to Intro
    const backBtn = this.add.text(100, height / 2 + 50, '메인 메뉴로 돌아가기', { 
      fontFamily: 'SBAggroM',
      color: '#ffffff', 
      fontSize: '24px', 
      backgroundColor: '#555555', 
      padding: { x: 20, y: 10 } 
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.scene.start('IntroScene');
    });
  }
}
