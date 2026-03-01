"use client";

import { useCallback, useEffect, useRef } from "react";

export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const voicesReadyRef = useRef(false);

  // 음성 목록 미리 로드 (비동기)
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) voicesReadyRef.current = true;
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  // 배달의민족 스타일 효과음 (띠링~ 2연타)
  const playChime = useCallback(() => {
    try {
      const ctx = getContext();

      // 첫 번째 음 (높은 띠링)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
      gain1.gain.setValueAtTime(0.4, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.3);

      // 두 번째 음 (더 높은 띠링)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.2);
      osc2.frequency.setValueAtTime(1760, ctx.currentTime + 0.28);
      gain2.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain2.gain.setValueAtTime(0.4, ctx.currentTime + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc2.start(ctx.currentTime + 0.2);
      osc2.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio not available
    }
  }, [getContext]);

  // TTS 음성 알림: "새 주문이 들어왔습니다. {객실번호}호, {메뉴내용}"
  const speak = useCallback((text: string) => {
    try {
      if (!("speechSynthesis" in window)) return;

      // Chrome 버그 대응: 장시간 미사용 시 speechSynthesis가 멈추는 현상
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ko-KR";
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // 한국어 음성 선택
      const voices = window.speechSynthesis.getVoices();
      const koVoice = voices.find(
        (v) => v.lang === "ko-KR" || v.lang === "ko_KR"
      );
      if (koVoice) {
        utterance.voice = koVoice;
      }

      // Chrome에서 긴 텍스트가 중간에 끊기는 버그 대응
      utterance.onpause = () => {
        window.speechSynthesis.resume();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      // TTS not available
    }
  }, []);

  // 효과음 + TTS 조합
  const playNewOrderAlert = useCallback(
    (roomNumber: string, items: { menuItemName: string; quantity: number }[]) => {
      playChime();

      const itemText = items
        .map((i) => `${i.menuItemName} ${i.quantity}개`)
        .join(", ");
      const text = `새 주문이 들어왔습니다. ${roomNumber}호, ${itemText}`;

      // 효과음 끝난 후 TTS 재생
      setTimeout(() => speak(text), 600);
    },
    [playChime, speak]
  );

  // 접수 효과음: "딩동~" 밝은 2음 차임
  const playAcceptSound = useCallback(() => {
    try {
      const ctx = getContext();
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

      // 동 (C6) - 5도 위
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

  // 완료 효과음: "짠~" 팡파레 (도미솔도 아르페지오)
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
          // 마지막 음은 길게
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
    play: playChime,
    speak,
    playNewOrderAlert,
    playAcceptSound,
    playCompleteSound,
  };
}
