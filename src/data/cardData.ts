// ─── 카드 속성 열거형 ──────────────────────────────────────────────────────────

export type CardElement = 'water' | 'fire' | 'grass' | 'lightning' | 'earth' | 'normal';

// ─── 카드 별 등급별 고유 효과 ─────────────────────────────────────────────────

export type CardEffectType =
  | 'burn'        // 화상: 턴 종료마다 value 데미지, duration턴
  | 'vulnerable'  // 취약: 받는 피해 +50%, duration턴
  | 'stun'        // 기절: 다음 적 공격 스킵
  | 'armor_break' // 방깎: 적 방어력 value 감소 (영구)
  | 'heal'        // 회복: 플레이어 HP value 즉시 회복
  | 'shield_add'  // 방어막: 이번 턴 추가 쉴드 value
  | 'chain'       // 연쇄: 적에게 상태이상 있을 때 추가 value 데미지
  | 'multi_hit'   // 다중: value회 분할 타격
  | 'pierce';     // 관통: 방어력 무시

export interface CardEffect {
  type: CardEffectType;
  value: number;
  duration?: number; // burn, vulnerable에 사용
}

// ─── 카드 데이터 인터페이스 ───────────────────────────────────────────────────

export interface CardData {
  /** 카드 고유 ID */
  id: number;
  /** 카드 이름 i18n 키 */
  nameKey: string;
  /** 카드 설명 i18n 키 */
  descKey: string;
  /** 속성 */
  element: CardElement;
  /**
   * 등급 (별 개수).
   * - 물/불/풀/번개/돌: 1~5
   * - 일반: 0 (별 없음)
   */
  stars: number;
  /** card-sprite.png 행 인덱스 (0-based) */
  spriteRow: number;
  /** card-sprite.png 열 인덱스 (0-based) */
  spriteCol: number;
  /** attr-sprite.png 에서 속성 아이콘 인덱스 (0-based) */
  attrIndex: number;
  /** 효과 키 */
  key: string;
  /** 효과 수치 (기본값) */
  value: number;
  /** 인게임 적용 배율 (런타임 추가) */
  mult: number;
  /** 일반 카드 별 강화로 누적된 기본값 보너스 (런타임 추가) */
  bonusValue?: number;
  /** 별 등급별 고유 추가 효과 */
  effects?: CardEffect[];
}

// ─── 속성별 attr-sprite 인덱스 ────────────────────────────────────────────────
// 속성 상성 : 물 > 불 > 풀 > 번개 > 돌 > 물
export const ELEMENT_ATTR_INDEX: Record<CardElement, number> = {
  water:     0,
  fire:      1,
  grass:     2,
  lightning: 3,
  earth:     4,
  normal:    5,
};

/** 별(★) 아이콘 attr-sprite 인덱스 */
export const STAR_ATTR_INDEX = 6;

// ─── 30장 카드 데이터 ─────────────────────────────────────────────────────────

export const CARD_DATA_LIST: CardData[] = [
  // ── Row 0: 물 (water) — 테마: 취약(Vulnerable) ────────────────────────────────
  // 1성: 기본 공격
  { id: 0, nameKey: 'card0Name', descKey: 'card0Desc', element: 'water', stars: 1,
    spriteRow: 0, spriteCol: 0, attrIndex: ELEMENT_ATTR_INDEX.water, key: 'attack', value: 10, mult: 1 },
  // 2성: 공격 + 취약 1턴
  { id: 1, nameKey: 'card1Name', descKey: 'card1Desc', element: 'water', stars: 2,
    spriteRow: 0, spriteCol: 1, attrIndex: ELEMENT_ATTR_INDEX.water, key: 'attack', value: 15, mult: 1,
    effects: [{ type: 'vulnerable', value: 1, duration: 1 }] },
  // 3성: 공격 + 취약 2턴
  { id: 2, nameKey: 'card2Name', descKey: 'card2Desc', element: 'water', stars: 3,
    spriteRow: 0, spriteCol: 2, attrIndex: ELEMENT_ATTR_INDEX.water, key: 'attack', value: 20, mult: 1,
    effects: [{ type: 'vulnerable', value: 1, duration: 2 }] },
  // 4성: 공격 + 취약 2턴 + 2회 타격
  { id: 3, nameKey: 'card3Name', descKey: 'card3Desc', element: 'water', stars: 4,
    spriteRow: 0, spriteCol: 3, attrIndex: ELEMENT_ATTR_INDEX.water, key: 'attack', value: 25, mult: 1,
    effects: [{ type: 'vulnerable', value: 1, duration: 2 }, { type: 'multi_hit', value: 2 }] },
  // 5성: 공격 + 취약 3턴 + 방어력 무시
  { id: 4, nameKey: 'card4Name', descKey: 'card4Desc', element: 'water', stars: 5,
    spriteRow: 0, spriteCol: 4, attrIndex: ELEMENT_ATTR_INDEX.water, key: 'attack', value: 30, mult: 1,
    effects: [{ type: 'vulnerable', value: 1, duration: 3 }, { type: 'pierce', value: 1 }] },

  // ── Row 1: 불 (fire) — 테마: 화상(Burn) ─────────────────────────────────────
  // 1성: 기본 공격
  { id: 5, nameKey: 'card5Name', descKey: 'card5Desc', element: 'fire', stars: 1,
    spriteRow: 1, spriteCol: 0, attrIndex: ELEMENT_ATTR_INDEX.fire, key: 'attack', value: 10, mult: 1 },
  // 2성: 공격 + 화상 8/턴 2턴
  { id: 6, nameKey: 'card6Name', descKey: 'card6Desc', element: 'fire', stars: 2,
    spriteRow: 1, spriteCol: 1, attrIndex: ELEMENT_ATTR_INDEX.fire, key: 'attack', value: 15, mult: 1,
    effects: [{ type: 'burn', value: 8, duration: 2 }] },
  // 3성: 공격 + 화상 12/턴 2턴
  { id: 7, nameKey: 'card7Name', descKey: 'card7Desc', element: 'fire', stars: 3,
    spriteRow: 1, spriteCol: 2, attrIndex: ELEMENT_ATTR_INDEX.fire, key: 'attack', value: 20, mult: 1,
    effects: [{ type: 'burn', value: 12, duration: 2 }] },
  // 4성: 공격 + 화상 15/턴 3턴
  { id: 8, nameKey: 'card8Name', descKey: 'card8Desc', element: 'fire', stars: 4,
    spriteRow: 1, spriteCol: 3, attrIndex: ELEMENT_ATTR_INDEX.fire, key: 'attack', value: 25, mult: 1,
    effects: [{ type: 'burn', value: 15, duration: 3 }] },
  // 5성: 공격 + 화상 20/턴 3턴
  { id: 9, nameKey: 'card9Name', descKey: 'card9Desc', element: 'fire', stars: 5,
    spriteRow: 1, spriteCol: 4, attrIndex: ELEMENT_ATTR_INDEX.fire, key: 'attack', value: 30, mult: 1,
    effects: [{ type: 'burn', value: 20, duration: 3 }] },

  // ── Row 2: 풀 (grass) — 테마: 회복(Heal) + 방어막 ───────────────────────────
  // 1성: 기본 공격
  { id: 10, nameKey: 'card10Name', descKey: 'card10Desc', element: 'grass', stars: 1,
    spriteRow: 2, spriteCol: 0, attrIndex: ELEMENT_ATTR_INDEX.grass, key: 'attack', value: 10, mult: 1 },
  // 2성: 약한 공격 + HP 회복 10
  { id: 11, nameKey: 'card11Name', descKey: 'card11Desc', element: 'grass', stars: 2,
    spriteRow: 2, spriteCol: 1, attrIndex: ELEMENT_ATTR_INDEX.grass, key: 'attack', value: 10, mult: 1,
    effects: [{ type: 'heal', value: 10 }] },
  // 3성: 공격 + HP 회복 15
  { id: 12, nameKey: 'card12Name', descKey: 'card12Desc', element: 'grass', stars: 3,
    spriteRow: 2, spriteCol: 2, attrIndex: ELEMENT_ATTR_INDEX.grass, key: 'attack', value: 15, mult: 1,
    effects: [{ type: 'heal', value: 15 }] },
  // 4성: 공격 + HP 회복 15 + 방어막 10
  { id: 13, nameKey: 'card13Name', descKey: 'card13Desc', element: 'grass', stars: 4,
    spriteRow: 2, spriteCol: 3, attrIndex: ELEMENT_ATTR_INDEX.grass, key: 'attack', value: 20, mult: 1,
    effects: [{ type: 'heal', value: 15 }, { type: 'shield_add', value: 10 }] },
  // 5성: 공격 + HP 회복 20 + 방어막 15
  { id: 14, nameKey: 'card14Name', descKey: 'card14Desc', element: 'grass', stars: 5,
    spriteRow: 2, spriteCol: 4, attrIndex: ELEMENT_ATTR_INDEX.grass, key: 'attack', value: 25, mult: 1,
    effects: [{ type: 'heal', value: 20 }, { type: 'shield_add', value: 15 }] },

  // ── Row 3: 번개 (lightning) — 테마: 연쇄(Chain) + 기절(Stun) ────────────────
  // 1성: 기본 공격
  { id: 15, nameKey: 'card15Name', descKey: 'card15Desc', element: 'lightning', stars: 1,
    spriteRow: 3, spriteCol: 0, attrIndex: ELEMENT_ATTR_INDEX.lightning, key: 'attack', value: 10, mult: 1 },
  // 2성: 공격 + 연쇄(적 상태이상 시 +20 추가)
  { id: 16, nameKey: 'card16Name', descKey: 'card16Desc', element: 'lightning', stars: 2,
    spriteRow: 3, spriteCol: 1, attrIndex: ELEMENT_ATTR_INDEX.lightning, key: 'attack', value: 15, mult: 1,
    effects: [{ type: 'chain', value: 20 }] },
  // 3성: 공격 + 연쇄 +28
  { id: 17, nameKey: 'card17Name', descKey: 'card17Desc', element: 'lightning', stars: 3,
    spriteRow: 3, spriteCol: 2, attrIndex: ELEMENT_ATTR_INDEX.lightning, key: 'attack', value: 20, mult: 1,
    effects: [{ type: 'chain', value: 28 }] },
  // 4성: 3회 분할 타격 (8×3=24)
  { id: 18, nameKey: 'card18Name', descKey: 'card18Desc', element: 'lightning', stars: 4,
    spriteRow: 3, spriteCol: 3, attrIndex: ELEMENT_ATTR_INDEX.lightning, key: 'attack', value: 8, mult: 1,
    effects: [{ type: 'multi_hit', value: 3 }] },
  // 5성: 공격 + 기절(다음 적 공격 스킵)
  { id: 19, nameKey: 'card19Name', descKey: 'card19Desc', element: 'lightning', stars: 5,
    spriteRow: 3, spriteCol: 4, attrIndex: ELEMENT_ATTR_INDEX.lightning, key: 'attack', value: 30, mult: 1,
    effects: [{ type: 'stun', value: 1 }] },

  // ── Row 4: 돌 (earth) — 테마: 방어막(Shield) + 방깎(Armor Break) ─────────────
  // 1성: 기본 공격
  { id: 20, nameKey: 'card20Name', descKey: 'card20Desc', element: 'earth', stars: 1,
    spriteRow: 4, spriteCol: 0, attrIndex: ELEMENT_ATTR_INDEX.earth, key: 'attack', value: 10, mult: 1 },
  // 2성: 공격 + 방어막 10
  { id: 21, nameKey: 'card21Name', descKey: 'card21Desc', element: 'earth', stars: 2,
    spriteRow: 4, spriteCol: 1, attrIndex: ELEMENT_ATTR_INDEX.earth, key: 'attack', value: 15, mult: 1,
    effects: [{ type: 'shield_add', value: 10 }] },
  // 3성: 공격 + 방어막 15
  { id: 22, nameKey: 'card22Name', descKey: 'card22Desc', element: 'earth', stars: 3,
    spriteRow: 4, spriteCol: 2, attrIndex: ELEMENT_ATTR_INDEX.earth, key: 'attack', value: 20, mult: 1,
    effects: [{ type: 'shield_add', value: 15 }] },
  // 4성: 공격 + 방어막 20 + 방깎 5
  { id: 23, nameKey: 'card23Name', descKey: 'card23Desc', element: 'earth', stars: 4,
    spriteRow: 4, spriteCol: 3, attrIndex: ELEMENT_ATTR_INDEX.earth, key: 'attack', value: 25, mult: 1,
    effects: [{ type: 'shield_add', value: 20 }, { type: 'armor_break', value: 5 }] },
  // 5성: 공격 + 방어막 25 + 방깎 10
  { id: 24, nameKey: 'card24Name', descKey: 'card24Desc', element: 'earth', stars: 5,
    spriteRow: 4, spriteCol: 4, attrIndex: ELEMENT_ATTR_INDEX.earth, key: 'attack', value: 30, mult: 1,
    effects: [{ type: 'shield_add', value: 25 }, { type: 'armor_break', value: 10 }] },

  // ── Row 5: 일반 (normal) ─────────────────────────────────────────────────────
  {
    id: 25,
    nameKey: 'card25Name', descKey: 'card25Desc',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 0,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    key: 'attack',
    value: 10, mult: 1,
  },
  {
    id: 26,
    nameKey: 'card26Name', descKey: 'card26Desc',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 1,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    key: 'defense',
    value: 15, mult: 1,
  },
  {
    id: 27,
    nameKey: 'card27Name', descKey: 'card27Desc',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 2,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    key: 'spear',
    value: 10, mult: 1,
  },
  {
    id: 28,
    nameKey: 'card28Name', descKey: 'card28Desc',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 3,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    key: 'arrow',
    value: 5, mult: 1,
  },
  {
    id: 29,
    nameKey: 'card29Name', descKey: 'card29Desc',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 4,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    key: 'hp',
    value: 10, mult: 1,
  },
];
