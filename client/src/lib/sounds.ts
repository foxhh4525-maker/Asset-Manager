/**
 * sounds.ts — نظام الأصوات
 * ملف مستقل لتجنب الاستيراد الدائري مع App.tsx
 */

class SoundEngine {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  private playTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    vol = 0.25,
    delay = 0
  ) {
    try {
      const ctx  = this.getCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + 0.01);
    } catch {}
  }

  /** نقرة خفيفة */
  click() { this.playTone(480, "sine", 0.07, 0.12); }

  /** hover */
  hover() { this.playTone(660, "sine", 0.05, 0.06); }

  /** فتح/تشغيل */
  open() {
    this.playTone(392, "sine", 0.08, 0.15, 0);
    this.playTone(523, "sine", 0.1,  0.15, 0.07);
  }

  /** نجاح */
  success() {
    this.playTone(523, "sine", 0.12, 0.22, 0);
    this.playTone(659, "sine", 0.12, 0.22, 0.12);
    this.playTone(784, "sine", 0.16, 0.22, 0.24);
  }

  /** إرسال */
  submit() {
    this.playTone(440, "sine", 0.09, 0.18, 0);
    this.playTone(550, "sine", 0.09, 0.18, 0.08);
    this.playTone(660, "sine", 0.12, 0.18, 0.16);
    this.playTone(880, "sine", 0.10, 0.18, 0.24);
  }

  /** خطأ */
  error() {
    this.playTone(300, "sawtooth", 0.12, 0.18, 0);
    this.playTone(220, "sawtooth", 0.12, 0.18, 0.12);
  }

  /** تمرير/swipe */
  swipe() { this.playTone(330, "sine", 0.08, 0.1); }
}

export const sfx = new SoundEngine();
