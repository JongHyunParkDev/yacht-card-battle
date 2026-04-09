/**
 * 게임 내 합성 SFX 파라미터 정의 (멀티 레이어 엔진용)
 * f1: 시작 주파수, f2: 끝 주파수
 * type: 메인 파형, dur: 지속시간, vol: 볼륨, noise: 타격 노이즈 여부
 */
export const SFX_DATA = {
  // --- 전투 (Combat) ---
  // 칼을 휘두르는 슉 소리 + 강한 타격감
  ATTACK:       { f1: 400,  f2: 60,   type: 'sawtooth' as OscillatorType, dur: 0.18, vol: 0.35, noise: true },
  // 둔탁한 피격음 (저음 강조)
  HIT:          { f1: 120,  f2: 40,   type: 'square' as OscillatorType,   dur: 0.22, vol: 0.5,  noise: true },
  // 신비로운 치유 (상승음)
  HEAL:         { f1: 523,  f2: 1046, type: 'sine' as OscillatorType,     dur: 0.5,  vol: 0.35, noise: false },
  // 승리 팡파르 (고음 상승)
  WIN:          { f1: 659,  f2: 1318, type: 'sine' as OscillatorType,     dur: 0.7,  vol: 0.45, noise: false },
  // 패배 (무거운 하강음)
  LOSE:         { f1: 196,  f2: 49,   type: 'square' as OscillatorType,   dur: 0.9,  vol: 0.35, noise: false },
  
  // --- 카드 인터랙션 (Card) ---
  // 매우 짧고 경쾌한 틱 사운드
  CARD_HOVER:   { f1: 1500, f2: 1800, type: 'sine' as OscillatorType,     dur: 0.05, vol: 0.1,  noise: false },
  // 카드를 집는 맑은 소리
  CARD_SELECT:  { f1: 1200, f2: 1600, type: 'triangle' as OscillatorType, dur: 0.15, vol: 0.25, noise: false },
  // 카드를 내는 묵직한 착탁음
  CARD_PLAY:    { f1: 500,  f2: 150,  type: 'sawtooth' as OscillatorType, dur: 0.3,  vol: 0.4,  noise: true },
  
  // --- 시스템 및 UI ---
  // 표준적인 버튼 클릭
  CLICK:        { f1: 800,  f2: 600,  type: 'triangle' as OscillatorType, dur: 0.12, vol: 0.2,  noise: false },
  // 보상 획득 (반짝이는 소리)
  REWARD:       { f1: 1000, f2: 3000, type: 'sine' as OscillatorType,     dur: 0.45, vol: 0.35, noise: false },
  // 이동 (가벼운 발걸음 터치)
  MOVE:         { f1: 250,  f2: 300,  type: 'sine' as OscillatorType,     dur: 0.12, vol: 0.15, noise: true },
  // 별/등급 업그레이드 (강하고 긴 상승음)
  UPGRADE:      { f1: 784,  f2: 2093, type: 'sine' as OscillatorType,     dur: 0.6,  vol: 0.3,  noise: false },
  // 실패/경고 (낮고 불쾌한 파형)
  ERROR:        { f1: 150,  f2: 100,  type: 'square' as OscillatorType,   dur: 0.3,  vol: 0.3,  noise: false },
} as const;

export type SFXKey = keyof typeof SFX_DATA;
