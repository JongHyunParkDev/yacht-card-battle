// ─── 맵 노드 타입 정의 ─────────────────────────────────────────────────────────

export const NODE_TYPE = {
  START:          0,   // 시작점 (내부용)
  SKULL:          1,   // 해골   — 일반속성 랜덤 몹
  SWORD:          2,   // 칼     — 현재 맵 속성 랜덤 몹
  ENHANCE:        3,   // 불     — 캐릭터 강화 (패시브)
  TREASURE:       4,   // 보물   — 장비 뽑기
  CARD_FLIP:      5,   // 도박   — 카드 뒤집기 골드 게임
  CARD_SWAP:      6,   // 교환   — 속성 카드 교환
  HEART:          7,   // 하트   — HP -5, 카드 밸류 ×1.3
  SHIELD_UP:      8,   // 방어   — 쉴드량 ×1.2
  STAR_UP:        9,   // 별     — 속성 카드 별 +1
  INDIAN_POKER:   10,  // 느낌표 — 인디언 포커
  BOSS_WATER:     11,  // 물 속성 보스 (2라운드)
  BOSS_FIRE:      12,  // 불 속성 보스 (2라운드)
  BOSS_GRASS:     13,  // 풀 속성 보스 (2라운드)
  UNUSED_14:      14,  // 사용 안함
  BOSS_LIGHTNING: 15,  // 번개 속성 보스 (2라운드)
  BOSS_EARTH:     16,  // 땅 속성 보스 (2라운드)
  UNUSED_17:      17,  // 사용 안함
  BOSS_FINAL:     18,  // 무속성 최종 보스 (3라운드)
} as const;

export type NodeTypeValue = typeof NODE_TYPE[keyof typeof NODE_TYPE];

/**
 * 레이어(row) 그룹 정의
 * 한 레이어의 모든 노드는 같은 그룹에서 타입이 결정됩니다.
 *
 * 그룹 A — 전투:      1(해골), 2(칼)
 * 그룹 B — 보상/이벤트: 3(강화), 4(보물), 5(도박)
 * 그룹 C — 카드 변형:  6(교환), 7(하트), 8(방어), 9(별), 10(포커)
 */
export const NODE_TYPE_GROUPS: number[][] = [
  [1, 2],           // 그룹 A: 전투
  [3, 4, 5],        // 그룹 B: 보상/이벤트
  [6, 7, 8, 9, 10], // 그룹 C: 카드 변형
];

/** 맵 생성에서 사용될 보스 노드 타입 목록 (사용 안함 제외) */
export const BOSS_NODE_TYPES: number[] = [11, 12, 13, 15, 16];

/** 해당 타입이 보스인지 여부 */
export function isBossType(type: number): boolean {
  return type >= 11 && type !== 14 && type !== 17;
}

/** 노드 타입 → 한국어 레이블 */
export const NODE_LABELS: Record<number, string> = {
  [NODE_TYPE.SKULL]:          '해골',
  [NODE_TYPE.SWORD]:          '전투',
  [NODE_TYPE.ENHANCE]:        '강화',
  [NODE_TYPE.TREASURE]:       '보물',
  [NODE_TYPE.CARD_FLIP]:      '도박',
  [NODE_TYPE.CARD_SWAP]:      '교환',
  [NODE_TYPE.HEART]:          '하트',
  [NODE_TYPE.SHIELD_UP]:      '방어',
  [NODE_TYPE.STAR_UP]:        '별',
  [NODE_TYPE.INDIAN_POKER]:   '포커',
  [NODE_TYPE.BOSS_WATER]:     '물 보스',
  [NODE_TYPE.BOSS_FIRE]:      '불 보스',
  [NODE_TYPE.BOSS_GRASS]:     '풀 보스',
  [NODE_TYPE.BOSS_LIGHTNING]: '번개 보스',
  [NODE_TYPE.BOSS_EARTH]:     '땅 보스',
  [NODE_TYPE.BOSS_FINAL]:     '최종 보스',
};

/** 보스 타입 → 속성 이름 */
export const BOSS_ELEMENT_NAME: Partial<Record<number, string>> = {
  [NODE_TYPE.BOSS_WATER]:     '물',
  [NODE_TYPE.BOSS_FIRE]:      '불',
  [NODE_TYPE.BOSS_GRASS]:     '풀',
  [NODE_TYPE.BOSS_LIGHTNING]: '번개',
  [NODE_TYPE.BOSS_EARTH]:     '땅',
  [NODE_TYPE.BOSS_FINAL]:     '무속성',
};

/**
 * node.type → map_nodes 스프라이트 프레임 이름
 *
 * row0_0~4 : type 1~5  (해골·칼·불·보물·도박)
 * row1_0~4 : type 6~10 (교환·하트·방어·별·포커)
 * row2_0~2 : type 11~13 (물·불·풀 보스)
 * row3_0~2 : type 15·16·18 (번개·땅·최종 보스)
 */
export function getNodeFrameName(type: number): string {
  if (type >= 1  && type <= 5)  return `row0_${type - 1}`;
  if (type >= 6  && type <= 10) return `row1_${type - 6}`;
  if (type === 11) return 'row2_0';
  if (type === 12) return 'row2_1';
  if (type === 13) return 'row2_2';
  if (type === 15) return 'row3_0';
  if (type === 16) return 'row3_1';
  if (type === 18) return 'row3_2';
  return 'row0_0'; // fallback
}
