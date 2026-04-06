// ─── 장비 등급 ────────────────────────────────────────────────────────────────

export type EquipGrade = 'common' | 'uncommon' | 'rare' | 'unique' | 'legendary';

/** 등급별 드롭 확률 (합계 = 1.0) */
export const EQUIP_GRADE_WEIGHT: Record<EquipGrade, number> = {
  common:    0.60,
  uncommon:  0.25,
  rare:      0.10,
  unique:    0.04,
  legendary: 0.01,
};

export const EQUIP_GRADE_LABEL: Record<EquipGrade, string> = {
  common:    '일반',
  uncommon:  '고급',
  rare:      '희귀',
  unique:    '유니크',
  legendary: '전설',
};

export const EQUIP_GRADE_COLOR: Record<EquipGrade, string> = {
  common:    '#aaaaaa',
  uncommon:  '#4fc3f7',
  rare:      '#ce93d8',
  unique:    '#ffb300',
  legendary: '#ff6e40',
};

// ─── 특수 효과 타입 ───────────────────────────────────────────────────────────

export type SpecialEffectType =
  | 'shield_on_turn_end'   // 매 전투 턴 종료 후 방어막 value 생성
  | 'heal_on_win'          // 전투 승리 시 HP value 회복
  | 'heal_on_win_pct'      // 전투 승리 시 최대 HP의 value% 회복
  | 'bonus_draw'           // 매 턴 카드 value장 추가 드로우
  | 'element_amplify'      // 속성 유불리 배율 +value (예: 1.5→1.5+value)
  | 'lifesteal_pct'        // 공격 데미지의 value% HP 흡수
  | 'card_mult_on_crit';   // 크리티컬 발생 시 카드 밸류 추가 ×value

export interface SpecialEffect {
  type: SpecialEffectType;
  value: number;
  /** UI에 표시할 한국어 설명 */
  desc: string;
}

// ─── 장비 스탯 ────────────────────────────────────────────────────────────────

export interface EquipStat {
  atk?:       number;  // 공격력 추가
  def?:       number;  // 방어력 추가
  crit?:      number;  // 치명타 확률 추가 (%)
  critDmg?:   number;  // 치명타 배율 추가 (예: 0.2 → +0.2×)
  maxHp?:     number;  // 최대 HP 추가
  cardMult?:  number;  // 카드 전체 밸류 배율 (곱셈, 예: 1.15)
  shieldMult?: number; // 방어 카드 쉴드량 배율 (곱셈, 예: 1.20)
  /** 속성별 공격 데미지 보너스 (%) — 예: { fire: 15 } = 불 공격 +15% */
  elementAtkBonus?: Partial<Record<string, number>>;
  /** 속성별 피해 감소 (%) — 예: { water: 10 } = 물 피해 -10% */
  elementDefBonus?: Partial<Record<string, number>>;
}

// ─── 장비 데이터 인터페이스 ───────────────────────────────────────────────────

export interface EquipmentData {
  id:       string;
  name:     string;
  desc:     string;
  grade:    EquipGrade;
  stats:    EquipStat;
  special?: SpecialEffect;
  texture:  string;
  frame:    number;
}

// ─── 장비 목록 (30개) ─────────────────────────────────────────────────────────
//
//  common    (60%, 11개) : 단일 스탯
//  uncommon  (25%,  7개) : 복합 스탯
//  rare      (10%,  5개) : 강력한 복합 스탯
//  unique     (4%,  4개) : 특수 패시브 효과
//  legendary  (1%,  3개) : 매우 강력한 복합 + 특수 효과
//

export const EQUIPMENT_DATA: EquipmentData[] = [

  // ──────────────────────────────────────────────────────────────────────────
  // COMMON (11)
  // ──────────────────────────────────────────────────────────────────────────

  {
    id: 'iron_ring',
    name: '철의 반지',
    desc: '단단한 철로 만든 반지. 착용자의 힘을 끌어올린다.',
    grade: 'common',
    stats: { atk: 5 },
    texture: 'equip_sheet_1',
    frame: 0
  },
  {
    id: 'leather_bracelet',
    name: '가죽 팔찌',
    desc: '두꺼운 가죽으로 엮은 팔찌. 방어에 도움이 된다.',
    grade: 'common',
    stats: { def: 3 },
    texture: 'equip_sheet_1',
    frame: 1
  },
  {
    id: 'basic_amulet',
    name: '기초 부적',
    desc: '초보 술사가 만든 부적. 생명력을 소폭 늘려준다.',
    grade: 'common',
    stats: { maxHp: 10 },
    texture: 'equip_sheet_1',
    frame: 2
  },
  {
    id: 'sharp_fang',
    name: '날카로운 이빨',
    desc: '맹수의 이빨로 만든 장식품. 급소를 노리는 감각이 예리해진다.',
    grade: 'common',
    stats: { crit: 3 },
    texture: 'equip_sheet_1',
    frame: 3
  },
  {
    id: 'wooden_shield_charm',
    name: '목제 방패 부적',
    desc: '오래된 목재 방패의 파편으로 만든 부적. 방어 카드의 효율이 높아진다.',
    grade: 'common',
    stats: { shieldMult: 1.10 },
    texture: 'equip_sheet_1',
    frame: 4
  },
  {
    id: 'red_stone_ring',
    name: '붉은 석 반지',
    desc: '불의 정수가 깃든 루비 반지. 화염 공격이 더욱 강렬해진다.',
    grade: 'common',
    stats: { elementAtkBonus: { fire: 10 } },
    texture: 'equip_sheet_1',
    frame: 5
  },
  {
    id: 'blue_gem_necklace',
    name: '청옥 목걸이',
    desc: '물의 기운이 담긴 사파이어 목걸이. 물 속성 공격력이 높아진다.',
    grade: 'common',
    stats: { elementAtkBonus: { water: 10 } },
    texture: 'equip_sheet_1',
    frame: 6
  },
  {
    id: 'vine_bracelet',
    name: '덩굴 팔찌',
    desc: '신성한 숲의 덩굴로 엮은 팔찌. 풀 속성 공격이 강화된다.',
    grade: 'common',
    stats: { elementAtkBonus: { grass: 10 } },
    texture: 'equip_sheet_1',
    frame: 7
  },
  {
    id: 'thunder_bead',
    name: '천둥 구슬',
    desc: '번개를 가두어 만든 구슬. 번개 속성 공격에 힘이 실린다.',
    grade: 'common',
    stats: { elementAtkBonus: { lightning: 10 } },
    texture: 'equip_sheet_1',
    frame: 8
  },
  {
    id: 'earth_drop',
    name: '흙의 방울',
    desc: '대지의 힘이 응축된 방울. 땅 속성 공격이 묵직해진다.',
    grade: 'common',
    stats: { elementAtkBonus: { earth: 10 } },
    texture: 'equip_sheet_1',
    frame: 9
  },
  {
    id: 'worn_armor_shard',
    name: '낡은 갑옷 조각',
    desc: '오래된 갑옷의 파편. 투박하지만 몸을 지켜준다.',
    grade: 'common',
    stats: { maxHp: 8, def: 1 },
    texture: 'equip_sheet_1',
    frame: 10
  },

  // ──────────────────────────────────────────────────────────────────────────
  // UNCOMMON (7)
  // ──────────────────────────────────────────────────────────────────────────

  {
    id: 'warrior_bracelet',
    name: '전사의 팔찌',
    desc: '역전의 용사가 애용하던 팔찌. 공격과 방어 모두를 강화한다.',
    grade: 'uncommon',
    stats: { atk: 8, def: 3 },
    texture: 'equip_sheet_1',
    frame: 11
  },
  {
    id: 'magic_ring',
    name: '마력 반지',
    desc: '마법사의 기운이 깃든 반지. 급소 공격 확률과 위력이 높아진다.',
    grade: 'uncommon',
    stats: { crit: 5, critDmg: 0.10 },
    texture: 'equip_sheet_1',
    frame: 12
  },
  {
    id: 'life_amulet',
    name: '생명의 부적',
    desc: '치유사가 정성껏 제작한 부적. 생명력과 방어력을 함께 높여준다.',
    grade: 'uncommon',
    stats: { maxHp: 20, def: 2 },
    texture: 'equip_sheet_1',
    frame: 13
  },
  {
    id: 'attack_crystal',
    name: '공격 수정',
    desc: '날카롭게 깎인 수정. 공격력과 치명타 확률을 동시에 강화한다.',
    grade: 'uncommon',
    stats: { atk: 6, crit: 5 },
    texture: 'equip_sheet_1',
    frame: 14
  },
  {
    id: 'element_guardian',
    name: '원소 수호석',
    desc: '모든 속성의 균형을 담은 돌. 어떤 원소 공격도 일부 흘려낼 수 있다.',
    grade: 'uncommon',
    stats: { elementDefBonus: { water: 5, fire: 5, grass: 5, lightning: 5, earth: 5 } },
    texture: 'equip_sheet_1',
    frame: 15
  },
  {
    id: 'eagle_ring',
    name: '쌍두 독수리 반지',
    desc: '두 독수리가 새겨진 반지. 공격력과 생존력을 함께 높여준다.',
    grade: 'uncommon',
    stats: { atk: 10, maxHp: 10 },
    texture: 'equip_sheet_2',
    frame: 0
  },
  {
    id: 'reinforced_gem',
    name: '강화된 보호석',
    desc: '단련을 거듭한 보호의 보석. 방어력과 방어 카드의 효율을 높인다.',
    grade: 'uncommon',
    stats: { def: 5, shieldMult: 1.15 },
    texture: 'equip_sheet_2',
    frame: 1
  },

  // ──────────────────────────────────────────────────────────────────────────
  // RARE (5)
  // ──────────────────────────────────────────────────────────────────────────

  {
    id: 'hero_sword_necklace',
    name: '용사의 검 목걸이',
    desc: '전설의 용사가 부러진 검 조각으로 만든 목걸이. 강력한 전투 능력을 부여한다.',
    grade: 'rare',
    stats: { atk: 15, crit: 8, critDmg: 0.15 },
    texture: 'equip_sheet_2',
    frame: 2
  },
  {
    id: 'undying_heart',
    name: '불사의 심장',
    desc: '쉽게 죽지 않는 마수의 심장. 최대 HP와 방어력을 크게 높여준다.',
    grade: 'rare',
    stats: { maxHp: 30, def: 8 },
    texture: 'equip_sheet_2',
    frame: 3
  },
  {
    id: 'element_amplifier',
    name: '원소 증폭기',
    desc: '고대 연금술사가 만든 장치. 모든 속성 공격의 위력이 크게 상승한다.',
    grade: 'rare',
    stats: { elementAtkBonus: { water: 15, fire: 15, grass: 15, lightning: 15, earth: 15 } },
    texture: 'equip_sheet_2',
    frame: 4
  },
  {
    id: 'iron_wall_armor',
    name: '철벽 갑옷 파편',
    desc: '철옹성을 지키던 갑옷 파편. 방어력과 방어 카드 효율이 크게 높아진다.',
    grade: 'rare',
    stats: { def: 12, shieldMult: 1.30 },
    texture: 'equip_sheet_2',
    frame: 5
  },
  {
    id: 'lethal_claw',
    name: '치명의 발톱',
    desc: '최상위 포식자의 발톱. 공격력과 치명타 성능이 크게 강화된다.',
    grade: 'rare',
    stats: { atk: 8, crit: 15, critDmg: 0.35 },
    texture: 'equip_sheet_2',
    frame: 6
  },

  // ──────────────────────────────────────────────────────────────────────────
  // UNIQUE (4)
  // ──────────────────────────────────────────────────────────────────────────

  {
    id: 'phoenix_feather',
    name: '피닉스의 깃털',
    desc: '불사조의 깃털. 전투에서 이길 때마다 생명력을 회복한다.',
    grade: 'unique',
    stats: {},
    special: {
      type: 'heal_on_win',
      value: 10,
      desc: '전투 승리 시 HP +10 회복',
    },
    texture: 'equip_sheet_2',
    frame: 7
  },
  {
    id: 'storm_eye',
    name: '폭풍의 눈',
    desc: '폭풍의 중심에서 채취한 보석. 매 전투 턴 종료 후 자동으로 방어막이 형성된다.',
    grade: 'unique',
    stats: {},
    special: {
      type: 'shield_on_turn_end',
      value: 10,
      desc: '매 턴 종료 후 방어막 10 생성',
    },
    texture: 'equip_sheet_2',
    frame: 8
  },
  {
    id: 'element_dominator',
    name: '원소 지배자',
    desc: '원소를 지배하는 자의 증표. 속성 유불리의 격차가 더욱 벌어진다.',
    grade: 'unique',
    stats: {},
    special: {
      type: 'element_amplify',
      value: 0.2,
      desc: '속성 유불리 배율 +0.2 (1.5×→1.7×, 0.5×→0.3×)',
    },
    texture: 'equip_sheet_2',
    frame: 9
  },
  {
    id: 'card_master_ring',
    name: '카드 마스터 반지',
    desc: '카드의 달인이 남긴 반지. 매 전투 턴마다 카드를 한 장 더 뽑는다.',
    grade: 'unique',
    stats: {},
    special: {
      type: 'bonus_draw',
      value: 1,
      desc: '매 턴 카드 1장 추가 드로우',
    },
    texture: 'equip_sheet_2',
    frame: 10
  },

  // ──────────────────────────────────────────────────────────────────────────
  // LEGENDARY (3)
  // ──────────────────────────────────────────────────────────────────────────

  {
    id: 'immortal_heart',
    name: '불멸의 심장',
    desc: '신화 속 불멸자의 심장. 극도로 높은 생존력과 전투 승리 시 대량 회복 능력을 부여한다.',
    grade: 'legendary',
    stats: { maxHp: 40, def: 8 },
    special: {
      type: 'heal_on_win_pct',
      value: 15,
      desc: '전투 승리 시 최대 HP의 15% 회복',
    },
    texture: 'equip_sheet_2',
    frame: 11
  },
  {
    id: 'chaos_ring',
    name: '혼돈의 반지',
    desc: '혼돈의 힘이 깃든 반지. 치명타 능력이 폭발적으로 강화되며 방어막이 자동 생성된다.',
    grade: 'legendary',
    stats: { crit: 25, critDmg: 0.50 },
    special: {
      type: 'shield_on_turn_end',
      value: 15,
      desc: '매 턴 종료 후 방어막 15 생성',
    },
    texture: 'equip_sheet_2',
    frame: 12
  },
  {
    id: 'divine_blessing',
    name: '신의 가호',
    desc: '신이 내린 축복. 모든 원소 공격이 강화되고, 카드 성능이 향상되며, 매 턴 카드를 추가로 드로우한다.',
    grade: 'legendary',
    stats: {
      cardMult: 1.30,
      elementAtkBonus: { water: 25, fire: 25, grass: 25, lightning: 25, earth: 25 },
    },
    special: {
      type: 'bonus_draw',
      value: 1,
      desc: '매 턴 카드 1장 추가 드로우',
    },
    texture: 'equip_sheet_2',
    frame: 13
  },
];

// ─── 헬퍼 함수 ────────────────────────────────────────────────────────────────

/** ID로 장비 조회 */
export function getEquipmentById(id: string): EquipmentData | undefined {
  return EQUIPMENT_DATA.find(e => e.id === id);
}

/** 등급별 장비 목록 */
export function getEquipmentByGrade(grade: EquipGrade): EquipmentData[] {
  return EQUIPMENT_DATA.filter(e => e.grade === grade);
}

/**
 * 가중치 랜덤으로 장비 N개 추출 (중복 제외).
 * ownedIds: 이미 보유 중인 장비 ID 목록 (드롭 풀에서 제외)
 */
export function drawEquipment(count: number, ownedIds: string[]): EquipmentData[] {
  const pool = EQUIPMENT_DATA.filter(e => !ownedIds.includes(e.id));
  if (pool.length === 0) return [];

  const result: EquipmentData[] = [];
  const remaining = [...pool];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((s, e) => s + EQUIP_GRADE_WEIGHT[e.grade], 0);
    let rand = Math.random() * totalWeight;
    let picked: EquipmentData | null = null;

    for (const equip of remaining) {
      rand -= EQUIP_GRADE_WEIGHT[equip.grade];
      if (rand <= 0) { picked = equip; break; }
    }
    if (!picked) picked = remaining[remaining.length - 1];

    result.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }

  return result;
}

/** 장비 스탯을 한 줄 요약 문자열로 반환 (UI 표시용) */
export function formatEquipStats(stats: EquipStat): string {
  const parts: string[] = [];
  if (stats.atk)        parts.push(`공격 +${stats.atk}`);
  if (stats.def)        parts.push(`방어 +${stats.def}`);
  if (stats.crit)       parts.push(`치명 +${stats.crit}%`);
  if (stats.critDmg)    parts.push(`치명 배율 +${stats.critDmg.toFixed(1)}×`);
  if (stats.maxHp)      parts.push(`최대HP +${stats.maxHp}`);
  if (stats.cardMult)   parts.push(`카드 ×${stats.cardMult.toFixed(2)}`);
  if (stats.shieldMult) parts.push(`쉴드 ×${stats.shieldMult.toFixed(2)}`);
  if (stats.elementAtkBonus) {
    const elMap: Record<string, string> = { water:'물', fire:'불', grass:'풀', lightning:'번개', earth:'땅' };
    const entries = Object.entries(stats.elementAtkBonus);
    // 모든 속성이 같은 수치면 "전속성 +N%"로 요약
    const vals = entries.map(([, v]) => v);
    if (entries.length === 5 && vals.every(v => v === vals[0])) {
      parts.push(`전속성 공격 +${vals[0]}%`);
    } else {
      entries.forEach(([el, val]) => parts.push(`${elMap[el] ?? el} 공격 +${val}%`));
    }
  }
  if (stats.elementDefBonus) {
    const elMap: Record<string, string> = { water:'물', fire:'불', grass:'풀', lightning:'번개', earth:'땅' };
    const entries = Object.entries(stats.elementDefBonus);
    const vals = entries.map(([, v]) => v);
    if (entries.length === 5 && vals.every(v => v === vals[0])) {
      parts.push(`전속성 피해 -${vals[0]}%`);
    } else {
      entries.forEach(([el, val]) => parts.push(`${elMap[el] ?? el} 피해 -${val}%`));
    }
  }
  return parts.join('  |  ') || '—';
}
