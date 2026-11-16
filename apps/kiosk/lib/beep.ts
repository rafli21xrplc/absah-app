/** Short tones so the line moves without looking at the screen: high = ok, low = problem. */
let audio: AudioContext | null = null;

export function beep(kind: 'ok' | 'warn' | 'error') {
  try {
    audio ??= new AudioContext();
    const tones = { ok: [880], warn: [660, 660], error: [220] }[kind];
    tones.forEach((hz, i) => {
      const osc = audio?.createOscillator();
      const gain = audio?.createGain();
      if (!audio || !osc || !gain) return;
      const start = audio.currentTime + i * 0.18;
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + (kind === 'error' ? 0.5 : 0.15));
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch {
    // No audio (autoplay policy before the first tap): the screen still shows the result.
  }
}
