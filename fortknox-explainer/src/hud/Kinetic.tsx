import React from 'react';
import {Easing, spring, useCurrentFrame} from 'remotion';
import {FPS} from '../timing';

const clamp = (v: number) => Math.max(0, Math.min(1, v));

type Props = {
  text: string;
  in: number; // frame the first glyph starts
  out?: number; // frame the exit starts (glyphs fly up and blur out)
  stagger?: number;
  style?: React.CSSProperties;
  charStyle?: (i: number) => React.CSSProperties;
  mode?: 'rise' | 'slam' | 'type';
};

// Per-glyph kinetic line: masked rise with a 3D flip, spring settle, blurred exit.
export const Kinetic: React.FC<Props> = ({text, in: inF, out, stagger = 1.1, style, charStyle, mode = 'rise'}) => {
  const frame = useCurrentFrame();
  const chars = [...text];
  return (
    <div style={{display: 'flex', whiteSpace: 'pre', perspective: 900, ...style}}>
      {chars.map((ch, i) => {
        const d = inF + i * stagger;
        const s = spring({frame: frame - d, fps: FPS, config: {damping: mode === 'slam' ? 11 : 15, mass: 0.55, stiffness: 190}});
        const o = out === undefined ? 0 : Easing.in(Easing.cubic)(clamp((frame - out - ((chars.length - i) / chars.length) * 4) / 6));
        let transform = '';
        let blur = 0;
        let opacity = 1;
        if (mode === 'rise') {
          transform = `translateY(${(1 - s) * 95 - o * 70}%) rotateX(${(1 - s) * -85}deg)`;
          blur = (1 - s) * 10 + o * 14;
          opacity = clamp(s * 2.2) * (1 - o);
        } else if (mode === 'slam') {
          transform = `scale(${1 + (1 - s) * 1.3}) translateY(${-o * 60}%)`;
          blur = Math.abs(1 - s) * 18 + o * 14;
          opacity = clamp(s * 3) * (1 - o);
        } else {
          const on = frame >= d;
          opacity = on ? 1 - o : 0;
          transform = `translateY(${-o * 60}%)`;
          blur = o * 12;
        }
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform,
              filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
              opacity,
              transformOrigin: '50% 100%',
              ...(charStyle ? charStyle(i) : {}),
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

// A horizontal bar that wipes in / out.
export const Wipe: React.FC<{in: number; out?: number; style?: React.CSSProperties; dur?: number}> = ({in: inF, out, style, dur = 9}) => {
  const frame = useCurrentFrame();
  const e = Easing.bezier(0.8, 0, 0.2, 1);
  const a = e(clamp((frame - inF) / dur));
  const b = out === undefined ? 0 : e(clamp((frame - out) / dur));
  return <div style={{transformOrigin: b > 0 ? '100% 50%' : '0% 50%', transform: `scaleX(${b > 0 ? 1 - b : a})`, ...style}} />;
};
