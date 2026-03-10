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

    // Save Game Button
    const saveBtn = this.add.text(100, height / 2 + 120, '게임 저장하기', {
      fontFamily: 'SBAggroM',
      color: '#ffffff',
      fontSize: '24px',
      backgroundColor: '#2e7d32',
      padding: { x: 20, y: 10 }
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    saveBtn.on('pointerdown', async () => {
      // @ts-ignore - Electron IPC Renderer is injected when nodeIntegration is true
      if (typeof require !== 'undefined') {
        const { ipcRenderer } = require('electron');
        const dummySaveData = JSON.stringify({ playerLevel: 5, gold: 1200, items: ['sword', 'shield'] });
        
        try {
          const result = await ipcRenderer.invoke('save-game', dummySaveData);
          if (result.success) {
            alert('저장 완료: ' + result.filePath);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        alert('웹 브라우저에서는 파일 저장을 지원하지 않습니다.');
      }
    });

    // Load Game Button
    const loadBtn = this.add.text(100, height / 2 + 190, '게임 불러오기', {
      fontFamily: 'SBAggroM',
      color: '#ffffff',
      fontSize: '24px',
      backgroundColor: '#1565c0',
      padding: { x: 20, y: 10 }
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    loadBtn.on('pointerdown', async () => {
      // @ts-ignore
      if (typeof require !== 'undefined') {
        const { ipcRenderer } = require('electron');
        try {
          const result = await ipcRenderer.invoke('load-game');
          if (result.success) {
            const loadedData = JSON.parse(result.data);
            alert(`불러오기 성공! 레벨: ${loadedData.playerLevel}, 골드: ${loadedData.gold}`);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        alert('웹 브라우저에서는 파일 불러오기를 지원하지 않습니다.');
      }
    });
  }
}
