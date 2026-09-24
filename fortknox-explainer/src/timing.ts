// Everything is locked to a 132 BPM grid: 11 beats = exactly 5 s, 66 beats = 30 s.
export const FPS = 30;
export const BPM = 132;
export const DURATION = 900; // 30 s
export const BEAT = (60 / BPM) * FPS; // 13.636 frames

// 6 sections x 5 s (11 beats each) — every message holds for at least 5 s.
export const SECTION_BEATS = [0, 11, 22, 33, 44, 55, 66];
export const SECTIONS = SECTION_BEATS.map((b) => Math.round(b * BEAT));
// -> [0, 150, 300, 450, 600, 750, 900]

// 9 camera shots inside those sections (sections 1, 4 and 5 hold two angles each).
export const SHOT_BEATS = [0, 6, 11, 22, 33, 39, 44, 50, 55, 66];
export const SHOTS = SHOT_BEATS.map((b) => Math.round(b * BEAT));
// -> [0, 82, 150, 300, 450, 532, 600, 682, 750, 900]

export const beatFrame = (b: number) => Math.round(b * BEAT);

const indexAt = (marks: number[], frame: number) => {
  for (let i = marks.length - 2; i >= 0; i--) {
    if (frame >= marks[i]) return i;
  }
  return 0;
};
export const shotIndexAt = (frame: number) => indexAt(SHOTS, frame);
export const sectionIndexAt = (frame: number) => indexAt(SECTIONS, frame);
