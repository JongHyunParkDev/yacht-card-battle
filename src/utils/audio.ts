import { SFX_DATA, SFXKey, OscLayer, NoiseLayer } from '@src/data/sfxData';

/**
 * 게임 오디오 관리 유틸리티 (멀티 레이어 Web Audio API 합성)
 * 레이어별 delay 로 코드/아르페지오 구현, ADSR envelope 지원
 */
export class AudioManager {
  private static ctx: AudioContext | null = null;
  private static noiseBuffer: AudioBuffer | null = null;

  /** SFX 볼륨 (0~1). 설정에서 0~100 값을 /100 해서 저장 */
  static sfxVol = 0.90;
  /** BGM 볼륨 (0~1). Phaser sound.play() volume 파라미터에 직접 사용 */
  static bgmVol = 0.20;

  /** IntroScene create() 에서 첫 user gesture 타이밍에 호출 */
  static init(_scene?: unknown) {
    this.getCtx();
  }

  /** 설정 씬에서 볼륨을 0~100 정수로 받아 적용 */
  static setSfxVolume(v: number) {
    this.sfxVol = Math.max(0, Math.min(100, v)) / 100;
  }

  /** 설정 씬에서 볼륨을 0~100 정수로 받아 적용 */
  static setBgmVolume(v: number, scene?: Phaser.Scene) {
    this.bgmVol = Math.max(0, Math.min(100, v)) / 100;
    // 현재 재생 중인 BGM 볼륨도 즉시 반영
    if (scene) {
      // 재생 중인 모든 Phaser 사운드(BGM)의 볼륨을 즉시 갱신
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sounds: Phaser.Sound.BaseSound[] = (scene.sound as any).sounds ?? [];
      sounds.forEach((s) => {
        if (s.isPlaying) (s as Phaser.Sound.WebAudioSound).setVolume(AudioManager.bgmVol);
      });
    }
  }

  private static getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private static getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const sr   = ctx.sampleRate;
    const buf  = ctx.createBuffer(1, sr * 1, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }

  // ── 레이어 생성 헬퍼 ──────────────────────────────────────────────────────

  private static makeOscLayer(ctx: AudioContext, now: number, layer: OscLayer) {
    const start  = now + (layer.delay ?? 0);
    const end    = start + layer.dur;
    const attack = layer.attack ?? 0.005;
    const vol    = layer.vol * this.sfxVol;

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = layer.type;
    osc.frequency.setValueAtTime(layer.f1, start);
    if (layer.f2 !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(layer.f2, 1), end);
    }

    gain.gain.setValueAtTime(0.00001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(vol, 0.00001), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.00001, end);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.05);
  }

  private static makeNoiseLayer(ctx: AudioContext, now: number, noise: NoiseLayer) {
    const start = now + (noise.delay ?? 0);
    const end   = start + noise.dur;
    const vol   = noise.vol * this.sfxVol;

    const src    = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain   = ctx.createGain();

    src.buffer = this.getNoiseBuffer(ctx);
    src.loop   = true;

    filter.type                     = noise.filter ?? 'lowpass';
    filter.frequency.setValueAtTime(noise.filterFreq ?? 400, start);
    filter.Q.setValueAtTime(4, start);

    gain.gain.setValueAtTime(Math.max(vol, 0.00001), start);
    gain.gain.exponentialRampToValueAtTime(0.00001, end);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(start);
    src.stop(end + 0.05);
  }

  // ── 공개 API ─────────────────────────────────────────────────────────────

  /** SFX 재생 */
  static play(key: SFXKey) {
    if (this.sfxVol <= 0) return;
    const def = SFX_DATA[key];
    if (!def) return;

    const ctx = this.getCtx();
    const now = ctx.currentTime;

    for (const layer of def.layers) {
      this.makeOscLayer(ctx, now, layer);
    }
    if (def.noise) {
      this.makeNoiseLayer(ctx, now, def.noise);
    }
  }

  /**
   * 속성별 ATTACK 사운드 (기본 ATTACK + 속성 오버레이 톤)
   */
  static playAttack(element?: string) {
    this.play('ATTACK');

    const elementTone: Record<string, { f1: number; f2: number; type: OscillatorType; dur: number; vol: number }> = {
      fire:      { f1: 480,  f2: 80,  type: 'sawtooth', dur: 0.20, vol: 0.18 },
      water:     { f1: 280,  f2: 560, type: 'sine',     dur: 0.22, vol: 0.14 },
      grass:     { f1: 380,  f2: 190, type: 'triangle', dur: 0.18, vol: 0.14 },
      lightning: { f1: 1200, f2: 80,  type: 'square',   dur: 0.10, vol: 0.20 },
      earth:     { f1: 90,   f2: 40,  type: 'square',   dur: 0.28, vol: 0.22 },
    };
    const tone = element ? elementTone[element] : undefined;
    if (tone && this.sfxVol > 0) {
      const ctx = this.getCtx();
      const now = ctx.currentTime;
      this.makeOscLayer(ctx, now, { ...tone, delay: 0 });
    }
  }
}
