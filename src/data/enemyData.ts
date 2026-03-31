import { CardElement } from './cardData';

export type EnemyRank = 'normal' | 'elite' | 'boss';

export interface EnemyDef {
  id: string;
  nameKey: string;     // i18n
  element: CardElement;
  rank: EnemyRank;
  hp: number;
  atk: number;
  def: number;
  spriteKey?: string;
}

export const ENEMY_DATA_LIST: EnemyDef[] = [
  // 물 속성(water)
  { id: 'slime_water', nameKey: 'Water Slime', element: 'water', rank: 'normal', hp: 30, atk: 5, def: 2 },
  { id: 'crab_water', nameKey: 'Giant Crab', element: 'water', rank: 'normal', hp: 45, atk: 6, def: 5 },
  { id: 'knight_water', nameKey: 'Aqua Knight', element: 'water', rank: 'elite', hp: 80, atk: 12, def: 10 },
  { id: 'boss_water', nameKey: 'Leviathan', element: 'water', rank: 'boss', hp: 200, atk: 20, def: 15 },

  // 불 속성(fire)
  { id: 'slime_fire', nameKey: 'Fire Slime', element: 'fire', rank: 'normal', hp: 25, atk: 7, def: 1 },
  { id: 'hound_fire', nameKey: 'Hell Hound', element: 'fire', rank: 'normal', hp: 40, atk: 10, def: 3 },
  { id: 'knight_fire', nameKey: 'Flame Knight', element: 'fire', rank: 'elite', hp: 75, atk: 15, def: 8 },
  { id: 'boss_fire', nameKey: 'Ifrit', element: 'fire', rank: 'boss', hp: 180, atk: 25, def: 10 },

  // 풀 속성(grass)
  { id: 'slime_grass', nameKey: 'Leaf Slime', element: 'grass', rank: 'normal', hp: 35, atk: 4, def: 3 },
  { id: 'treant_grass', nameKey: 'Young Treant', element: 'grass', rank: 'normal', hp: 55, atk: 5, def: 6 },
  { id: 'knight_grass', nameKey: 'Forest Knight', element: 'grass', rank: 'elite', hp: 90, atk: 10, def: 12 },
  { id: 'boss_grass', nameKey: 'Ancient Treant', element: 'grass', rank: 'boss', hp: 250, atk: 15, def: 20 },

  // 땅 속성(earth)
  { id: 'golem_earth', nameKey: 'Mud Golem', element: 'earth', rank: 'normal', hp: 50, atk: 6, def: 8 },
  { id: 'worm_earth', nameKey: 'Sand Worm', element: 'earth', rank: 'normal', hp: 60, atk: 8, def: 5 },
  { id: 'knight_earth', nameKey: 'Earth Knight', element: 'earth', rank: 'elite', hp: 100, atk: 14, def: 15 },
  { id: 'boss_earth', nameKey: 'Titan', element: 'earth', rank: 'boss', hp: 300, atk: 18, def: 25 },

  // 번개 속성(lightning)
  { id: 'wisp_lightning', nameKey: 'Spark Wisp', element: 'lightning', rank: 'normal', hp: 20, atk: 8, def: 0 },
  { id: 'bird_lightning', nameKey: 'Thunder Bird', element: 'lightning', rank: 'normal', hp: 35, atk: 12, def: 2 },
  { id: 'knight_lightning', nameKey: 'Storm Knight', element: 'lightning', rank: 'elite', hp: 70, atk: 18, def: 6 },
  { id: 'boss_lightning', nameKey: 'Thunder Dragon', element: 'lightning', rank: 'boss', hp: 160, atk: 30, def: 12 },

  // 노멀(무속성)
  { id: 'goblin', nameKey: 'Goblin', element: 'normal', rank: 'normal', hp: 35, atk: 6, def: 2 },
  { id: 'orc', nameKey: 'Orc Warrior', element: 'normal', rank: 'normal', hp: 50, atk: 8, def: 5 },
  { id: 'troll', nameKey: 'Cave Troll', element: 'normal', rank: 'elite', hp: 85, atk: 12, def: 8 },
  { id: 'boss_normal', nameKey: 'Bandit King', element: 'normal', rank: 'boss', hp: 220, atk: 22, def: 15 },
];

export function getRandomEnemy(element: CardElement, rank: EnemyRank): EnemyDef {
  const cands = ENEMY_DATA_LIST.filter(e => e.element === element && e.rank === rank);
  if (cands.length > 0) return cands[Math.floor(Math.random() * cands.length)];
  const fallbacks = ENEMY_DATA_LIST.filter(e => e.rank === rank);
  if (fallbacks.length > 0) return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  return ENEMY_DATA_LIST[0];
}
