import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {beatPulse} from '../camera';
import {C, FONT_DISPLAY, FONT_MONO, rgba} from '../theme';
import {SHOTS, shotIndexAt} from '../timing';
import {MOMENTS} from '../world/World';
import {Kinetic, Wipe} from './Kinetic';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const EXIT = 6; // frames a block overlaps into the next whip

const big: React.CSSProperties = {fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 150, lineHeight: 0.9, letterSpacing: '-0.045em', color: C.white};
const tag: React.CSSProperties = {fontFamily: FONT_MONO, fontWeight: 600, fontSize: 22, letterSpacing: '0.34em', textTransform: 'uppercase'};
const sub: React.CSSProperties = {fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 40, letterSpacing: '-0.01em', color: C.dim};

const Block: React.FC<{i: number; left?: number; bottom?: number; children: React.ReactNode; align?: 'left' | 'center'}> = ({i, left = 130, bottom = 150, children, align = 'left'}) => {
  const frame = useCurrentFrame();
  const s = SHOTS[i];
  const e = i === 8 ? SHOTS[9] : SHOTS[i + 1] + EXIT;
  if (frame < s || frame >= e) return null;
  // slow push on the type while it holds
  const k = interpolate(frame, [s, e], [1.035, 1], {easing: Easing.out(Easing.quad)});
  return (
    <div
      style={{
        position: 'absolute',
        ...(align === 'center' ? {left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center'} : {left, bottom}),
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        transform: `scale(${k})`,
        transformOrigin: align === 'center' ? '50% 50%' : '0% 100%',
      }}
    >
      {children}
    </div>
  );
};

const Tag: React.FC<{text: string; in: number; out?: number; color: string; dot?: boolean}> = ({text, in: inF, out, color, dot}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
      {dot && <div style={{width: 14, height: 14, borderRadius: 7, background: color, boxShadow: `0 0 16px ${color}`, opacity: frame < inF ? 0 : Math.floor(frame / 4) % 2 ? 1 : 0.3}} />}
      <Kinetic text={text} in={inF} out={out} stagger={0.5} mode="type" style={{...tag, color}} />
    </div>
  );
};

const Counter: React.FC<{from: number; to: number; a: number; b: number; suffix?: string; style?: React.CSSProperties}> = ({from, to, a, b, suffix = '', style}) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [a, b], [from, to], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin)});
  return <span style={style}>{Math.round(v)}{suffix}</span>;
};

export const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const S = SHOTS;
  const out = (i: number) => S[i + 1] - 5;
  const {ATTACK, GAP_CLOSE, LOCKS, KEY_TURN, SCAN} = MOMENTS;

  // RGB-split glitch on the ransomware hit
  const g = frame >= ATTACK && frame < ATTACK + 14 ? Math.exp(-(frame - ATTACK) / 4) : 0;
  const glitch = g > 0 ? `${-8 * g}px 0 ${rgba(C.cyan, 0.9)}, ${8 * g}px 0 ${rgba(C.red, 0.9)}` : 'none';

  const windowOpen = frame < GAP_CLOSE;
  const approvals = (frame >= KEY_TURN[0] + 3 ? 1 : 0) + (frame >= KEY_TURN[1] + 3 ? 1 : 0);
  const pulse = beatPulse(frame);
  const idx = shotIndexAt(frame);

  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* 1 — threat */}
      <Block i={0}>
        <Tag text="threat detected" in={6} out={out(0)} color={C.red} dot />
        <Kinetic text="RANSOMWARE" in={ATTACK - 2} out={out(0)} stagger={0.9} mode="slam" style={{...big, color: C.red, textShadow: glitch, transform: `translateX(${Math.sin(frame * 9) * 10 * g}px)`}} />
        <Kinetic text="hits production." in={ATTACK + 10} out={out(0)} stagger={0.6} style={sub} />
      </Block>

      {/* 2 — backups hunted */}
      <Block i={1}>
        <Kinetic text="then it hunts" in={S[1] + 5} out={out(1)} stagger={0.7} style={{...sub, fontSize: 56, color: C.white}} />
        <Kinetic text="YOUR BACKUPS" in={S[1] + 9} out={out(1)} stagger={0.9} style={big} charStyle={(i) => (i >= 5 ? {color: C.red} : {})} />
        <Wipe in={S[1] + 15} out={out(1)} style={{height: 8, width: 860, background: C.red, boxShadow: `0 0 24px ${C.red}`}} />
      </Block>

      {/* 3 — FortKnox */}
      <Block i={2}>
        <Tag text="cyber vaulting" in={S[2] + 7} out={out(2)} color={C.teal} />
        <Kinetic text="Cohesity" in={S[2] + 7} out={out(2)} stagger={1} style={{...big, fontWeight: 500, fontSize: 120}} />
        <Kinetic
          text="FortKnox"
          in={S[2] + 12}
          out={out(2)}
          stagger={1.2}
          style={{...big, fontSize: 170, color: C.teal, textShadow: `0 0 ${30 + pulse * 30}px ${rgba(C.teal, 0.55)}`}}
        />
        <Kinetic text="an isolated, immutable copy of your backups" in={S[2] + 26} out={out(2)} stagger={0.35} style={{...sub, fontSize: 34}} />
      </Block>

      {/* 4 — virtual air gap */}
      <Block i={3}>
        <div style={{display: 'flex', alignItems: 'center', gap: 16, opacity: clamp((frame - S[3] - 6) / 4)}}>
          <span style={{...tag, color: C.dim}}>transfer window</span>
          <span
            style={{
              ...tag,
              letterSpacing: '0.2em',
              padding: '8px 16px',
              borderRadius: 6,
              color: C.bg,
              background: windowOpen ? C.amber : C.teal,
              boxShadow: `0 0 24px ${windowOpen ? C.amber : C.teal}`,
              transform: `scale(${frame >= GAP_CLOSE && frame < GAP_CLOSE + 6 ? 1.15 : 1})`,
            }}
          >
            {windowOpen ? '● open' : '● closed'}
          </span>
        </div>
        <Kinetic text="VIRTUAL" in={S[3] + 6} out={out(3)} stagger={1} style={big} />
        <Kinetic text="AIR GAP" in={S[3] + 10} out={out(3)} stagger={1} style={{...big, color: C.teal}} />
        <Kinetic text="disconnected outside the window" in={GAP_CLOSE + 2} out={out(3)} stagger={0.35} style={{...sub, fontSize: 34}} />
      </Block>

      {/* 5 — immutable / encrypted / WORM, one per beat */}
      <Block i={4}>
        <Kinetic text="IMMUTABLE" in={LOCKS[0] - 2} out={out(4)} stagger={0.5} mode="slam" style={{...big, fontSize: 120, opacity: frame >= LOCKS[1] ? 0.45 : 1}} />
        <Kinetic text="ENCRYPTED" in={LOCKS[1] - 2} out={out(4)} stagger={0.5} mode="slam" style={{...big, fontSize: 120, color: C.teal, opacity: frame >= LOCKS[2] ? 0.45 : 1}} />
        <Kinetic text="WORM-LOCKED" in={LOCKS[2] - 2} out={out(4)} stagger={0.5} mode="slam" style={{...big, fontSize: 120, color: C.amber}} />
      </Block>

      {/* 6 — quorum */}
      <Block i={5}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18, opacity: clamp((frame - S[5] - 6) / 4)}}>
          <span style={{...tag, color: C.dim}}>approvals</span>
          <span style={{...tag, fontSize: 30, color: approvals === 2 ? C.teal : C.white, letterSpacing: '0.1em'}}>{approvals} / 2</span>
          {[0, 1].map((k) => (
            <div key={k} style={{width: 46, height: 10, borderRadius: 5, background: k < approvals ? C.teal : rgba(C.white, 0.2), boxShadow: k < approvals ? `0 0 16px ${C.teal}` : 'none'}} />
          ))}
        </div>
        <Kinetic text="QUORUM" in={S[5] + 6} out={out(5)} stagger={1.2} style={{...big, fontSize: 180}} charStyle={() => (approvals === 2 ? {color: C.teal} : {})} />
        <Kinetic text="two people approve critical actions" in={S[5] + 14} out={out(5)} stagger={0.35} style={{...sub, fontSize: 34}} />
      </Block>

      {/* 7 — scanned clean */}
      <Block i={6}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18, opacity: clamp((frame - S[6] - 5) / 4)}}>
          <span style={{...tag, color: C.dim}}>threat scan</span>
          <Counter from={0} to={100} a={SCAN[0]} b={SCAN[1]} suffix="%" style={{...tag, fontSize: 30, color: C.teal, letterSpacing: '0.05em'}} />
        </div>
        <Kinetic text="SCANNED" in={S[6] + 5} out={out(6)} stagger={0.9} style={big} />
        <div style={{display: 'flex', alignItems: 'center', gap: 28}}>
          <Kinetic text="CLEAN" in={SCAN[1] - 12} out={out(6)} stagger={0.9} mode="slam" style={{...big, color: C.teal}} />
          <Kinetic text="✓" in={SCAN[1] - 4} out={out(6)} mode="slam" style={{...big, color: C.teal, fontSize: 120}} />
        </div>
      </Block>

      {/* 8 — recovered fast */}
      <Block i={7}>
        <Kinetic text="RECOVERED" in={S[7] + 5} out={out(7)} stagger={0.8} style={big} />
        <Kinetic text="FAST" in={S[7] + 10} out={out(7)} stagger={1.4} mode="slam" style={{...big, fontStyle: 'italic', color: C.teal, fontSize: 190}} />
        <Kinetic text="granular · original or alternate location" in={S[7] + 16} out={out(7)} stagger={0.3} style={{...sub, fontSize: 32}} />
      </Block>

      {/* 9 — end card */}
      <Block i={8} align="center">
        <Tag text="cyber vaulting & recovery" in={S[8] + 6} color={C.teal} />
        <div style={{display: 'flex', alignItems: 'baseline', gap: 36}}>
          <Kinetic text="Cohesity" in={S[8] + 3} stagger={1} style={{...big, fontWeight: 500, fontSize: 140}} />
          <Kinetic text="FortKnox" in={S[8] + 8} stagger={1.1} style={{...big, fontSize: 140, color: C.teal, textShadow: `0 0 ${30 + pulse * 30}px ${rgba(C.teal, 0.55)}`}} />
        </div>
        <Wipe in={S[8] + 16} style={{height: 3, width: 980, background: `linear-gradient(90deg, transparent, ${C.teal}, transparent)`}} dur={14} />
        <Kinetic text="Isolate.  Lock.  Recover." in={S[8] + 20} stagger={0.7} style={{...sub, fontSize: 54, color: C.white, fontWeight: 600}} />
        <Kinetic text="managed SaaS or self-managed on-prem" in={S[8] + 30} stagger={0.3} mode="type" style={{...tag, fontSize: 20, color: C.dim, marginTop: 12}} />
      </Block>

      {/* persistent chrome: frame corners, shot counter, beat ticks */}
      <Chrome idx={idx} pulse={pulse} />
    </div>
  );
};

const Chrome: React.FC<{idx: number; pulse: number}> = ({idx, pulse}) => {
  const frame = useCurrentFrame();
  const inA = Easing.out(Easing.cubic)(clamp((frame - 4) / 14));
  const corner = (pos: React.CSSProperties, rot: number) => (
    <div style={{position: 'absolute', width: 44, height: 44, borderTop: `3px solid ${rgba(C.white, 0.55)}`, borderLeft: `3px solid ${rgba(C.white, 0.55)}`, transform: `rotate(${rot}deg)`, ...pos}} />
  );
  const m = 56 - inA * 16;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: inA}}>
      {corner({left: m, top: m}, 0)}
      {corner({right: m, top: m}, 90)}
      {corner({right: m, bottom: m}, 180)}
      {corner({left: m, bottom: m}, 270)}
      <div style={{position: 'absolute', right: 96, top: 84, ...tag, fontSize: 18, color: C.dim, display: 'flex', gap: 18, alignItems: 'center'}}>
        <span style={{color: idx >= 2 ? C.teal : C.red}}>{String(idx + 1).padStart(2, '0')}</span>
        <span>/ 09</span>
      </div>
      <div style={{position: 'absolute', left: 96, top: 84, display: 'flex', gap: 6}}>
        {Array.from({length: 33}).map((_, b) => {
          const on = frame >= Math.round((b * 450) / 33);
          return <div key={b} style={{width: 6, height: 18, background: on ? (idx >= 2 ? C.teal : C.red) : rgba(C.white, 0.18), opacity: on ? 0.5 + pulse * 0.5 : 1}} />;
        })}
      </div>
    </div>
  );
};
