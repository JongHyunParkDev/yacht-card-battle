// ─── BattleFX.ts — 배틀 시각/음향 이펙트 모듈 함수 ──────────────────────────────

import { AudioManager } from '@src/utils/Audio';

// ELEM_COLORS는 BattleScene과 동일하게 유지
const ELEM_COLORS: Record<string, number> = {
  water:     0x4db8ff,
  fire:      0xff6b35,
  grass:     0x5ddb7a,
  lightning: 0xffe033,
  earth:     0xc8a04a,
  normal:    0xcccccc,
};

const FONT_B = 'SBAggroB';

// ── FX 파라미터 타입 ────────────────────────────────────────────────────────────

export interface ProjectileParams {
  scene: Phaser.Scene;
  elem: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fast: boolean;
  stars?: number;
  onHit: () => void;
}

export interface HitBurstParams {
  scene: Phaser.Scene;
  x: number;
  y: number;
  elem: string;
  W: number;
  H: number;
}

export interface FloatingDamageParams {
  scene: Phaser.Scene;
  x: number;
  y: number;
  amount: number;
  isCrit: boolean;
  color: string;
}

export interface FloatingHealParams {
  scene: Phaser.Scene;
  x: number;
  y: number;
  amount: number;
}

export interface PlayerAttackParams {
  scene: Phaser.Scene;
  playerSprite: Phaser.GameObjects.Sprite;
  enemyContainer: Phaser.GameObjects.Container;
  elem: string;
  W: number;
  onComplete: () => void;
  isFastForward?: boolean;
  stars?: number;
}

export interface EnemyHitParams {
  scene: Phaser.Scene;
  enemyContainer: Phaser.GameObjects.Container;
  enemyBody: Phaser.GameObjects.Rectangle;
  enemyIdleTween: Phaser.Tweens.Tween | undefined;
  elem: string;
  isCrit: boolean;
  mapElement: string;
}

export interface PlayerHitParams {
  scene: Phaser.Scene;
  playerSprite: Phaser.GameObjects.Sprite;
}

// ── 프로젝타일 발사 ─────────────────────────────────────────────────────────────

export function launchProjectile(p: ProjectileParams): void {
  const { scene, elem, fromX, fromY, toX, toY, fast, stars = 0, onHit } = p;
  const travelDur = fast ? 130 : 260;

  const scaleFactor = stars > 0 ? 1 + (stars - 1) * 0.18 : 1.0;

  const proj = scene.add.graphics();
  proj.setDepth(10);
  proj.setScale(scaleFactor);

  switch (elem) {
    case 'fire': {
      proj.fillStyle(0xff4500, 1);
      proj.fillCircle(0, 0, 13);
      proj.fillStyle(0xff8800, 0.7);
      proj.fillCircle(-2, -2, 7);
      proj.fillStyle(0xffdd00, 0.5);
      proj.fillCircle(-3, -3, 3);
      break;
    }
    case 'water': {
      proj.fillStyle(0x2288ff, 0.85);
      proj.fillCircle(0, 0, 11);
      proj.fillStyle(0xaaddff, 0.6);
      proj.fillCircle(-3, -3, 5);
      proj.lineStyle(2, 0x55aaff, 0.9);
      proj.strokeCircle(0, 0, 13);
      break;
    }
    case 'lightning': {
      proj.fillStyle(0xffee00, 1);
      proj.fillTriangle(-6, -16, 4, 0, -2, 0);
      proj.fillTriangle(-2, 0, 8, 0, 2, 16);
      proj.fillStyle(0xffffff, 0.6);
      proj.fillCircle(0, 0, 5);
      break;
    }
    case 'grass': {
      proj.fillStyle(0x22cc55, 0.9);
      proj.fillEllipse(0, 0, 14, 22);
      proj.fillStyle(0x55ff88, 0.5);
      proj.fillEllipse(-2, -3, 7, 11);
      proj.lineStyle(1.5, 0x008833, 0.8);
      proj.strokeEllipse(0, 0, 14, 22);
      break;
    }
    case 'earth': {
      proj.fillStyle(0x8B5E2A, 1);
      proj.fillCircle(0, 0, 13);
      proj.fillStyle(0xAA8044, 0.6);
      proj.fillCircle(-3, -4, 7);
      proj.fillStyle(0x664422, 0.5);
      proj.fillCircle(3, 3, 5);
      break;
    }
    default: {
      proj.fillStyle(0xffffff, 0.85);
      proj.fillRect(-3, -16, 6, 32);
      proj.fillStyle(0xd4af37, 0.7);
      proj.fillRect(-1, -12, 2, 24);
      break;
    }
  }

  proj.setPosition(fromX, fromY);

  const startAngle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY) * (180 / Math.PI);
  if (['earth', 'grass'].includes(elem)) proj.setAngle(startAngle);

  if (elem === 'lightning') {
    const steps = fast ? 3 : 5;
    const stepDur = travelDur / steps;
    let s = 0;
    const doStep = () => {
      if (s >= steps) {
        playHitBurst({ scene, x: toX, y: toY, elem, W: 0, H: 0 });
        proj.destroy();
        onHit();
        return;
      }
      const t = (s + 1) / steps;
      const mx = fromX + (toX - fromX) * t + (s % 2 === 0 ? 20 : -20);
      const my = fromY + (toY - fromY) * t + (Math.random() - 0.5) * 30;
      scene.tweens.add({
        targets: proj, x: mx, y: my, duration: stepDur,
        ease: 'Linear', onComplete: () => { s++; doStep(); },
      });
    };
    doStep();
  } else {
    scene.tweens.add({
      targets: proj, x: toX,
      duration: travelDur,
      ease: 'Power1.easeIn',
      onUpdate: (tween) => {
        const pg = tween.progress;
        proj.y = fromY + (toY - fromY) * pg - Math.sin(pg * Math.PI) * 40;
        if (['earth', 'grass'].includes(elem)) proj.angle += fast ? 8 : 5;
      },
      onComplete: () => {
        playHitBurst({ scene, x: toX, y: toY, elem, W: 0, H: 0 });
        proj.destroy();
        onHit();
      },
    });
  }

  if (elem === 'fire') {
    const trailCount = fast ? 3 : 6;
    for (let i = 0; i < trailCount; i++) {
      scene.time.delayedCall(i * (travelDur / trailCount * 0.6), () => {
        if (!proj.active) return;
        const trail = scene.add.graphics();
        trail.fillStyle(0xff6600, 0.5 - i * 0.06);
        trail.fillCircle(0, 0, 8 - i);
        trail.setPosition(proj.x, proj.y).setDepth(9);
        scene.tweens.add({
          targets: trail, alpha: 0, scale: 0.3, duration: 250,
          onComplete: () => trail.destroy(),
        });
      });
    }
  }
}

// ── 착탄 이펙트 ─────────────────────────────────────────────────────────────────

export function playHitBurst(p: HitBurstParams): void {
  const { scene, x, y, elem } = p;
  const color = ELEM_COLORS[elem] ?? 0xffffff;
  const burstCount = 8;

  for (let i = 0; i < burstCount; i++) {
    const angle = (i / burstCount) * Math.PI * 2;
    const line = scene.add.graphics();
    line.lineStyle(2.5, color, 1);
    const len = elem === 'lightning' ? 30 : 22;
    line.lineBetween(0, 0, Math.cos(angle) * len, Math.sin(angle) * len);
    line.setPosition(x, y).setDepth(11);
    scene.tweens.add({
      targets: line, scaleX: 1.8, scaleY: 1.8, alpha: 0,
      duration: elem === 'lightning' ? 250 : 350,
      ease: 'Power2.easeOut',
      onComplete: () => line.destroy(),
    });
  }

  const flash = scene.add.graphics();
  flash.fillStyle(color, 0.85);
  flash.fillCircle(0, 0, elem === 'fire' ? 30 : 22);
  flash.setPosition(x, y).setDepth(11);
  scene.tweens.add({
    targets: flash, alpha: 0, scale: 2.2,
    duration: elem === 'lightning' ? 200 : 400,
    ease: 'Power3.easeOut',
    onComplete: () => flash.destroy(),
  });

  if (elem === 'lightning') {
    const { W, H } = p;
    if (W > 0 && H > 0) {
      const whiteFlash = scene.add.graphics();
      whiteFlash.fillStyle(0xffffff, 0.2);
      whiteFlash.fillRect(0, 0, W, H);
      whiteFlash.setDepth(50);
      scene.tweens.add({
        targets: whiteFlash, alpha: 0, duration: 120,
        onComplete: () => whiteFlash.destroy(),
      });
    }
    scene.cameras.main.shake(120, 0.012);
  }

  if (elem === 'fire') {
    scene.cameras.main.shake(80, 0.008);
  }
}

// ── 피해 플로팅 텍스트 ──────────────────────────────────────────────────────────

export function showFloatingDamage(p: FloatingDamageParams): void {
  const { scene, x, y, amount, isCrit, color } = p;
  if (amount <= 0 && color !== '#e74c3c') return;

  const displayColor = isCrit ? '#ff9900' : color;

  const txt = scene.add.text(x, y, `-${Math.floor(amount)}`, {
    fontFamily: FONT_B,
    fontSize: isCrit ? '58px' : '40px',
    color: displayColor,
    stroke: isCrit ? '#7a3300' : '#000000',
    strokeThickness: isCrit ? 9 : 6,
    fontStyle: isCrit ? 'italic' : 'normal',
  }).setOrigin(0.5);

  if (isCrit) {
    const critObj = scene.add.text(x, y - 45, '★ CRITICAL!', {
      fontFamily: FONT_B, fontSize: '28px', color: '#ffe566', stroke: '#7a3300', strokeThickness: 4,
    }).setOrigin(0.5);
    scene.tweens.add({
      targets: critObj, y: y - 60, alpha: 0, duration: 800, ease: 'Power2.easeOut',
      onComplete: () => critObj.destroy(),
    });
  }

  scene.tweens.add({
    targets: txt,
    y: y - (isCrit ? 80 : 50),
    alpha: 0,
    scale: isCrit ? 1.5 : 1,
    duration: isCrit ? 1400 : 1100,
    ease: 'Power2.easeOut',
    onComplete: () => txt.destroy(),
  });
}

// ── 회복 플로팅 텍스트 ──────────────────────────────────────────────────────────

export function showFloatingHeal(p: FloatingHealParams): void {
  const { scene, x, y, amount } = p;
  if (amount <= 0) return;
  const txt = scene.add.text(x, y, `+${Math.floor(amount)} HP`, {
    fontFamily: FONT_B, fontSize: '24px', color: '#00e676',
    stroke: '#005020', strokeThickness: 3,
  }).setOrigin(0.5);
  scene.tweens.add({
    targets: txt, y: y - 45, alpha: 0, duration: 1000, ease: 'Power2.easeOut',
    onComplete: () => txt.destroy(),
  });
}

// ── 플레이어 공격 애니메이션 ────────────────────────────────────────────────────

export function playPlayerAttack(p: PlayerAttackParams): void {
  const { scene, playerSprite, enemyContainer, elem, W, onComplete, isFastForward = false, stars = 0 } = p;

  const startX = playerSprite.x;
  const dashX  = startX + W * 0.20;

  const easeMap: Record<string, string> = {
    water:     'Sine.easeInOut',
    fire:      'Expo.easeOut',
    grass:     'Bounce.easeOut',
    lightning: 'Power4.easeOut',
    earth:     'Power2.easeIn',
    normal:    'Power1.easeInOut',
  };
  const durMap: Record<string, number> = {
    water: 200, fire: 130, grass: 250, lightning: 70, earth: 300, normal: 180,
  };
  const ease   = easeMap[elem] ?? 'Power1.easeInOut';
  let dashDur  = durMap[elem] ?? 180;
  if (isFastForward) dashDur = Math.max(40, Math.floor(dashDur * 0.4));

  const elemColor = ELEM_COLORS[elem] ?? 0xffffff;
  AudioManager.playAttack(elem);
  playerSprite.setTint(elemColor);

  scene.tweens.add({
    targets:  playerSprite,
    x:        dashX,
    duration: dashDur,
    ease,
    onComplete: () => {
      playerSprite.clearTint();
      const launchX = playerSprite.x;
      const launchY = playerSprite.y - 20;
      launchProjectile({
        scene,
        elem,
        fromX: launchX,
        fromY: launchY,
        toX: enemyContainer.x,
        toY: enemyContainer.y - 10,
        fast: isFastForward,
        stars,
        onHit: onComplete,
      });
      scene.tweens.add({
        targets:  playerSprite,
        x:        startX,
        duration: dashDur + 80,
        ease:     'Power2.easeOut',
      });
    },
  });

  if (elem === 'lightning') {
    scene.tweens.add({
      targets:   playerSprite,
      angle:     { from: -8, to: 8 },
      duration:  30,
      repeat:    5,
      yoyo:      true,
      onComplete: () => playerSprite.setAngle(0),
    });
  }
}

// ── 적 피격 이펙트 ──────────────────────────────────────────────────────────────

export function playEnemyHit(p: EnemyHitParams): void {
  const { scene, enemyContainer, enemyBody, enemyIdleTween, elem, isCrit, mapElement } = p;
  const elemColor = ELEM_COLORS[elem] ?? 0xff0000;
  enemyIdleTween?.pause();

  enemyBody.setFillStyle(elemColor, 0.6);
  const origX = enemyContainer.x;

  if (isCrit) {
    scene.cameras.main.shake(200, 0.01);
    enemyContainer.setScale(1.1);
  }

  scene.tweens.add({
    targets:  enemyContainer,
    x:        { from: origX - (isCrit ? 18 : 12), to: origX + (isCrit ? 18 : 12) },
    duration: isCrit ? 40 : 60,
    repeat:   isCrit ? 5 : 3,
    yoyo:     true,
    onComplete: () => {
      enemyContainer.x = origX;
      enemyContainer.setScale(1.0);
      enemyBody.setFillStyle(ELEM_COLORS[mapElement] ?? 0xff6666, 0.15);
      enemyIdleTween?.resume();
    },
  });
}

// ── 플레이어 피격 이펙트 ────────────────────────────────────────────────────────

export function playPlayerHit(p: PlayerHitParams): void {
  const { scene, playerSprite } = p;
  AudioManager.play('HIT');
  playerSprite.setTint(0xff0000);
  scene.cameras.main.shake(200, 0.015);

  const origX = playerSprite.x;
  scene.tweens.add({
    targets:  playerSprite,
    x:        { from: origX - 15, to: origX + 15 },
    duration: 50,
    repeat:   4,
    yoyo:     true,
    onComplete: () => {
      playerSprite.x = origX;
      playerSprite.clearTint();
    },
  });
}
