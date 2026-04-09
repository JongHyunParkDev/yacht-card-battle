import { SFX_DATA, SFXKey } from '@src/data/sfxData';

/**
 * 게임 오디오 관리 유틸리티 (멀티 레이어 하모닉 합성 SFX 방식)
 */
export class AudioManager {
  private static audioContext: AudioContext | null = null;
  private static noiseBuffer: AudioBuffer | null = null;

  private static getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  private static getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const size = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  /**
   * 풍부한 사운드를 위한 멀티 레이어 재생 (하모닉스 + 코러스 효과)
   */
  static play(key: SFXKey) {
    const data = SFX_DATA[key];
    if (!data) return;

    const ctx = this.getContext();
    const now = ctx.currentTime;
    const volume = data.vol ?? 0.3;

    // --- 레이어 1: 메인 톤 (중심이 되는 소리) ---
    this.createOscillatorLayer(ctx, now, data.f1, data.f2, data.type, data.dur, volume);

    // --- 레이어 2: 하모닉/디튠 톤 (소리를 풍성하고 두껍게 만듦) ---
    // 메인 톤보다 아주 살짝 어긋나게(Detune) 하여 코러스 효과를 주거나, 
    // 특정 인터벌(옥타브 등)을 섞어 소리의 깊이를 더함
    const detuneOffset = 5; // 5Hz 차이로 풍성한 떨림 유도
    const harmonicMult = data.f1 < 400 ? 2 : 0.5; // 저음은 화성학적으로 보강, 고음은 서브 톤 추가
    this.createOscillatorLayer(
      ctx, now, 
      data.f1 + detuneOffset, 
      (data.f2 ? data.f2 + detuneOffset : undefined), 
      data.type === 'sine' ? 'triangle' : 'sine', // 다른 파형을 섞어 배음 구조를 풍부하게 함
      data.dur, 
      volume * 0.6 // 서브 레이어는 약간 작게
    );

    // --- 레이어 3: 노이즈 (물리적인 타격 질감) ---
    if (data.noise) {
      const n = ctx.createBufferSource();
      const ng = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      n.buffer = this.getNoiseBuffer(ctx);
      filter.type = data.f1 > 500 ? 'highpass' : 'lowpass';
      filter.frequency.setValueAtTime(data.f1, now);
      filter.Q.setValueAtTime(10, now); // 공명(Resonance) 추가
      
      ng.gain.setValueAtTime(volume * 0.5, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + data.dur * 0.7);

      n.connect(filter);
      filter.connect(ng);
      ng.connect(ctx.destination);
      n.start(now);
      n.stop(now + data.dur);
    }
  }

  /** 개별 오실레이터 레이어 생성 헬퍼 */
  private static createOscillatorLayer(
    ctx: AudioContext, now: number, 
    f1: number, f2: number | undefined, 
    type: OscillatorType, dur: number, vol: number
  ) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    
    o.type = type;
    o.frequency.setValueAtTime(f1, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + dur);

    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.00001, now + dur);

    o.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + dur + 0.1);
  }
}