import {Easing} from 'remotion';
import {BEAT, SHOTS} from './timing';

export type Cam = {x: number; y: number; z: number; yaw: number; pitch: number; dist: number; roll: number};

const cam = (x: number, y: number, z: number, yaw: number, pitch: number, dist: number, roll = 0): Cam => ({
  x, y, z, yaw, pitch, dist, roll,
});

// World stations (CSS px, y is down, floor at y = 0)
export const P = {x: 0, z: 0}; // production
export const B = {x: 1500, z: 0}; // backups
export const V = {x: 3300, z: 0}; // FortKnox vault

// Opening pose, then per shot: where the move lands (`from`) and where the slow drift ends (`to`).
const OPEN = cam(-120, -420, 0, -62, -26, 1900, -6);
const KEYS: {from: Cam; to: Cam}[] = [
  // 1 production under attack — low hero push
  {from: cam(0, -140, 0, -30, -14, 1100, 0), to: cam(60, -130, 0, -12, -10, 820, 2)},
  // 2 whip right to the backups
  {from: cam(B.x, -120, 0, 22, -20, 950, -3), to: cam(B.x + 60, -110, 0, 38, -15, 760, 0)},
  // 3 FortKnox reveal — rise up to the vault, slow orbit while it assembles
  {from: cam(V.x, -300, 0, -44, -12, 1550, 0), to: cam(V.x, -280, 0, -14, -7, 1200, 0)},
  // 4 air gap — travel along the bridge as the window opens and shuts
  {from: cam((B.x + V.x) / 2 + 150, -120, -120, 48, -22, 1350, 0), to: cam((B.x + V.x) / 2 + 380, -130, -120, 70, -16, 1150, 0)},
  // 5 immutable / encrypted / locked — on the door
  {from: cam(V.x - 260, -230, -230, 86, -6, 1020, 0), to: cam(V.x - 260, -230, -230, 72, -4, 880, 0)},
  // 6 quorum — two keys, low angle
  {from: cam(V.x - 320, -200, -220, 60, 2, 940, 2), to: cam(V.x - 320, -210, -220, 74, 0, 820, 0)},
  // 7 scan — high top-down orbit
  {from: cam(V.x, -300, 0, 12, -58, 1180, 0), to: cam(V.x, -300, 0, 42, -62, 1050, 0)},
  // 8 recover — wide tracking arc back to production
  {from: cam(V.x / 2 + 150, -420, 0, -2, -26, 2350, 0), to: cam(V.x / 2 - 250, -420, 0, -12, -23, 2150, 0)},
  // 9 resolve — full world, slow orbit
  {from: cam(V.x / 2, -520, 0, -8, -34, 3050, 0), to: cam(V.x / 2, -500, 0, 8, -28, 2700, 0)},
];

const TRANSITION = 17; // frames; fast whip with hard accel/decel
const OPEN_TRANSITION = 30;
const whip = Easing.bezier(0.8, 0, 0.16, 1);
const drift = Easing.bezier(0.4, 0, 0.6, 1);

const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
  yaw: a.yaw + (b.yaw - a.yaw) * t,
  pitch: a.pitch + (b.pitch - a.pitch) * t,
  dist: a.dist + (b.dist - a.dist) * t,
  roll: a.roll + (b.roll - a.roll) * t,
});

const shotPose = (i: number, frame: number) => {
  const s = SHOTS[i];
  const e = SHOTS[i + 1];
  const p = Math.max(0, Math.min(1, (frame - s) / (e - s)));
  return lerpCam(KEYS[i].from, KEYS[i].to, drift(p));
};

export const cameraAt = (frame: number): Cam => {
  let i = 0;
  for (let k = SHOTS.length - 2; k >= 0; k--) {
    if (frame >= SHOTS[k]) {
      i = k;
      break;
    }
  }
  const s = SHOTS[i];
  const dur = i === 0 ? OPEN_TRANSITION : TRANSITION;
  const prev = i === 0 ? OPEN : shotPose(i - 1, s);
  const t = Math.max(0, Math.min(1, (frame - s) / dur));
  const pose = shotPose(i, frame);
  // Dip the camera back on the whip so every move has a little arc/overshoot of scale.
  const arc = i === 0 ? 0 : Math.sin(Math.PI * t) * 160;
  const c = lerpCam(prev, pose, whip(t));
  return {...c, dist: c.dist + arc};
};

// 0..1 intensity of the current whip (used for motion streaks + blur)
export const whipAmount = (frame: number) => {
  for (let k = SHOTS.length - 2; k >= 1; k--) {
    const s = SHOTS[k];
    if (frame >= s && frame < s + TRANSITION) {
      const t = (frame - s) / TRANSITION;
      return Math.sin(Math.PI * t) ** 2;
    }
  }
  return 0;
};

// Tiny beat-synced shake on impacts
export const shakeAt = (frame: number, impacts: number[]) => {
  let amp = 0;
  for (const f of impacts) {
    const d = frame - f;
    if (d >= 0 && d < 12) amp = Math.max(amp, Math.exp(-d / 3.2));
  }
  return {x: Math.sin(frame * 2.7) * 9 * amp, y: Math.cos(frame * 3.3) * 7 * amp};
};

export const beatPulse = (frame: number) => {
  const ph = (frame % BEAT) / BEAT;
  return Math.exp(-ph * 5);
};
