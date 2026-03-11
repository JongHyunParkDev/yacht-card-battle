import Phaser from 'phaser';

export default class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');
  }

  preload() {
    // 폰트와 이미지 프리로드는 이제 PreloadScene에서 수행하므로 생략 가능합니다.
  }

  create() {
    const { width, height } = this.scale;

    // 1. 가장 뒷 배경 (움직임 없음)
    this.add.image(width / 2, height / 2, 'bg1').setOrigin(0.5);

    // 패럴랙스 이동 시 우측 하단 공백이 보이지 않도록 미리 이동 최대치만큼 더해둡니다.
    const maxBg2OffsetX = (width / 2) * 0.04;
    const maxBg2OffsetY = (height / 2) * 0.04;

    // 2. 우측 하단 캐릭터 이미지 (크기 조절 및 우측 하단 배치)
    const bgLayer2 = this.add.image(width + maxBg2OffsetX, height + maxBg2OffsetY, 'bg2')
      .setOrigin(1, 1) // 우측 하단 기준
      .setScale(0.5); // 캐릭터 크기가 너무 크다 하셔서 살짝 줄였습니다

    // 패럴랙스 효과 적용
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // 화면 중앙을 기준으로 얼마나 떨어져 있는지 계산
      const offsetX = pointer.x - width / 2;
      const offsetY = pointer.y - height / 2;

      // 캐릭터: 우측 하단 기준으로 살짝 이동 (0.04)
      // 여백을 더해두었으므로 우측 하단으로 마우스를 향해도 공백이 보이지 않습니다.
      bgLayer2.setPosition((width + maxBg2OffsetX) - offsetX * 0.04, (height + maxBg2OffsetY) - offsetY * 0.04);
    });

    // Title
    this.add.text(100, height / 2 - 150, 'CB Tower', {
      fontFamily: 'SBAggroB',
      fontSize: '64px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0, 0.5);

    // Button Style Helper
    const createButton = (y: number, text: string, onClick: () => void) => {
      const button = this.add.text(100, y, text, {
        fontFamily: 'SBAggroM',
        fontSize: '32px',
        color: '#aaaaaa',
        // 고정 너비를 주어 투명한 배경이더라도 일정한 클릭 영역을 확보합니다
        fixedWidth: 300, 
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

      // 자연스러운 투명 버튼 호버/클릭 효과 (색상 및 스케일 변경)
      button.on('pointerdown', () => {
        button.setColor('#ffffff');
        button.setScale(0.95);
      });

      button.on('pointerup', () => {
        button.setColor('#ffffff');
        button.setScale(1.05);
        // 애니메이션 효과 후 즉각 실행되지만, 
        // 시각적 피드백을 위해 약간의 딜레이를 줄 수도 있습니다.
        onClick();
      });

      button.on('pointerout', () => {
        button.setColor('#aaaaaa');
        button.setScale(1);
        // 선택 해제 표시로 좌측 이동했던 것을 원복(선택적)
        button.setX(100);
      });

      button.on('pointerover', () => {
        button.setColor('#ffffff');
        button.setScale(1.05);
        this.add.tween({
          targets: button,
          x: 110, // 마우스 올렸을 때 오른쪽으로 살짝 이동하는 애니메이션
          duration: 100,
          ease: 'Power1'
        });
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
