# 카드 수치 계산 규칙 (Card Value Calculation Rules)

> **주의**: 카드 표시값과 전투 계산값이 항상 일치해야 한다.
> 새로운 배율 요소가 추가될 때마다 이 문서와 아래 3개 파일을 모두 업데이트할 것.

---

## 기본 공식

### 공격/화살/투창/HP 카드
```
실제값 = (card.value + card.bonusValue) × card.mult × playerCardMult
```

### 방어/쉴드 카드 (defense, shield)
```
실제값 = (card.value + card.bonusValue) × card.mult × playerCardMult × playerShieldMult
```

---

## 반영해야 하는 곳 (표시값 = 실제값이어야 함)

| 파일 | 위치 | 처리 방식 |
|---|---|---|
| `src/scenes/BattleScene.ts` | `buildHandUI()` — `new Card(...)` 생성 시 | `displayMult`에 playerCardMult (방어는 ×playerShieldMult) 포함 |
| `src/scenes/MainScene.ts` | 덱 패널 카드 목록 `new Card(...)` 생성 시 | `totalMult`에 playerCardMult (방어는 ×playerShieldMult) 포함 |
| `src/scenes/MainScene.ts` | `showCardDetailPopup()` 호출 시 | 위 `totalMult`와 동일한 값 전달 |

---

## 배율 요소 목록

| 필드 | 위치 | 설명 |
|---|---|---|
| `card.mult` | CardData (런타임) | 카드 개별 배율 (별 강화, Enhance 이벤트) |
| `card.bonusValue` | CardData (런타임) | 별 강화로 누적된 기본값 보너스 |
| `cardMultipliers[cardId]` | MainScene | Enhance 이벤트 결과 개별 카드 배율 (곱셈 누적) |
| `playerCardMult` | MainScene / BattleSceneData | 전체 카드 배율 (HEART 이벤트, 장비 등) — **가산 방식** |
| `playerShieldMult` | MainScene / BattleSceneData | 방어 카드 전용 배율 (SHIELD_UP 이벤트, 장비) — **가산 방식** |

---

## 가산(Additive) 누적 방식 — 중요!

`playerCardMult`와 `playerShieldMult`는 **복리(×=) 방식이 아니라 가산 방식**:

```typescript
// 올바른 가산 방식
playerCardMult = parseFloat((playerCardMult + (gain - 1)).toFixed(4));
// 예: 1.0 + 0.2 = 1.2 → 1.2 + 0.2 = 1.4 → 1.4 + 0.2 = 1.6

// 절대 금지
playerCardMult *= gain; // ← 복리 방식 금지!
```

---

## 실제 계산 코드 위치 (BattleScene.ts)

```typescript
// line ~974
const baseVal = (card.value + (card.bonusValue || 0)) * (card.mult || 1.0) * (data_.playerCardMult || 1.0);

// 방어/쉴드 카드
shield = baseVal * (data_.playerShieldMult || 1.0);
// Guardian 패시브 추가: shield *= 2

// 공격 카드
dmg = baseVal;
// (속성 상성, 크리티컬, 콤보 보너스는 별도 계산)
```

---

## 체크리스트 (새 배율 요소 추가 시)

- [ ] `BattleScene.ts` `buildHandUI()` 의 `displayMult` 계산에 반영
- [ ] `MainScene.ts` 덱 패널의 `totalMult` 계산에 반영
- [ ] `MainScene.ts` `showCardDetailPopup()` 전달값에 반영
- [ ] `BattleScene.ts` 실제 전투 계산 로직에 반영
- [ ] `CLAUDE.md` 배율 적용 규칙 섹션 업데이트
- [ ] 이 파일(`CARD_VALUE_RULES.md`) 업데이트
