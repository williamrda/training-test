import React from 'react';
import {Easing, interpolate, random, spring} from 'remotion';
import {B, beatPulse, P, V} from '../camera';
import {C, FONT_MONO, mix, rgba} from '../theme';
import {beatFrame, FPS, SHOTS} from '../timing';
import {Box, Plane} from './Box';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ramp = (f: number, a: number, b: number, ease = Easing.bezier(0.65, 0, 0.35, 1)) =>
  ease(clamp((f - a) / (b - a)));
const sp = (f: number, start: number, damping = 13, mass = 0.7) =>
  spring({frame: f - start, fps: FPS, config: {damping, mass, stiffness: 170}});

// ---------------------------------------------------------------- key moments
const ATTACK = beatFrame(1); // ransomware impact on production
const HUNT = SHOTS[1] + 6; // backups get hit
const VAULT_IN = SHOTS[2]; // vault assembles
const GAP = SHOTS[3]; // transfer window
const GAP_OPEN_END = GAP + 18;
const GAP_CLOSE = beatFrame(28.5); // window shuts ~3 s into the section
const LOCKS = [beatFrame(34), beatFrame(35.5), beatFrame(37)];
const KEY_IN = SHOTS[5];
const KEY_TURN = [beatFrame(40.5), beatFrame(41.5)];
const SCAN = [SHOTS[6] + 6, SHOTS[7] - 12];
const RECOVER = SHOTS[7];
const RESOLVE = SHOTS[8];

// ---------------------------------------------------------------- vault geometry
const VS = 440; // vault cube size
const DOOR_X = V.x - VS / 2 - 2; // -x face (towards the backups)

// Recovery wave travels from the vault back to production during shot 8.
const recoverAt = (f: number, x: number) => ramp(f, RECOVER + 10 + ((V.x - x) / V.x) * 30, RECOVER + 18 + ((V.x - x) / V.x) * 30);

// ---------------------------------------------------------------- floor + labels
const Floor: React.FC<{f: number}> = ({f}) => {
  const pulse = beatPulse(f);
  return (
    <Plane
      x={V.x / 2}
      y={1}
      w={9000}
      h={5200}
      transform="rotateX(90deg)"
      style={{
        background: `
          radial-gradient(ellipse at 50% 50%, ${rgba(C.cyan, 0.08 + pulse * 0.03)} 0%, rgba(0,0,0,0) 55%),
          repeating-linear-gradient(0deg, ${rgba(C.cyan, 0.1)} 0 2px, transparent 2px 120px),
          repeating-linear-gradient(90deg, ${rgba(C.cyan, 0.1)} 0 2px, transparent 2px 120px)`,
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, #000 30%, transparent 70%)',
        maskImage: 'radial-gradient(ellipse at 50% 50%, #000 30%, transparent 70%)',
      }}
    />
  );
};

const FloorLabel: React.FC<{x: number; z: number; text: string; color: string; o?: number}> = ({x, z, text, color, o = 1}) => (
  <Plane x={x} y={-1} z={z} w={900} h={80} transform="rotateX(90deg)" style={{opacity: o * 0.6}}>
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 40,
        letterSpacing: '0.42em',
        color,
        textAlign: 'center',
        lineHeight: '80px',
        fontWeight: 600,
        textShadow: `0 0 18px ${rgba(color.startsWith('#') ? color : C.cyan, 0.6)}`,
      }}
    >
      {text}
    </div>
  </Plane>
);

// ---------------------------------------------------------------- production (shot 1 + 8)
const Production: React.FC<{f: number}> = ({f}) => {
  const towers = [];
  for (let gx = 0; gx < 5; gx++) {
    for (let gz = 0; gz < 3; gz++) {
      const x = P.x + (gx - 2) * 150;
      const z = P.z + (gz - 1) * 150;
      const h = 170 + random(`t${gx}${gz}`) * 150;
      const dist = Math.hypot(gx - 2, gz - 1);
      const infect = ramp(f, ATTACK + dist * 5, ATTACK + dist * 5 + 6, Easing.out(Easing.cubic));
      const rec = recoverAt(f, x);
      const state = infect * (1 - rec);
      const body = mix(mix(C.steel, '#3a0d18', state), '#0f3a33', rec * 0.6);
      const glow = rec > 0.5 ? C.teal : state > 0.4 ? C.red : C.cyan;
      const jitter = state > 0.1 && f < SHOTS[2] ? Math.sin(f * 7 + gx * 3) * 4 * (1 - rec) : 0;
      const lights = (
        <div style={{position: 'absolute', inset: 10, display: 'flex', flexDirection: 'column', gap: 9}}>
          {Array.from({length: Math.floor(h / 26)}).map((_, i) => {
            const on = random(`l${gx}${gz}${i}${Math.floor(f / 3)}`) > 0.35;
            const col = rec > 0.5 ? C.teal : state > 0.4 ? C.red : C.cyan;
            return <div key={i} style={{height: 4, width: on ? '70%' : '35%', background: rgba(col, on ? 0.95 : 0.35), boxShadow: `0 0 8px ${col}`}} />;
          })}
        </div>
      );
      towers.push(
        <Box key={`${gx}${gz}`} x={x + jitter} z={z} w={84} h={h} d={84} color={body} glow={glow} glowAmt={0.25 + state * 0.6 + rec * 0.5} front={lights} left={lights} />,
      );
    }
  }
  // ransomware shock ring on impact
  const ring = ramp(f, ATTACK, ATTACK + 22, Easing.out(Easing.quad));
  return (
    <>
      {towers}
      <Plane
        x={P.x}
        y={-2}
        z={P.z}
        w={1400}
        h={1400}
        transform={`rotateX(90deg) scale(${0.1 + ring})`}
        style={{borderRadius: '50%', border: `6px solid ${rgba(C.red, (1 - ring) * 0.9)}`, boxShadow: `0 0 60px ${rgba(C.red, (1 - ring) * 0.8)}`}}
      />
      <FloorLabel x={P.x} z={P.z + 330} text="PRODUCTION" color={recoverAt(f, P.x) > 0.5 ? C.teal : f > ATTACK ? C.red : C.cyan} />
    </>
  );
};

// ---------------------------------------------------------------- backups (shot 2)
const Backups: React.FC<{f: number}> = ({f}) => {
  const blocks = [];
  for (let gx = 0; gx < 4; gx++) {
    for (let gz = 0; gz < 3; gz++) {
      for (let gy = 0; gy < 2; gy++) {
        const x = B.x + (gx - 1.5) * 118;
        const z = B.z + (gz - 1) * 118;
        const order = gx * 0.9 + random(`b${gx}${gz}${gy}`) * 3;
        const hit = ramp(f, HUNT + order * 3, HUNT + order * 3 + 5, Easing.out(Easing.cubic));
        const rec = recoverAt(f, x);
        const state = hit * (1 - rec);
        const pop = hit > 0 && hit < 1 ? Math.sin(hit * Math.PI) * 18 : 0;
        const crack = state > 0.2 ? (
          <div style={{position: 'absolute', inset: 0, background: `linear-gradient(${120 + gx * 40}deg, transparent 45%, ${rgba(C.red, 0.9)} 48%, transparent 51%)`}} />
        ) : null;
        blocks.push(
          <Box
            key={`${gx}${gz}${gy}`}
            x={x}
            y={-gy * 112 - pop * (gy + 1) * 0.5}
            z={z}
            w={100}
            h={100}
            d={100}
            color={mix(mix(C.steelHi, '#40101b', state), '#0f3a33', rec * 0.6)}
            glow={rec > 0.5 ? C.teal : state > 0.3 ? C.red : C.cyan}
            glowAmt={0.3 + state * 0.6 + rec * 0.4}
            front={crack}
            top={crack}
          />,
        );
      }
    }
  }
  return (
    <>
      {blocks}
      <FloorLabel x={B.x} z={B.z + 300} text="BACKUPS" color={recoverAt(f, B.x) > 0.5 ? C.teal : f > HUNT ? C.red : C.cyan} />
    </>
  );
};

// ---------------------------------------------------------------- the FortKnox vault
const VaultShell: React.FC<{f: number}> = ({f}) => {
  const half = VS / 2;
  const pulse = beatPulse(f);
  const faces: {t: string; w: number; h: number; light: number; dir: [number, number, number]; rot: string}[] = [
    {t: `translateZ(${half}px)`, w: VS, h: VS, light: 0.95, dir: [0, 0, 1], rot: 'rotateY(40deg)'},
    {t: `rotateY(180deg) translateZ(${half}px)`, w: VS, h: VS, light: 0.55, dir: [0, 0, -1], rot: 'rotateY(-40deg)'},
    {t: `rotateY(90deg) translateZ(${half}px)`, w: VS, h: VS, light: 0.7, dir: [1, 0, 0], rot: 'rotateX(40deg)'},
    {t: `rotateY(-90deg) translateZ(${half}px)`, w: VS, h: VS, light: 0.82, dir: [-1, 0, 0], rot: 'rotateX(-40deg)'},
    {t: `rotateX(90deg) translateZ(${half}px)`, w: VS, h: VS, light: 1.35, dir: [0, -1, 0], rot: 'rotateZ(50deg)'},
  ];
  return (
    <div style={{position: 'absolute', transformStyle: 'preserve-3d', transform: `translate3d(${V.x}px, ${-half}px, ${V.z}px)`}}>
      {faces.map((fc, i) => {
        const s = sp(f, VAULT_IN + i * 3, 15, 0.9);
        const off = (1 - s) * 900;
        const [dx, dy, dz] = fc.dir;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: -fc.w / 2,
              top: -fc.h / 2,
              width: fc.w,
              height: fc.h,
              opacity: f < VAULT_IN ? 0 : clamp(s * 3),
              transform: `translate3d(${dx * off}px, ${dy * off}px, ${dz * off}px) ${fc.t} ${s < 0.999 ? fc.rot.replace(/(-?\d+)deg/, (_, n) => `${Number(n) * (1 - s)}deg`) : ''}`,
              background: `linear-gradient(160deg, ${mix(C.steelHi, '#ffffff', 0.05 * fc.light)} 0%, ${mix(C.steel, '#000000', 0.35 / fc.light)} 100%)`,
              border: `2px solid ${rgba(C.teal, 0.5 + pulse * 0.25)}`,
              boxShadow: `inset 0 0 70px ${rgba(C.teal, 0.18 + pulse * 0.1)}, 0 0 40px ${rgba(C.teal, 0.15)}`,
              backfaceVisibility: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            {/* panel seams */}
            <div style={{position: 'absolute', inset: 26, border: `1px solid ${rgba(C.teal, 0.25)}`}} />
            <div style={{position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: rgba(C.teal, 0.2)}} />
            <div style={{position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: rgba(C.teal, 0.2)}} />
          </div>
        );
      })}
    </div>
  );
};

// Door + locks + keys live on the -x face.
const Door: React.FC<{f: number}> = ({f}) => {
  const visible = f >= VAULT_IN + 6;
  const s = sp(f, VAULT_IN + 14, 12, 0.8);
  const open = ramp(f, RECOVER, RECOVER + 12, Easing.bezier(0.7, 0, 0.2, 1));
  const pulse = beatPulse(f);
  const R = 150;
  return (
    <div
      style={{
        position: 'absolute',
        transformStyle: 'preserve-3d',
        transform: `translate3d(${DOOR_X}px, ${-VS / 2}px, ${V.z}px) rotateY(-90deg)`,
        opacity: visible ? 1 : 0,
      }}
    >
      {/* inner core glow (seen when the door swings open) */}
      <div
        style={{
          position: 'absolute', left: -R, top: -R, width: R * 2, height: R * 2, borderRadius: '50%',
          transform: 'translateZ(1px)',
          background: `radial-gradient(circle, ${rgba('#ffffff', 0.95)} 0%, ${rgba(C.teal, 0.9)} 35%, ${rgba(C.teal, 0.1)} 72%)`,
          opacity: open,
        }}
      />
      {/* the door disc, hinged on its left edge */}
      <div
        style={{
          position: 'absolute', left: -R, top: -R, width: R * 2, height: R * 2,
          transformOrigin: '0% 50%',
          transform: `translateZ(4px) rotateY(${-open * 105}deg) scale(${s})`,
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: `radial-gradient(circle at 40% 35%, ${C.steelHi} 0%, ${C.steel} 60%, #0a1020 100%)`,
            border: `5px solid ${rgba(C.teal, 0.75 + pulse * 0.25)}`,
            boxShadow: `0 0 50px ${rgba(C.teal, 0.4)}, inset 0 0 40px ${rgba('#000000', 0.7)}`,
          }}
        />
        {Array.from({length: 12}).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: R - 7, top: 12, width: 14, height: 14, borderRadius: '50%',
              transformOrigin: `7px ${R - 12}px`, transform: `rotate(${i * 30}deg)`,
              background: C.teal, boxShadow: `0 0 10px ${C.teal}`,
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute', left: 0, right: 0, top: R - 10, textAlign: 'center',
            fontFamily: FONT_MONO, fontSize: 18, letterSpacing: '0.4em', color: rgba(C.teal, 0.9), transform: 'translateY(-70px)',
          }}
        >
          FORTKNOX
        </div>
      </div>
      <Locks f={f} R={R} />
      <Keys f={f} />
    </div>
  );
};

// Shot 5 — three rings slam on, on the beat; hex stream = encryption; padlock = WORM
const Locks: React.FC<{f: number; R: number}> = ({f, R}) => {
  const fade = 1 - ramp(f, RECOVER - 4, RECOVER + 4);
  if (f < LOCKS[0] - 6) return null;
  const rings = [R + 60, R + 28, R - 10];
  return (
    <div style={{position: 'absolute', transformStyle: 'preserve-3d', opacity: fade}}>
      {rings.map((r, i) => {
        const t = ramp(f, LOCKS[i] - 6, LOCKS[i], Easing.in(Easing.cubic));
        const flash = f >= LOCKS[i] ? Math.exp(-(f - LOCKS[i]) / 4) : 0;
        const col = i === 0 ? C.cyan : i === 1 ? C.teal : C.amber;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: -r, top: -r, width: r * 2, height: r * 2, borderRadius: '50%',
              transform: `translateZ(${12 + i * 10 + (1 - t) * 500}px) scale(${1 + (1 - t) * 0.8}) rotate(${(1 - t) * 90}deg)`,
              border: `${10 - i * 2}px ${i === 1 ? 'dashed' : 'solid'} ${rgba(col, t)}`,
              boxShadow: `0 0 ${30 + flash * 80}px ${rgba(col, 0.5 + flash * 0.5)}`,
              opacity: t,
            }}
          />
        );
      })}
      {/* encryption hex stream across the face */}
      {f >= LOCKS[1] && f < KEY_IN + 6 && (
        <div
          style={{
            position: 'absolute', left: -VS / 2 + 10, top: -VS / 2 + 10, width: VS - 20, height: VS - 20,
            transform: 'translateZ(2px)', overflow: 'hidden', fontFamily: FONT_MONO, fontSize: 15, lineHeight: '20px',
            color: rgba(C.teal, 0.35 * clamp((f - LOCKS[1]) / 5) * (1 - clamp((f - KEY_IN) / 6))), wordBreak: 'break-all',
            WebkitMaskImage: 'radial-gradient(circle, transparent 35%, #000 36%)',
            maskImage: 'radial-gradient(circle, transparent 35%, #000 36%)',
          }}
        >
          {Array.from({length: 420}).map((_, i) => '0123456789ABCDEF'[Math.floor(random(`h${i}${Math.floor(f / 2)}`) * 16)]).join('')}
        </div>
      )}
      {/* WORM padlock */}
      {f >= LOCKS[2] - 6 && f < KEY_IN + 8 && (() => {
        const s = sp(f, LOCKS[2] - 4, 10, 0.6) * (1 - ramp(f, KEY_IN, KEY_IN + 8, Easing.in(Easing.back(2))));
        return (
          <div style={{position: 'absolute', transformStyle: 'preserve-3d', transform: `translateZ(${60 + (1 - s) * 300}px) scale(${s})`}}>
            <div style={{position: 'absolute', left: -34, top: -86, width: 68, height: 70, borderRadius: '34px 34px 0 0', border: `12px solid ${C.amber}`, borderBottom: 'none', boxShadow: `0 0 20px ${rgba(C.amber, 0.7)}`}} />
            <Box y={70} w={120} h={96} d={34} color="#3a2a10" glow={C.amber} glowAmt={0.9}
              front={<div style={{position: 'absolute', left: '50%', top: '38%', width: 16, height: 30, marginLeft: -8, borderRadius: 8, background: C.amber}} />} />
          </div>
        );
      })()}
    </div>
  );
};

// Shot 6 — two keys slide in and turn together (quorum)
const Key: React.FC<{f: number; side: -1 | 1; turnAt: number}> = ({f, side, turnAt}) => {
  const inT = sp(f, KEY_IN + (side === 1 ? 3 : 0), 14, 0.8);
  const turn = ramp(f, turnAt, turnAt + 7, Easing.bezier(0.5, 0, 0.1, 1.4));
  const ok = f >= turnAt + 4;
  const col = ok ? C.teal : C.cyan;
  const fade = 1 - ramp(f, RECOVER - 4, RECOVER + 2);
  return (
    <div
      style={{
        position: 'absolute', transformStyle: 'preserve-3d', opacity: fade,
        transform: `translate3d(${side * 95}px, 0px, ${40 + (1 - inT) * 420}px) scale(1.3) rotateZ(${turn * 90}deg)`,
      }}
    >
      {/* keyhole plate */}
      <div style={{position: 'absolute', left: -30, top: -30, width: 60, height: 60, borderRadius: 14, transform: `translateZ(${-36}px) rotateZ(${-turn * 90}deg)`, background: '#050a14', border: `3px solid ${rgba(col, 0.9)}`, boxShadow: `0 0 ${ok ? 40 : 10}px ${col}`}} />
      {/* shaft (points into the door) */}
      <div style={{position: 'absolute', left: -7, top: -7, width: 14, height: 14, transformStyle: 'preserve-3d', transform: 'translateZ(40px)'}}>
        <div style={{position: 'absolute', left: 0, top: 7, width: 14, height: 80, transformOrigin: '50% 0%', transform: 'rotateX(-90deg)', background: `linear-gradient(${C.white}, #8aa0c8)`}} />
        <div style={{position: 'absolute', left: 7, top: 0, width: 80, height: 14, transformOrigin: '0% 50%', transform: 'rotateY(90deg)', background: `linear-gradient(90deg, ${C.white}, #6c80a8)`}} />
      </div>
      {/* bow */}
      <div style={{position: 'absolute', left: -34, top: -34, width: 68, height: 68, borderRadius: '50%', border: `12px solid ${col}`, transform: 'translateZ(40px)', boxShadow: `0 0 ${ok ? 30 : 12}px ${rgba(col, 0.7)}`, boxSizing: 'border-box'}} />
    </div>
  );
};

const Keys: React.FC<{f: number}> = ({f}) => {
  if (f < KEY_IN - 2 || f > RECOVER + 3) return null;
  return (
    <div style={{position: 'absolute', transformStyle: 'preserve-3d', transform: 'translateY(0px)'}}>
      <Key f={f} side={-1} turnAt={KEY_TURN[0]} />
      <Key f={f} side={1} turnAt={KEY_TURN[1]} />
    </div>
  );
};

// ---------------------------------------------------------------- air gap bridge (shot 4)
const BRIDGE_A = B.x + 330;
const BRIDGE_B = DOOR_X - 20;
const SEGS = 10;

const AirGap: React.FC<{f: number}> = ({f}) => {
  const segW = (BRIDGE_B - BRIDGE_A) / SEGS;
  const windowOpen = f >= GAP && f < GAP_CLOSE;
  const segs = [];
  for (let i = 0; i < SEGS; i++) {
    // extend from both ends towards the middle, retract back out
    const fromEnd = Math.min(i, SEGS - 1 - i);
    const ext = ramp(f, GAP + 2 + fromEnd * 1.6, GAP + 7 + fromEnd * 1.6, Easing.out(Easing.back(1.6)));
    const ret = ramp(f, GAP_CLOSE + (4 - fromEnd) * 1.4, GAP_CLOSE + 5 + (4 - fromEnd) * 1.4, Easing.in(Easing.cubic));
    const k = ext * (1 - ret);
    if (k <= 0.001) continue;
    const x = BRIDGE_A + segW * (i + 0.5);
    segs.push(
      <Box key={i} x={x} y={-8} z={V.z} w={segW - 8} h={14} d={110} scale={k} color="#10304a" glow={windowOpen ? C.amber : C.teal} glowAmt={0.8} opacity={clamp(k * 2)} />,
    );
  }
  // data packets crossing while the window is open
  const packets = [];
  for (let i = 0; i < 26; i++) {
    const t0 = GAP_OPEN_END - 2 + i * 3;
    if (t0 + 22 > GAP_CLOSE + 4) break;
    const t = clamp((f - t0) / 22);
    if (t <= 0 || t >= 1) continue;
    const x = BRIDGE_A + (BRIDGE_B - BRIDGE_A) * Easing.inOut(Easing.cubic)(t);
    packets.push(<Box key={i} x={x} y={-40 - Math.sin(t * Math.PI) * 20} z={V.z + (i % 3 - 1) * 30} w={34} h={34} d={34} color="#0f4a3c" glow={C.teal} glowAmt={1} rotY={t * 180} />);
  }
  // pylons that mark the transfer window
  const pylon = (x: number) => (
    <Box x={x} z={V.z - 90} w={26} h={200} d={26} color={C.steel} glow={windowOpen ? C.amber : C.teal} glowAmt={windowOpen ? 1 : 0.5} />
  );
  const gapShow = ramp(f, GAP_CLOSE + 8, GAP_CLOSE + 16) * (1 - ramp(f, RECOVER, RECOVER + 6));
  return (
    <>
      {segs}
      {packets}
      {f >= GAP - 30 && pylon(BRIDGE_A - 10)}
      {f >= GAP - 30 && pylon(BRIDGE_B + 10)}
      {f >= GAP - 30 && (
        <>
          <Box x={BRIDGE_A - 10} z={V.z + 90} w={26} h={200} d={26} color={C.steel} glow={windowOpen ? C.amber : C.teal} glowAmt={windowOpen ? 1 : 0.5} />
          <Box x={BRIDGE_B + 10} z={V.z + 90} w={26} h={200} d={26} color={C.steel} glow={windowOpen ? C.amber : C.teal} glowAmt={windowOpen ? 1 : 0.5} />
        </>
      )}
      {/* the gap itself: a shimmering "no connection" field */}
      <Plane
        x={(BRIDGE_A + BRIDGE_B) / 2}
        y={-100}
        z={V.z}
        w={BRIDGE_B - BRIDGE_A - 80}
        h={200}
        style={{
          opacity: gapShow * 0.9,
          background: `repeating-linear-gradient(90deg, ${rgba(C.teal, 0.0)} 0 22px, ${rgba(C.teal, 0.22)} 22px 24px)`,
          borderLeft: `3px solid ${C.teal}`,
          borderRight: `3px solid ${C.teal}`,
          boxShadow: `0 0 40px ${rgba(C.teal, 0.3)}`,
        }}
      />
    </>
  );
};

// ---------------------------------------------------------------- scan (shot 7)
const Scan: React.FC<{f: number}> = ({f}) => {
  if (f < SCAN[0] - 6 || f > RECOVER + 10) return null;
  const appear = ramp(f, SCAN[0] - 6, SCAN[0] + 4, Easing.out(Easing.cubic));
  const fade = 1 - ramp(f, RECOVER, RECOVER + 8);
  const sweep = ramp(f, SCAN[0], SCAN[1], Easing.inOut(Easing.sin));
  const N = 6;
  const step = 62;
  const top = -VS - 4;
  const sweepX = V.x - (N * step) / 2 + sweep * N * step;
  const tiles = [];
  for (let gx = 0; gx < N; gx++) {
    for (let gz = 0; gz < N; gz++) {
      const x = V.x + (gx - (N - 1) / 2) * step;
      const z = V.z + (gz - (N - 1) / 2) * step;
      const scanned = x < sweepX;
      const lift = appear * (18 + random(`s${gx}${gz}`) * 26);
      tiles.push(
        <Box key={`${gx}${gz}`} x={x} y={top - lift} z={z} w={48} h={16} d={48} color={scanned ? '#0f4a3c' : C.steelHi} glow={scanned ? C.teal : C.cyan} glowAmt={scanned ? 1 : 0.35} opacity={appear * fade} />,
      );
    }
  }
  return (
    <>
      {tiles}
      <Plane
        x={sweepX}
        y={top - 60}
        z={V.z}
        w={N * step + 60}
        h={170}
        transform="rotateY(90deg)"
        style={{
          opacity: appear * fade * (sweep < 1 ? 1 : 0.2),
          background: `linear-gradient(180deg, ${rgba(C.teal, 0)} 0%, ${rgba(C.teal, 0.55)} 100%)`,
          borderBottom: `4px solid ${C.teal}`,
          boxShadow: `0 0 60px ${rgba(C.teal, 0.7)}`,
        }}
      />
    </>
  );
};

// ---------------------------------------------------------------- recovery arc (shot 8)
const Recover: React.FC<{f: number}> = ({f}) => {
  if (f < RECOVER + 4) return null;
  const packets = [];
  const x0 = DOOR_X - 30;
  const x1 = P.x + 120;
  for (let i = 0; i < 22; i++) {
    const t0 = RECOVER + 6 + i * 1.5;
    const t = clamp((f - t0) / 24);
    if (t <= 0 || t >= 1) continue;
    const e = Easing.inOut(Easing.cubic)(t);
    const x = x0 + (x1 - x0) * e;
    const y = -VS / 2 - Math.sin(e * Math.PI) * 520;
    const z = V.z + Math.sin(e * Math.PI) * ((i % 5) - 2) * 70;
    packets.push(<Box key={i} x={x} y={y} z={z} w={56} h={56} d={56} color="#0f4a3c" glow={C.teal} glowAmt={1} rotY={e * 270} />);
  }
  return <>{packets}</>;
};

// ---------------------------------------------------------------- resolve halo (shot 9)
const Halo: React.FC<{f: number}> = ({f}) => {
  if (f < RESOLVE - 2) return null;
  const s = sp(f, RESOLVE, 16, 1);
  const pulse = beatPulse(f);
  return (
    <Plane x={V.x} y={-2} z={V.z} w={1100} h={1100} transform={`rotateX(90deg) scale(${0.3 + s * 0.7})`}
      style={{borderRadius: '50%', border: `3px solid ${rgba(C.teal, 0.8)}`, boxShadow: `0 0 ${50 + pulse * 40}px ${rgba(C.teal, 0.5)}, inset 0 0 80px ${rgba(C.teal, 0.25)}`}} />
  );
};

// ---------------------------------------------------------------- floating dust (billboarded)
const Dust: React.FC<{f: number; yaw: number; pitch: number}> = ({f, yaw, pitch}) => (
  <>
    {Array.from({length: 70}).map((_, i) => {
      const x = -900 + random(`dx${i}`) * 5200;
      const y = -60 - random(`dy${i}`) * 900 - Math.sin(f / 30 + i) * 20;
      const z = -1400 + random(`dz${i}`) * 2800;
      const s = 3 + random(`ds${i}`) * 5;
      return (
        <div key={i} style={{position: 'absolute', left: -s / 2, top: -s / 2, width: s, height: s, borderRadius: '50%',
          transform: `translate3d(${x}px, ${y}px, ${z}px) rotateY(${-yaw}deg) rotateX(${-pitch}deg)`,
          background: i % 3 === 0 ? C.teal : C.cyan, opacity: 0.35 + random(`do${i}`) * 0.4, boxShadow: `0 0 ${s * 2}px ${C.cyan}`}} />
      );
    })}
  </>
);

export const World: React.FC<{f: number; yaw: number; pitch: number}> = ({f, yaw, pitch}) => (
  <>
    <Floor f={f} />
    <Dust f={f} yaw={yaw} pitch={pitch} />
    <Production f={f} />
    <Backups f={f} />
    <AirGap f={f} />
    <VaultShell f={f} />
    <Door f={f} />
    <Scan f={f} />
    <Recover f={f} />
    <Halo f={f} />
    <FloorLabel x={V.x} z={V.z + 380} text="FORTKNOX VAULT" color={C.teal} o={f >= VAULT_IN + 10 ? 1 : 0} />
  </>
);

export const MOMENTS = {ATTACK, HUNT, VAULT_IN, GAP, GAP_CLOSE, LOCKS, KEY_IN, KEY_TURN, SCAN, RECOVER, RESOLVE};
