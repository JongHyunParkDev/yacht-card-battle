import Phaser from 'phaser';

export default class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');
  }

  create() {
    const { width, height } = this.scale;

    // Title
    this.add.text(width / 2, height / 2 - 150, 'Yacht Card Battle', {
      fontSize: '64px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Button Style Helper
    const createButton = (y: number, text: string, onClick: () => void) => {
      const button = this.add.text(width / 2, y, text, {
        fontSize: '32px',
        color: '#ffffff',
        backgroundColor: '#4a4a4a',
        padding: { x: 20, y: 10 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      button.on('pointerdown', () => {
        button.setStyle({ backgroundColor: '#888888' });
      });

      button.on('pointerup', () => {
        button.setStyle({ backgroundColor: '#4a4a4a' });
        onClick();
      });

      button.on('pointerout', () => {
        button.setStyle({ backgroundColor: '#4a4a4a' });
      });

      button.on('pointerover', () => {
        button.setStyle({ backgroundColor: '#666666' });
      });

      return button;
    };

    // Buttons
    createButton(height / 2, '게임 시작', () => {
      console.log('게임 시작 버튼 클릭');
      this.scene.start('MainScene');
    });

    createButton(height / 2 + 80, '게임 업적 달성', () => {
      console.log('게임 업적 달성 버튼 클릭');
      alert('업적 페이지는 아직 구현되지 않았습니다.');
    });

    createButton(height / 2 + 160, '게임 종료', () => {
      console.log('게임 종료 버튼 클릭');
      // If running in Electron, sending a close command might be handled in preload or just by closing the window
      if (typeof window !== 'undefined' && window.close) {
        window.close();
      }
    });
  }
}
