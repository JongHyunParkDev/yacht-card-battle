# YCB (CB-Tower) 게임 설계 통합 문서

> 최초 작성: 2026-04-16  
> 원본 출처: `CARD_VALUE_RULES.md`, `evaluation.md`, `game_design_analysis.md`, `strategy_architecture.md` 통합  
> **이 문서는 코드 분석 + 기획 지침 + 개선 체크리스트를 하나로 관리하는 마스터 문서다.**

---

## 목차

1. [카드 수치 계산 규칙](#1-카드-수치-계산-규칙)
2. [UX / UI 원칙](#2-ux--ui-원칙)
3. [데이터 영속성 구조](#3-데이터-영속성-구조)
4. [현재 구현 상태](#4-현재-구현-상태)
5. [게임 재미 평가](#5-게임-재미-평가)
6. [밸런스 진단](#6-밸런스-진단)
7. [개선 체크리스트](#7-개선-체크리스트) ← 핵심 관리 섹션
8. [장기 비전 및 상세 기획](#8-장기-비전-및-상세-기획)
9. [코드 구조 가이드라인](#9-코드-구조-가이드라인)

---

## 1. 카드 수치 계산 규칙

> **주의**: 카드 표시값과 전투 계산값이 항상 일치해야 한다.  
> 새로운 배율 요소가 추가될 때마다 이 섹션과 아래 3개 파일을 모두 업데이트할 것.

### 기본 공식

**공격/화살/투창/HP 카드**
```
실제값 = (card.value + card.bonusValue) × card.mult × playerCardMult
```

**방어/쉴드 카드 (defense, shield)**
```
실제값 = (card.value + card.bonusValue) × card.mult × playerCardMult × playerShieldMult
```

### 반영해야 하는 파일

| 파일 | 위치 | 처리 방식 |
|---|---|---|
| `src/scenes/BattleScene.ts` | `buildHandUI()` — `new Card(...)` 생성 시 | `displayMult`에 playerCardMult (방어는 ×playerShieldMult) 포함 |
| `src/scenes/MainScene.ts` | 덱 패널 카드 목록 `new Card(...)` 생성 시 | `totalMult`에 playerCardMult (방어는 ×playerShieldMult) 포함 |
| `src/scenes/MainScene.ts` | `showCardDetailPopup()` 호출 시 | 위 `totalMult`와 동일한 값 전달 |

### 배율 요소 목록

| 필드 | 위치 | 설명 |
|---|---|---|
| `card.mult` | CardData (런타임) | 카드 개별 배율 (별 강화, Enhance 이벤트) |
| `card.bonusValue` | CardData (런타임) | 별 강화로 누적된 기본값 보너스 |
| `cardMultipliers[cardId]` | MainScene | Enhance 이벤트 결과 개별 카드 배율 (곱셈 누적) |
| `playerCardMult` | MainScene / BattleSceneData | 전체 카드 배율 (HEART 이벤트, 장비 등) — **가산 방식** |
| `playerShieldMult` | MainScene / BattleSceneData | 방어 카드 전용 배율 (SHIELD_UP 이벤트, 장비) — **가산 방식** |

### 가산(Additive) 누적 방식 — 중요!

`playerCardMult`와 `playerShieldMult`는 **복리(×=) 방식이 아니라 가산 방식**:

```typescript
// 올바른 가산 방식
playerCardMult = parseFloat((playerCardMult + (gain - 1)).toFixed(4));
// 예: 1.0 + 0.2 = 1.2 → 1.2 + 0.2 = 1.4 → 1.4 + 0.2 = 1.6

// 절대 금지
playerCardMult *= gain; // ← 복리 방식 금지!
```

### 실제 계산 코드 위치 (BattleScene.ts)

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

### 배율 추가 시 체크리스트

- [ ] `BattleScene.ts` `buildHandUI()`의 `displayMult` 계산에 반영
- [ ] `MainScene.ts` 덱 패널의 `totalMult` 계산에 반영
- [ ] `MainScene.ts` `showCardDetailPopup()` 전달값에 반영
- [ ] `BattleScene.ts` 실제 전투 계산 로직에 반영
- [ ] `CLAUDE.md` 배율 적용 규칙 섹션 업데이트
- [ ] 이 파일 배율 요소 목록 섹션 업데이트

---

## 2. UX / UI 원칙

- **사용자 주도적 진행**: 모든 이벤트는 사용자의 명시적인 클릭에 의해 종료. 강제 타임아웃 금지.
- **최소주의 HUD**: 맵 탐험/전투 중 골드량 기본 숨김. 골드 이벤트 발생 시에만 현재 골드+변화량 노출. 메인 화면(Intro)에서만 전체 골드량 영구 노출.
- **표준화된 카드 선택**: 모든 카드 관련 이벤트(강화, 교환, 아이템 사용)는 **가로 드래그형 스크롤 그리드** 사용. 보유 카드 수량(`count`)이 많을 경우 묶지 않고 개별 카드로 펼쳐서 표시.
- **HP 바 왼쪽 고정**: `setOrigin(0, 0.5)` 필수. `setOrigin(0.5, 0.5)` 사용 시 바가 가운데서 줄어드는 버그 발생.
- **테마 일관성**: 모든 모달/배경/카드 UI는 양피지·촛불·나무판자 질감의 9-slice 이미지 사용.
- **i18n 필수**: 모든 UI 텍스트는 `i18n.t('key')` 경유 출력. 하드코딩 금지.

---

## 3. 데이터 영속성 구조

### 파일 역할 구분

| 파일 | 역할 | 내용 |
|---|---|---|
| `savegame.json` | 현재 런 상태 | 맵 진행도, HP, 덱, 스탯, 장비 |
| `legacy.json` | 영구 누적 데이터 | 총 골드, 전체 장비 컬렉션, 런 기록 |
| `settings.json` | 설정 | 언어, 해상도, 볼륨 |

### legacy.json 구조

```json
{
  "runs": [...],
  "totalGold": 0,
  "allEquipment": [],
  "currentGold": 0,
  "currentEquipment": []
}
```

- `totalGold` / `allEquipment`: `save-legacy` 호출 시 누적 (런 종료 시점)
- `currentGold` / `currentEquipment`: `save-persistent` 호출 시 덮어쓰기 (런 중 실시간)

### 씬 간 데이터 동기화 주의사항

- 이벤트로 변동된 스탯(HP, ATK, DEF)이 다음 씬 전환 시 유실되지 않도록 상시 체크
- 카드 교환/업그레이드 완료 후 `playerDeck` 데이터가 즉시 최신화되어 다음 전투에서 수정된 덱이 정확히 로드되어야 함
- Electron IPC 저장 로직은 항상 비동기 처리 고려

---

## 4. 현재 구현 상태

> 기준일: 2026-04-13

### ✅ 구현 완료

| 항목 | 구현 방식 |
|---|---|
| 캐릭터 5종 고유 패시브 | `BattleScene.ts`에서 `characterWeapon` 분기 처리 |
| 카드 별 등급별 고유 효과 | `cardData.ts`의 `effects: CardEffect[]` — 취약/화상/연쇄/다중타격/기절/방깎/관통/회복/방어막 |
| 적 행동 예고 UI | `enemyIntentCont` — 매 턴 예상 데미지, 최종보스 페이즈별 패턴 예고 |
| 상태이상 시스템 | 화상(burn), 취약(vulnerable), 기절(stun), 방깎(armor_break), 연쇄(chain) |
| 최종 보스 3페이즈 | 5턴 제한, 페이즈당 HP 100 리셋, 쉴드 50 부여, 페이즈별 공격 패턴 |
| BGM/SFX 시스템 | 13트랙 BGM, `AudioManager` 볼륨 제어 |
| 데이터 영속성 | savegame.json / legacy.json / settings.json |
| 노드 이벤트 10종 | 전투·강화·보물·도박·카드교환·생명제단·회복의샘·별강화·덱정제·보스 |

### ❌ 미구현

1. **IntroScene 골드 소비처** — 패시브 강화 / 장비 슬롯 열기 (상인 노드 없음)
2. **메타 진행** — 런 간 잠금해제
3. **적 속성별 고유 공격 패턴** — 현재 모든 적이 매 턴 고정 ATK 반격
4. **원소 연쇄 반응** — 젖음·감전·수증기 등 복합 반응
5. **시각 연출** — 히트스탑, 카메라 쉐이크

---

## 5. 게임 재미 평가

> 한 줄 요약: 기반은 탄탄하고 완성도는 높아졌지만, 아직 "또 하고 싶다"는 욕구가 생기지 않는 게임이다.

### 핵심 지표 (5점 만점)

| 지표 | 점수 | 근거 |
|---|---|---|
| 첫 인상 | ★★★★☆ | BGM, 카드 UI, 캐릭터 선택 화면 — 진입감 좋음 |
| 전투의 재미 | ★★★☆☆ | 카드 효과 콤보는 재밌지만 반복 후 단조로워짐 |
| 성장감 | ★★★★☆ | 카드 효과 + 패시브 + 이벤트 보상으로 확보 |
| 긴장감 | ★★★☆☆ | 최종 보스만 긴장됨, 일반 전투는 거의 없음 |
| 반복 플레이 욕구 | ★★☆☆☆ | 한 런 끝나면 "한 번 더" 이유가 없음 |
| 캐릭터 차별성 | ★★★★☆ | 5개 캐릭터가 실제로 다른 방식으로 플레이됨 |
| 완성도 | ★★★★☆ | 눈에 띄는 버그 없이 잘 돌아감 |

### 잘 되어 있는 것 (건드리지 말 것)

- **캐릭터 패시브 시스템**: Guardian 매 턴 쉴드+5, Lancer 즉사 조건, Berserker HP역전 폭발 — 실제로 플레이 스타일 차별화
- **카드 고유 효과**: 속성별 테마(취약·화상·연쇄·방어막·회복)가 명확하고 전략을 만들어냄
- **최종 보스 3페이즈**: 5턴 제한 + 페이즈별 패턴 + 쉴드 리셋 — 잘 설계된 클라이맥스
- **적 행동 예고 UI**: "이번 턴 방어할지 말지" 판단 근거 제공
- **노드 이벤트 다양성**: HEART(HP vs 카드밸류), INDIAN_POKER(덱 정제), CARD_FLIP(도박) — 트레이드오프 있는 좋은 설계

---

## 6. 밸런스 진단

### 캐릭터 밸런스

| 캐릭터 | 현재 평가 | 이유 |
|---|---|---|
| Guardian | 🔴 약함 | 방어막이 1턴짜리 — 방어 캐릭터인데 방어가 항상 손해 |
| Ranger | 🟡 조건부 강함 | chain +50% 패시브 구현됨. 상태이상 선행 필요 |
| Berserker | 🟡 불안정 | 초반 전투에서 패시브 발동(HP <60%) 어려움 |
| Titan | ✅ 강함 | 관통이 후반 보스에 매우 유리 |
| Lancer | 🟡 운 의존 | 투창 카드 드로우 운에 좌우됨 |

### 캐릭터별 추천 속성

> 패시브와 카드 효과 교차 분석 기반. 시작 덱 구성 및 STAR_UP/CARD_SWAP 선택 시 참고.

| 캐릭터 | 1순위 | 2순위 | 이유 |
|---|---|---|---|
| Guardian | 🟤 땅(earth) | 🟢 풀(grass) | shield_add 효과가 방어막 ×2배 패시브와 직결. 풀은 heal+shield_add 조합으로 생존력 극대화 |
| Ranger | ⚡ 번개(lightning) | 💧 물(water) | chain 효과가 chain +50% 패시브와 직결. 물로 취약 선행 시 chain 조건 충족 + 데미지 증폭 |
| Berserker | 🔥 불(fire) | ⚡ 번개(lightning) | 화상으로 적 지속딜 + 자신 HP도 관리해 패시브(HP<60%) 발동 타이밍 조절 가능. 번개 chain 폭딜도 유효 |
| Titan | 💧 물(water) | 🔥 불(fire) | 취약(+50%) + 다중타격 + 관통 조합으로 최대 폭딜. 불은 화상으로 방어력 높은 적도 관통 우회 가능 |
| Lancer | 💧 물(water) | 🔥 불(fire) | 취약(+50%)으로 투창 즉사 조건(크리뎀×밸류 ≥ 적HP) 달성 쉬워짐. 불 화상으로 적 HP 깎아 즉사 세팅 |

**비추천 조합**
- Guardian + 번개: chain은 방어 패시브와 무관, Guardian의 낮은 ATK에 비효율
- Titan + 땅: armor_break가 이미 관통(pierce)인 Titan에게 의미 없음

### 이벤트 밸런스

| 이벤트 | 체감 가치 | 평가 |
|---|---|---|
| HEART (생명력 제단) | ★★★★★ | **과강**. -5HP로 +5% 카드밸류는 항상 이득. 후반 1.3~1.5배까지 쌓임 |
| STAR_UP (별 강화) | ★★★★☆ | 강함. 고성급 카드 = 강한 효과 확보 |
| TREASURE (보물) | ★★★★☆ | 장비 특수효과에 따라 게임 판도 변경 |
| ENHANCE (강화) | ★★★☆☆ | 안정적이나 극적 변화 없음 |
| INDIAN_POKER (덱 정제) | ★★★☆☆ | 카드 교환이지 제거가 아니라서 임팩트 제한 |
| CARD_SWAP (카드 교환) | ★★☆☆☆ | 원하는 방향으로 바꾸기 어려움 |
| CARD_FLIP (도박) | ★★☆☆☆ | 완전 운. 기대값 낮게 느껴짐 |
| SHIELD_UP (회복의 샘) | ★★☆☆☆ | shieldMult +0.2 vs HP 28% 회복. 대부분 HP 회복이 나음 |

---

## 7. 개선 체크리스트

> 이 섹션이 핵심 관리 포인트다. 작업 완료 시 `[x]`로 표시하고 날짜를 추가할 것.  
> 새로운 개선 아이디어는 적절한 우선순위 범주에 추가할 것.

---

### 🔴 즉시 — 재미를 직접 높이는 것

- [x] **IntroScene 골드 소비처 구현** — 패시브 강화(영구 스탯 구매) / 장비 슬롯 열기 ✅ 2026-04-18
- [x] **적 속성별 고유 행동 패턴 추가** (`doEnemyTurn()`에 속성별 분기 추가) ✅ 2026-04-18
  - water: 2턴마다 방어력 +5
  - fire: 3턴마다 플레이어에게 화상 부여 (5×2턴), advanceToNextTurn에서 화상 틱
  - grass: HP 50% 이하 시 자기회복 (최대HP 15%), 4턴 쿨다운
  - lightning: 기절 면역 (applyCardEffects에서 stun 차단)
  - earth: 매 턴 방어막 10 생성 (damageEnemy에서 흡수)
- [x] **게임 패배 후 이어하기 버그 수정** — check-save-file이 mapHash 존재 여부로 유효성 검증 ✅ 2026-04-18
- [ ] **HEART 이벤트 재조정** — "소 희생(-5HP, +5%)"이 항상 이득인 구조 수정
  - HP 10 미만 시 소 희생 비활성화, 또는 비용을 -8 HP로 상향

---

### 🟡 단기 — 게임을 훨씬 풍부하게

- [x] **적 스탯 스케일링 구현** — mapStage×0.25(HP) / ×0.20(ATK) / ×0.15(DEF) BattleScene.ts:208 ✅ 2026-04-16
- [ ] **Guardian 방어막 지속 구조 수정** — 방어막이 1턴 이상 지속 가능해야 Guardian이 의미 있음
  - 옵션 A: 쉴드를 다음 턴까지 50% 유지
  - 옵션 B: Guardian 전용 — 사용하지 않은 쉴드가 다음 턴으로 이월
- [x] **덱 카드 제거 기능** — NodeEventScene.ts:1868 `removeCardId` + MainScene.ts:1514 `removeOneDeckCard` 구현됨 ✅ 2026-04-16
- [x] **CharacterSelectScene 시작 장비 선택** — CharacterSelectScene.ts:570 `selectedEquip → startEquipment` 전달 구현됨 ✅ 2026-04-16
- [ ] **시작 덱 커스터마이징** — 캐릭터 선택 화면에서 "시작 속성 선택" 또는 "제거할 카드 선택" 제공
- [ ] **SHIELD_UP 이벤트 재설계** — shieldMult +0.2가 HP 28% 회복보다 항상 약한 구조 개선
- [ ] **Lancer 투창 드로우 보완** — 투창 카드가 없을 때 패시브 활용 불가 문제 해소 방안

---

### 🟢 중기 — 장기 플레이 이유 만들기

- [ ] **메타 진행 — legacy 활용** — `runs` 횟수 기반 새 이벤트/카드 해금. 런 실패도 "기여"가 되도록
- [ ] **원소 연쇄 반응 시스템**
  - 젖음(water) + 번개 타격 = 감전(2.5배 + 기절)
  - 젖음(water) + 불 타격 = 수증기(적 공격 빗나감 50%)
  - 휘감김(grass) + 불 타격 = 대화재(화상 전이 + 2배)
  - 젖음(water) + 땅 타격 = 진흙(연속 2회 턴 획득 확률)
  - 대전(lightning) + 불 타격 = 폭발(광역 AOE)
- [ ] **오래된 제단 노드(ALTAR)** — 고등급 카드 희생 → 최대 HP 영구 상승
- [ ] **대장간 노드(BLACKSMITH)** — 동일 속성 1·2성 카드 2장 합성 → 상위 성급

---

### 🔵 장기 — 확장 콘텐츠

- [ ] **시각 연출 고도화** — 히트스탑(80~150ms timeScale=0), 카메라 쉐이크(일반 2px/100ms, 크리 15px/500ms)
- [ ] **데미지 플로팅 텍스트 개선** — 포물선 궤적, 원소별 색상(물-파랑, 불-빨강 등), 크리 특수 표시
- [ ] **업적 / 시즌 콘텐츠**
- [ ] **다중 타겟팅** — 향후 보스전 확장 대비 그리드 기반 좌표계

---

### ⚙️ 코드 품질 / 유지보수

- [ ] **BattleScene.ts 분리** (현재 2188줄 — executeCardAction() 200줄 단일 함수)
  - `CardEffectProcessor.ts` — 카드 효과 계산 전담
  - `DamageCalculator.ts` — 크리·상성·관통·연쇄 계산
  - `EnemyAI.ts` — 적 행동 패턴
- [ ] **NodeEventScene.ts 분리** (현재 1920줄)
- [ ] **씬 간 데이터 동기화 테스트** — 이벤트 결과가 save.json에 즉각 반영되는지 검증
- [ ] **i18n 미적용 항목 완성** — `enemyData.ts`의 `nameKey` 한국어화
- [ ] **Electron IPC 저장 비동기 처리 고도화** — 데이터 유실 방지

---

## 8. 장기 비전 및 상세 기획

### 8.1 골드 경제 및 덱 압축 시스템

**골드 소비처 — IntroScene**
- 패시브 강화: 골드를 소비하여 런 시작 전 영구 스탯 강화 구매
- 장비 슬롯 열기: 골드를 소비하여 최대 장비 슬롯 수 증가
- 상인 노드는 없음 — 골드 소비는 IntroScene에서만

**오래된 제단(ALTAR)**
- 고등급 카드 희생(덱에서 영구 소멸) → 최대 HP 영구 상승
- 안 쓰는 3~4성 카드의 재활용 방안

**대장간(BLACKSMITH)**
- 동일 속성·스탯 베이스의 1·2성 카드 2장 융합 → 상위 성급 업그레이드

### 8.2 원소 연쇄 반응 시스템

단순 상성(데미지 증감)을 보완하는 **복합 반응 시스템**:

| 조합 | 반응명 | 효과 |
|---|---|---|
| 젖음 + 번개 | 감전(Shock) | 데미지 2.5배 + 기절 |
| 젖음 + 불 | 수증기(Steam) | 적 공격 빗나감 50% |
| 휘감김 + 불 | 대화재(Inferno) | 화상 전이 + 타격 데미지 2배 |
| 젖음 + 땅 | 진흙(Mud) | 연속 2회 턴 획득 확률 증가 |
| 대전 + 불 | 폭발(Explosion) | 단일 → 광역(AOE) 판정 변경 |

### 8.3 시각 연출 규격

**카메라 쉐이크**
- 일반 타격: X/Y 랜덤 반경 2px, 100ms
- 약점/시너지 폭발: 반경 8~15px, 300~500ms (데미지 비례 강도 증가)

**히트스탑**
- 치명타 또는 상태이상 연쇄 타격 시 `time.timeScale = 0`으로 80~150ms 정지 후 재생

**데미지 플로팅 텍스트**
- 일반: 흰색 / 회복: 초록색 / 원소 피격: 원소 테마색
- 포물선 궤적 (X축 랜덤 + Y축 점프 후 낙하) + 페이드 아웃

### 8.4 전투 AI 확장성

- 다중 타겟팅: 향후 보스전 대비 그리드 기반 좌표계 준비
- 적의 원소 시너지 활용: 후반 적 AI가 '젖음'을 걸고 다음 턴 '번개' 공격을 예고(Telegraph)하여 플레이어가 방어/정화 카드로 대응하도록 유도

---

## 9. 코드 구조 가이드라인

### 씬 아키텍처 원칙

- **새 에셋은 반드시 `PreloadScene.preload()`에 등록** — 다른 씬에서 `this.load.*` 호출 금지
- 리팩터링 우선: 새 기능 추가 전 씬 간 데이터 전송 인터페이스를 정리하여 재사용성 극대화
- 스타일 통일: 모든 UI 요소는 `index.css`의 중세 판타지 테마 우선 사용

### 배율 계산 불변 규칙

- `cardMult`, `shieldMult` 모든 누적은 **가산(additive)** 방식 — `*=` 복리 방식 절대 금지
- HP 바는 반드시 `setOrigin(0, 0.5)` — `setOrigin(0.5, 0.5)` 금지

### 덱 관리 규칙

- `drawPile` 고갈 시에만 `discardPile` 셔플하여 재채움
- `cardMultipliers`: 카드 ID별 관리, 동일 ID 전체 복사본에 일괄 적용
- 성급(Star) 업그레이드: 개별 카드 단위(`DeckEntry.count`) 처리
