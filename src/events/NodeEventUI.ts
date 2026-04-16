// ─── NodeEventUI.ts — NodeEventScene 공통 UI 헬퍼 ────────────────────────────────

import { AudioManager } from '@src/utils/Audio';

const COLOR_GOLD = 0xd4af37;
const FONT_B = 'SBAggroB';
const FONT_M = 'SBAggroM';

export function makeDivider(
  scene: Phaser.Scene,
  y: number,
  W: number,
  w?: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(1, COLOR_GOLD, 0.3);
  const width = w ?? W * 0.4;
  g.lineBetween(-width, y, width, y);
  return g;
}

export function makeTitle(
  scene: Phaser.Scene,
  text: string,
  y: number,
  color = '#d4af37',
): Phaser.GameObjects.Text {
  return scene.add.text(0, y, text, {
    fontFamily: FONT_B, fontSize: '34px', color,
  }).setOrigin(0.5);
}

export function makeHeader(
  scene: Phaser.Scene,
  frame: string,
  text: string,
  y: number,
  iconSize = 64,
  color = '#d4af37',
): Phaser.GameObjects.Container {
  const cont = scene.add.container(0, y);
  const txt = scene.add.text(0, 0, text, {
    fontFamily: FONT_B, fontSize: '32px', color,
  }).setOrigin(0, 0.5);
  const gap    = 14;
  const totalW = iconSize + gap + txt.width;
  const startX = -totalW / 2;
  const icon = scene.add.image(startX + iconSize / 2, 0, 'map_nodes', frame);
  icon.setDisplaySize(iconSize, iconSize);
  txt.setX(startX + iconSize + gap);
  cont.add([icon, txt]);
  return cont;
}

export function makeBody(
  scene: Phaser.Scene,
  text: string,
  y: number,
  W: number,
): Phaser.GameObjects.Text {
  return scene.add.text(0, y, text, {
    fontFamily: FONT_M, fontSize: '18px', color: '#cccccc',
    wordWrap: { width: W * 0.7 }, align: 'center',
  }).setOrigin(0.5);
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  bgColor: number,
  onDown: () => void,
  W: number,
  w?: number,
  h = 54,
): Phaser.GameObjects.Container {
  const bw  = w ?? Math.round(W * 0.18);
  const btn = scene.add.container(x, y);

  const bg = scene.add.graphics();
  bg.fillStyle(bgColor, 1);
  bg.lineStyle(1, COLOR_GOLD, 0.6);
  bg.fillRoundedRect(-bw / 2, -h / 2, bw, h, 10);
  bg.strokeRoundedRect(-bw / 2, -h / 2, bw, h, 10);

  const txt = scene.add.text(0, 0, label, {
    fontFamily: FONT_M, fontSize: '20px', color: '#ffffff',
    wordWrap: { width: bw - 20 }, align: 'center',
  }).setOrigin(0.5);

  btn.add([bg, txt]);
  btn.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -h / 2, bw, h), Phaser.Geom.Rectangle.Contains);
  btn.on('pointerover', () => txt.setColor('#ffdb58').setScale(1.05));
  btn.on('pointerout',  () => txt.setColor('#ffffff').setScale(1));
  btn.on('pointerdown', () => {
    AudioManager.play('CLICK');
    onDown();
  });
  return btn;
}
