import Phaser from 'phaser';
import { addFullscreenBackground } from '@src/utils/sceneUtils';

export default class MainScene extends Phaser.Scene {
  private isContinue: boolean = false;

  constructor() {
    super('MainScene');
  }

  // IntroScene에서 보내준 data를 받습니다 (예: { isContinue: true })
  init(data: any) {
    this.isContinue = data?.isContinue || false;
  }

  preload() {
    // Load assets here
  }

  async create() {
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

    // 맵 생성을 위한 시드(Seed) 해시값
    let mapHash = '';

    // '이어하기(Continue)' 모드일 때만 기존 세이브 파일을 확인합니다.
    if (this.isContinue) {
      // Electron 환경에서 JSON 파일로 세이브 로드
      // @ts-ignore
      if (typeof require !== 'undefined') {
        try {
          const { ipcRenderer } = require('electron');
          const loadResult = await ipcRenderer.invoke('load-game');
          if (loadResult && loadResult.success && loadResult.data && loadResult.data.mapHash) {
            mapHash = loadResult.data.mapHash;
            console.log('기존 맵 해시 자동 로드 성공(Electron):', mapHash);
          }
        } catch (e) {
          console.warn('Electron 로드 실패, 새 해시 생성 대기');
        }
      }
    }

    // 파일에서 불러오지 못했거나 새 게임(isContinue === false)인 경우, 새로운 해시 생성
    if (!mapHash) {
      const timestamp = new Date().getTime();
      const randomPart = Math.floor(Math.random() * 999999);
      mapHash = `stage_${timestamp}_${randomPart}`;
      console.log('새로운 맵 해시 생성됨:', mapHash);

      // JSON 파일에 저장
      // @ts-ignore
      if (typeof require !== 'undefined') {
        try {
          const { ipcRenderer } = require('electron');
          // 세이브 파일에 맵 해시값을 저장하도록 요청
          await ipcRenderer.invoke('save-game', { mapHash });
        } catch (e) {
          console.warn('Electron 세이브 실패', e);
        }
      }
    }

    // 시드 기반 맵 생성 함수 호출
    const mapLayersData = this.generateMapData(mapHash, mapWorldWidth, mapWorldHeight);
    const allNodes: MapNode[] = mapLayersData.flat();

    // 맵 노드를 그리기 전에, 시작 노드를 확실하게 초기화합니다.
    const startNode = mapLayersData[0][0];
    this.currentNodeId = startNode.id; 

    // 점선 그리기 (Dots)
    const mapGraphics = this.add.graphics();
    mapGraphics.fillStyle(0xffffff, 1);    // 안(배경)은 흰색
    mapGraphics.lineStyle(2, 0x000000, 1); // 밖(테두리)은 검정색, 2px 두께

    allNodes.forEach((node: MapNode) => {
      node.nextNodes.forEach((nextId: number) => {
        const nextNode = allNodes.find((n: MapNode) => n.id === nextId);
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
          
          mapGraphics.fillCircle(pointX, pointY, 4);   // 흰색 안쪽
          mapGraphics.strokeCircle(pointX, pointY, 4); // 검정색 테두리
        }
      });
    });

    // 각 노드 클릭을 위한 UI 구현
    // 추후 투명도 조절 등을 위해 그려진 스프라이트 배열을 보관합니다
    const nodeSpritesMap = new Map<number, Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics>();

    allNodes.forEach((node: MapNode) => {
      // 1. 맨 처음 시작 점 (layer === 0)은 이미지 없이 흰색/검정테두리 점(Dot)만 그립니다
      if (node.layer === 0) {
        const startDot = this.add.graphics();
        startDot.fillStyle(0xffffff, 1);
        startDot.lineStyle(3, 0x000000, 1);
        startDot.fillCircle(node.x, node.y, 16);
        startDot.strokeCircle(node.x, node.y, 16);
        nodeSpritesMap.set(node.id, startDot); // 인터랙션용으론 안 씁니다(클릭 못함)
        return;
      }

      // 2. 나머지 노드들은 기존 로직(스프라이트 생성) 유지
      let frameName = '';
      if (node.type < 5) frameName = `row0_${node.type}`;
      else if (node.type < 10) frameName = `row1_${node.type - 5}`;
      else if (node.type < 14) frameName = `row2_${node.type - 10}`;
      else frameName = `row3_${node.type - 14}`; // 14 이상일 경우

      const nodeSprite = this.add.sprite(node.x, node.y, 'map_nodes', frameName);
      
      // 스프라이트 크기 축소 (기본 0.8로 설정)
      nodeSprite.setScale(0.8); 
      nodeSprite.setInteractive({ useHandCursor: true });
      nodeSpritesMap.set(node.id, nodeSprite);
      
      // Node Mouse Over 효과
      nodeSprite.on('pointerover', () => {
        // 지나간 노드는 마우스 오버 반응 무시
        if (nodeSprite.alpha < 1) return;
        nodeSprite.setScale(0.9);
      });
      nodeSprite.on('pointerout', () => {
        // 지나간 노드는 복구 크기를 더 작게, 아니면 원래 크기(0.8)로
        if (nodeSprite.alpha < 1) nodeSprite.setScale(0.6);
        else nodeSprite.setScale(0.8);
      });
      
      // Click 이벤트
      nodeSprite.on('pointerdown', () => {
        // 퍼즈 상태거나 이동 중이면 클릭 무시
        if (this.isPaused || this.isMoving) return;

        // 현재 활성화된 노드를 찾습니다.
        const currentNode = allNodes.find((n: MapNode) => n.id === this.currentNodeId);
        if (!currentNode) {
           this.cameras.main.shake(100, 0.005);
           return;
        }
        
        // 현재 위치에서 다음 갈 수 있는 Node인지 체크 (바로 연결된 곳으로만 가능)
        if (currentNode.nextNodes.includes(node.id)) {
           this.movePlayer(node.x, node.y);
           this.currentNodeId = node.id;
           this.updateNodesVisibility(allNodes, nodeSpritesMap); // 화면 업데이트
        } else {
           // 이동 불가 피드백 (화면 흔들리거나 색상 깜박임 등)
           this.cameras.main.shake(100, 0.005);
        }
      });
    });

    // 플레이어 토큰 초기 셋팅 후 바로 한 번 화면을 징검다리처럼 갱신
    this.updateNodesVisibility(allNodes, nodeSpritesMap);

    // 플레이어 마커 핀: PreloadScene에서 자른 row4_0 ~ row4_2 프레임 사용
    // 맵 이동 시 가운데로 정렬하기 위해 오프셋 수치(-20, +10)를 제거
    this.playerToken = this.add.sprite(startNode.x, startNode.y, 'map_nodes', 'row4_0');
    this.playerToken.setScale(0.4); // 핀 스케일 축소
    this.playerToken.setOrigin(0.5, 0.5); // 앵커 포인트를 정중앙으로 명시적 설정
    this.playerToken.setDepth(10); // 토큰이 가장 위에 보이도록
    
    // 카메라는 플레이어를 계속 부드럽게 따라다님
    this.cameras.main.startFollow(this.playerToken, true, 0.05, 0.05);

    // ESC 키로 일시정지 메뉴 호출
    this.input.keyboard?.on('keydown-ESC', () => {
       this.togglePauseMenu(width, height);
    });
  }

  playerToken!: Phaser.GameObjects.Sprite;
  currentNodeId: number = -1; // -1로 초기화 (그리기 단계에서 재설정됨)
  pauseMenuContainer!: Phaser.GameObjects.Container;
  isPaused: boolean = false;
  isMoving: boolean = false; // 플레이어가 이동 중인지 체크 (이동 중일 땐 ESC 방지)

  togglePauseMenu(width: number, height: number) {
    if (this.isPaused || this.isMoving) return; // 이미 퍼즈 상태거나 이동 중이면 넘김
    this.isPaused = true;

    const cam = this.cameras.main;

    // 메뉴를 담을 컨테이너 생성 (카메라가 현재 보고 있는 정중앙 월드 좌표에 배치)
     // setScrollFactor(0)는 줌(Zoom) 상태에서 클릭 영역(Hit Area) 왜곡 버그를 일으킬 수 있으므로 제거합니다.
     this.pauseMenuContainer = this.add.container(cam.midPoint.x, cam.midPoint.y);
     this.pauseMenuContainer.setDepth(100);

     // 어두운 배경 (딤 처리)
     const backdrop = this.add.graphics();
     backdrop.fillStyle(0x000000, 0.7);
     
     // 해상도나 줌을 고려해 넉넉한 사이즈로 화면 전체를 덮게 세팅
     const bgW = width * 3;
     const bgH = height * 3;
     backdrop.fillRect(-bgW / 2, -bgH / 2, bgW, bgH);
     backdrop.setInteractive(new Phaser.Geom.Rectangle(-bgW / 2, -bgH / 2, bgW, bgH), Phaser.Geom.Rectangle.Contains);

     // 일시정지 타이틀
     const titleText = this.add.text(0, -120, '일시정지', {
      fontFamily: 'SBAggroB',
      fontSize: '48px',
      color: '#ffffff'
     }).setOrigin(0.5);

     // 버튼 공통 스타일
     const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
         fixedWidth: 120,
         fixedHeight: 120,
         fontFamily: 'SBAggroM',
         fontSize: '24px',
         color: '#e6d8b8',
         backgroundColor: '#222222',
         align: 'center',
         padding: { top: 20 }
     };

     // 1. 도움말 버튼 (왼쪽)
     const helpBtn = this.add.text(-160, 20, '?\n\n도움말', btnStyle)
         .setOrigin(0.5).setInteractive({ useHandCursor: true });

     helpBtn.on('pointerdown', () => {
         // TODO: 도움말 기능 추가 (현재는 팝업 애니메이션 정도만)
         this.tweens.add({ targets: helpBtn, scale: 0.9, yoyo: true, duration: 100 });
         console.log('도움말 클릭됨');
     });
     helpBtn.on('pointerover', () => helpBtn.setColor('#ffdb58').setScale(1.05));
     helpBtn.on('pointerout', () => helpBtn.setColor('#e6d8b8').setScale(1));

     // 2. 재개하기 버튼 (가운데)
     const resumeBtn = this.add.text(0, 20, '▶\n\n재개하기', btnStyle)
         .setOrigin(0.5).setInteractive({ useHandCursor: true });

     resumeBtn.on('pointerdown', () => {
         this.isPaused = false;
         this.pauseMenuContainer.destroy();
     });
     resumeBtn.on('pointerover', () => resumeBtn.setColor('#ffdb58').setScale(1.05));
     resumeBtn.on('pointerout', () => resumeBtn.setColor('#e6d8b8').setScale(1));

     // 3. 메인 메뉴 버튼 (오른쪽)
     const mainMenuBtn = this.add.text(160, 20, '⌂\n\n메인으로', btnStyle)
         .setOrigin(0.5).setInteractive({ useHandCursor: true });

     mainMenuBtn.on('pointerdown', () => {
         this.isPaused = false;
         this.scene.start('IntroScene'); // 인트로 씬으로 되돌아감
     });
     mainMenuBtn.on('pointerover', () => mainMenuBtn.setColor('#ffdb58').setScale(1.05));
     mainMenuBtn.on('pointerout', () => mainMenuBtn.setColor('#e6d8b8').setScale(1));

     // 컨테이너에 조립
     this.pauseMenuContainer.add([backdrop, titleText, helpBtn, resumeBtn, mainMenuBtn]);
  }

  // 플레이어 이동 후 노드들의 투명도 등을 일괄 업데이트하는 메서드
  updateNodesVisibility(allNodes: MapNode[], nodeSpritesMap: Map<number, Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics>) {
      const currentNode = allNodes.find(n => n.id === this.currentNodeId);
      if (!currentNode) return;

      const currentLayer = currentNode.layer;

      allNodes.forEach(node => {
          const sprite = nodeSpritesMap.get(node.id);
          if (!sprite || node.layer === 0) return; // 0번 레이어(큰 점)는 제외

          // Sprite 타입 필터링
          if (sprite instanceof Phaser.GameObjects.Sprite) {
              // 1. 이미 지나간 아래(과거) 레이어 혹은 지금 서 있는 레이어의 다른 노드
              if (node.layer <= currentLayer && node.id !== this.currentNodeId) {
                  sprite.setAlpha(0.3); // 투명도 확 낮춰서 disable 효과
                  sprite.setScale(0.6); // 크기도 줄임
                  sprite.setTint(0x888888); // 색도 회색빛으로 다운
              } 
              // 2. 현재 내 위치의 노드 (지금 밟고 있는 곳)
              else if (node.id === this.currentNodeId) {
                  sprite.setAlpha(1.0);
                  sprite.setScale(0.8);
                  sprite.clearTint();
              }
              // 3. 앞으로 갈 수 있는 미래방향 노드들 중, 바로 다음 연결된 타겟
              else if (node.layer === currentLayer + 1 && currentNode.nextNodes.includes(node.id)) {
                  sprite.setAlpha(1.0); // 선명하게
                  sprite.setScale(0.8);
                  sprite.clearTint();
                  
                  // 살짝 펄스 느낌의 이펙트
                  this.tweens.add({
                      targets: sprite,
                      scale: 0.85,
                      yoyo: true,
                      repeat: -1,
                      duration: 800
                  });
              } 
              // 4. 아예 연결되어 있지 않은 머나먼 미래 노드들 또는 못 가는 곳
              else {
                  sprite.setAlpha(0.6); // 아직 비활성화 상태까진 아니지만 약간 흐리게
                  sprite.setScale(0.7);
                  sprite.clearTint();
                  this.tweens.killTweensOf(sprite); // 기존 애니메이션 정리
              }
          }
      });
  }

  movePlayer(targetX: number, targetY: number) {
    if (!this.playerToken) return;
    
    // 이동 시작
    this.isMoving = true;

    // 이전 애니메이션이 있다면 취소
    this.tweens.killTweensOf(this.playerToken);

    // X, Y 중간 지점을 계산 (포물선 점프의 정점 역할)
    const midX = (this.playerToken.x + targetX) / 2;
    const midY = (this.playerToken.y + targetY) / 2 - 50; // 살짝 위로 들리는 높이

    // 1. 사람이 말을 짚고 들어 올리는 모션 (크기 증가, 살짝 기울임)
    this.tweens.add({
      targets: this.playerToken,
      x: midX,
      y: midY,
      scaleX: 0.6,
      scaleY: 0.6,
      angle: 15, // 살짝 들리면서 기우뚱
      duration: 250,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // 2. 새로운 위치에 '탁!' 하고 내려놓는 모션 (원래 크기/각도로 돌아오면서 바운스)
        this.tweens.add({
          targets: this.playerToken,
          x: targetX,
          y: targetY,
          scaleX: 0.4, // 기존 스케일
          scaleY: 0.4,
          angle: 0,
          duration: 500,
          ease: 'Bounce.easeOut', // 내려놓을 때 탁-타닥! 하는 진동 느낌
          onComplete: () => {
            this.isMoving = false; // 이동 완료 후 상태 해제
          }
        });
      }
    });
  }

  // Hash 값을 기반으로 항상 동일한 형태의 맵을 생성 (시드 랜덤 제너레이터)
  generateMapData(hash: string, width: number, height: number): MapNode[][] {
    let seed = 0;
    for (let i = 0; i < hash.length; i++) {
        seed = ((seed << 5) - seed) + hash.charCodeAt(i);
        seed |= 0;
    }

    // 간단한 LCG(Linear Congruential Generator) 난수 생성기
    const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        if (seed < 0) seed += 233280; // 자바스크립트의 % 연산자는 음수를 반환할 수 있으므로 보정
        return seed / 233280;
    };
    const randInt = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;

    const mapLayersData: MapNode[][] = [];
    let nodeId = 0;
    const numLayers = 8; // Layer 0 ~ 7
    const layerSpacingY = (height - 600) / (numLayers - 1);

    for (let layer = 0; layer < numLayers; layer++) {
      const currentLayerNodes: MapNode[] = [];
      const y = height - 200 - (layer * layerSpacingY);
      
      let numNodes = 1;
      if (layer === 0 || layer === numLayers - 1) {
          numNodes = 1; // 시작점과 최종 보스는 1개
      } else {
          numNodes = randInt(2, 4); // 중간 레이어는 2~4개 노드 무작위
      }

      const spacingX = width / (numNodes + 1);

      for (let i = 0; i < numNodes; i++) {
          let nodeType = 1; 
          // layer가 0인 노드는 이미지를 사용하지 않을 것이므로 type 0을 무시해도 됩니다.
          if (layer === 0) nodeType = 0; 
          else if (layer === numLayers - 1) nodeType = randInt(10, 13); // 보스 (10~13 중 하나)
          // 몬스터와 카드의 비율 조정이 필요하다면 여기서 (1~9 사이를 조절)
          else nodeType = randInt(0, 9); // 일반/이벤트/카드류는 0~9 랜덤 뽑기

          currentLayerNodes.push({
              id: nodeId++,
              layer: layer,
              x: spacingX * (i + 1) + randInt(-40, 40),      // X축 위치 랜덤성 (구불구불)
              y: y + (layer === 0 || layer === numLayers - 1 ? 0 : randInt(-20, 20)), // Y축도 살짝 흔듦
              type: nodeType,
              nextNodes: []
          });
      }
      mapLayersData.push(currentLayerNodes);
    }

    // 맵 노드를 레이어별로 위로 향하도록 연결 (Edge 생성을 해시 기반 랜덤으로)
    for (let layer = 0; layer < numLayers - 1; layer++) {
      const currentLayer = mapLayersData[layer];
      const nextLayer = mapLayersData[layer + 1];

      currentLayer.forEach((node, idx) => {
          // 다음 레이어에서 가장 가까운 비율의 노드 하나는 무조건 연결을 보장
          const ratio = idx / Math.max(1, currentLayer.length - 1);
          const nextIdx = Math.round(ratio * (nextLayer.length - 1));
          
          node.nextNodes.push(nextLayer[nextIdx].id);

          // 30% 확률로 이웃한 다른 노드와도 연결되는 분기점 생성
          if (random() < 0.3 && nextLayer.length > 1) {
             const extraIdx = (nextIdx + 1) % nextLayer.length;
             if (!node.nextNodes.includes(nextLayer[extraIdx].id)) {
                 node.nextNodes.push(nextLayer[extraIdx].id);
             }
          }
      });

      // 혹시 다음 레이어에서 고립된 노드(아무도 연결해주지 않은)가 있는지 방어 코드
      nextLayer.forEach((nextNode, nextIdx) => {
          const isLinked = currentLayer.some(node => node.nextNodes.includes(nextNode.id));
          if (!isLinked) {
              const ratio = nextIdx / Math.max(1, nextLayer.length - 1);
              const currIdx = Math.round(ratio * (currentLayer.length - 1));
              if (!currentLayer[currIdx].nextNodes.includes(nextNode.id)) {
                currentLayer[currIdx].nextNodes.push(nextNode.id);
              }
          }
      });
    }

    return mapLayersData;
  }
}

export interface MapNode {
  id: number;
  layer: number;
  x: number;
  y: number;
  type: number;
  nextNodes: number[];
}
