// Everything is locked to a 132 BPM grid: 33 beats = exactly 15.000 s.
export const FPS = 30;
export const BPM = 132;
export const DURATION = 450; // 15 s
export const BEAT = (60 / BPM) * FPS; // 13.636 frames

// 9 shots, lengths in beats: 4-3-4-4-4-4-3-3-4 (= 33)
export const SHOT_BEATS = [0, 4, 7, 11, 15, 19, 23, 26, 29, 33];
export const SHOTS = SHOT_BEATS.map((b) => Math.round(b * BEAT));
// -> [0, 55, 95, 150, 205, 259, 314, 355, 395, 450]

export const shotStart = (i: number) => SHOTS[i];
export const shotEnd = (i: number) => SHOTS[i + 1];
export const beatFrame = (b: number) => Math.round(b * BEAT);

export const shotIndexAt = (frame: number) => {
  for (let i = SHOTS.length - 2; i >= 0; i--) {
    if (frame >= SHOTS[i]) return i;
  }
  return 0;
};
