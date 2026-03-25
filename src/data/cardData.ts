// ─── 카드 속성 열거형 ──────────────────────────────────────────────────────────

export type CardElement = 'water' | 'fire' | 'grass' | 'lightning' | 'earth' | 'normal';

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
  /** 공격력 (기본값) */
  attack: number;
  /** 방어력 (기본값) */
  defense: number;
  /** 마나 비용 */
  cost: number;
}

// ─── 속성별 attr-sprite 인덱스 ────────────────────────────────────────────────

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
  // ── Row 0: 물 (water) ────────────────────────────────────────────────────────
  {
    id: 0,
    nameKey: 'card0Name', descKey: 'card0Desc',
    element: 'water', stars: 1,
    spriteRow: 0, spriteCol: 0,
    attrIndex: ELEMENT_ATTR_INDEX.water,
    attack: 0, defense: 4, cost: 1,
  },
  {
    id: 1,
    nameKey: 'card1Name', descKey: 'card1Desc',
    element: 'water', stars: 2,
    spriteRow: 0, spriteCol: 1,
    attrIndex: ELEMENT_ATTR_INDEX.water,
    attack: 8, defense: 5, cost: 2,
  },
  {
    id: 2,
    nameKey: 'card2Name', descKey: 'card2Desc',
    element: 'water', stars: 3,
    spriteRow: 0, spriteCol: 2,
    attrIndex: ELEMENT_ATTR_INDEX.water,
    attack: 12, defense: 8, cost: 3,
  },
  {
    id: 3,
    nameKey: 'card3Name', descKey: 'card3Desc',
    element: 'water', stars: 4,
    spriteRow: 0, spriteCol: 3,
    attrIndex: ELEMENT_ATTR_INDEX.water,
    attack: 18, defense: 12, cost: 4,
  },
  {
    id: 4,
    nameKey: 'card4Name', descKey: 'card4Desc',
    element: 'water', stars: 5,
    spriteRow: 0, spriteCol: 4,
    attrIndex: ELEMENT_ATTR_INDEX.water,
    attack: 25, defense: 15, cost: 5,
  },

  // ── Row 1: 불 (fire) ─────────────────────────────────────────────────────────
  {
    id: 5,
    nameKey: 'card5Name', descKey: 'card5Desc',
    element: 'fire', stars: 1,
    spriteRow: 1, spriteCol: 0,
    attrIndex: ELEMENT_ATTR_INDEX.fire,
    attack: 5, defense: 0, cost: 1,
  },
  {
    id: 6,
    nameKey: 'card6Name', descKey: 'card6Desc',
    element: 'fire', stars: 2,
    spriteRow: 1, spriteCol: 1,
    attrIndex: ELEMENT_ATTR_INDEX.fire,
    attack: 9, defense: 3, cost: 2,
  },
  {
    id: 7,
    nameKey: 'card7Name', descKey: 'card7Desc',
    element: 'fire', stars: 3,
    spriteRow: 1, spriteCol: 2,
    attrIndex: ELEMENT_ATTR_INDEX.fire,
    attack: 14, defense: 6, cost: 3,
  },
  {
    id: 8,
    nameKey: 'card8Name', descKey: 'card8Desc',
    element: 'fire', stars: 4,
    spriteRow: 1, spriteCol: 3,
    attrIndex: ELEMENT_ATTR_INDEX.fire,
    attack: 20, defense: 10, cost: 4,
  },
  {
    id: 9,
    nameKey: 'card9Name', descKey: 'card9Desc',
    element: 'fire', stars: 5,
    spriteRow: 1, spriteCol: 4,
    attrIndex: ELEMENT_ATTR_INDEX.fire,
    attack: 28, defense: 12, cost: 5,
  },

  // ── Row 2: 풀 (grass) ────────────────────────────────────────────────────────
  {
    id: 10,
    nameKey: 'card10Name', descKey: 'card10Desc',
    element: 'grass', stars: 1,
    spriteRow: 2, spriteCol: 0,
    attrIndex: ELEMENT_ATTR_INDEX.grass,
    attack: 2, defense: 6, cost: 1,
  },
  {
    id: 11,
    nameKey: 'card11Name', descKey: 'card11Desc',
    element: 'grass', stars: 2,
    spriteRow: 2, spriteCol: 1,
    attrIndex: ELEMENT_ATTR_INDEX.grass,
    attack: 10, defense: 4, cost: 2,
  },
  {
    id: 12,
    nameKey: 'card12Name', descKey: 'card12Desc',
    element: 'grass', stars: 3,
    spriteRow: 2, spriteCol: 2,
    attrIndex: ELEMENT_ATTR_INDEX.grass,
    attack: 11, defense: 14, cost: 3,
  },
  {
    id: 13,
    nameKey: 'card13Name', descKey: 'card13Desc',
    element: 'grass', stars: 4,
    spriteRow: 2, spriteCol: 3,
    attrIndex: ELEMENT_ATTR_INDEX.grass,
    attack: 16, defense: 18, cost: 4,
  },
  {
    id: 14,
    nameKey: 'card14Name', descKey: 'card14Desc',
    element: 'grass', stars: 5,
    spriteRow: 2, spriteCol: 4,
    attrIndex: ELEMENT_ATTR_INDEX.grass,
    attack: 14, defense: 22, cost: 5,
  },

  // ── Row 3: 번개 (lightning) ──────────────────────────────────────────────────
  {
    id: 15,
    nameKey: 'card15Name', descKey: 'card15Desc',
    element: 'lightning', stars: 1,
    spriteRow: 3, spriteCol: 0,
    attrIndex: ELEMENT_ATTR_INDEX.lightning,
    attack: 6, defense: 2, cost: 1,
  },
  {
    id: 16,
    nameKey: 'card16Name', descKey: 'card16Desc',
    element: 'lightning', stars: 2,
    spriteRow: 3, spriteCol: 1,
    attrIndex: ELEMENT_ATTR_INDEX.lightning,
    attack: 11, defense: 5, cost: 2,
  },
  {
    id: 17,
    nameKey: 'card17Name', descKey: 'card17Desc',
    element: 'lightning', stars: 3,
    spriteRow: 3, spriteCol: 2,
    attrIndex: ELEMENT_ATTR_INDEX.lightning,
    attack: 16, defense: 7, cost: 3,
  },
  {
    id: 18,
    nameKey: 'card18Name', descKey: 'card18Desc',
    element: 'lightning', stars: 4,
    spriteRow: 3, spriteCol: 3,
    attrIndex: ELEMENT_ATTR_INDEX.lightning,
    attack: 22, defense: 10, cost: 4,
  },
  {
    id: 19,
    nameKey: 'card19Name', descKey: 'card19Desc',
    element: 'lightning', stars: 5,
    spriteRow: 3, spriteCol: 4,
    attrIndex: ELEMENT_ATTR_INDEX.lightning,
    attack: 30, defense: 12, cost: 5,
  },

  // ── Row 4: 돌 (earth) ────────────────────────────────────────────────────────
  {
    id: 20,
    nameKey: 'card20Name', descKey: 'card20Desc',
    element: 'earth', stars: 1,
    spriteRow: 4, spriteCol: 0,
    attrIndex: ELEMENT_ATTR_INDEX.earth,
    attack: 3, defense: 8, cost: 1,
  },
  {
    id: 21,
    nameKey: 'card21Name', descKey: 'card21Desc',
    element: 'earth', stars: 2,
    spriteRow: 4, spriteCol: 1,
    attrIndex: ELEMENT_ATTR_INDEX.earth,
    attack: 12, defense: 6, cost: 2,
  },
  {
    id: 22,
    nameKey: 'card22Name', descKey: 'card22Desc',
    element: 'earth', stars: 3,
    spriteRow: 4, spriteCol: 2,
    attrIndex: ELEMENT_ATTR_INDEX.earth,
    attack: 10, defense: 18, cost: 3,
  },
  {
    id: 23,
    nameKey: 'card23Name', descKey: 'card23Desc',
    element: 'earth', stars: 4,
    spriteRow: 4, spriteCol: 3,
    attrIndex: ELEMENT_ATTR_INDEX.earth,
    attack: 24, defense: 14, cost: 4,
  },
  {
    id: 24,
    nameKey: 'card24Name', descKey: 'card24Desc',
    element: 'earth', stars: 5,
    spriteRow: 4, spriteCol: 4,
    attrIndex: ELEMENT_ATTR_INDEX.earth,
    attack: 26, defense: 20, cost: 5,
  },

  // ── Row 5: 일반 (normal) ─────────────────────────────────────────────────────
  {
    id: 25,
    nameKey: 'card25Name', descKey: 'card25Desc',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 0,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    attack: 10, defense: 0, cost: 2,
  },
  {
    id: 26,
    nameKey: 'card26Name', descKey: 'card26Desc',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 1,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    attack: 0, defense: 14, cost: 2,
  },
  {
    id: 27,
    nameKey: 'card27Name', descKey: 'card27Desc',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 2,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    attack: 14, defense: 0, cost: 3,
  },
  {
    id: 28,
    nameKey: 'card28Name', descKey: 'card28Desc',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 3,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    attack: 7, defense: 0, cost: 2,
  },
  {
    id: 29,
    nameKey: 'card29Name', descKey: 'card29Desc',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 4,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    attack: 0, defense: 0, cost: 2,
  },
];
