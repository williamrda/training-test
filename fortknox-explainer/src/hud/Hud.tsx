import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {beatPulse} from '../camera';
import {C, FONT_DISPLAY, FONT_MONO, rgba} from '../theme';
import {DURATION, SECTION_BEATS, SECTIONS, SHOTS, sectionIndexAt} from '../timing';
import {MOMENTS} from '../world/World';
import {Kinetic, Wipe} from './Kinetic';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const EXIT = 6; // frames a block overlaps into the next whip

const big: React.CSSProperties = {fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 140, lineHeight: 0.9, letterSpacing: '-0.045em', color: C.white};
const tag: React.CSSProperties = {fontFamily: FONT_MONO, fontWeight: 600, fontSize: 22, letterSpacing: '0.34em', textTransform: 'uppercase'};
const sub: React.CSSProperties = {fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 40, letterSpacing: '-0.01em', color: C.dim};

// One text block per 5 s section; its lines build up and stay until the section ends.
const Section: React.FC<{i: number; left?: number; bottom?: number; children: React.ReactNode; align?: 'left' | 'center'}> = ({i, left = 130, bottom = 140, children, align = 'left'}) => {
  const frame = useCurrentFrame();
  const s = SECTIONS[i];
  const last = i === SECTIONS.length - 2;
  const e = last ? DURATION : SECTIONS[i + 1] + EXIT;
  if (frame < s || frame >= e) return null;
  // slow push on the type while it holds
  const k = interpolate(frame, [s, e], [1.03, 1], {easing: Easing.out(Easing.quad)});
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

// Checklist row that ticks in on its beat and stays.
const Check: React.FC<{text: string; at: number; out: number; color: string}> = ({text, at, out, color}) => {
  const frame = useCurrentFrame();
  const on = clamp((frame - at) / 5);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
      <div
        style={{
          width: 54, height: 54, borderRadius: 12, border: `3px solid ${rgba(color, 0.35 + on * 0.65)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: rgba(color, on * 0.18), boxShadow: on > 0 ? `0 0 ${24 * on}px ${rgba(color, 0.6)}` : 'none',
          opacity: clamp((frame - at + 10) / 6) * (1 - clamp((frame - out) / 6)),
        }}
      >
        <span style={{fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 34, color, transform: `scale(${on})`}}>✓</span>
      </div>
      <Kinetic text={text} in={at - 2} out={out} stagger={0.6} mode="slam" style={{...big, fontSize: 76, letterSpacing: '-0.03em', color}} />
    </div>
  );
};

export const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const S = SECTIONS;
  const out = (i: number) => S[i + 1] - 5;
  const {ATTACK, HUNT, GAP_CLOSE, LOCKS, KEY_TURN, SCAN, RECOVER} = MOMENTS;

  // RGB-split glitch on the ransomware hit
  const g = frame >= ATTACK && frame < ATTACK + 14 ? Math.exp(-(frame - ATTACK) / 4) : 0;
  const glitch = g > 0 ? `${-8 * g}px 0 ${rgba(C.cyan, 0.9)}, ${8 * g}px 0 ${rgba(C.red, 0.9)}` : 'none';

  const windowOpen = frame < GAP_CLOSE;
  const approvals = (frame >= KEY_TURN[0] + 3 ? 1 : 0) + (frame >= KEY_TURN[1] + 3 ? 1 : 0);
  const pulse = beatPulse(frame);
  const idx = sectionIndexAt(frame);

  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* 1 — threat (production, then backups) */}
      <Section i={0}>
        <Tag text="threat detected" in={6} out={out(0)} color={C.red} dot />
        <Kinetic text="RANSOMWARE" in={ATTACK - 2} out={out(0)} stagger={0.9} mode="slam" style={{...big, fontSize: 150, color: C.red, textShadow: glitch, transform: `translateX(${Math.sin(frame * 9) * 10 * g}px)`}} />
        <Kinetic text="hits production," in={ATTACK + 12} out={out(0)} stagger={0.6} style={{...sub, fontSize: 48}} />
        <div style={{display: 'flex', gap: 18, alignItems: 'baseline'}}>
          <Kinetic text="then hunts" in={HUNT - 2} out={out(0)} stagger={0.6} style={{...sub, fontSize: 48, color: C.white}} />
          <Kinetic text="YOUR BACKUPS" in={HUNT + 4} out={out(0)} stagger={0.8} mode="slam" style={{...big, fontSize: 88, color: C.red}} />
        </div>
      </Section>

      {/* 2 — FortKnox */}
      <Section i={1}>
        <Tag text="cyber vaulting" in={S[1] + 7} out={out(1)} color={C.teal} />
        <Kinetic text="Cohesity" in={S[1] + 7} out={out(1)} stagger={1} style={{...big, fontWeight: 500, fontSize: 120}} />
        <Kinetic
          text="FortKnox"
          in={S[1] + 14}
          out={out(1)}
          stagger={1.2}
          style={{...big, fontSize: 170, color: C.teal, textShadow: `0 0 ${30 + pulse * 30}px ${rgba(C.teal, 0.55)}`}}
        />
        <Kinetic text="an isolated, immutable copy of your backups" in={S[1] + 34} out={out(1)} stagger={0.35} style={{...sub, fontSize: 38, color: C.white}} />
        <Kinetic text="in a Cohesity-managed cloud vault or self-managed on-prem" in={S[1] + 70} out={out(1)} stagger={0.3} style={{...sub, fontSize: 32}} />
      </Section>

      {/* 3 — virtual air gap */}
      <Section i={2}>
        <div style={{display: 'flex', alignItems: 'center', gap: 16, opacity: clamp((frame - S[2] - 6) / 4) * (1 - clamp((frame - out(2)) / 6))}}>
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
        <Kinetic text="VIRTUAL" in={S[2] + 6} out={out(2)} stagger={1} style={big} />
        <Kinetic text="AIR GAP" in={S[2] + 12} out={out(2)} stagger={1} style={{...big, color: C.teal}} />
        <Kinetic text="connected only during the transfer window" in={S[2] + 30} out={out(2)} stagger={0.35} style={{...sub, fontSize: 36, color: C.white}} />
        <Kinetic text="isolated the rest of the time" in={GAP_CLOSE + 6} out={out(2)} stagger={0.4} style={{...sub, fontSize: 36, color: C.teal}} />
      </Section>

      {/* 4 — locked down (door rings, then the two keys) */}
      <Section i={3}>
        <Tag text="tamper-proof by design" in={S[3] + 6} out={out(3)} color={C.teal} />
        <Check text="IMMUTABLE" at={LOCKS[0]} out={out(3)} color={C.white} />
        <Check text="ENCRYPTED" at={LOCKS[1]} out={out(3)} color={C.teal} />
        <Check text="WORM-LOCKED" at={LOCKS[2]} out={out(3)} color={C.amber} />
        <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
          <Check text="QUORUM" at={KEY_TURN[1] + 3} out={out(3)} color={C.cyan} />
          <div style={{display: 'flex', alignItems: 'center', gap: 14, opacity: clamp((frame - SHOTS[5] - 4) / 5) * (1 - clamp((frame - out(3)) / 6))}}>
            <span style={{...tag, fontSize: 24, color: approvals === 2 ? C.cyan : C.white, letterSpacing: '0.1em'}}>{approvals}/2 approvers</span>
            {[0, 1].map((k) => (
              <div key={k} style={{width: 40, height: 10, borderRadius: 5, background: k < approvals ? C.cyan : rgba(C.white, 0.2), boxShadow: k < approvals ? `0 0 16px ${C.cyan}` : 'none'}} />
            ))}
          </div>
        </div>
      </Section>

      {/* 5 — scanned clean, recovered fast */}
      <Section i={4}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18, opacity: clamp((frame - S[4] - 5) / 4) * (1 - clamp((frame - out(4)) / 6))}}>
          <span style={{...tag, color: C.dim}}>threat scan</span>
          <Counter from={0} to={100} a={SCAN[0]} b={SCAN[1]} suffix="%" style={{...tag, fontSize: 30, color: C.teal, letterSpacing: '0.05em'}} />
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 30}}>
          <Kinetic text="SCANNED" in={S[4] + 6} out={out(4)} stagger={0.9} style={{...big, fontSize: 120}} />
          <Kinetic text="CLEAN ✓" in={SCAN[1] - 6} out={out(4)} stagger={0.9} mode="slam" style={{...big, fontSize: 120, color: C.teal}} />
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 30}}>
          <Kinetic text="RECOVERED" in={RECOVER + 4} out={out(4)} stagger={0.8} style={{...big, fontSize: 120}} />
          <Kinetic text="FAST" in={RECOVER + 12} out={out(4)} stagger={1.4} mode="slam" style={{...big, fontStyle: 'italic', color: C.teal, fontSize: 120}} />
        </div>
        <Kinetic text="granular restore · original or alternate location" in={RECOVER + 22} out={out(4)} stagger={0.3} style={{...sub, fontSize: 34}} />
      </Section>

      {/* 6 — end card */}
      <Section i={5} align="center">
        <Tag text="cyber vaulting & recovery" in={S[5] + 8} color={C.teal} />
        <div style={{display: 'flex', alignItems: 'baseline', gap: 36}}>
          <Kinetic text="Cohesity" in={S[5] + 4} stagger={1} style={{...big, fontWeight: 500, fontSize: 150}} />
          <Kinetic text="FortKnox" in={S[5] + 10} stagger={1.1} style={{...big, fontSize: 150, color: C.teal, textShadow: `0 0 ${30 + pulse * 30}px ${rgba(C.teal, 0.55)}`}} />
        </div>
        <Wipe in={S[5] + 20} style={{height: 3, width: 1040, background: `linear-gradient(90deg, transparent, ${C.teal}, transparent)`}} dur={16} />
        <Kinetic text="Isolate.  Lock.  Recover." in={S[5] + 26} stagger={0.8} style={{...sub, fontSize: 60, color: C.white, fontWeight: 600}} />
        <Kinetic text="managed SaaS or self-managed on-prem" in={S[5] + 48} stagger={0.3} mode="type" style={{...tag, fontSize: 20, color: C.dim, marginTop: 14}} />
        <Kinetic text="cohesity.com/platform/fortknox" in={S[5] + 64} stagger={0.3} mode="type" style={{...tag, fontSize: 20, color: C.teal, letterSpacing: '0.2em', textTransform: 'none'}} />
      </Section>

      {/* persistent chrome: frame corners, section counter, beat ticks */}
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
  const col = idx >= 1 ? C.teal : C.red;
  const beats = SECTION_BEATS[SECTION_BEATS.length - 1];
  return (
    <div style={{position: 'absolute', inset: 0, opacity: inA}}>
      {corner({left: m, top: m}, 0)}
      {corner({right: m, top: m}, 90)}
      {corner({right: m, bottom: m}, 180)}
      {corner({left: m, bottom: m}, 270)}
      <div style={{position: 'absolute', right: 96, top: 84, ...tag, fontSize: 18, color: C.dim, display: 'flex', gap: 18, alignItems: 'center'}}>
        <span style={{color: col}}>{String(idx + 1).padStart(2, '0')}</span>
        <span>/ {String(SECTIONS.length - 1).padStart(2, '0')}</span>
      </div>
      <div style={{position: 'absolute', left: 96, top: 84, display: 'flex', gap: 3}}>
        {Array.from({length: beats}).map((_, b) => {
          const on = frame >= Math.round((b * DURATION) / beats);
          return <div key={b} style={{width: 3, height: b % 11 === 0 ? 22 : 14, alignSelf: 'flex-end', background: on ? col : rgba(C.white, 0.18), opacity: on ? 0.5 + pulse * 0.5 : 1}} />;
        })}
      </div>
    </div>
  );
};
