import Phaser from 'phaser';

/**
 * 오브젝트를 화면 높이에 비례하여 스케일링합니다.
 * @param obj 대상 이미지 오브젝트
 * @param heightPercentage 화면 높이 대비 비율 (예: 0.8 이면 화면 높이의 80% 크기)
 */
export const setResponsiveScale = (obj: Phaser.GameObjects.Image, heightPercentage: number) => {
  if (obj.height > 0) {
    const scale = (obj.scene.scale.height * heightPercentage) / obj.height;
    obj.setScale(scale);
  }
};

/**
 * 배경 이미지를 화면 전체에 꽉 차게(비율 유지) 배치합니다.
 * @param scene 현재 씬 객체
 * @param textureKey 리소스 매니저에 등록된 이미지 키
 * @returns 추가된 Phaser.GameObjects.Image 인스턴스
 */
export const addFullscreenBackground = (scene: Phaser.Scene, textureKey: string): Phaser.GameObjects.Image => {
  const bg = scene.add.image(scene.scale.width / 2, scene.scale.height / 2, textureKey).setOrigin(0.5);

  const updateScale = () => {
    const { width, height } = scene.scale;
    bg.setPosition(width / 2, height / 2);
    
    const scaleX = width / bg.width;
    const scaleY = height / bg.height;
    const scale = Math.max(scaleX, scaleY);
    
    bg.setScale(scale);
  };

  // 초기 스케일 설정
  updateScale();

  // 화면 크기 변경 시마다 재계산
  scene.scale.on('resize', updateScale);

  // 씬이 종료될 때 이벤트 리스너 제거 (메모리 누수 방지)
  scene.events.once('shutdown', () => {
    scene.scale.off('resize', updateScale);
  });
  
  return bg;
};
