import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { Netlist } from "@workspace/api-client-react";

// ──────────────────────────────────────────────────────────────────────────────
// PROTEUS-STANDARD COLOR PALETTE
// ──────────────────────────────────────────────────────────────────────────────
const C = {
  bg:          "#F5F5F5",
  gridDot:     "#D0D0D0",
  sym:         "#1A1A1A",
  symFill:     "#FFFFFF",
  labelRef:    "#1A1A1A",
  labelVal:    "#444444",
  labelPin:    "#555555",
  wire:        "#0000FF",
  wirePwr:     "#FF0000",
  wireGnd:     "#000000",
  wireAna:     "#7C3AED",
  wirePwm:     "#D97706",
  junction:    "#0000FF",
  sel:         "#F59E0B",
  selFill:     "#FFFBEB",
};

const FONT = "'Roboto Mono', 'JetBrains Mono', 'Courier New', monospace";
const SNAP = 20;
const GRID = 20;
const COMP_HALF_W = 48;
const COMP_HALF_H = 40;
const MIN_SPACING = 100;

function wireColor(netType: string): string {
  if (netType === "power")  return C.wirePwr;
  if (netType === "ground") return C.wireGnd;
  if (netType === "analog") return C.wireAna;
  if (netType === "pwm")    return C.wirePwm;
  return C.wire;
}

// ──────────────────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────────────────
type Pt  = { x: number; y: number };
type Dir = "left" | "right" | "up" | "down";
type Rect = { x: number; y: number; w: number; h: number };

// ──────────────────────────────────────────────────────────────────────────────
// PIN ANCHOR POSITIONS  (relative to component center 0,0)
// All coordinates snapped to 20px grid multiples
// ──────────────────────────────────────────────────────────────────────────────
const PIN_ANCHORS: Record<string, Record<string, Pt>> = {
  Resistor:         { pin1: { x: -40, y: 0 }, pin2: { x: 40, y: 0 } },
  Capacitor:        { pin1: { x: -40, y: 0 }, pin2: { x: 40, y: 0 }, pos: { x: -40, y: 0 }, neg: { x: 40, y: 0 } },
  Inductor:         { pin1: { x: -40, y: 0 }, pin2: { x: 40, y: 0 } },
  Button:           { pin1: { x: -40, y: 0 }, pin2: { x: 40, y: 0 } },
  Switch:           { pin1: { x: -40, y: 0 }, pin2: { x: 40, y: 0 } },
  Crystal:          { pin1: { x: -40, y: 0 }, pin2: { x: 40, y: 0 } },
  LED:              { anode: { x: -40, y: 0 }, cathode: { x: 40, y: 0 } },
  Diode:            { anode: { x: -40, y: 0 }, cathode: { x: 40, y: 0 } },
  ZenerDiode:       { anode: { x: -40, y: 0 }, cathode: { x: 40, y: 0 } },
  SchottkyDiode:    { anode: { x: -40, y: 0 }, cathode: { x: 40, y: 0 } },
  TVSDiode:         { anode: { x: -40, y: 0 }, cathode: { x: 40, y: 0 } },
  InfraredEmitter:  { anode: { x: -40, y: 0 }, cathode: { x: 40, y: 0 } },
  InfraredDetector: { anode: { x: -40, y: 0 }, cathode: { x: 40, y: 0 } },
  NPN:              { base: { x: -40, y: 0 }, collector: { x: 40, y: -40 }, emitter: { x: 40, y: 40 } },
  PNP:              { base: { x: -40, y: 0 }, collector: { x: 40, y: -40 }, emitter: { x: 40, y: 40 } },
  Transistor:       { base: { x: -40, y: 0 }, collector: { x: 40, y: -40 }, emitter: { x: 40, y: 40 } },
  NMOSFET:          { gate: { x: -40, y: 0 }, drain: { x: 40, y: -40 }, source: { x: 40, y: 40 } },
  PMOSFET:          { gate: { x: -40, y: 0 }, drain: { x: 40, y: -40 }, source: { x: 40, y: 40 } },
  Buzzer:           { vcc: { x: 0, y: -40 }, gnd: { x: 0, y: 40 } },
  Motor:            { m_pos: { x: -40, y: 0 }, m_neg: { x: 40, y: 0 } },
  Relay:            { coil_a: { x: -40, y: -20 }, coil_b: { x: -40, y: 20 }, com: { x: 40, y: 0 }, no: { x: 40, y: -20 }, nc: { x: 40, y: 20 } },
};

function compBounds(type: string, pins: string[]): { hw: number; hh: number } {
  if (PIN_ANCHORS[type]) {
    return { hw: COMP_HALF_W, hh: COMP_HALF_H };
  }
  const left  = pins.filter((_, i) => i % 2 === 0);
  const right = pins.filter((_, i) => i % 2 !== 0);
  const rows  = Math.max(left.length, right.length);
  const hh    = (rows * 18 + 20) / 2;
  return { hw: 56 + 12, hh };
}

function pinDir(anchor: Pt): Dir {
  if (Math.abs(anchor.x) >= Math.abs(anchor.y)) {
    return anchor.x <= 0 ? "left" : "right";
  }
  return anchor.y < 0 ? "up" : "down";
}

function getICAnchors(pins: string[]): Record<string, Pt> {
  const left  = pins.filter((_, i) => i % 2 === 0);
  const right = pins.filter((_, i) => i % 2 !== 0);
  const rows  = Math.max(left.length, right.length);
  const h     = rows * 18 + 20;
  const half  = h / 2;
  const out: Record<string, Pt> = {};
  left.forEach( (p, i) => { out[p] = { x: -68, y: -half + 14 + i * 18 }; });
  right.forEach((p, i) => { out[p] = { x:  68, y: -half + 14 + i * 18 }; });
  return out;
}

function resolveAnchor(type: string, pinName: string, allPins: string[]): Pt {
  const typed = PIN_ANCHORS[type];
  if (typed?.[pinName]) return typed[pinName];
  const ic = getICAnchors(allPins);
  return ic[pinName] ?? { x: 0, y: 0 };
}

// ──────────────────────────────────────────────────────────────────────────────
// OBSTACLE-AWARE MANHATTAN ROUTING
// ──────────────────────────────────────────────────────────────────────────────

function snapPt(p: number): number {
  return Math.round(p / GRID) * GRID;
}

function segmentsIntersectRect(ax: number, ay: number, bx: number, by: number, rect: Rect): boolean {
  const { x, y, w, h } = rect;
  const rx1 = x, ry1 = y, rx2 = x + w, ry2 = y + h;
  if (ax === bx) {
    const lx = ax;
    if (lx <= rx1 || lx >= rx2) return false;
    const minY = Math.min(ay, by), maxY = Math.max(ay, by);
    return maxY > ry1 && minY < ry2;
  } else {
    const ly = ay;
    if (ly <= ry1 || ly >= ry2) return false;
    const minX = Math.min(ax, bx), maxX = Math.max(ax, bx);
    return maxX > rx1 && minX < rx2;
  }
}

function routeWireObstacle(from: Pt, fromDir: Dir, to: Pt, toDir: Dir, obstacles: Rect[]): string {
  const EXT = GRID * 2;
  const snap = (v: number) => Math.round(v / GRID) * GRID;

  const fx = snap(from.x), fy = snap(from.y);
  const tx = snap(to.x),   ty = snap(to.y);

  const stubPt = (p: Pt, d: Dir, len: number): Pt => {
    if (d === "right") return { x: p.x + len, y: p.y };
    if (d === "left")  return { x: p.x - len, y: p.y };
    if (d === "up")    return { x: p.x, y: p.y - len };
    return { x: p.x, y: p.y + len };
  };

  const f = stubPt({ x: fx, y: fy }, fromDir, EXT);
  const t = stubPt({ x: tx, y: ty }, toDir, EXT);

  function segHitsObstacle(ax: number, ay: number, bx: number, by: number): boolean {
    return obstacles.some((r) => segmentsIntersectRect(ax, ay, bx, by, r));
  }

  function buildPath(pts: Pt[]): string {
    if (pts.length === 0) return "";
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1], cur = pts[i];
      if (prev.x === cur.x) d += ` V${cur.y}`;
      else                   d += ` H${cur.x}`;
    }
    return d;
  }

  const tryPath = (pts: Pt[]): string | null => {
    for (let i = 0; i < pts.length - 1; i++) {
      if (segHitsObstacle(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)) return null;
    }
    return buildPath(pts);
  };

  // Candidate routes to try (all Manhattan)
  const candidates: Pt[][] = [];

  if ((fromDir === "right" || fromDir === "left") && (toDir === "right" || toDir === "left")) {
    const midX = snap((f.x + t.x) / 2);
    candidates.push([{ x: fx, y: fy }, f, { x: midX, y: f.y }, { x: midX, y: t.y }, t, { x: tx, y: ty }]);
    const offsets = [-GRID * 3, GRID * 3, -GRID * 6, GRID * 6, -GRID * 9, GRID * 9];
    for (const off of offsets) {
      const vy = snap(f.y + off);
      candidates.push([{ x: fx, y: fy }, f, { x: midX, y: f.y }, { x: midX, y: vy }, { x: t.x, y: vy }, t, { x: tx, y: ty }]);
    }
  } else if ((fromDir === "up" || fromDir === "down") && (toDir === "up" || toDir === "down")) {
    const midY = snap((f.y + t.y) / 2);
    candidates.push([{ x: fx, y: fy }, f, { x: f.x, y: midY }, { x: t.x, y: midY }, t, { x: tx, y: ty }]);
    const offsets = [-GRID * 3, GRID * 3, -GRID * 6, GRID * 6];
    for (const off of offsets) {
      const vx = snap(f.x + off);
      candidates.push([{ x: fx, y: fy }, f, { x: f.x, y: midY }, { x: vx, y: midY }, { x: vx, y: t.y }, t, { x: tx, y: ty }]);
    }
  } else if ((fromDir === "right" || fromDir === "left") && (toDir === "up" || toDir === "down")) {
    candidates.push([{ x: fx, y: fy }, f, { x: t.x, y: f.y }, t, { x: tx, y: ty }]);
    const offsets = [-GRID * 3, GRID * 3, -GRID * 6, GRID * 6];
    for (const off of offsets) {
      const vx = snap(f.x + off);
      candidates.push([{ x: fx, y: fy }, f, { x: vx, y: f.y }, { x: vx, y: t.y }, t, { x: tx, y: ty }]);
    }
  } else {
    candidates.push([{ x: fx, y: fy }, f, { x: f.x, y: t.y }, t, { x: tx, y: ty }]);
    const offsets = [-GRID * 3, GRID * 3, -GRID * 6, GRID * 6];
    for (const off of offsets) {
      const vy = snap(f.y + off);
      candidates.push([{ x: fx, y: fy }, f, { x: f.x, y: vy }, { x: t.x, y: vy }, t, { x: tx, y: ty }]);
    }
  }

  for (const cand of candidates) {
    const p = tryPath(cand);
    if (p !== null) return p;
  }

  return buildPath(candidates[0]);
}

// ──────────────────────────────────────────────────────────────────────────────
// WIRE SEGMENT EXTRACTION (for label collision detection)
// ──────────────────────────────────────────────────────────────────────────────
function extractSegments(pathD: string): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const tokens = pathD.replace(/([A-Z])/g, " $1 ").trim().split(/\s+/);
  let cx = 0, cy = 0;
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (cmd === "M") {
      const [px, py] = tokens[i + 1].split(",").map(Number);
      cx = px; cy = py;
      i += 2;
    } else if (cmd === "H") {
      const nx = Number(tokens[i + 1]);
      if (nx !== cx) segs.push({ x1: cx, y1: cy, x2: nx, y2: cy });
      cx = nx; i += 2;
    } else if (cmd === "V") {
      const ny = Number(tokens[i + 1]);
      if (ny !== cy) segs.push({ x1: cx, y1: cy, x2: cx, y2: ny });
      cy = ny; i += 2;
    } else {
      i++;
    }
  }
  return segs;
}

function ptOnSegment(px: number, py: number, seg: { x1: number; y1: number; x2: number; y2: number }, tol = 14): boolean {
  const { x1, y1, x2, y2 } = seg;
  if (x1 === x2) {
    if (Math.abs(px - x1) > tol) return false;
    return py >= Math.min(y1, y2) - tol && py <= Math.max(y1, y2) + tol;
  } else {
    if (Math.abs(py - y1) > tol) return false;
    return px >= Math.min(x1, x2) - tol && px <= Math.max(x1, x2) + tol;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SVG COMPONENT SYMBOLS (IEEE/IEC style)
// ──────────────────────────────────────────────────────────────────────────────

function ResistorSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-40" y1="0" x2="-20" y2="0" />
      <polyline points="-20,0 -15,-8 -8,8 0,-8 8,8 15,-8 20,0" fill="none" />
      <line x1="20" y1="0" x2="40" y2="0" />
    </g>
  );
}

function CapSVG({ polar = false }: { polar?: boolean }) {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-40" y1="0" x2="-6" y2="0" />
      {polar
        ? <path d="M-6,-16 Q2,-16 2,0 Q2,16 -6,16" fill="none" />
        : <line x1="-6" y1="-16" x2="-6" y2="16" />}
      <line x1="6" y1="-16" x2="6" y2="16" />
      <line x1="6" y1="0" x2="40" y2="0" />
      {polar && <text x="-16" y="-18" fontSize="9" fill={C.wirePwr} textAnchor="middle" fontFamily={FONT}>+</text>}
    </g>
  );
}

function InductorSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-40" y1="0" x2="-20" y2="0" />
      <path d="M-20,0 A5,5 0 0,1 -10,0 A5,5 0,0,1 0,0 A5,5 0,0,1 10,0 A5,5 0,0,1 20,0" />
      <line x1="20" y1="0" x2="40" y2="0" />
    </g>
  );
}

function DiodeSVG({ variant = "plain" }: { variant?: "plain" | "zener" | "schottky" | "tvs" }) {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-40" y1="0" x2="-14" y2="0" />
      <polygon points="-14,-12 -14,12 12,0" fill={C.symFill} stroke={C.sym} />
      {variant === "zener"    && <path d="M12,-12 L16,-8 M12,12 L8,8" />}
      {variant === "schottky" && <path d="M12,-12 Q14,-12 14,-9 M12,12 Q10,12 10,9" />}
      {variant === "tvs"      && <><line x1="12" y1="-14" x2="12" y2="14" /><line x1="8" y1="-14" x2="16" y2="-14" /><line x1="8" y1="14" x2="16" y2="14" /></>}
      {variant === "plain"    && <line x1="12" y1="-12" x2="12" y2="12" />}
      <line x1="12" y1="0" x2="40" y2="0" />
    </g>
  );
}

function LEDColor(color?: string): string {
  switch (color) {
    case "red":    return "#EF4444";
    case "green":  return "#22C55E";
    case "blue":   return "#3B82F6";
    case "yellow": return "#EAB308";
    case "white":  return "#E5E7EB";
    case "UV":     return "#8B5CF6";
    case "IR":     return "#FCA5A5";
    default:       return "#FCD34D";
  }
}

function LEDSVG({ color }: { color?: string }) {
  const fill = LEDColor(color);
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <defs>
        <marker id="led-arr" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 Z" fill={C.wire} stroke="none" />
        </marker>
      </defs>
      <line x1="-40" y1="0" x2="-14" y2="0" />
      <polygon points="-14,-12 -14,12 12,0" fill={fill} fillOpacity="0.4" stroke={C.sym} />
      <line x1="12" y1="-12" x2="12" y2="12" />
      <line x1="12" y1="0" x2="40" y2="0" />
      <line x1="14" y1="-8" x2="26" y2="-20" stroke={C.wire} markerEnd="url(#led-arr)" />
      <line x1="20" y1="-4" x2="32" y2="-16" stroke={C.wire} markerEnd="url(#led-arr)" />
    </g>
  );
}

function IREmitterSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <defs>
        <marker id="ir-arr-out" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 Z" fill="#7C3AED" stroke="none" />
        </marker>
      </defs>
      <line x1="-40" y1="0" x2="-14" y2="0" />
      <polygon points="-14,-12 -14,12 12,0" fill="#EDE9FE" fillOpacity="0.5" stroke={C.sym} />
      <line x1="12" y1="-12" x2="12" y2="12" />
      <line x1="12" y1="0" x2="40" y2="0" />
      <line x1="14" y1="-8" x2="26" y2="-20" stroke="#7C3AED" strokeDasharray="3,1.5" markerEnd="url(#ir-arr-out)" />
      <line x1="20" y1="-4" x2="32" y2="-16" stroke="#7C3AED" strokeDasharray="3,1.5" markerEnd="url(#ir-arr-out)" />
    </g>
  );
}

function IRDetectorSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <defs>
        <marker id="ir-arr-in" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 Z" fill="#7C3AED" stroke="none" />
        </marker>
      </defs>
      <line x1="-40" y1="0" x2="-14" y2="0" />
      <polygon points="-14,-12 -14,12 12,0" fill="#F5F3FF" fillOpacity="0.5" stroke={C.sym} />
      <line x1="12" y1="-12" x2="12" y2="12" />
      <line x1="12" y1="0" x2="40" y2="0" />
      <line x1="30" y1="-20" x2="18" y2="-8" stroke="#7C3AED" strokeDasharray="3,1.5" markerEnd="url(#ir-arr-in)" />
      <line x1="36" y1="-16" x2="24" y2="-4" stroke="#7C3AED" strokeDasharray="3,1.5" markerEnd="url(#ir-arr-in)" />
    </g>
  );
}

function NPNSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <circle cx="0" cy="0" r="28" fill={C.symFill} stroke={C.sym} />
      <line x1="-40" y1="0" x2="-16" y2="0" />
      <line x1="-16" y1="-22" x2="-16" y2="22" strokeWidth="2.5" />
      <line x1="-16" y1="-13" x2="24" y2="-34" />
      <line x1="-16" y1="13"  x2="24" y2="34" />
      <polygon points="14,26 26,36 20,40" fill={C.sym} stroke="none" />
      <line x1="24" y1="-34" x2="40" y2="-40" />
      <line x1="24" y1="34"  x2="40" y2="40" />
      <text x="6" y="-6" fontSize="7" fill={C.labelPin} fontFamily={FONT}>C</text>
      <text x="6" y="14" fontSize="7" fill={C.labelPin} fontFamily={FONT}>E</text>
    </g>
  );
}

function PNPSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <circle cx="0" cy="0" r="28" fill={C.symFill} stroke={C.sym} />
      <line x1="-40" y1="0" x2="-16" y2="0" />
      <line x1="-16" y1="-22" x2="-16" y2="22" strokeWidth="2.5" />
      <line x1="-16" y1="-13" x2="24" y2="-34" />
      <line x1="-16" y1="13"  x2="24" y2="34" />
      <polygon points="-6,-10 -16,-13 -12,-6" fill={C.sym} stroke="none" />
      <line x1="24" y1="-34" x2="40" y2="-40" />
      <line x1="24" y1="34"  x2="40" y2="40" />
    </g>
  );
}

function MOSFETSVG({ n = true }: { n?: boolean }) {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <circle cx="0" cy="0" r="28" fill={C.symFill} stroke={C.sym} />
      <line x1="-40" y1="0" x2="-14" y2="0" />
      <line x1="-14" y1="-22" x2="-14" y2="22" />
      <line x1="-10" y1="-22" x2="-10" y2="-6" />
      <line x1="-10" y1="6"   x2="-10" y2="22" />
      <line x1="-10" y1="-13" x2="22" y2="-32" />
      <line x1="-10" y1="13"  x2="22" y2="32" />
      <line x1="-10" y1="0"   x2="4"  y2="0" />
      {n
        ? <polygon points="12,24 24,32 20,38" fill={C.sym} stroke="none" />
        : <polygon points="-4,-12 -12,-10 -8,-4" fill={C.sym} stroke="none" />}
      <line x1="22" y1="-32" x2="40" y2="-40" />
      <line x1="22" y1="32"  x2="40" y2="40" />
      <text x="2" y="4" fontSize="7" fill={C.labelPin} textAnchor="middle" fontFamily={FONT}>{n ? "N" : "P"}</text>
    </g>
  );
}

function BuzzerSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <rect x="-14" y="-22" width="28" height="20" rx="2" fill={C.symFill} stroke={C.sym} />
      <path d="M14,-32 Q34,-32 34,-12 Q34,8 14,8" />
      <path d="M14,-22 Q24,-22 24,-12 Q24,-2 14,-2" />
      <line x1="0" y1="-22" x2="0" y2="-40" />
      <line x1="0" y1="-2"  x2="0" y2="40" />
      <text x="-4" y="-26" fontSize="8" fill={C.wirePwr} fontFamily={FONT}>+</text>
    </g>
  );
}

function CrystalSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-40" y1="0" x2="-16" y2="0" />
      <line x1="-16" y1="-14" x2="-16" y2="14" />
      <rect x="-12" y="-12" width="24" height="24" rx="1" fill={C.symFill} stroke={C.sym} />
      <line x1="12" y1="-14" x2="12" y2="14" />
      <line x1="12" y1="0" x2="40" y2="0" />
    </g>
  );
}

function SwitchSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-40" y1="0" x2="-14" y2="0" />
      <circle cx="-14" cy="0" r="3" fill={C.sym} />
      <line x1="-12" y1="-6" x2="12" y2="-16" stroke={C.sym} />
      <circle cx="14" cy="0" r="3" fill={C.sym} />
      <line x1="14" y1="0" x2="40" y2="0" />
    </g>
  );
}

function MotorSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <circle cx="0" cy="0" r="26" fill={C.symFill} stroke={C.sym} />
      <text x="0" y="5" textAnchor="middle" fontSize="15" fontWeight="bold" fill={C.sym} fontFamily={FONT}>M</text>
      <line x1="-40" y1="0" x2="-26" y2="0" />
      <line x1="26"  y1="0" x2="40"  y2="0" />
    </g>
  );
}

function RelaySVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <rect x="-28" y="-28" width="28" height="56" rx="2" fill={C.symFill} stroke={C.sym} />
      <path d="M-22,-14 Q-16,-14 -16,-7 Q-16,0 -22,0 Q-16,0 -16,7 Q-16,14 -22,14" />
      <line x1="-40" y1="-20" x2="-28" y2="-20" />
      <line x1="-40" y1="20"  x2="-28" y2="20" />
      <line x1="0" y1="0"   x2="40" y2="0" />
      <line x1="0" y1="-20" x2="40" y2="-20" />
      <line x1="0" y1="20"  x2="40" y2="20" />
      <circle cx="4" cy="-20" r="3" fill={C.sym} />
      <line x1="4" y1="-20" x2="18" y2="-8" strokeWidth="2" />
      <circle cx="18" cy="0" r="3" fill="none" stroke={C.sym} />
      <circle cx="18" cy="20" r="3" fill="none" stroke={C.sym} />
    </g>
  );
}

function ICSVG({ pins, label }: { pins: string[]; label: string }) {
  const left  = pins.filter((_, i) => i % 2 === 0);
  const right = pins.filter((_, i) => i % 2 !== 0);
  const rows  = Math.max(left.length, right.length);
  const h     = rows * 18 + 20;
  const half  = h / 2;
  const hw    = 56;
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <rect x={-hw} y={-half} width={hw * 2} height={h} rx="3" fill={C.symFill} stroke={C.sym} />
      <text x="0" y="6" textAnchor="middle" fontSize="9" fill={C.labelRef} fontFamily={FONT} fontWeight="bold">
        {label.slice(0, 10)}
      </text>
      {left.map((pin, i) => {
        const py = -half + 14 + i * 18;
        return (
          <g key={pin}>
            <line x1={-hw - 12} y1={py} x2={-hw} y2={py} />
            <text x={-hw + 4} y={py + 3} fontSize="6.5" fill={C.labelPin} fontFamily={FONT}>{pin.slice(0, 8)}</text>
          </g>
        );
      })}
      {right.map((pin, i) => {
        const py = -half + 14 + i * 18;
        return (
          <g key={pin}>
            <line x1={hw} y1={py} x2={hw + 12} y2={py} />
            <text x={hw - 4} y={py + 3} textAnchor="end" fontSize="6.5" fill={C.labelPin} fontFamily={FONT}>{pin.slice(0, 8)}</text>
          </g>
        );
      })}
    </g>
  );
}

function CompSymbol({
  type,
  pins,
  properties,
}: {
  type: string;
  pins: string[];
  properties?: Record<string, string>;
}) {
  const isPolar = properties?.["type"] === "electrolytic" || properties?.["type"] === "tantalum";
  const model   = properties?.["model"] ?? "";

  switch (type) {
    case "Resistor":         return <ResistorSVG />;
    case "LED":              return <LEDSVG color={properties?.["color"] ?? model} />;
    case "Diode":            return <DiodeSVG />;
    case "ZenerDiode":       return <DiodeSVG variant="zener" />;
    case "SchottkyDiode":    return <DiodeSVG variant="schottky" />;
    case "TVSDiode":         return <DiodeSVG variant="tvs" />;
    case "InfraredEmitter":  return <IREmitterSVG />;
    case "InfraredDetector": return <IRDetectorSVG />;
    case "Capacitor":        return <CapSVG polar={isPolar} />;
    case "Inductor":         return <InductorSVG />;
    case "NPN":
    case "Transistor":       return <NPNSVG />;
    case "PNP":              return <PNPSVG />;
    case "NMOSFET":          return <MOSFETSVG n />;
    case "PMOSFET":          return <MOSFETSVG n={false} />;
    case "Buzzer":           return <BuzzerSVG />;
    case "Crystal":          return <CrystalSVG />;
    case "Button":
    case "Switch":           return <SwitchSVG />;
    case "Motor":            return <MotorSVG />;
    case "Relay":            return <RelaySVG />;
    default:                 return <ICSVG pins={pins} label={type} />;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// POWER / GND / NET-LABEL SYMBOLS
// ──────────────────────────────────────────────────────────────────────────────
function VCCSymbolSVG({ voltage, name }: { voltage?: number; name: string }) {
  const label = voltage ? `${voltage}V` : name;
  return (
    <g>
      <line x1="0" y1="0" x2="0" y2="-14" stroke={C.wirePwr} strokeWidth="1.5" />
      <polygon points="-12,-14 12,-14 0,-30" fill={C.wirePwr} />
      <text x="0" y="-33" textAnchor="middle" fontSize="9" fill={C.wirePwr} fontFamily={FONT} fontWeight="bold">
        {label}
      </text>
    </g>
  );
}

function GNDSymbolSVG({ name }: { name: string }) {
  return (
    <g>
      <line x1="0" y1="0" x2="0" y2="12" stroke={C.wireGnd} strokeWidth="1.5" />
      <line x1="-16" y1="12" x2="16" y2="12" stroke={C.wireGnd} strokeWidth="1.5" />
      <line x1="-10" y1="18" x2="10" y2="18" stroke={C.wireGnd} strokeWidth="1.5" />
      <line x1="-4"  y1="24" x2="4"  y2="24" stroke={C.wireGnd} strokeWidth="1.5" />
      <text x="0" y="36" textAnchor="middle" fontSize="8" fill={C.wireGnd} fontFamily={FONT}>{name}</text>
    </g>
  );
}

function NetLabelSVG({ name, netType }: { name: string; netType: string }) {
  const col = wireColor(netType);
  return (
    <g>
      <line x1="-14" y1="0" x2="0" y2="0" stroke={col} strokeWidth="1.5" />
      <polygon points="0,-7 0,7 18,0" fill="none" stroke={col} strokeWidth="1.5" />
      <text x="22" y="4" fontSize="8" fill={col} fontFamily={FONT}>{name}</text>
    </g>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// FORCE-DIRECTED LAYOUT  (minimum 100px spacing, 20px grid snap)
// ──────────────────────────────────────────────────────────────────────────────
const CELL_W = 240;
const CELL_H = 260;
const MARGIN = 160;

interface PlacedComp {
  id:          string;
  type:        string;
  category:    string;
  pins:        Array<{ name: string; direction: string; type: string; pinNumber?: number }>;
  properties?: Record<string, string>;
  x:           number;
  y:           number;
  col:         number;
  row:         number;
}

function buildLayout(netlist: Netlist): PlacedComp[] {
  const n = netlist.components.length;
  if (n === 0) return [];

  const powerNets = new Set(netlist.nets.filter((nn) => nn.type === "power").map((nn) => nn.name));
  const gndNets   = new Set(netlist.nets.filter((nn) => nn.type === "ground").map((nn) => nn.name));

  const compNets = new Map<string, Set<string>>();
  netlist.components.forEach((c) => compNets.set(c.id, new Set()));
  netlist.connections.forEach((conn) => {
    if (netlist.nets.find((nn) => nn.name === conn.from)) compNets.get(conn.to)?.add(conn.from);
    if (netlist.nets.find((nn) => nn.name === conn.to))   compNets.get(conn.from)?.add(conn.to);
  });

  const connSet = new Set<string>();
  netlist.connections.forEach((conn) => {
    if (!netlist.nets.find((nn) => nn.name === conn.from) &&
        !netlist.nets.find((nn) => nn.name === conn.to)) {
      connSet.add(`${conn.from}--${conn.to}`);
      connSet.add(`${conn.to}--${conn.from}`);
    }
  });

  const scored = netlist.components.map((comp) => {
    const nets  = compNets.get(comp.id) ?? new Set();
    let score   = 0;
    if ([...nets].some((nn) => powerNets.has(nn))) score -= 20;
    if ([...nets].some((nn) => gndNets.has(nn)))   score += 20;
    if (comp.category === "passive")          score += 0;
    if (comp.category === "active_discrete")  score += 5;
    if (comp.category === "active_ic")        score += 10;
    if (comp.category === "module")           score += 15;
    if (comp.category === "sensor")           score += 12;
    return { comp, score };
  });
  scored.sort((a, b) => a.score - b.score);

  const cols = Math.max(2, Math.ceil(Math.sqrt(n * 1.2)));

  const positions = scored.map(({ comp }, idx) => ({
    id: comp.id,
    x:  MARGIN + (idx % cols) * CELL_W,
    y:  MARGIN + Math.floor(idx / cols) * CELL_H,
    vx: 0,
    vy: 0,
  }));

  const REPULSION  = 18000;
  const ATTRACTION = 0.006;
  const DAMPING    = 0.70;
  const ITERATIONS = 120;
  const MIN_DIST   = MIN_SPACING + 80;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cool  = 1 - iter / (ITERATIONS * 1.5);
    const forces = positions.map(() => ({ fx: 0, fy: 0 }));

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const d2 = dx * dx + dy * dy + 1;
        const d  = Math.sqrt(d2);

        const rep = (REPULSION / d2) * cool;
        const rx  = (rep * dx) / d;
        const ry  = (rep * dy) / d;
        forces[i].fx += rx;
        forces[i].fy += ry;
        forces[j].fx -= rx;
        forces[j].fy -= ry;

        if (d < MIN_DIST) {
          const push = ((MIN_DIST - d) / MIN_DIST) * 6 * cool;
          forces[i].fx += (dx / d) * push;
          forces[i].fy += (dy / d) * push;
          forces[j].fx -= (dx / d) * push;
          forces[j].fy -= (dy / d) * push;
        }

        const id_i = positions[i].id, id_j = positions[j].id;
        if (connSet.has(`${id_i}--${id_j}`)) {
          const att  = ATTRACTION * d * cool;
          forces[i].fx -= (dx / d) * att;
          forces[i].fy -= (dy / d) * att;
          forces[j].fx += (dx / d) * att;
          forces[j].fy += (dy / d) * att;
        }
      }
    }

    for (let i = 0; i < positions.length; i++) {
      positions[i].vx = (positions[i].vx + forces[i].fx) * DAMPING;
      positions[i].vy = (positions[i].vy + forces[i].fy) * DAMPING;
      positions[i].x  = Math.max(MARGIN, positions[i].x + positions[i].vx);
      positions[i].y  = Math.max(MARGIN, positions[i].y + positions[i].vy);
    }
  }

  const posMap = new Map(positions.map((p) => [p.id, p]));
  return scored.map(({ comp }, idx) => {
    const p  = posMap.get(comp.id)!;
    const sx = Math.round(p.x / SNAP) * SNAP;
    const sy = Math.round(p.y / SNAP) * SNAP;
    return {
      ...comp,
      x:   sx,
      y:   sy,
      col: idx % cols,
      row: Math.floor(idx / cols),
    };
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// PIN LABELS WITH ANTI-COLLISION (8pt, flips side if wire overlaps)
// ──────────────────────────────────────────────────────────────────────────────
function PinLabels({
  compType,
  pins,
  allWireSegs,
  cx,
  cy,
}: {
  compType:    string;
  pins:        Array<{ name: string; pinNumber?: number }>;
  allWireSegs: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  cx:          number;
  cy:          number;
}) {
  const noExternalLabels = !PIN_ANCHORS[compType];
  if (noExternalLabels) return null;

  const LABEL_OFF = 15;

  return (
    <>
      {pins.map((pin) => {
        const anchor = resolveAnchor(compType, pin.name, pins.map((p) => p.name));
        const dir    = pinDir(anchor);

        let tx = anchor.x, ty = anchor.y;
        let anchor2: "start" | "middle" | "end" = "middle";

        const defaultPos = () => {
          if (dir === "left")  { tx = anchor.x - LABEL_OFF; ty = anchor.y - 4; anchor2 = "end"; }
          else if (dir === "right") { tx = anchor.x + LABEL_OFF; ty = anchor.y - 4; anchor2 = "start"; }
          else if (dir === "up")    { tx = anchor.x; ty = anchor.y - LABEL_OFF; anchor2 = "middle"; }
          else                      { tx = anchor.x; ty = anchor.y + LABEL_OFF + 4; anchor2 = "middle"; }
        };

        const oppositePos = () => {
          if (dir === "left")  { tx = anchor.x + LABEL_OFF; ty = anchor.y - 4; anchor2 = "start"; }
          else if (dir === "right") { tx = anchor.x - LABEL_OFF; ty = anchor.y - 4; anchor2 = "end"; }
          else if (dir === "up")    { tx = anchor.x; ty = anchor.y + LABEL_OFF + 4; anchor2 = "middle"; }
          else                      { tx = anchor.x; ty = anchor.y - LABEL_OFF; anchor2 = "middle"; }
        };

        defaultPos();

        const worldTx = cx + tx;
        const worldTy = cy + ty;
        const hits = allWireSegs.some((seg) => ptOnSegment(worldTx, worldTy, seg));
        if (hits) oppositePos();

        return (
          <g key={pin.name}>
            <text
              x={tx} y={ty}
              textAnchor={anchor2}
              fontSize="8"
              fill={C.labelPin}
              fontFamily={FONT}
              style={{ pointerEvents: "none" }}
            >
              {pin.name}
            </text>
          </g>
        );
      })}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN RENDERER
// ──────────────────────────────────────────────────────────────────────────────
interface Props {
  netlist: Netlist;
}

export function SchematicRenderer({ netlist }: Props) {
  const [zoom,       setZoom]       = useState(1);
  const [pan,        setPan]        = useState<Pt>({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGrid,   setShowGrid]   = useState(true);
  const [hoveredNet, setHoveredNet] = useState<string | null>(null);

  const isDragging = useRef(false);
  const lastPt     = useRef<Pt>({ x: 0, y: 0 });
  const svgRef     = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const placed = useMemo(() => buildLayout(netlist), [netlist]);

  // Auto-center
  useEffect(() => {
    if (placed.length === 0) return;
    const xs  = placed.map((c) => c.x);
    const ys  = placed.map((c) => c.y);
    const minX = Math.min(...xs) - MARGIN;
    const minY = Math.min(...ys) - MARGIN;
    const maxX = Math.max(...xs) + MARGIN;
    const maxY = Math.max(...ys) + MARGIN;
    const bbW  = maxX - minX;
    const bbH  = maxY - minY;
    const cW   = containerRef.current?.clientWidth  ?? 800;
    const cH   = containerRef.current?.clientHeight ?? 600;
    const newZoom = Math.min(1.4, Math.max(0.25, Math.min(cW / bbW, cH / bbH) * 0.82));
    setZoom(newZoom);
    setPan({
      x: cW / 2 - ((minX + maxX) / 2) * newZoom,
      y: cH / 2 - ((minY + maxY) / 2) * newZoom,
    });
  }, [placed]);

  const compById = useMemo(() => {
    const m = new Map<string, PlacedComp>();
    placed.forEach((c) => m.set(c.id, c));
    return m;
  }, [placed]);

  const netByName = useMemo(() => {
    const m = new Map<string, (typeof netlist.nets)[number]>();
    netlist.nets.forEach((nn) => m.set(nn.name, nn));
    return m;
  }, [netlist.nets]);

  const obstacles = useMemo((): Rect[] => {
    return placed.map((comp) => {
      const { hw, hh } = compBounds(comp.type, comp.pins.map((p) => p.name));
      const pad = 20;
      return { x: comp.x - hw - pad, y: comp.y - hh - pad, w: (hw + pad) * 2, h: (hh + pad) * 2 };
    });
  }, [placed]);

  const pinWorld = useCallback(
    (compId: string, pinName: string): Pt | null => {
      const comp = compById.get(compId);
      if (!comp) return null;
      const local = resolveAnchor(comp.type, pinName, comp.pins.map((p) => p.name));
      return { x: snapPt(comp.x + local.x), y: snapPt(comp.y + local.y) };
    },
    [compById],
  );

  const pinWorldDir = useCallback(
    (compId: string, pinName: string): Dir => {
      const comp = compById.get(compId);
      if (!comp) return "right";
      const local = resolveAnchor(comp.type, pinName, comp.pins.map((p) => p.name));
      return pinDir(local);
    },
    [compById],
  );

  const maxX = Math.max(800, ...placed.map((p) => p.x)) + MARGIN * 2;
  const maxY = Math.max(600, ...placed.map((p) => p.y)) + MARGIN * 2;

  // Interaction
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.15, Math.min(5, z - e.deltaY * 0.001)));
  }, []);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest(".schematic-component")) return;
    isDragging.current = true;
    lastPt.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPt.current.x;
    const dy = e.clientY - lastPt.current.y;
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    lastPt.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseUp   = useCallback(() => { isDragging.current = false; }, []);

  const fitToScreen = useCallback(() => {
    if (placed.length === 0) { setZoom(1); setPan({ x: 0, y: 0 }); return; }
    const xs  = placed.map((c) => c.x);
    const ys  = placed.map((c) => c.y);
    const minX = Math.min(...xs) - MARGIN;
    const minY = Math.min(...ys) - MARGIN;
    const maxXv = Math.max(...xs) + MARGIN;
    const maxYv = Math.max(...ys) + MARGIN;
    const cW = containerRef.current?.clientWidth  ?? 800;
    const cH = containerRef.current?.clientHeight ?? 600;
    const fz = Math.min(1.4, Math.max(0.15, Math.min(cW / (maxXv - minX), cH / (maxYv - minY)) * 0.85));
    setZoom(fz);
    setPan({
      x: cW / 2 - ((minX + maxXv) / 2) * fz,
      y: cH / 2 - ((minY + maxYv) / 2) * fz,
    });
  }, [placed]);

  const exportSVG = useCallback(() => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.removeAttribute("style");
    clone.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);

    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
      text { font-family: 'Courier New', monospace; }
      .schematic-component { cursor: default; }
    `;
    clone.insertBefore(style, clone.firstChild);

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", "0"); bg.setAttribute("y", "0");
    bg.setAttribute("width", String(maxX)); bg.setAttribute("height", String(maxY));
    bg.setAttribute("fill", C.bg);
    clone.insertBefore(bg, clone.firstChild);

    const str  = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([str], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "schematic.svg"; a.click();
    URL.revokeObjectURL(url);
  }, [maxX, maxY]);

  // ── Build wire / power / junction data ──────────────────────────────────────
  interface WireEntry {
    path:    string;
    color:   string;
    netName: string;
    netType: string;
    segs:    Array<{ x1: number; y1: number; x2: number; y2: number }>;
  }
  interface PowerEntry   { x: number; y: number; type: "vcc" | "gnd"; netName: string; voltage?: number; }
  interface NetLabelEntry { x: number; y: number; netName: string; netType: string; }

  const wires:           WireEntry[]     = [];
  const powerSymbols:    PowerEntry[]    = [];
  const netLabelSymbols: NetLabelEntry[] = [];

  const pointCount = new Map<string, { x: number; y: number; color: string; count: number }>();
  function trackPt(x: number, y: number, color: string) {
    const key = `${Math.round(x)},${Math.round(y)}`;
    const ex  = pointCount.get(key);
    if (ex) { ex.count += 1; ex.color = color; }
    else      pointCount.set(key, { x, y, color, count: 1 });
  }

  for (const conn of netlist.connections) {
    const fromNet = netByName.get(conn.from);
    const toNet   = netByName.get(conn.to);

    if (fromNet && !toNet) {
      const pinPos = pinWorld(conn.to, conn.toPin);
      if (!pinPos) continue;
      if (fromNet.type === "power")
        powerSymbols.push({ ...pinPos, type: "vcc", netName: fromNet.name, voltage: fromNet.voltage });
      else if (fromNet.type === "ground")
        powerSymbols.push({ ...pinPos, type: "gnd", netName: fromNet.name });
      else
        netLabelSymbols.push({ ...pinPos, netName: fromNet.name, netType: fromNet.type });
    } else if (!fromNet && toNet) {
      const pinPos = pinWorld(conn.from, conn.fromPin);
      if (!pinPos) continue;
      if (toNet.type === "power")
        powerSymbols.push({ ...pinPos, type: "vcc", netName: toNet.name, voltage: toNet.voltage });
      else if (toNet.type === "ground")
        powerSymbols.push({ ...pinPos, type: "gnd", netName: toNet.name });
      else
        netLabelSymbols.push({ ...pinPos, netName: toNet.name, netType: toNet.type });
    } else if (!fromNet && !toNet) {
      const fromPos = pinWorld(conn.from, conn.fromPin);
      const toPos   = pinWorld(conn.to,   conn.toPin);
      if (!fromPos || !toPos) continue;

      const net     = netByName.get(conn.net ?? "");
      const netType = net?.type ?? "signal";
      const color   = wireColor(netType);
      const fd      = pinWorldDir(conn.from, conn.fromPin);
      const td      = pinWorldDir(conn.to,   conn.toPin);

      const obsForRoute = obstacles.filter((_, idx) => {
        const comp = placed[idx];
        return comp.id !== conn.from && comp.id !== conn.to;
      });

      const path = routeWireObstacle(fromPos, fd, toPos, td, obsForRoute);
      const segs = extractSegments(path);

      wires.push({ path, color, netName: conn.net ?? "", netType, segs });
      trackPt(fromPos.x, fromPos.y, color);
      trackPt(toPos.x,   toPos.y,   color);
    }
  }

  const allWireSegs = wires.flatMap((w) => w.segs);
  const junctions   = [...pointCount.values()].filter((p) => p.count >= 3);

  const selected      = selectedId ? compById.get(selectedId) : null;
  const selectedConns = selectedId
    ? netlist.connections.filter((c) => c.from === selectedId || c.to === selectedId)
    : [];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ background: C.bg }}
    >
      {/* Toolbar */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5" style={{ pointerEvents: "all" }}>
        {[
          { label: "+",              onClick: () => setZoom((z) => Math.min(5, z + 0.25)) },
          { label: "−",              onClick: () => setZoom((z) => Math.max(0.15, z - 0.25)) },
          { label: "⊡ Fit",          onClick: fitToScreen },
          { label: showGrid ? "Grid ●" : "Grid ○", onClick: () => setShowGrid((v) => !v) },
          { label: "↓ Export SVG",   onClick: exportSVG },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            style={{
              background:   "#1F2937",
              border:       "1px solid #374151",
              color:        "#E5E7EB",
              borderRadius: "4px",
              padding:      "3px 9px",
              fontSize:     "10px",
              fontFamily:   FONT,
              cursor:       "pointer",
              whiteSpace:   "nowrap",
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ fontSize: "9px", color: "#6B7280", fontFamily: FONT, marginLeft: 4 }}>
          {Math.round(zoom * 100)}% · {placed.length} comp
        </span>
      </div>

      {/* Selected component panel */}
      {selected && (
        <div
          className="absolute top-2 right-2 z-20 rounded p-3 text-[10px] font-mono space-y-1.5"
          style={{
            background:     "#1F2937EE",
            border:         "1px solid #374151",
            maxWidth:       "220px",
            backdropFilter: "blur(8px)",
            fontFamily:     FONT,
            color:          "#E5E7EB",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span style={{ color: C.sel, fontWeight: "bold" }}>{selected.id}</span>
            <button onClick={() => setSelectedId(null)} style={{ color: "#6B7280", fontSize: "9px" }}>✕</button>
          </div>
          <div style={{ color: "#9CA3AF" }}>{selected.type}</div>
          {Object.entries(selected.properties ?? {}).map(([k, v]) => (
            <div key={k}><span style={{ color: "#6B7280" }}>{k}:</span> {v}</div>
          ))}
          <div style={{ color: "#6B7280", borderTop: "1px solid #374151", paddingTop: 4, marginTop: 4 }}>
            {selectedConns.length} connection{selectedConns.length !== 1 ? "s" : ""}
          </div>
          {selectedConns.map((c, i) => {
            const nn = netByName.get(c.net ?? "");
            return (
              <div key={i} style={{ color: wireColor(nn?.type ?? "signal"), fontSize: "9px" }}>
                .{c.from === selectedId ? c.fromPin : c.toPin} → {c.from === selectedId ? c.to : c.from}
              </div>
            );
          })}
        </div>
      )}

      {/* Net hover tooltip */}
      {hoveredNet && (
        <div
          className="absolute bottom-12 left-2 z-20 px-2 py-1 rounded"
          style={{ background: "#1F2937EE", border: "1px solid #374151", color: "#E5E7EB", fontSize: "9px", fontFamily: FONT }}
        >
          net: <span style={{ color: C.wire }}>{hoveredNet}</span>
        </div>
      )}

      {/* Legend */}
      <div
        className="absolute bottom-2 left-2 z-20 flex flex-col gap-1 p-2 rounded"
        style={{ background: "#1F2937CC", border: "1px solid #374151" }}
      >
        {[
          { col: C.wirePwr, lbl: "Power" },
          { col: C.wireGnd, lbl: "Ground" },
          { col: C.wire,    lbl: "Signal" },
          { col: C.wirePwm, lbl: "PWM" },
          { col: C.wireAna, lbl: "Analog" },
        ].map(({ col, lbl }) => (
          <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "9px", fontFamily: FONT }}>
            <div style={{ width: 18, height: 2, background: col, borderRadius: 1 }} />
            <span style={{ color: "#9CA3AF" }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        viewBox={`0 0 ${maxX} ${maxY}`}
        style={{
          transform:       `matrix(${zoom},0,0,${zoom},${pan.x},${pan.y})`,
          transformOrigin: "0 0",
        }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* Background */}
        <rect x="0" y="0" width={maxX} height={maxY} fill={C.bg} />

        {/* 20px dot grid */}
        {showGrid && (
          <g>
            {Array.from({ length: Math.ceil(maxX / GRID) + 1 }, (_, i) =>
              Array.from({ length: Math.ceil(maxY / GRID) + 1 }, (_, j) => (
                <circle key={`${i}-${j}`} cx={i * GRID} cy={j * GRID} r="0.8" fill={C.gridDot} />
              ))
            )}
          </g>
        )}

        {/* Wires (drawn below components) */}
        {wires.map((w, i) => (
          <path
            key={i}
            d={w.path}
            stroke={w.netName === hoveredNet ? "#F59E0B" : w.color}
            strokeWidth={w.netName === hoveredNet ? 2.5 : 1.5}
            fill="none"
            strokeLinecap="square"
            strokeLinejoin="miter"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoveredNet(w.netName)}
            onMouseLeave={() => setHoveredNet(null)}
          />
        ))}

        {/* Junction dots – 4px radius solid circles at ≥3-wire intersections */}
        {junctions.map((j, i) => (
          <circle key={i} cx={j.x} cy={j.y} r="4" fill={j.color} />
        ))}

        {/* Power symbols */}
        {powerSymbols.map((sym, i) => (
          <g key={i} transform={`translate(${sym.x},${sym.y})`}>
            {sym.type === "vcc"
              ? <VCCSymbolSVG voltage={sym.voltage} name={sym.netName} />
              : <GNDSymbolSVG name={sym.netName} />}
          </g>
        ))}

        {/* Net labels */}
        {netLabelSymbols.map((sym, i) => (
          <g key={i} transform={`translate(${sym.x},${sym.y})`}>
            <NetLabelSVG name={sym.netName} netType={sym.netType} />
          </g>
        ))}

        {/* Components (drawn on top) */}
        {placed.map((comp) => {
          const isSelected = comp.id === selectedId;
          const pinNames   = comp.pins.map((p) => p.name);
          const value      = comp.properties?.["value"]
            ?? comp.properties?.["resistance"]
            ?? comp.properties?.["capacitance"]
            ?? comp.properties?.["model"]
            ?? comp.properties?.["color"]
            ?? "";

          const { hw, hh } = compBounds(comp.type, pinNames);

          return (
            <g
              key={comp.id}
              className="schematic-component"
              transform={`translate(${comp.x},${comp.y})`}
              onClick={() => setSelectedId(comp.id === selectedId ? null : comp.id)}
              style={{ cursor: "pointer" }}
            >
              {isSelected && (
                <rect
                  x={-hw - 8} y={-hh - 8}
                  width={(hw + 8) * 2} height={(hh + 8) * 2}
                  rx="5"
                  fill={C.selFill}
                  fillOpacity="0.5"
                  stroke={C.sel}
                  strokeWidth="1.5"
                  strokeDasharray="5,3"
                />
              )}

              <CompSymbol type={comp.type} pins={pinNames} properties={comp.properties} />

              {/* Pin labels with anti-collision */}
              <PinLabels
                compType={comp.type}
                pins={comp.pins.map((p) => ({ name: p.name, pinNumber: p.pinNumber }))}
                allWireSegs={allWireSegs}
                cx={comp.x}
                cy={comp.y}
              />

              {/* Ref designator – 15px above component top, bold */}
              <text
                x={0}
                y={-hh - 15}
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fontFamily={FONT}
                fill={isSelected ? C.sel : C.labelRef}
                style={{ pointerEvents: "none" }}
              >
                {comp.id}
              </text>

              {/* Value – 15px below component bottom */}
              {value && (
                <text
                  x={0}
                  y={hh + 24}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontFamily={FONT}
                  fill={C.labelVal}
                  style={{ pointerEvents: "none" }}
                >
                  {value}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
