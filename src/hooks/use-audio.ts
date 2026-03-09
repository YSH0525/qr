"use client";

import { useCallback, useRef } from "react";

export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // 딩동 알림음 (G5 → C6)
  const playDingDong = useCallback(async () => {
    try {
      const ctx = getContext();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      const t = ctx.currentTime;

      // 딩 (G5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(784, t);
      gain1.gain.setValueAtTime(0.35, t);
      gain1.gain.exponentialRampToValueAtTime(0.1, t + 0.25);
      gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      osc1.start(t);
      osc1.stop(t + 0.4);

      // 동 (C6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1047, t + 0.15);
      gain2.gain.setValueAtTime(0.0001, t);
      gain2.gain.setValueAtTime(0.35, t + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.55);
      osc2.start(t + 0.15);
      osc2.stop(t + 0.55);
    } catch {
      // Audio not available
    }
  }, [getContext]);

  // 완료 효과음
  const playCompleteSound = useCallback(() => {
    try {
      const ctx = getContext();
      const t = ctx.currentTime;
      const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t + i * 0.08);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.setValueAtTime(0.3, t + i * 0.08);
        if (i < notes.length - 1) {
          gain.gain.exponentialRampToValueAtTime(0.1, t + i * 0.08 + 0.15);
        } else {
          gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.08 + 0.5);
        }
        osc.start(t + i * 0.08);
        osc.stop(t + i * 0.08 + 0.5);
      });
    } catch {
      // Audio not available
    }
  }, [getContext]);

  return {
    playDingDong,
    playAcceptSound: playDingDong,
    playNewOrderAlert: playDingDong,
    playServiceRequestAlert: playDingDong,
    playCompleteSound,
  };
}
