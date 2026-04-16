// ─── BattleCalc.ts — 순수 배틀 계산 함수 모음 ─────────────────────────────────

/** Water > Fire > Grass > Earth > Lightning > Water */
export const TYPE_BEATS: Record<string, string> = {
  water:     'fire',
  fire:      'grass',
  grass:     'earth',
  earth:     'lightning',
  lightning: 'water',
};

/**
 * 속성 상성 배율 계산
 * @param atkElem  공격 속성
 * @param defElem  방어(적) 속성
 * @param amplify  element_amplify 장비 합계 (기본 0)
 * @returns 1.5 (유리) | 0.5 (불리) | 1.0 (중립)
 */
export function calcElemMult(atkElem: string, defElem: string, amplify = 0): number {
  if (atkElem === 'normal' || defElem === 'normal') return 1.0;
  if (TYPE_BEATS[atkElem] === defElem) return 1.5 * (1 + amplify);
  if (TYPE_BEATS[defElem] === atkElem) return 0.5;
  return 1.0;
}

/**
 * 방어력 감쇄 공식: rawDmg * (50 / (50 + defense))
 */
export function calcDefenseReduction(rawDmg: number, defense: number): number {
  return Math.max(1, Math.floor(rawDmg * (50 / (50 + Math.max(0, defense)))));
}

/**
 * 크리티컬 계산
 * @param baseDmg    크리 적용 전 피해량
 * @param critChance 크리 확률 (0~100)
 * @param critMult   크리 배율 (예: 1.5)
 * @param equipBonus card_mult_on_crit 장비 합계 (기본 0)
 */
export function calcCritResult(
  baseDmg: number,
  critChance: number,
  critMult: number,
  equipBonus = 0,
): { dmg: number; wasCrit: boolean } {
  const wasCrit = Math.random() * 100 < critChance;
  const dmg = wasCrit ? baseDmg * (critMult + equipBonus) : baseDmg;
  return { dmg, wasCrit };
}
