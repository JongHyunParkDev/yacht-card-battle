// ─── IndianPokerEvent.ts — 인디언 포커 + 덱 정화 이벤트 ─────────────────────────

import { CARD_DATA_LIST } from '@src/data/cardData';
import { i18n } from '@src/utils/localization';
import type NodeEventScene from '@src/scenes/NodeEventScene';
import type { NodeEventData } from '@src/scenes/NodeEventScene';

const FONT_B = 'SBAggroB';
const FONT_M = 'SBAggroM';

// ─── 인디언 포커 이벤트 ────────────────────────────────────────────────────────

export function createIndianPokerEvent(
  scene: NodeEventScene,
  root: Phaser.GameObjects.Container,
  data: NodeEventData,
  W: number,
  H: number,
): void {
  const { mapElement } = data;
  const TOTAL_ROUNDS   = 5;

  let currentRound = 1;
  let foldTokens   = 1;
  let betAttempts  = 1;
  let winStreak    = 0;
  let gameEnded    = false;
  let locked       = false;

  const gen = () => ({
    playerStars: Math.floor(Math.random() * 5) + 1,
    aiStars:     Math.floor(Math.random() * 5) + 1,
  });
  let cards = gen();

  const title   = scene.makeHeader('row1_4', i18n.f('indianPokerTitle', { elem: scene.elementName(mapElement) }), -H * 0.38);
  const divider = scene.makeDivider(-H * 0.30);

  const roundLabel = scene.add.text(0, -H * 0.25, `${i18n.t('round')}  ${currentRound} / ${TOTAL_ROUNDS}`, {
    fontFamily: FONT_B, fontSize: '22px', color: '#cccccc',
  }).setOrigin(0.5);

  const tokenLabel = scene.add.text(-W * 0.15, -H * 0.19, `${i18n.t('foldToken')}: ${foldTokens}`, {
    fontFamily: FONT_M, fontSize: '16px', color: '#aaaaaa',
  }).setOrigin(0.5);

  const attemptLabel = scene.add.text(W * 0.15, -H * 0.19, `${i18n.t('remainChance')}: ${betAttempts}`, {
    fontFamily: FONT_M, fontSize: '16px', color: '#aaaaaa',
  }).setOrigin(0.5);

  const CARD_W = Math.round(W * 0.09);
  const CARD_H = Math.round(H * 0.24);
  const cardY  = -H * 0.04;

  const aiCardG = scene.add.graphics();
  aiCardG.fillStyle(0x2a1a4a, 1); aiCardG.lineStyle(2, 0x9966cc, 1);
  aiCardG.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
  aiCardG.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
  aiCardG.setPosition(-W * 0.12, cardY);

  const aiStarTxt = scene.add.text(-W * 0.12, cardY, `★ ${cards.aiStars}`, {
    fontFamily: FONT_B, fontSize: '28px', color: '#f5cc4a',
  }).setOrigin(0.5);
  const aiLbl = scene.add.text(-W * 0.12, cardY + CARD_H * 0.6, i18n.t('opponent'), {
    fontFamily: 'SBAggroL', fontSize: '14px', color: '#aaaaaa',
  }).setOrigin(0.5);

  const myCardG = scene.add.graphics();
  myCardG.fillStyle(0x1a2a4a, 1); myCardG.lineStyle(2, 0x6699cc, 1);
  myCardG.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
  myCardG.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
  myCardG.setPosition(W * 0.12, cardY);

  const myCardTxt = scene.add.text(W * 0.12, cardY, '?', {
    fontFamily: FONT_B, fontSize: '36px', color: '#6699cc',
  }).setOrigin(0.5);
  const myLbl = scene.add.text(W * 0.12, cardY + CARD_H * 0.6, i18n.t('myCardHidden'), {
    fontFamily: 'SBAggroL', fontSize: '14px', color: '#aaaaaa',
  }).setOrigin(0.5);

  const statusTxt = scene.add.text(0, H * 0.17, i18n.t('betOrFold'), {
    fontFamily: FONT_M, fontSize: '17px', color: '#cccccc',
  }).setOrigin(0.5);

  const winLbl = scene.add.text(0, H * 0.24, `${i18n.t('obtainableCard')}: ${i18n.t('none')}`, {
    fontFamily: FONT_M, fontSize: '16px', color: '#f5cc4a',
  }).setOrigin(0.5);

  const refresh = () => {
    roundLabel.setText(`${i18n.t('round')}  ${currentRound} / ${TOTAL_ROUNDS}`);
    tokenLabel.setText(`${i18n.t('foldToken')}: ${foldTokens}`);
    attemptLabel.setText(`${i18n.t('remainChance')}: ${betAttempts}`);
    aiStarTxt.setText(`★ ${cards.aiStars}`);
    winLbl.setText(`${i18n.t('obtainableCard')}: ${winStreak > 0 ? `★ ${winStreak}` : i18n.t('none')}`);
  };

  const BW  = Math.round(W * 0.20);
  const BG  = Math.round(W * 0.03);
  const BY  = H * 0.36;
  const B2_LEFT  = -(BW / 2 + BG / 2);
  const B2_RIGHT =  (BW / 2 + BG / 2);

  const takeNowBtn = scene.makeButton(B2_LEFT, BY, i18n.t('receive'), 0x1a5c1a, () => {
    gameEnded = true;
    scene.tweens.add({
      targets: root, alpha: 0, duration: 180,
      onComplete: () => {
        root.removeAll(true);
        root.setAlpha(1);
        const resTitle = scene.makeHeader('row1_4', '포커 보상 획득', -H * 0.15);
        const resMsg = scene.add.text(0, 0, `포커 게임을 종료하고\n장비 카드 ${winStreak}장을 획득합니다.`, {
          fontFamily: FONT_M, fontSize: '20px', color: '#f5cc4a', align: 'center',
        }).setOrigin(0.5);
        const confirmBtn = scene.makeButton(0, H * 0.22, i18n.t('confirm') || '확인', 0x27ae60, () => {
          scene.closeEvent({ pokerCard: winStreak });
        }, 140, 50);
        root.add([resTitle, resMsg, confirmBtn]);
      },
    });
  }, BW, 52) as Phaser.GameObjects.Container;
  takeNowBtn.setVisible(false);

  const continueBtn = scene.makeButton(B2_RIGHT, BY, i18n.t('continueBtn'), 0x1a3a6c, () => {
    takeNowBtn.setVisible(false);
    continueBtn.setVisible(false);
    myCardTxt.setText('?').setColor('#6699cc'); myLbl.setText(i18n.t('myCardHidden'));
    locked = false; betBtn.setAlpha(1).setVisible(true); foldBtn.setAlpha(1).setVisible(true);
    statusTxt.setText(i18n.t('betOrFold')).setColor('#cccccc');
    refresh();
  }, BW, 52) as Phaser.GameObjects.Container;
  continueBtn.setVisible(false);

  const promptTake = (onContinue: () => void) => {
    if (winStreak === 0 || currentRound > TOTAL_ROUNDS) { onContinue(); return; }
    statusTxt.setText(i18n.f('pokerTakeConfirm', { n: winStreak })).setColor('#f5cc4a');
    betBtn.setVisible(false);
    foldBtn.setVisible(false);
    takeNowBtn.setVisible(true);
    continueBtn.setVisible(true);
  };

  const revealAndResolve = () => {
    locked = true;
    betBtn.setAlpha(0.4); foldBtn.setAlpha(0.4);

    myCardTxt.setText(`★ ${cards.playerStars}`).setColor('#f5cc4a');
    myLbl.setText(i18n.t('myCardRevealed'));
    scene.tweens.add({ targets: myCardTxt, scaleX: 1.3, scaleY: 1.3, duration: 180, yoyo: true, ease: 'Power2' });
    statusTxt.setText(i18n.t('cardReveal')).setColor('#cccccc');

    scene.time.delayedCall(700, () => {
      const res = cards.playerStars > cards.aiStars ? 'win'
                : cards.playerStars < cards.aiStars ? 'lose' : 'draw';

      if (res === 'win') {
        winStreak++;
        currentRound++;
        foldTokens = 1; betAttempts = 1;
        statusTxt.setText(i18n.f('pokerWin', { n: winStreak })).setColor('#2ecc71');
        refresh();

        if (currentRound > TOTAL_ROUNDS) {
          gameEnded = true;
          statusTxt.setText(i18n.f('pokerSweep', { n: winStreak })).setColor('#f5cc4a');
          betBtn.setVisible(false); foldBtn.setVisible(false);

          scene.time.delayedCall(1400, () => {
            scene.tweens.add({
              targets: root, alpha: 0, duration: 180,
              onComplete: () => {
                root.removeAll(true);
                root.setAlpha(1);
                const resTitle = scene.makeHeader('row1_4', '포커 올킬!', -H * 0.15);
                const resMsg = scene.add.text(0, 0, `모든 라운드에서 승인하여\n최종 보상 (${winStreak}장)을 획득하셨습니다!`, {
                  fontFamily: FONT_B, fontSize: '22px', color: '#2ecc71', align: 'center',
                }).setOrigin(0.5);
                const confirmBtn = scene.makeButton(0, H * 0.22, i18n.t('confirm') || '확인', 0x27ae60, () => {
                  scene.closeEvent({ pokerCard: winStreak });
                }, 140, 50);
                root.add([resTitle, resMsg, confirmBtn]);
              },
            });
          });
          return;
        }

        scene.time.delayedCall(1400, () => {
          cards = gen();
          myCardTxt.setText('?').setColor('#6699cc');
          myLbl.setText(i18n.t('myCardHidden'));
          aiStarTxt.setText(`★ ${cards.aiStars}`);
          locked = false; betBtn.setAlpha(1); foldBtn.setAlpha(1);
          promptTake(() => {
            statusTxt.setText(i18n.t('betOrFold')).setColor('#cccccc');
            betBtn.setVisible(true); foldBtn.setVisible(true);
            refresh();
          });
        });

      } else if (res === 'draw') {
        statusTxt.setText(i18n.t('pokerDraw')).setColor('#ffdb58');
        scene.time.delayedCall(1200, () => {
          cards = gen();
          myCardTxt.setText('?').setColor('#6699cc');
          myLbl.setText(i18n.t('myCardHidden'));
          aiStarTxt.setText(`★ ${cards.aiStars}`);
          locked = false; betBtn.setAlpha(1); foldBtn.setAlpha(1);
          statusTxt.setText(i18n.t('betOrFold')).setColor('#cccccc');
        });

      } else {
        betAttempts--;
        statusTxt.setText(i18n.f('pokerLose', { n: betAttempts })).setColor('#e74c3c');
        attemptLabel.setText(`${i18n.t('remainChance')}: ${betAttempts}`);

        if (betAttempts <= 0) {
          gameEnded = true;
          betBtn.setVisible(false); foldBtn.setVisible(false);
          statusTxt.setText(i18n.t('pokerExhausted')).setColor('#e74c3c');

          scene.time.delayedCall(1400, () => {
            scene.tweens.add({
              targets: root, alpha: 0, duration: 180,
              onComplete: () => {
                root.removeAll(true);
                root.setAlpha(1);
                const resTitle = scene.makeHeader('row1_4', '도전 실패', -H * 0.15);
                const resMsg = scene.add.text(0, 0, '모든 배팅 횟수를 소진하였습니다.\n보상을 획득하지 못했습니다.', {
                  fontFamily: FONT_M, fontSize: '18px', color: '#e74c3c', align: 'center',
                }).setOrigin(0.5);
                const confirmBtn = scene.makeButton(0, H * 0.22, i18n.t('confirm') || '확인', 0x3a1a1a, () => {
                  scene.closeEvent({ pokerCard: 0 });
                }, 140, 50);
                root.add([resTitle, resMsg, confirmBtn]);
              },
            });
          });
        } else {
          scene.time.delayedCall(1200, () => {
            cards = gen();
            myCardTxt.setText('?').setColor('#6699cc');
            myLbl.setText(i18n.t('myCardHidden'));
            aiStarTxt.setText(`★ ${cards.aiStars}`);
            locked = false; betBtn.setAlpha(1); foldBtn.setAlpha(1);
            statusTxt.setText(i18n.t('betOrFold')).setColor('#cccccc');
          });
        }
      }
    });
  };

  const betBtn = scene.makeButton(B2_LEFT, BY, i18n.t('bet'), 0x1a5c1a, () => {
    if (gameEnded || locked) return;
    revealAndResolve();
  }, BW, 52);

  const foldBtn = scene.makeButton(B2_RIGHT, BY, i18n.t('pokerFold'), 0x5c3a1a, () => {
    if (gameEnded || locked) return;
    if (foldTokens <= 0) {
      statusTxt.setText(i18n.t('noFoldToken')).setColor('#e74c3c');
      return;
    }
    locked = true;
    betBtn.setAlpha(0.4); foldBtn.setAlpha(0.4);
    myCardTxt.setText(`★ ${cards.playerStars}`).setColor('#aaaaaa');
    myLbl.setText(i18n.t('myCardRevealed'));
    scene.tweens.add({ targets: myCardTxt, scaleX: 1.2, scaleY: 1.2, duration: 150, yoyo: true });

    if (cards.playerStars === 5) {
      gameEnded = true;
      statusTxt.setText('5성 카드를 손에 쥐고 포기...\n이벤트가 즉시 종료됩니다.').setColor('#e74c3c');
      betBtn.setVisible(false); foldBtn.setVisible(false);
      scene.time.delayedCall(1400, () => {
        scene.tweens.add({
          targets: root, alpha: 0, duration: 180,
          onComplete: () => {
            root.removeAll(true);
            root.setAlpha(1);
            const resTitle = scene.makeHeader('row1_4', '포커 강제 종료', -H * 0.15);
            const resMsg   = scene.add.text(0, 0,
              '5성 카드를 들고 배팅을 포기하면\n이벤트가 즉시 종료됩니다.\n보상을 받지 못합니다.', {
              fontFamily: FONT_M, fontSize: '18px', color: '#e74c3c', align: 'center',
            }).setOrigin(0.5);
            const confirmBtn = scene.makeButton(0, H * 0.22, i18n.t('confirm') || '확인', 0x3a1a1a, () => {
              scene.closeEvent({ pokerCard: 0 });
            }, 140, 50);
            root.add([resTitle, resMsg, confirmBtn]);
          },
        });
      });
      return;
    }

    foldTokens--;
    statusTxt.setText(i18n.f('pokerFolded', { n: foldTokens })).setColor('#aaaaaa');
    scene.time.delayedCall(900, () => {
      cards = gen();
      myCardTxt.setText('?').setColor('#6699cc'); myLbl.setText(i18n.t('myCardHidden'));
      aiStarTxt.setText(`★ ${cards.aiStars}`);
      tokenLabel.setText(`${i18n.t('foldToken')}: ${foldTokens}`);
      locked = false; betBtn.setAlpha(1); foldBtn.setAlpha(1);
      statusTxt.setText(i18n.t('betOrFold')).setColor('#cccccc');
    });
  }, BW, 56);

  root.add([
    title, divider, roundLabel, tokenLabel, attemptLabel,
    aiCardG, aiStarTxt, aiLbl,
    myCardG, myCardTxt, myLbl,
    statusTxt, winLbl,
    betBtn, foldBtn, takeNowBtn, continueBtn,
  ]);
}

// ─── 덱 정화 이벤트 ────────────────────────────────────────────────────────────

export function createDeckPurificationEvent(
  scene: NodeEventScene,
  root: Phaser.GameObjects.Container,
  data: NodeEventData,
  W: number,
  H: number,
): void {
  const ELEM_OFFSET: Record<string, number> = { water:0, fire:5, grass:10, lightning:15, earth:20 };

  const title   = scene.makeHeader('row1_4', '덱 정화', -H * 0.38);
  const divider = scene.makeDivider(-H * 0.30, W * 0.7);
  const desc    = scene.add.text(0, -H * 0.23, '제거할 카드 1장을 선택하세요.\n카드를 제거하면 덱이 강해집니다.', {
    fontFamily: FONT_M, fontSize: '17px', color: '#cccccc', align: 'center', lineSpacing: 4,
  }).setOrigin(0.5);
  root.add([title, divider, desc]);

  const allCards = data.deck;
  if (allCards.length === 0) {
    root.add([
      scene.makeBody('제거할 카드가 없습니다.', H * 0.02),
      scene.makeButton(0, H * 0.22, '확인', 0x333333, () => scene.closeEvent({}), Math.round(W * 0.22), 50),
    ]);
    return;
  }

  scene.createScrollableCardGrid(allCards, 1.0, (entry, cardData) => {
    const removedCardId = entry.cardId;

    scene.tweens.add({ targets: root, alpha: 0, duration: 180, onComplete: () => {
      root.removeAll(true);
      root.setAlpha(1);

      const upgradeable = allCards.filter(e => {
        if (e.cardId === removedCardId) return false;
        const cd = CARD_DATA_LIST.find(c => c.id === e.cardId);
        return cd && cd.element !== 'normal' && cd.stars < 5 && cd.element in ELEM_OFFSET;
      });

      root.add([
        scene.makeHeader('row1_4', '보너스: 카드 강화', -H * 0.38),
        scene.makeDivider(-H * 0.30, W * 0.7),
        scene.add.text(0, -H * 0.23,
          `[${i18n.t(cardData.nameKey)}] 제거 완료!\n강화할 카드를 선택하거나 건너뛰세요.`, {
          fontFamily: FONT_M, fontSize: '16px', color: '#f5cc4a', align: 'center', lineSpacing: 4,
        }).setOrigin(0.5),
      ]);

      const skipBtn = scene.makeButton(0, H * 0.36, '건너뛰기', 0x333333, () => {
        scene.closeEvent({ removeCardId: removedCardId });
      }, Math.round(W * 0.24), 46);
      root.add(skipBtn);

      if (upgradeable.length === 0) {
        const noneTxt = scene.add.text(0, H * 0.04, '강화할 수 있는 카드가 없습니다.', {
          fontFamily: FONT_M, fontSize: '16px', color: '#aaaaaa',
        }).setOrigin(0.5);
        root.add(noneTxt);
        return;
      }

      scene.createScrollableCardGrid(upgradeable, 1.0, (upgradeEntry, upgradeCard) => {
        scene.tweens.add({ targets: root, alpha: 0, duration: 180, onComplete: () => {
          root.removeAll(true);
          root.setAlpha(1);

          const off = ELEM_OFFSET[upgradeCard.element];
          const upgradedCard = off != null ? CARD_DATA_LIST[off + upgradeCard.stars] : null;

          const group: Phaser.GameObjects.GameObject[] = [
            scene.makeHeader('row1_4', '덱 정화 완료!', -H * 0.32),
          ];

          if (upgradedCard) {
            const SC = 0.82, sw = CARD_WIDTH * SC;
            group.push(
              scene.add.text(-sw * 1.2, -H * 0.17, '제거', {
                fontFamily: FONT_M, fontSize: '13px', color: '#e74c3c',
              }).setOrigin(0.5),
              scene.add.text(sw * 0.8, -H * 0.17, '강화', {
                fontFamily: FONT_M, fontSize: '13px', color: '#2ecc71',
              }).setOrigin(0.5),
              new Card(scene, -sw * 1.2 - sw / 2, -H * 0.12 - (CARD_HEIGHT * SC) / 2, cardData).setScale(SC),
              scene.add.text(0, -H * 0.08, '▶', { fontFamily: FONT_B, fontSize: '36px', color: '#fff' }).setOrigin(0.5),
              new Card(scene, sw * 0.8 - sw / 2, -H * 0.12 - (CARD_HEIGHT * SC) / 2, upgradedCard).setScale(SC),
            );
          }

          group.push(
            scene.add.text(0, H * 0.22, '카드 제거 + 강화 완료!', {
              fontFamily: FONT_B, fontSize: '20px', color: '#2ecc71',
            }).setOrigin(0.5),
            scene.makeButton(0, H * 0.35, '확인', 0x27ae60, () => {
              scene.closeEvent({ removeCardId: removedCardId, upgradeStarCardId: upgradeEntry.cardId });
            }, Math.round(W * 0.28), 56),
          );
          root.add(group);
        }});
      }, '#2ecc71');
    }});
  }, '#e74c3c');
}

// Card and CARD_WIDTH/CARD_HEIGHT imports needed by createDeckPurificationEvent
import Card, { CARD_WIDTH, CARD_HEIGHT } from '@src/objects/Card';
