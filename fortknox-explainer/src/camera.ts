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
  {from: cam(0, -140, 0, -28, -14, 1050, 0), to: cam(40, -130, 0, -18, -11, 860, 2)},
  // 2 whip right to the backups
  {from: cam(B.x, -120, 0, 24, -20, 900, -3), to: cam(B.x + 40, -110, 0, 32, -17, 780, 0)},
  // 3 FortKnox reveal — rise up to the vault
  {from: cam(V.x, -300, 0, -36, -12, 1500, 0), to: cam(V.x, -300, 0, -24, -9, 1260, 0)},
  // 4 air gap — side-on along the bridge
  {from: cam((B.x + V.x) / 2 + 250, -120, -120, 58, -20, 1250, 0), to: cam((B.x + V.x) / 2 + 330, -120, -120, 66, -18, 1150, 0)},
  // 5 immutable / encrypted / locked — tight on the door
  {from: cam(V.x - 260, -230, -230, 82, -6, 980, 0), to: cam(V.x - 260, -230, -230, 76, -5, 900, 0)},
  // 6 quorum — two keys, low angle
  {from: cam(V.x - 320, -200, -220, 62, 2, 920, 2), to: cam(V.x - 320, -210, -220, 70, 0, 840, 0)},
  // 7 scan — high top-down orbit
  {from: cam(V.x, -300, 0, 20, -58, 1150, 0), to: cam(V.x, -300, 0, 36, -60, 1080, 0)},
  // 8 recover — wide tracking arc back to production
  {from: cam(V.x / 2, -420, 0, -4, -26, 2350, 0), to: cam(V.x / 2 - 150, -420, 0, -10, -24, 2150, 0)},
  // 9 resolve — full world, calm
  {from: cam(V.x / 2, -520, 0, 0, -34, 3000, 0), to: cam(V.x / 2, -520, 0, 0, -30, 2800, 0)},
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
