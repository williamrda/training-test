import React from 'react';
import {rgba, shade} from '../theme';

type Props = {
  x?: number;
  y?: number; // bottom of the box (floor = 0, up is negative)
  z?: number;
  w: number;
  h: number;
  d: number;
  color: string;
  glow?: string;
  glowAmt?: number;
  opacity?: number;
  rotY?: number;
  scale?: number;
  front?: React.ReactNode;
  top?: React.ReactNode;
  left?: React.ReactNode;
};

// Six shaded faces -> a solid-looking box with lit edges.
export const Box: React.FC<Props> = ({
  x = 0, y = 0, z = 0, w, h, d, color, glow = '#3cc8ff', glowAmt = 0.3, opacity = 1, rotY = 0, scale = 1,
  front, top, left,
}) => {
  const edge = `1.5px solid ${rgba(glow, 0.25 + glowAmt * 0.65)}`;
  const face = (fw: number, fh: number, transform: string, light: number, child?: React.ReactNode): React.CSSProperties & {child?: React.ReactNode} => ({
    position: 'absolute',
    left: -fw / 2,
    top: -fh / 2,
    width: fw,
    height: fh,
    transform,
    background: `linear-gradient(180deg, ${shade(color, light * 1.18)} 0%, ${shade(color, light * 0.78)} 100%)`,
    border: edge,
    boxShadow: `inset 0 0 ${Math.max(w, h) * 0.25}px ${rgba(glow, glowAmt * 0.45)}`,
    backfaceVisibility: 'hidden',
    boxSizing: 'border-box',
    overflow: 'hidden',
    child,
  });
  const faces = [
    face(w, h, `translateZ(${d / 2}px)`, 0.95),
    face(w, h, `rotateY(180deg) translateZ(${d / 2}px)`, 0.55),
    face(d, h, `rotateY(90deg) translateZ(${w / 2}px)`, 0.7),
    face(d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, 0.78, left),
    face(w, d, `rotateX(90deg) translateZ(${h / 2}px)`, 1.4, top),
    face(w, d, `rotateX(-90deg) translateZ(${h / 2}px)`, 0.3),
  ];
  faces[0].child = front;
  return (
    <div
      style={{
        position: 'absolute',
        transformStyle: 'preserve-3d',
        transform: `translate3d(${x}px, ${y - (h * scale) / 2}px, ${z}px) rotateY(${rotY}deg) scale3d(${scale},${scale},${scale})`,
        opacity,
      }}
    >
      {faces.map(({child, ...st}, i) => (
        <div key={i} style={st}>
          {child}
        </div>
      ))}
    </div>
  );
};

// A flat plane positioned in world space.
export const Plane: React.FC<{
  x?: number; y?: number; z?: number; w: number; h: number; transform?: string; style?: React.CSSProperties; children?: React.ReactNode;
}> = ({x = 0, y = 0, z = 0, w, h, transform = '', style, children}) => (
  <div
    style={{
      position: 'absolute',
      left: -w / 2,
      top: -h / 2,
      width: w,
      height: h,
      transform: `translate3d(${x}px, ${y}px, ${z}px) ${transform}`,
      transformStyle: 'preserve-3d',
      ...style,
    }}
  >
    {children}
  </div>
);
