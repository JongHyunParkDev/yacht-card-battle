// ─── TreasureEvent.ts — 보물 이벤트 (4번 노드) ───────────────────────────────────

import {
  drawEquipment, formatEquipStats, getEquipmentById,
  EQUIP_GRADE_LABEL, EQUIP_GRADE_COLOR,
  type EquipmentData,
} from '@src/data/equipmentData';
import { i18n } from '@src/utils/localization';
import { AudioManager } from '@src/utils/Audio';
import type NodeEventScene from '@src/scenes/NodeEventScene';
import type { NodeEventData } from '@src/scenes/NodeEventScene';

export function createTreasureEvent(
  scene: NodeEventScene,
  root: Phaser.GameObjects.Container,
  data: NodeEventData,
  W: number,
  H: number,
): void {
  const { playerEquipment, maxEquipSlots } = data;
  const isFull = playerEquipment.length >= maxEquipSlots;

  const drawn = drawEquipment(3, playerEquipment);

  const slotText = i18n.f('treasureSlot', { cur: playerEquipment.length, max: maxEquipSlots });
  const title   = scene.makeHeader('row0_3', i18n.t('treasureTitle'), -H * 0.35);
  const slotLbl = scene.add.text(0, -H * 0.275, slotText, {
    fontFamily: 'SBAggroM', fontSize: '16px',
    color: isFull ? '#e74c3c' : '#aaaaaa',
  }).setOrigin(0.5);
  const hintTxt = scene.add.text(0, -H * 0.235,
    '아이콘에 마우스를 올리면 상세 정보를 볼 수 있습니다', {
      fontFamily: 'SBAggroL', fontSize: '12px', color: '#666688',
    }).setOrigin(0.5);
  const divider = scene.makeDivider(-H * 0.19);

  const buildResult = (equip: EquipmentData) => {
    const r: Record<string, unknown> = { equipment: equip.id };
    const s = equip.stats;
    if (s.atk)        r.atkDelta            = s.atk;
    if (s.def)        r.defDelta            = s.def;
    if (s.crit)       r.critDelta           = s.crit;
    if (s.critDmg)    r.critDmgDelta        = s.critDmg;
    if (s.maxHp)      r.maxHpDelta          = s.maxHp;
    if (s.cardMult)   r.cardValueMultiplier = s.cardMult;
    if (s.shieldMult) r.shieldMultiplier    = s.shieldMult;
    return r;
  };

  const pickEquip = (equip: EquipmentData) => {
    const result = buildResult(equip);
    if (!isFull) {
      scene.tweens.add({
        targets: root, alpha: 0, duration: 180,
        onComplete: () => {
          root.removeAll(true);
          root.setAlpha(1);
          const resTitle   = scene.makeHeader('row0_3', '장비 획득!', -H * 0.37);
          const gradeColor = EQUIP_GRADE_COLOR[equip.grade];
          const nameText   = scene.add.text(0, -H * 0.22, equip.name, {
            fontFamily: 'SBAggroB', fontSize: '28px', color: gradeColor,
          }).setOrigin(0.5);
          const statsText  = scene.add.text(0, -H * 0.12, formatEquipStats(equip.stats), {
            fontFamily: 'SBAggroM', fontSize: '18px', color: '#cccccc', align: 'center',
          }).setOrigin(0.5);
          const specialText = equip.special
            ? scene.add.text(0, -H * 0.02, `★ ${equip.special.desc}`, {
                fontFamily: 'SBAggroM', fontSize: '16px', color: '#f5cc4a',
              }).setOrigin(0.5)
            : null;
          const confirmBtn = scene.makeButton(
            0, H * 0.25, i18n.t('confirm') || '확인', 0x3a2800,
            () => scene.closeEvent(result),
            Math.round(W * 0.28), 56,
          );
          const items: Phaser.GameObjects.GameObject[] = [resTitle, nameText, statsText, confirmBtn];
          if (specialText) items.splice(3, 0, specialText);
          root.add(items);
        },
      });
      return;
    }

    // 슬롯 가득 찬 경우 → 교체 선택 화면
    scene.tweens.add({
      targets: root, alpha: 0, duration: 180,
      onComplete: () => {
        root.removeAll(true);
        root.setAlpha(1);

        const replaceTitle = scene.makeTitle(i18n.t('treasureReplaceTitle'), -H * 0.40);

        const ICON = Math.min(Math.round(W * 0.12), 80);
        const newGradeHex = parseInt(EQUIP_GRADE_COLOR[equip.grade].replace('#', '0x'));
        const newCont = scene.add.container(0, -H * 0.28);
        const newBg = scene.add.graphics();
        newBg.fillStyle(0x10101e, 0.95);
        newBg.lineStyle(2.5, newGradeHex, 1);
        newBg.fillRoundedRect(-ICON / 2, -ICON / 2, ICON, ICON, 8);
        newBg.strokeRoundedRect(-ICON / 2, -ICON / 2, ICON, ICON, 8);
        const newSprite = scene.add.sprite(0, -4, equip.texture, equip.frame);
        newSprite.setDisplaySize(Math.round(ICON * 0.65), Math.round(ICON * 0.65));
        const newGradeLbl = scene.add.text(0, -ICON / 2 + 4, EQUIP_GRADE_LABEL[equip.grade], {
          fontFamily: 'SBAggroB', fontSize: '10px', color: EQUIP_GRADE_COLOR[equip.grade],
        }).setOrigin(0.5, 0);
        const newNameLbl = scene.add.text(0, ICON / 2 + 4, equip.name, {
          fontFamily: 'SBAggroM', fontSize: '12px', color: EQUIP_GRADE_COLOR[equip.grade],
          align: 'center', wordWrap: { width: ICON + 40 },
        }).setOrigin(0.5, 0);
        newCont.add([newBg, newSprite, newGradeLbl, newNameLbl]);

        const newStatsStr = formatEquipStats(equip.stats) + (equip.special ? `\n★ ${equip.special.desc}` : '');
        const newStatsTxt = scene.add.text(ICON / 2 + 14, -H * 0.28, newStatsStr, {
          fontFamily: 'SBAggroM', fontSize: '12px', color: EQUIP_GRADE_COLOR[equip.grade], lineSpacing: 3,
        }).setOrigin(0, 0.5);

        const div2    = scene.makeDivider(-H * 0.14);
        const guideTxt = scene.add.text(0, -H * 0.09, '교체할 장비를 선택하거나 건너뛰세요', {
          fontFamily: 'SBAggroM', fontSize: '13px', color: '#888888',
        }).setOrigin(0.5);

        // 공유 툴팁
        const tooltipCont = scene.add.container(0, 0).setDepth(3000).setVisible(false);
        const tooltipBg   = scene.add.graphics();
        const tooltipText = scene.add.text(12, 10, '', {
          fontFamily: 'SBAggroM', fontSize: '14px', color: '#eeeeee', lineSpacing: 5,
          wordWrap: { width: 260 },
        });
        tooltipCont.add([tooltipBg, tooltipText]);
        root.add(tooltipCont);

        const slotItems: Phaser.GameObjects.GameObject[] = [];
        playerEquipment.forEach((eqId, idx) => {
          const owned = getEquipmentById(eqId);
          if (!owned) return;
          const ownedGradeHex = parseInt(EQUIP_GRADE_COLOR[owned.grade].replace('#', '0x'));
          const rowY = -H * 0.02 + idx * (ICON + 28 + H * 0.035);

          const slotCont = scene.add.container(-W * 0.28, rowY);
          const slotBg = scene.add.graphics();
          slotBg.fillStyle(0x1a1a2e, 1);
          slotBg.lineStyle(2, ownedGradeHex, 0.85);
          slotBg.fillRoundedRect(-ICON / 2, -ICON / 2, ICON, ICON, 6);
          slotBg.strokeRoundedRect(-ICON / 2, -ICON / 2, ICON, ICON, 6);
          const slotSprite = scene.add.sprite(0, 0, owned.texture, owned.frame);
          slotSprite.setDisplaySize(Math.round(ICON * 0.65), Math.round(ICON * 0.65));
          const slotNameLbl = scene.add.text(0, ICON / 2 + 3, `${owned.name}`, {
            fontFamily: 'SBAggroM', fontSize: '10px', color: EQUIP_GRADE_COLOR[owned.grade],
            align: 'center', wordWrap: { width: ICON + 30 },
          }).setOrigin(0.5, 0);
          slotCont.add([slotBg, slotSprite, slotNameLbl]);
          slotCont.setSize(ICON, ICON);
          slotCont.setInteractive({ useHandCursor: true });

          slotCont.on('pointerover', () => {
            let txt = `[${EQUIP_GRADE_LABEL[owned.grade]}] ${owned.name}\n`;
            txt += `─────────────────\n`;
            txt += formatEquipStats(owned.stats);
            if (owned.special) txt += `\n★ ${owned.special.desc}`;
            tooltipText.setText(txt);
            tooltipCont.setVisible(true);
            const b = tooltipText.getBounds();
            const tw = b.width + 24; const th = b.height + 20;
            tooltipBg.clear();
            tooltipBg.fillStyle(0x0a0a14, 0.96);
            tooltipBg.lineStyle(2, ownedGradeHex, 1);
            tooltipBg.fillRoundedRect(0, 0, tw, th, 7);
            tooltipBg.strokeRoundedRect(0, 0, tw, th, 7);
            tooltipCont.setPosition(-W * 0.28 - tw / 2, rowY - ICON / 2 - th - 8);
          });
          slotCont.on('pointerout', () => tooltipCont.setVisible(false));

          const ownedStatsStr = formatEquipStats(owned.stats) + (owned.special ? `\n★ ${owned.special.desc}` : '');
          const ownedStatsTxt = scene.add.text(-W * 0.28 + ICON / 2 + 12, rowY, ownedStatsStr, {
            fontFamily: 'SBAggroL', fontSize: '11px', color: '#bbbbbb', lineSpacing: 2,
          }).setOrigin(0, 0.5);

          const replBtn = scene.makeButton(W * 0.24, rowY, '교체', 0x5c1a1a, () => {
            scene.tweens.add({
              targets: root, alpha: 0, duration: 180,
              onComplete: () => {
                root.removeAll(true);
                root.setAlpha(1);
                const resTitle2 = scene.makeHeader('row0_3', '장비 교체 완료!', -H * 0.32);
                const resText   = scene.add.text(0, -H * 0.15,
                  `${owned.name}\n→\n${equip.name}`, {
                    fontFamily: 'SBAggroM', fontSize: '20px', color: '#cccccc', align: 'center',
                  }).setOrigin(0.5);
                const confirmBtn2 = scene.makeButton(
                  0, H * 0.25, i18n.t('confirm') || '확인', 0x5c1a1a,
                  () => scene.closeEvent({ ...result, replaceEquipment: eqId }),
                  Math.round(W * 0.28), 56,
                );
                root.add([resTitle2, resText, confirmBtn2]);
              },
            });
          }, Math.round(W * 0.14), 48);

          slotItems.push(slotCont, ownedStatsTxt, replBtn);
        });

        const skipY = -H * 0.02 + playerEquipment.length * (ICON + 28 + H * 0.035) + H * 0.06;
        const skipBtn = scene.makeButton(0, skipY, '교체 안 함  (획득 포기)', 0x1e1e1e,
          () => scene.closeEvent({}),
          Math.round(W * 0.32), 52,
        );

        root.add([replaceTitle, newCont, newStatsTxt, div2, guideTxt, ...slotItems, skipBtn]);
      },
    });
  };

  // ── 아이콘 카드 배치 ──────────────────────────────────────────────────────────
  const CARD_SIZE = Math.min(Math.round(W * 0.18), 130);
  const CARD_GAP  = Math.round(W * 0.04);
  const totalW    = drawn.length * CARD_SIZE + (drawn.length - 1) * CARD_GAP;
  const cardStartX = -totalW / 2;
  const cardY      = -H * 0.04;

  const tooltipCont = scene.add.container(0, 0).setDepth(3000).setVisible(false);
  const tooltipBg   = scene.add.graphics();
  const tooltipText = scene.add.text(12, 10, '', {
    fontFamily: 'SBAggroM', fontSize: '14px', color: '#eeeeee', lineSpacing: 5,
    wordWrap: { width: 260 },
  });
  tooltipCont.add([tooltipBg, tooltipText]);
  root.add(tooltipCont);

  const showTooltip = (equip: EquipmentData, anchorX: number, anchorY: number) => {
    const gradeColor = EQUIP_GRADE_COLOR[equip.grade];
    const gradeLabel = EQUIP_GRADE_LABEL[equip.grade];
    let txt = `[${gradeLabel}] ${equip.name}\n`;
    txt += `─────────────────\n`;
    txt += formatEquipStats(equip.stats);
    if (equip.special) txt += `\n★ ${equip.special.desc}`;

    tooltipText.setText(txt);
    tooltipCont.setVisible(true);

    const b  = tooltipText.getBounds();
    const tw = b.width + 24;
    const th = b.height + 20;
    tooltipBg.clear();
    tooltipBg.fillStyle(0x0a0a14, 0.96);
    tooltipBg.lineStyle(2, parseInt(gradeColor.replace('#', '0x')), 1);
    tooltipBg.fillRoundedRect(0, 0, tw, th, 7);
    tooltipBg.strokeRoundedRect(0, 0, tw, th, 7);

    let tx = anchorX - tw / 2;
    let ty = anchorY - CARD_SIZE / 2 - th - 12;
    if (ty < -H / 2 + 10) ty = anchorY + CARD_SIZE / 2 + 12;
    tooltipCont.setPosition(tx, ty);
  };

  const iconCards = drawn.map((equip, i) => {
    const cx = cardStartX + i * (CARD_SIZE + CARD_GAP) + CARD_SIZE / 2;
    const cy = cardY;
    const gradeHex = parseInt(EQUIP_GRADE_COLOR[equip.grade].replace('#', '0x'));

    const cont = scene.add.container(cx, cy);

    const bg = scene.add.graphics();
    bg.fillStyle(0x10101e, 0.95);
    bg.lineStyle(2.5, gradeHex, 1);
    bg.fillRoundedRect(-CARD_SIZE / 2, -CARD_SIZE / 2, CARD_SIZE, CARD_SIZE, 10);
    bg.strokeRoundedRect(-CARD_SIZE / 2, -CARD_SIZE / 2, CARD_SIZE, CARD_SIZE, 10);

    const iconSize = Math.round(CARD_SIZE * 0.62);
    const sprite   = scene.add.sprite(0, -8, equip.texture, equip.frame);
    sprite.setDisplaySize(iconSize, iconSize);

    const nameLbl = scene.add.text(0, CARD_SIZE / 2 - 22, equip.name, {
      fontFamily: 'SBAggroM', fontSize: '11px',
      color: EQUIP_GRADE_COLOR[equip.grade],
      align: 'center', wordWrap: { width: CARD_SIZE - 8 },
    }).setOrigin(0.5, 0);

    const gradeLbl = scene.add.text(0, -CARD_SIZE / 2 + 6, EQUIP_GRADE_LABEL[equip.grade], {
      fontFamily: 'SBAggroB', fontSize: '10px',
      color: EQUIP_GRADE_COLOR[equip.grade],
    }).setOrigin(0.5, 0);

    cont.add([bg, sprite, gradeLbl, nameLbl]);
    cont.setSize(CARD_SIZE, CARD_SIZE);
    cont.setInteractive({ useHandCursor: true });

    const drawBg = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? 0x1a1a30 : 0x10101e, hover ? 0.98 : 0.95);
      bg.lineStyle(hover ? 3 : 2.5, gradeHex, 1);
      bg.fillRoundedRect(-CARD_SIZE / 2, -CARD_SIZE / 2, CARD_SIZE, CARD_SIZE, 10);
      bg.strokeRoundedRect(-CARD_SIZE / 2, -CARD_SIZE / 2, CARD_SIZE, CARD_SIZE, 10);
    };

    cont.on('pointerover', () => {
      AudioManager.play('CARD_HOVER');
      drawBg(true);
      scene.tweens.add({ targets: cont, scaleX: 1.06, scaleY: 1.06, duration: 100 });
      showTooltip(equip, cx, cy);
    });
    cont.on('pointerout', () => {
      drawBg(false);
      scene.tweens.add({ targets: cont, scaleX: 1, scaleY: 1, duration: 100 });
      tooltipCont.setVisible(false);
    });
    cont.on('pointerdown', () => {
      AudioManager.play('CARD_SELECT');
      pickEquip(equip);
    });

    return cont;
  });

  const skipBtn = scene.makeButton(
    0, H * 0.36,
    i18n.t('skip') || '건너뛰기',
    0x222232,
    () => scene.closeEvent({}),
    Math.round(W * 0.22), 44,
  );

  if (drawn.length === 0) {
    const noEquip = scene.makeBody(i18n.t('noNewEquip'), H * 0.02);
    root.add([title, slotLbl, divider, noEquip, skipBtn]);
    return;
  }

  root.add([title, slotLbl, hintTxt, divider, ...iconCards, skipBtn]);
}
