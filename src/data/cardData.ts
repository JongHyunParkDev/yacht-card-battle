// ─── 카드 속성 열거형 ──────────────────────────────────────────────────────────

export type CardElement = 'water' | 'fire' | 'grass' | 'lightning' | 'earth' | 'normal';

// ─── 카드 데이터 인터페이스 ───────────────────────────────────────────────────

export interface CardData {
  /** 카드 고유 ID */
  id: number;
  /** 카드 이름 */
  name: string;
  /** 카드 설명 */
  description: string;
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
    name: '물의 물약',
    description: '맑은 샘에서 채운 물약.\n체력을 소량 회복한다.',
    element: 'water', stars: 1,
    spriteRow: 0, spriteCol: 0,
    attrIndex: ELEMENT_ATTR_INDEX.water,
    attack: 0, defense: 4, cost: 1,
  },
  {
    id: 1,
    name: '산호 검사',
    description: '산호 검을 든 바다 전사.\n물속에서 더욱 강해진다.',
    element: 'water', stars: 2,
    spriteRow: 0, spriteCol: 1,
    attrIndex: ELEMENT_ATTR_INDEX.water,
    attack: 8, defense: 5, cost: 2,
  },
  {
    id: 2,
    name: '폭풍의 기사',
    description: '물의 소용돌이를 두른 기사.\n주위 모든 적에게 피해를 준다.',
    element: 'water', stars: 3,
    spriteRow: 0, spriteCol: 2,
    attrIndex: ELEMENT_ATTR_INDEX.water,
    attack: 12, defense: 8, cost: 3,
  },
  {
    id: 3,
    name: '포세이돈',
    description: '바다를 지배하는 신.\n삼지창으로 강렬한 파도를 일으킨다.',
    element: 'water', stars: 4,
    spriteRow: 0, spriteCol: 3,
    attrIndex: ELEMENT_ATTR_INDEX.water,
    attack: 18, defense: 12, cost: 4,
  },
  {
    id: 4,
    name: '심해의 대어',
    description: '고대 심해에서 잠든 괴수.\n거대한 파도로 전장을 덮친다.',
    element: 'water', stars: 5,
    spriteRow: 0, spriteCol: 4,
    attrIndex: ELEMENT_ATTR_INDEX.water,
    attack: 25, defense: 15, cost: 5,
  },

  // ── Row 1: 불 (fire) ─────────────────────────────────────────────────────────
  {
    id: 5,
    name: '작은 불꽃',
    description: '마음속에서 피어난 작은 불씨.\n적에게 화상을 입힌다.',
    element: 'fire', stars: 1,
    spriteRow: 1, spriteCol: 0,
    attrIndex: ELEMENT_ATTR_INDEX.fire,
    attack: 5, defense: 0, cost: 1,
  },
  {
    id: 6,
    name: '화염 쥐',
    description: '꼬리에 불을 달고 다니는 쥐.\n빠르게 움직여 화상을 남긴다.',
    element: 'fire', stars: 2,
    spriteRow: 1, spriteCol: 1,
    attrIndex: ELEMENT_ATTR_INDEX.fire,
    attack: 9, defense: 3, cost: 2,
  },
  {
    id: 7,
    name: '화염포 전사',
    description: '화염포를 장착한 기계 전사.\n폭발적인 화염으로 광역 피해를 준다.',
    element: 'fire', stars: 3,
    spriteRow: 1, spriteCol: 2,
    attrIndex: ELEMENT_ATTR_INDEX.fire,
    attack: 14, defense: 6, cost: 3,
  },
  {
    id: 8,
    name: '불사조',
    description: '죽어도 다시 살아나는 전설의 새.\n쓰러진 뒤 부활하여 반격한다.',
    element: 'fire', stars: 4,
    spriteRow: 1, spriteCol: 3,
    attrIndex: ELEMENT_ATTR_INDEX.fire,
    attack: 20, defense: 10, cost: 4,
  },
  {
    id: 9,
    name: '마왕',
    description: '지옥 불의 군주.\n모든 것을 태우는 업화로 전장을 지배한다.',
    element: 'fire', stars: 5,
    spriteRow: 1, spriteCol: 4,
    attrIndex: ELEMENT_ATTR_INDEX.fire,
    attack: 28, defense: 12, cost: 5,
  },

  // ── Row 2: 풀 (grass) ────────────────────────────────────────────────────────
  {
    id: 10,
    name: '새싹 정령',
    description: '갓 태어난 초록 정령.\n주위에 치유 에너지를 퍼뜨린다.',
    element: 'grass', stars: 1,
    spriteRow: 2, spriteCol: 0,
    attrIndex: ELEMENT_ATTR_INDEX.grass,
    attack: 2, defense: 6, cost: 1,
  },
  {
    id: 11,
    name: '식충 식물',
    description: '날카로운 이빨을 가진 식물 몬스터.\n덩굴로 적을 감아 무력화시킨다.',
    element: 'grass', stars: 2,
    spriteRow: 2, spriteCol: 1,
    attrIndex: ELEMENT_ATTR_INDEX.grass,
    attack: 10, defense: 4, cost: 2,
  },
  {
    id: 12,
    name: '나무 거인',
    description: '크리스탈 뿔을 가진 숲의 수호자.\n강인한 몸으로 아군을 지켜낸다.',
    element: 'grass', stars: 3,
    spriteRow: 2, spriteCol: 2,
    attrIndex: ELEMENT_ATTR_INDEX.grass,
    attack: 11, defense: 14, cost: 3,
  },
  {
    id: 13,
    name: '고목신',
    description: '수천 년을 산 거대한 나무의 정령.\n뿌리로 대지를 뒤흔들어 적을 쓰러뜨린다.',
    element: 'grass', stars: 4,
    spriteRow: 2, spriteCol: 3,
    attrIndex: ELEMENT_ATTR_INDEX.grass,
    attack: 16, defense: 18, cost: 4,
  },
  {
    id: 14,
    name: '드리아드',
    description: '꽃과 함께 잠든 숲의 여신.\n강력한 자연 치유로 아군을 소생시킨다.',
    element: 'grass', stars: 5,
    spriteRow: 2, spriteCol: 4,
    attrIndex: ELEMENT_ATTR_INDEX.grass,
    attack: 14, defense: 22, cost: 5,
  },

  // ── Row 3: 번개 (lightning) ──────────────────────────────────────────────────
  {
    id: 15,
    name: '번개 구슬',
    description: '정전기를 머금은 신비한 구슬.\n접촉한 적에게 감전을 부여한다.',
    element: 'lightning', stars: 1,
    spriteRow: 3, spriteCol: 0,
    attrIndex: ELEMENT_ATTR_INDEX.lightning,
    attack: 6, defense: 2, cost: 1,
  },
  {
    id: 16,
    name: '번개 독수리',
    description: '폭풍 구름을 가르는 맹금.\n빠른 강하로 번개 공격을 가한다.',
    element: 'lightning', stars: 2,
    spriteRow: 3, spriteCol: 1,
    attrIndex: ELEMENT_ATTR_INDEX.lightning,
    attack: 11, defense: 5, cost: 2,
  },
  {
    id: 17,
    name: '뇌광 닌자',
    description: '번개처럼 사라지는 그림자.\n순간이동하듯 적의 빈틈을 노린다.',
    element: 'lightning', stars: 3,
    spriteRow: 3, spriteCol: 2,
    attrIndex: ELEMENT_ATTR_INDEX.lightning,
    attack: 16, defense: 7, cost: 3,
  },
  {
    id: 18,
    name: '번개 용',
    description: '구름 위를 누비는 번개 용.\n입에서 뿜는 번개로 여러 적을 마비시킨다.',
    element: 'lightning', stars: 4,
    spriteRow: 3, spriteCol: 3,
    attrIndex: ELEMENT_ATTR_INDEX.lightning,
    attack: 22, defense: 10, cost: 4,
  },
  {
    id: 19,
    name: '제우스',
    description: '하늘을 지배하는 신들의 왕.\n번개 볼트로 전장 전체를 초토화시킨다.',
    element: 'lightning', stars: 5,
    spriteRow: 3, spriteCol: 4,
    attrIndex: ELEMENT_ATTR_INDEX.lightning,
    attack: 30, defense: 12, cost: 5,
  },

  // ── Row 4: 돌 (earth) ────────────────────────────────────────────────────────
  {
    id: 20,
    name: '돌멩이',
    description: '평범해 보이지만 단단한 돌.\n기본적인 방어막을 형성한다.',
    element: 'earth', stars: 1,
    spriteRow: 4, spriteCol: 0,
    attrIndex: ELEMENT_ATTR_INDEX.earth,
    attack: 3, defense: 8, cost: 1,
  },
  {
    id: 21,
    name: '사막 전갈',
    description: '독침을 가진 거대 전갈.\n독 공격으로 적을 서서히 약화시킨다.',
    element: 'earth', stars: 2,
    spriteRow: 4, spriteCol: 1,
    attrIndex: ELEMENT_ATTR_INDEX.earth,
    attack: 12, defense: 6, cost: 2,
  },
  {
    id: 22,
    name: '암석 골렘',
    description: '대지에서 태어난 거대 바위 골렘.\n강철 같은 몸으로 모든 공격을 튕겨낸다.',
    element: 'earth', stars: 3,
    spriteRow: 4, spriteCol: 2,
    attrIndex: ELEMENT_ATTR_INDEX.earth,
    attack: 10, defense: 18, cost: 3,
  },
  {
    id: 23,
    name: '드워프 전사',
    description: '거대한 철퇴를 휘두르는 드워프.\n한 방에 땅을 진동시키는 강타를 날린다.',
    element: 'earth', stars: 4,
    spriteRow: 4, spriteCol: 3,
    attrIndex: ELEMENT_ATTR_INDEX.earth,
    attack: 24, defense: 14, cost: 4,
  },
  {
    id: 24,
    name: '대지의 코뿔소',
    description: '산을 짊어진 고대 코뿔소.\n돌진으로 전선을 완전히 무너뜨린다.',
    element: 'earth', stars: 5,
    spriteRow: 4, spriteCol: 4,
    attrIndex: ELEMENT_ATTR_INDEX.earth,
    attack: 26, defense: 20, cost: 5,
  },

  // ── Row 5: 일반 (normal) ─────────────────────────────────────────────────────
  {
    id: 25,
    name: '이중 타격',
    description: '검과 도끼를 동시에 휘두른다.\n두 번의 연속 공격을 가한다.',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 0,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    attack: 10, defense: 0, cost: 2,
  },
  {
    id: 26,
    name: '철벽 방어',
    description: '단단한 나무 방패를 앞세운다.\n이번 턴 받는 피해를 크게 감소시킨다.',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 1,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    attack: 0, defense: 14, cost: 2,
  },
  {
    id: 27,
    name: '암습',
    description: '어둠 속에서 창으로 기습한다.\n방어 중인 적도 꿰뚫는 관통 피해.',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 2,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    attack: 14, defense: 0, cost: 3,
  },
  {
    id: 28,
    name: '속사 연발',
    description: '화살통을 비울 기세로 연속 발사.\n3회 공격,  각 공격마다 피해를 준다.',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 3,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    attack: 7, defense: 0, cost: 2,
  },
  {
    id: 29,
    name: '회복 물약',
    description: '붉은 액체가 담긴 신비한 물약.\n체력을 대폭 회복하고 독 상태를 해제한다.',
    element: 'normal', stars: 0,
    spriteRow: 5, spriteCol: 4,
    attrIndex: ELEMENT_ATTR_INDEX.normal,
    attack: 0, defense: 0, cost: 2,
  },
];
