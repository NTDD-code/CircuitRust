import type { CompileResult } from "@workspace/api-client-react";

export function calculateHealthScore(result: CompileResult): number {
  let score = 100;

  for (const err of result.errors) {
    switch (err.errorCode) {
      case "E001": score -= 50; break;
      case "E013": score -= 40; break;
      case "E012": score -= 30; break;
      case "E010": score -= 30; break;
      case "E007": score -= 25; break;
      case "E009": score -= 20; break;
      case "E008": score -= 20; break;
      case "E011": score -= 15; break;
      default:     score -= 15;
    }
  }

  for (const warn of result.warnings) {
    switch (warn.warningCode) {
      case "W003": score -= 10; break;
      case "W009": score -= 8;  break;
      case "W005": score -= 5;  break;
      default:     score -= 3;
    }
  }

  return Math.max(0, Math.min(100, score));
}

export function getHealthColor(score: number): string {
  if (score >= 85) return "#3FB950";
  if (score >= 60) return "#D29922";
  if (score >= 40) return "#F0883E";
  return "#F85149";
}

export function getHealthLabel(score: number): string {
  if (score >= 95) return "SAFE";
  if (score >= 75) return "REVIEW";
  if (score >= 50) return "ISSUES";
  return "UNSAFE";
}

export function playCompileSound(success: boolean): void {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    if (success) {
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = now + i * 0.08;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.05, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    } else {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.14);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.14);
    }
  } catch {
    // Silently fail if AudioContext is blocked
  }
}
