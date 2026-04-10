/**
 * 게임 내 합성 SFX 정의 (멀티 레이어 Web Audio API 합성)
 * layers: 오실레이터 레이어 배열 (delay 로 아르페지오/코드 표현)
 * noise: 물리적 타격감 노이즈 레이어
 */

export type OscLayer = {
  f1: number;              // 시작 주파수
  f2?: number;             // 끝 주파수 (없으면 f1 유지)
  type: OscillatorType;    // 파형
  dur: number;             // 지속 시간 (초)
  vol: number;             // 볼륨 (0~1)
  delay?: number;          // 재생 시작 딜레이 (초, 아르페지오용)
  attack?: number;         // 어택 시간 (초, 없으면 즉시)
};

export type NoiseLayer = {
  dur: number;
  vol: number;
  filter?: 'highpass' | 'lowpass' | 'bandpass';
  filterFreq?: number;
  delay?: number;
};

export type SFXDef = {
  layers: OscLayer[];
  noise?: NoiseLayer;
};

export const SFX_DATA: Record<string, SFXDef> = {

  // ─── 전투 (Combat) ─────────────────────────────────────────────────────────

  /** 칼 휘두르는 슉 + 묵직한 펀치감 */
  ATTACK: {
    layers: [
      { f1: 360, f2: 55,  type: 'sawtooth', dur: 0.20, vol: 0.72 },
      { f1: 180, f2: 28,  type: 'square',   dur: 0.26, vol: 0.40 },
    ],
    noise: { dur: 0.14, vol: 0.58, filter: 'lowpass', filterFreq: 380 },
  },

  /** 크리티컬 히트 - 날카로운 크랙 + 빛나는 링 */
  CRIT: {
    layers: [
      { f1: 880,  f2: 55,  type: 'sawtooth', dur: 0.13, vol: 0.90 },
      { f1: 1760, f2: 440, type: 'sine',     dur: 0.30, vol: 0.50 },
      { f1: 440,  f2: 220, type: 'triangle', dur: 0.40, vol: 0.32, delay: 0.06 },
    ],
    noise: { dur: 0.09, vol: 0.75, filter: 'highpass', filterFreq: 2200 },
  },

  /** 피격 - 둔탁한 저음 충격 */
  HIT: {
    layers: [
      { f1: 130, f2: 38,  type: 'square',   dur: 0.24, vol: 0.80 },
      { f1: 260, f2: 75,  type: 'sawtooth', dur: 0.18, vol: 0.40 },
    ],
    noise: { dur: 0.18, vol: 0.62, filter: 'lowpass', filterFreq: 220 },
  },

  /** 치유 - 상승하는 화음 아르페지오 */
  HEAL: {
    layers: [
      { f1: 523,  f2: 1046, type: 'sine',     dur: 0.50, vol: 0.58 },
      { f1: 659,  f2: 1318, type: 'sine',     dur: 0.45, vol: 0.42, delay: 0.08 },
      { f1: 784,  f2: 1568, type: 'triangle', dur: 0.40, vol: 0.32, delay: 0.16 },
    ],
  },

  /** 방어막 생성 - 금속성 핑 */
  SHIELD: {
    layers: [
      { f1: 880,  f2: 1320, type: 'triangle', dur: 0.16, vol: 0.58 },
      { f1: 1760, f2: 880,  type: 'sine',     dur: 0.35, vol: 0.40 },
      { f1: 2640, f2: 1320, type: 'sine',     dur: 0.28, vol: 0.25, delay: 0.02 },
    ],
    noise: { dur: 0.06, vol: 0.36, filter: 'highpass', filterFreq: 1800 },
  },

  /** 화상 틱 데미지 - 찌지직 사이즐 */
  BURN_TICK: {
    layers: [
      { f1: 320, f2: 100, type: 'sawtooth', dur: 0.10, vol: 0.32 },
    ],
    noise: { dur: 0.14, vol: 0.50, filter: 'highpass', filterFreq: 1200 },
  },

  /** 기절/전격 - 전기 스냅 */
  STUN: {
    layers: [
      { f1: 1400, f2: 100, type: 'sawtooth', dur: 0.08, vol: 0.68 },
      { f1: 400,  f2: 900, type: 'square',   dur: 0.18, vol: 0.40, delay: 0.05 },
    ],
    noise: { dur: 0.12, vol: 0.58, filter: 'highpass', filterFreq: 1000 },
  },

  /** 버프 효과 (상태이상 부여 등 긍정) */
  BUFF: {
    layers: [
      { f1: 523, f2: 784, type: 'sine',     dur: 0.22, vol: 0.50 },
      { f1: 659, f2: 988, type: 'triangle', dur: 0.20, vol: 0.36, delay: 0.10 },
    ],
  },

  /** 디버프 효과 (취약/방깎 등 부정) */
  DEBUFF: {
    layers: [
      { f1: 300, f2: 180, type: 'square', dur: 0.18, vol: 0.46 },
      { f1: 200, f2: 120, type: 'square', dur: 0.22, vol: 0.36, delay: 0.09 },
    ],
  },

  /** 승리 - 상승 아르페지오 팡파르 */
  WIN: {
    layers: [
      { f1: 523,  f2: 523,  type: 'sine',     dur: 0.20, vol: 0.70 },
      { f1: 659,  f2: 659,  type: 'sine',     dur: 0.22, vol: 0.70, delay: 0.10 },
      { f1: 784,  f2: 784,  type: 'sine',     dur: 0.24, vol: 0.70, delay: 0.20 },
      { f1: 1046, f2: 1046, type: 'sine',     dur: 0.55, vol: 0.78, delay: 0.30 },
      { f1: 1046, f2: 1567, type: 'triangle', dur: 0.40, vol: 0.32, delay: 0.32 },
    ],
  },

  /** 패배 - 무거운 하강 */
  LOSE: {
    layers: [
      { f1: 220, f2: 110, type: 'square',   dur: 0.45, vol: 0.62 },
      { f1: 147, f2: 73,  type: 'square',   dur: 0.55, vol: 0.46, delay: 0.18 },
      { f1: 180, f2: 44,  type: 'sawtooth', dur: 0.75, vol: 0.36 },
    ],
    noise: { dur: 0.60, vol: 0.40, filter: 'lowpass', filterFreq: 100 },
  },

  // ─── 카드 인터랙션 ────────────────────────────────────────────────────────

  /** 카드 위에 마우스 올림 - 매우 짧고 경쾌 (상대적으로 조용하게 유지) */
  CARD_HOVER: {
    layers: [
      { f1: 2000, f2: 2400, type: 'sine', dur: 0.04, vol: 0.16 },
    ],
  },

  /** 카드 선택 - 맑고 crisp한 픽 */
  CARD_SELECT: {
    layers: [
      { f1: 1200, f2: 1800, type: 'triangle', dur: 0.13, vol: 0.40 },
      { f1: 2400, f2: 1600, type: 'sine',     dur: 0.10, vol: 0.22 },
    ],
  },

  /** 카드 내기 - 슉 + 탁 */
  CARD_PLAY: {
    layers: [
      { f1: 440, f2: 110, type: 'sawtooth', dur: 0.16, vol: 0.62 },
      { f1: 160, f2: 48,  type: 'square',   dur: 0.13, vol: 0.50 },
    ],
    noise: { dur: 0.10, vol: 0.42, filter: 'lowpass', filterFreq: 320 },
  },

  // ─── 시스템 UI ──────────────────────────────────────────────────────────

  /** 표준 버튼 클릭 */
  CLICK: {
    layers: [
      { f1: 880, f2: 660, type: 'triangle', dur: 0.11, vol: 0.32 },
    ],
  },

  /** 보상 획득 - 반짝이는 상승 스파클 */
  REWARD: {
    layers: [
      { f1: 1000, f2: 2000, type: 'sine', dur: 0.16, vol: 0.54 },
      { f1: 1260, f2: 2520, type: 'sine', dur: 0.16, vol: 0.46, delay: 0.08 },
      { f1: 1587, f2: 3174, type: 'sine', dur: 0.18, vol: 0.40, delay: 0.16 },
      { f1: 2000, f2: 4000, type: 'sine', dur: 0.22, vol: 0.32, delay: 0.24 },
    ],
  },

  /** 노드 이동 - 가벼운 발걸음 (이동은 상대적으로 작게) */
  MOVE: {
    layers: [
      { f1: 260, f2: 320, type: 'sine', dur: 0.11, vol: 0.26 },
    ],
    noise: { dur: 0.08, vol: 0.26, filter: 'lowpass', filterFreq: 200 },
  },

  /** 별/등급 업그레이드 - 화려한 상승 아르페지오 */
  UPGRADE: {
    layers: [
      { f1: 523,  f2: 1046, type: 'sine',     dur: 0.22, vol: 0.65 },
      { f1: 659,  f2: 1318, type: 'sine',     dur: 0.24, vol: 0.54, delay: 0.12 },
      { f1: 784,  f2: 1568, type: 'sine',     dur: 0.28, vol: 0.50, delay: 0.24 },
      { f1: 1046, f2: 2093, type: 'sine',     dur: 0.45, vol: 0.68, delay: 0.36 },
      { f1: 1500, f2: 3000, type: 'triangle', dur: 0.32, vol: 0.32, delay: 0.52 },
    ],
  },

  /** 실패/경고 - 짧고 불쾌한 이중 버저 */
  ERROR: {
    layers: [
      { f1: 220, f2: 160, type: 'square', dur: 0.12, vol: 0.50 },
      { f1: 175, f2: 125, type: 'square', dur: 0.12, vol: 0.40, delay: 0.10 },
    ],
  },

  /** 코인/골드 - 맑은 코인 핑 */
  COIN: {
    layers: [
      { f1: 1760, f2: 1480, type: 'sine',     dur: 0.14, vol: 0.50 },
      { f1: 2200, f2: 1760, type: 'triangle', dur: 0.11, vol: 0.32, delay: 0.03 },
    ],
  },

} as const;

export type SFXKey = keyof typeof SFX_DATA;
