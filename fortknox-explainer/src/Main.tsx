import '@fontsource/inter-tight/500.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/inter-tight/800.css';
import '@fontsource/inter-tight/800-italic.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import React from 'react';
import {AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {beatPulse, cameraAt, shakeAt, whipAmount} from './camera';
import {Hud} from './hud/Hud';
import {C, rgba} from './theme';
import {DURATION, FPS} from './timing';
import cues from './vo-cues.json';
import {MOMENTS, World} from './world/World';

export type MainProps = {withVoiceover: boolean; withMusic: boolean};

const PERSPECTIVE = 1400;

// Music bed sits well under the VO and ducks a further ~5 dB while a line plays.
const MUSIC_BED = 0.5;
const MUSIC_DUCKED = 0.28;
const musicVolume = (f: number, duck: boolean) => {
  const t = f / FPS;
  let d = 0;
  if (duck) {
    for (const l of cues.lines) {
      const a = interpolate(t, [l.start - 0.12, l.start, l.end, l.end + 0.18], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
      d = Math.max(d, a);
    }
  }
  return MUSIC_BED + (MUSIC_DUCKED - MUSIC_BED) * d;
};

export const Main: React.FC<MainProps> = ({withVoiceover, withMusic}) => {
  const f = useCurrentFrame();
  const cam = cameraAt(f);
  const sh = shakeAt(f, [MOMENTS.ATTACK, ...MOMENTS.LOCKS, MOMENTS.RESOLVE]);
  const whip = whipAmount(f);
  const pulse = beatPulse(f);
  const threat = f < MOMENTS.VAULT_IN ? 1 - interpolate(f, [MOMENTS.VAULT_IN - 8, MOMENTS.VAULT_IN], [0, 1], {extrapolateLeft: 'clamp'}) : 0;
  const fadeIn = interpolate(f, [0, 8], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: C.bg, overflow: 'hidden'}}>
      {/* sky */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 90% 70% at 50% ${40 + cam.pitch * 0.4}%, ${threat > 0 ? rgba(C.red, 0.1 * threat) : rgba(C.cyan, 0.1)} 0%, transparent 60%),
            linear-gradient(180deg, ${C.bg2} 0%, ${C.bg} 70%)`,
        }}
      />
      {/* 3D stage */}
      <AbsoluteFill style={{perspective: PERSPECTIVE, filter: whip > 0.05 ? `blur(${whip * 2.2}px)` : undefined, opacity: fadeIn}}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 0,
            height: 0,
            transformStyle: 'preserve-3d',
            transform: `translate3d(${sh.x}px, ${sh.y}px, 0) translateZ(${PERSPECTIVE - cam.dist}px) rotateZ(${cam.roll}deg) rotateX(${cam.pitch}deg) rotateY(${cam.yaw}deg) translate3d(${-cam.x}px, ${-cam.y}px, ${-cam.z}px)`,
          }}
        >
          <World f={f} yaw={cam.yaw} pitch={cam.pitch} />
        </div>
      </AbsoluteFill>
      {/* speed streaks during whips */}
      {whip > 0.05 && (
        <AbsoluteFill style={{opacity: whip * 0.55, mixBlendMode: 'screen'}}>
          {Array.from({length: 16}).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${(i * 37 + f * 41) % 100}%`,
                top: `${(i * 61) % 100}%`,
                width: 380 + ((i * 97) % 300),
                height: 2,
                background: `linear-gradient(90deg, transparent, ${i % 2 ? C.cyan : C.white}, transparent)`,
              }}
            />
          ))}
        </AbsoluteFill>
      )}
      {/* red threat wash on the attack */}
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 60%, transparent 40%, ${rgba(C.red, 0.28 * threat * (0.6 + pulse * 0.4))} 100%)`}} />
      {/* legibility gradient for lower-third type + vignette */}
      <AbsoluteFill style={{background: `linear-gradient(0deg, ${rgba(C.bg, 0.78)} 0%, transparent 45%), radial-gradient(ellipse at center, transparent 55%, ${rgba('#000000', 0.65)} 100%)`}} />
      <Hud />
      {withMusic && <Audio src={staticFile('music.wav')} volume={(fr) => musicVolume(fr, withVoiceover)} />}
      {withVoiceover && <Audio src={staticFile('vo.wav')} volume={1} />}
    </AbsoluteFill>
  );
};

export const COMP = {id: 'FortKnoxExplainer', width: 1920, height: 1080, fps: FPS, durationInFrames: DURATION};
