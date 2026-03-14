import Phaser from 'phaser';
import { addFullscreenBackground } from '@src/utils/sceneUtils';

export default class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
  }

  preload() {
    // Load assets here
  }

  create() {
    const { width, height } = this.scale;
    
    // 화면에 맞는 기준 너비
    const mapWorldWidth = Math.max(width, 1000);
    const mapWorldHeight = 2400; // 충분히 긴 세로 길이 (상단으로 올라가는 형태)

    // 카메라 설정 (전체 맵 경계 지정, 줌인)
    this.cameras.main.setBounds(0, 0, mapWorldWidth, mapWorldHeight);
    this.cameras.main.setZoom(1.1); // 살짝 확대
    
    // 배경 이미지 (전체 높이에 맞춰 꽉 채움)
    const bg = this.add.image(mapWorldWidth / 2, mapWorldHeight / 2, 'map_bg');
    bg.setDisplaySize(mapWorldWidth, mapWorldHeight);
    // 빈티지 지도 느낌을 더 주기위해 약간 어둡게 (Tint) 적용 가능
    bg.setTint(0xddccbb);
    
    // 간단한 맵 구조 데이터 (아래에서 위로 올라가는 계층 구조)
    // 0:해골, 1:칼, 2:캠프파이어, 3:보물, 4:물음표, 5~9:카드, 10~15:보스들
    const mapLayersData = [
      // Layer 0 (Start)
      [{ id: 0, layer: 0, x: mapWorldWidth / 2, y: mapWorldHeight - 200, type: 0, nextNodes: [1, 2] }],
      
      // Layer 1
      [
        { id: 1, layer: 1, x: mapWorldWidth / 2 - 200, y: mapWorldHeight - 450, type: 4, nextNodes: [3, 4] },
        { id: 2, layer: 1, x: mapWorldWidth / 2 + 200, y: mapWorldHeight - 450, type: 1, nextNodes: [4, 5] },
      ],

      // Layer 2
      [
        { id: 3, layer: 2, x: mapWorldWidth / 2 - 350, y: mapWorldHeight - 700, type: 2, nextNodes: [6] },
        { id: 4, layer: 2, x: mapWorldWidth / 2,       y: mapWorldHeight - 700, type: 5, nextNodes: [6, 7] }, // Card draw
        { id: 5, layer: 2, x: mapWorldWidth / 2 + 350, y: mapWorldHeight - 700, type: 3, nextNodes: [7] },
      ],

      // Layer 3
      [
        { id: 6, layer: 3, x: mapWorldWidth / 2 - 200, y: mapWorldHeight - 1000, type: 1, nextNodes: [8, 9] },
        { id: 7, layer: 3, x: mapWorldWidth / 2 + 200, y: mapWorldHeight - 1000, type: 4, nextNodes: [9, 10] },
      ],

      // Layer 4
      [
        { id: 8, layer: 4, x: mapWorldWidth / 2 - 350, y: mapWorldHeight - 1300, type: 2, nextNodes: [11] },
        { id: 9, layer: 4, x: mapWorldWidth / 2,       y: mapWorldHeight - 1300, type: 6, nextNodes: [11, 12] }, // Card hurt
        { id: 10, layer: 4, x: mapWorldWidth / 2 + 350, y: mapWorldHeight - 1300, type: 3, nextNodes: [12] },
      ],

      // Layer 5 (중간 보스급)
      [
        { id: 11, layer: 5, x: mapWorldWidth / 2 - 150, y: mapWorldHeight - 1600, type: 7, nextNodes: [13] }, // Card star
        { id: 12, layer: 5, x: mapWorldWidth / 2 + 150, y: mapWorldHeight - 1600, type: 8, nextNodes: [13] },
      ],

      // Layer 6 (최종 보스 앞 휴식)
      [
        { id: 13, layer: 6, x: mapWorldWidth / 2, y: mapWorldHeight - 1900, type: 2, nextNodes: [14] }, 
      ],

      // Layer 7 (최종 보스, nodeType 10: 물, 11: 불, ... 등)
      [
        { id: 14, layer: 7, x: mapWorldWidth / 2, y: mapWorldHeight - 2200, type: 10, nextNodes: [] }, 
      ]
    ];

    const allNodes = mapLayersData.flat();

    // 점선 그리기 (Dots)
    const mapGraphics = this.add.graphics();
    mapGraphics.fillStyle(0x222222, 0.8);

    allNodes.forEach(node => {
      node.nextNodes.forEach(nextId => {
        const nextNode = allNodes.find(n => n.id === nextId);
        if (!nextNode) return;
        
        // 두 노드 사이의 거리 측정
        const dist = Phaser.Math.Distance.Between(node.x, node.y, nextNode.x, nextNode.y);
        // 약 20px 간격마다 점 찍기
        const dotCount = Math.floor(dist / 20);
        for (let i = 1; i < dotCount; i++) { 
          const t = i / dotCount;
          // 약간의 커브(Bezier)를 줘도 좋지만 직선(Linear)으로 처리
          const pointX = Phaser.Math.Linear(node.x, nextNode.x, t);
          // Y값을 살짝 흔들면 구불구불한 밧줄 느낌이 나지만 단순하게 처리
          const pointY = Phaser.Math.Linear(node.y, nextNode.y, t);
          mapGraphics.fillCircle(pointX, pointY, 4);
        }
      });
    });

    // 각 노드 클릭을 위한 UI 구현
    allNodes.forEach(node => {
      // 160x160으로 일정하게 잘랐으므로 바로 스프라이트 프레임 번호(type)를 사용
      const nodeSprite = this.add.sprite(node.x, node.y, 'map_nodes', node.type);
      
      // 스프라이트 크기 축소 
      nodeSprite.setScale(0.5); // 이미지가 160px 라서 적당히 스케일링
      nodeSprite.setInteractive({ useHandCursor: true });
      
      // Node Mouse Over 효과
      nodeSprite.on('pointerover', () => {
        nodeSprite.setScale(0.9);
      });
      nodeSprite.on('pointerout', () => {
        nodeSprite.setScale(0.8);
      });
      
      // Click 이벤트
      nodeSprite.on('pointerdown', () => {
        const currentNode = allNodes.find(n => n.id === this.currentNodeId);
        if (!currentNode) return;
        
        // 현재 위치에서 다음 갈 수 있는 Node인지 체크 (바로 연결된 곳으로만 가능)
        if (currentNode.nextNodes.includes(node.id)) {
          this.movePlayer(node.x, node.y);
          this.currentNodeId = node.id;
        } else {
          // 이동 불가 피드백 (화면 흔들리거나 색상 깜박임 등)
          this.cameras.main.shake(100, 0.005);
        }
      });
    });

    // 플레이어 토큰 초기 셋팅
    const startNode = mapLayersData[0][0];
    this.currentNodeId = startNode.id; // 초기 활성화 노드
    
    // 플레이어 마커 핀: 16, 17, 18 번 프레임에 있다 가정 (4x5 의 맨 마지막 줄)
    this.playerToken = this.add.sprite(startNode.x - 20, startNode.y + 10, 'map_nodes', 16);
    this.playerToken.setScale(0.4); // 핀 스케일 축소
    this.playerToken.setDepth(10); // 토큰이 가장 위에 보이도록
    
    // 카메라는 플레이어를 계속 부드럽게 따라다님
    this.cameras.main.startFollow(this.playerToken, true, 0.05, 0.05);

    // 디버그용 
    const evolBtn = this.add.text(width - 250, 50, '토큰 변경(디버깅)', {
      fontFamily: 'SBAggroM',
      color: '#000',
      backgroundColor: '#f1f1f1',
      padding: { x: 10, y: 10 }
    }).setInteractive({ useHandCursor: true })
      .setScrollFactor(0) // 화면에 붙박이로 고정
      .on('pointerdown', () => {
        let currentFrame = parseInt(this.playerToken.frame.name);
        if (currentFrame >= 18) currentFrame = 16;
        else currentFrame++;
        this.playerToken.setFrame(currentFrame);
    });
  }

  playerToken!: Phaser.GameObjects.Sprite;
  currentNodeId: number = 0;

  movePlayer(targetX: number, targetY: number) {
    if (!this.playerToken) return;
    this.tweens.add({
      targets: this.playerToken,
      x: targetX - 20, // 노드의 살짝 옆쪽 아래
      y: targetY + 10,
      duration: 600,
      ease: 'Power2'
    });
  }
}
