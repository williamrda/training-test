export const C = {
  bg: '#04060c',
  bg2: '#0a1324',
  steel: '#16213a',
  steelHi: '#233255',
  line: 'rgba(120,170,255,0.18)',
  teal: '#1de9a6',
  cyan: '#3cc8ff',
  red: '#ff3550',
  amber: '#ffb547',
  white: '#eef4ff',
  dim: 'rgba(214,226,255,0.62)',
};

export const FONT_DISPLAY = '"Inter Tight", "Inter", system-ui, sans-serif';
export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

export const mix = (a: string, b: string, t: number) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
};

export const shade = (hex: string, f: number) => {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `rgb(${r},${g},${b})`;
};

export const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
