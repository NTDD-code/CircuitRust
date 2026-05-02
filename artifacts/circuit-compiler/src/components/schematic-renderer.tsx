import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { Netlist } from "@workspace/api-client-react";

// ──────────────────────────────────────────────────────────────────────────────
// PROTEUS-INSPIRED COLOR PALETTE  (light background)
// ──────────────────────────────────────────────────────────────────────────────
const C = {
  bg:          "#F6F8FA",
  gridDot:     "#C5D0DF",
  sym:         "#111827",
  symFill:     "#FFFFFF",
  labelRef:    "#111827",
  labelVal:    "#374151",
  labelPin:    "#6B7280",
  labelPinNum: "#9CA3AF",
  wire:        "#1D4ED8",   // signal  → dark blue
  wirePwr:     "#DC2626",   // power   → red
  wireGnd:     "#111827",   // GND     → near-black
  wireAna:     "#7C3AED",   // analog  → purple
  wirePwm:     "#D97706",   // PWM     → amber
  junction:    "#1D4ED8",
  sel:         "#F59E0B",
  selFill:     "#FFFBEB",
};

const FONT = "'Roboto Mono', 'JetBrains Mono', 'Courier New', monospace";

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
type Pt = { x: number; y: number };
type Dir = "left" | "right" | "up" | "down";

// ──────────────────────────────────────────────────────────────────────────────
// PIN ANCHOR POSITIONS  (relative to component center 0,0)
// ──────────────────────────────────────────────────────────────────────────────
const PIN_ANCHORS: Record<string, Record<string, Pt>> = {
  Resistor:      { pin1: { x: -32, y: 0 }, pin2: { x: 32, y: 0 } },
  Capacitor:     { pin1: { x: -32, y: 0 }, pin2: { x: 32, y: 0 }, pos: { x: -32, y: 0 }, neg: { x: 32, y: 0 } },
  Inductor:      { pin1: { x: -32, y: 0 }, pin2: { x: 32, y: 0 } },
  Button:        { pin1: { x: -32, y: 0 }, pin2: { x: 32, y: 0 } },
  Switch:        { pin1: { x: -32, y: 0 }, pin2: { x: 32, y: 0 } },
  Crystal:       { pin1: { x: -32, y: 0 }, pin2: { x: 32, y: 0 } },
  LED:           { anode: { x: -32, y: 0 }, cathode: { x: 32, y: 0 } },
  Diode:         { anode: { x: -32, y: 0 }, cathode: { x: 32, y: 0 } },
  ZenerDiode:    { anode: { x: -32, y: 0 }, cathode: { x: 32, y: 0 } },
  SchottkyDiode: { anode: { x: -32, y: 0 }, cathode: { x: 32, y: 0 } },
  TVSDiode:      { anode: { x: -32, y: 0 }, cathode: { x: 32, y: 0 } },
  InfraredEmitter:  { anode: { x: -32, y: 0 }, cathode: { x: 32, y: 0 } },
  InfraredDetector: { anode: { x: -32, y: 0 }, cathode: { x: 32, y: 0 } },
  NPN:     { base: { x: -32, y: 0 }, collector: { x: 24, y: -28 }, emitter: { x: 24, y: 28 } },
  PNP:     { base: { x: -32, y: 0 }, collector: { x: 24, y: -28 }, emitter: { x: 24, y: 28 } },
  Transistor: { base: { x: -32, y: 0 }, collector: { x: 24, y: -28 }, emitter: { x: 24, y: 28 } },
  NMOSFET: { gate: { x: -32, y: 0 }, drain: { x: 24, y: -28 }, source: { x: 24, y: 28 } },
  PMOSFET: { gate: { x: -32, y: 0 }, drain: { x: 24, y: -28 }, source: { x: 24, y: 28 } },
  Buzzer:  { vcc: { x: -32, y: -14 }, gnd_pin: { x: -32, y: 14 } },
  Motor:   { m_pos: { x: -32, y: 0 }, m_neg: { x: 32, y: 0 } },
  Relay:   { coil_pos: { x: -32, y: -18 }, coil_neg: { x: -32, y: 18 }, com: { x: 32, y: 0 }, nc: { x: 32, y: -18 }, no: { x: 32, y: 18 } },
};

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
  const h     = rows * 18 + 12;
  const half  = h / 2;
  const out: Record<string, Pt> = {};
  left.forEach( (p, i) => { out[p] = { x: -56, y: -half + 14 + i * 18 }; });
  right.forEach((p, i) => { out[p] = { x:  56, y: -half + 14 + i * 18 }; });
  return out;
}

function resolveAnchor(type: string, pinName: string, allPins: string[]): Pt {
  const typed = PIN_ANCHORS[type];
  if (typed?.[pinName]) return typed[pinName];
  const ic = getICAnchors(allPins);
  return ic[pinName] ?? { x: 0, y: 0 };
}

// ──────────────────────────────────────────────────────────────────────────────
// WIRE ROUTING  (orthogonal L/Z/U shaped, no diagonals)
// ──────────────────────────────────────────────────────────────────────────────
function routeWire(from: Pt, fromDir: Dir, to: Pt, toDir: Dir): string {
  const EXT = 12; // stub extension before bend

  // Straight line
  if (Math.abs(from.x - to.x) < 1 && Math.abs(from.y - to.y) < 1) {
    return `M${from.x},${from.y}`;
  }

  // Compute stub exit points
  const stub = (p: Pt, d: Dir, len: number): Pt => {
    if (d === "right") return { x: p.x + len, y: p.y };
    if (d === "left")  return { x: p.x - len, y: p.y };
    if (d === "up")    return { x: p.x, y: p.y - len };
    return { x: p.x, y: p.y + len };
  };

  const f = stub(from, fromDir, EXT);
  const t = stub(to,   toDir,   EXT);

  // If horizontal stub → horizontal stub (both H): Z-route via vertical midpoint
  if ((fromDir === "right" || fromDir === "left") && (toDir === "right" || toDir === "left")) {
    if (Math.abs(f.y - t.y) < 1) {
      return `M${from.x},${from.y} H${f.x} H${t.x} H${to.x}`;
    }
    const midX = (f.x + t.x) / 2;
    return `M${from.x},${from.y} H${f.x} V${f.y} H${midX} V${t.y} H${t.x} H${to.x}`;
  }

  // If vertical stub → vertical stub: Z-route via horizontal midpoint
  if ((fromDir === "up" || fromDir === "down") && (toDir === "up" || toDir === "down")) {
    if (Math.abs(f.x - t.x) < 1) {
      return `M${from.x},${from.y} V${f.y} V${t.y} V${to.y}`;
    }
    const midY = (f.y + t.y) / 2;
    return `M${from.x},${from.y} V${f.y} H${f.x} V${midY} H${t.x} V${t.y} V${to.y}`;
  }

  // Mixed: one H one V → L-shape
  if ((fromDir === "right" || fromDir === "left") && (toDir === "up" || toDir === "down")) {
    return `M${from.x},${from.y} H${f.x} H${t.x} V${t.y} V${to.y}`;
  }
  if ((fromDir === "up" || fromDir === "down") && (toDir === "right" || toDir === "left")) {
    return `M${from.x},${from.y} V${f.y} V${t.y} H${t.x} H${to.x}`;
  }

  // Fallback: Z via midpoint
  const midX = (from.x + to.x) / 2;
  return `M${from.x},${from.y} H${midX} V${to.y} H${to.x}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// SVG SYMBOL COMPONENTS
// ──────────────────────────────────────────────────────────────────────────────

function ResistorSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-32" y1="0" x2="-18" y2="0" />
      <rect x="-18" y="-7" width="36" height="14" rx="2" fill={C.symFill} stroke={C.sym} />
      <line x1="18" y1="0" x2="32" y2="0" />
    </g>
  );
}

function CapSVG({ polar = false }: { polar?: boolean }) {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-32" y1="0" x2="-5" y2="0" />
      {polar ? (
        <path d="M-5,-14 Q2,-14 2,0 Q2,14 -5,14" stroke={C.sym} fill="none" />
      ) : (
        <line x1="-5" y1="-14" x2="-5" y2="14" />
      )}
      <line x1="5" y1="-14" x2="5" y2="14" />
      <line x1="5" y1="0" x2="32" y2="0" />
      {polar && <text x="-14" y="-16" fontSize="9" fill={C.wirePwr} textAnchor="middle" fontFamily={FONT}>+</text>}
    </g>
  );
}

function InductorSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-32" y1="0" x2="-18" y2="0" />
      <path d="M-18,0 A5,5 0 0 1 -8,0 A5,5 0 0 1 2,0 A5,5 0 0 1 12,0 A5,5 0 0 1 18,0" />
      <line x1="18" y1="0" x2="32" y2="0" />
    </g>
  );
}

function DiodeSVG({ variant = "plain" }: { variant?: "plain" | "zener" | "schottky" | "tvs" }) {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-32" y1="0" x2="-12" y2="0" />
      <polygon points="-12,-11 -12,11 10,0" fill={C.symFill} stroke={C.sym} />
      {variant === "zener"   && <path d="M10,-11 L14,-7 M10,11 L6,7" />}
      {variant === "schottky" && <path d="M10,-11 Q12,-11 12,-8 M10,11 Q8,11 8,8" />}
      {variant === "tvs"     && <><line x1="10" y1="-13" x2="10" y2="13" /><line x1="6" y1="-13" x2="14" y2="-13" /><line x1="6" y1="13" x2="14" y2="13" /></>}
      {variant === "plain"   && <line x1="10" y1="-11" x2="10" y2="11" />}
      <line x1="10" y1="0" x2="32" y2="0" />
    </g>
  );
}

function LEDColor(color?: string) {
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
      <line x1="-32" y1="0" x2="-12" y2="0" />
      <polygon points="-12,-11 -12,11 10,0" fill={fill} fillOpacity="0.3" stroke={C.sym} />
      <line x1="10" y1="-11" x2="10" y2="11" />
      <line x1="10" y1="0" x2="32" y2="0" />
      <line x1="12" y1="-8" x2="22" y2="-18" stroke={C.wire} markerEnd="url(#led-arr)" />
      <line x1="18" y1="-5" x2="28" y2="-15" stroke={C.wire} markerEnd="url(#led-arr)" />
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
      <line x1="-32" y1="0" x2="-12" y2="0" />
      <polygon points="-12,-11 -12,11 10,0" fill="#EDE9FE" fillOpacity="0.5" stroke={C.sym} />
      <line x1="10" y1="-11" x2="10" y2="11" />
      <line x1="10" y1="0" x2="32" y2="0" />
      {/* IR arrows outward (emitting) */}
      <line x1="13" y1="-7" x2="23" y2="-17" stroke="#7C3AED" strokeDasharray="3,1.5" markerEnd="url(#ir-arr-out)" />
      <line x1="19" y1="-4" x2="29" y2="-14" stroke="#7C3AED" strokeDasharray="3,1.5" markerEnd="url(#ir-arr-out)" />
      <text x="6" y="18" fontSize="7" fill="#7C3AED" textAnchor="middle" fontFamily={FONT}>IR</text>
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
      <line x1="-32" y1="0" x2="-12" y2="0" />
      <polygon points="-12,-11 -12,11 10,0" fill="#F5F3FF" fillOpacity="0.5" stroke={C.sym} />
      <line x1="10" y1="-11" x2="10" y2="11" />
      <line x1="10" y1="0" x2="32" y2="0" />
      {/* IR arrows inward (receiving) — point toward component */}
      <line x1="28" y1="-17" x2="18" y2="-7" stroke="#7C3AED" strokeDasharray="3,1.5" markerEnd="url(#ir-arr-in)" />
      <line x1="34" y1="-14" x2="24" y2="-4" stroke="#7C3AED" strokeDasharray="3,1.5" markerEnd="url(#ir-arr-in)" />
      <text x="6" y="18" fontSize="7" fill="#7C3AED" textAnchor="middle" fontFamily={FONT}>🔵</text>
    </g>
  );
}

function NPNSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <circle cx="0" cy="0" r="24" fill={C.symFill} stroke={C.sym} />
      {/* Base */}
      <line x1="-32" y1="0" x2="-14" y2="0" />
      {/* Base contact bar */}
      <line x1="-14" y1="-18" x2="-14" y2="18" strokeWidth="2" />
      {/* Collector: up-right */}
      <line x1="-14" y1="-11" x2="20" y2="-26" />
      {/* Emitter: down-right */}
      <line x1="-14" y1="11" x2="20" y2="26" />
      {/* Emitter arrow (NPN = outward) */}
      <polygon points="12,20 22,28 18,32" fill={C.sym} stroke="none" />
    </g>
  );
}

function PNPSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <circle cx="0" cy="0" r="24" fill={C.symFill} stroke={C.sym} />
      <line x1="-32" y1="0" x2="-14" y2="0" />
      <line x1="-14" y1="-18" x2="-14" y2="18" strokeWidth="2" />
      <line x1="-14" y1="-11" x2="20" y2="-26" />
      <line x1="-14" y1="11" x2="20" y2="26" />
      {/* PNP arrow points inward (toward base) on collector */}
      <polygon points="-4,-13 -14,-11 -10,-5" fill={C.sym} stroke="none" />
    </g>
  );
}

function MOSFETSVG({ n = true }: { n?: boolean }) {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <circle cx="0" cy="0" r="24" fill={C.symFill} stroke={C.sym} />
      {/* Gate */}
      <line x1="-32" y1="0" x2="-12" y2="0" />
      <line x1="-12" y1="-18" x2="-12" y2="18" />
      {/* Gate oxide gap */}
      <line x1="-8" y1="-18" x2="-8" y2="-4" />
      <line x1="-8" y1="4"  x2="-8"  y2="18" />
      {/* Drain & Source */}
      <line x1="-8" y1="-11" x2="20" y2="-26" />
      <line x1="-8" y1="11"  x2="20" y2="26" />
      <line x1="-8" y1="0"   x2="4"  y2="0" />
      {n && <polygon points="12,20 22,28 18,32" fill={C.sym} stroke="none" />}
      {!n && <polygon points="-4,-13 -12,-11 -8,-5" fill={C.sym} stroke="none" />}
      <text x="4" y="4" fontSize="7" fill={C.labelPin} textAnchor="middle" fontFamily={FONT}>{n?"N":"P"}</text>
    </g>
  );
}

function BuzzerSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <rect x="-10" y="-20" width="20" height="40" rx="2" fill={C.symFill} stroke={C.sym} />
      <path d="M10,-24 Q30,-24 30,0 Q30,24 10,24" />
      <path d="M10,-14 Q20,-14 20,0 Q20,14 10,14" />
      <line x1="-32" y1="-14" x2="-10" y2="-14" />
      <line x1="-32" y1="14"  x2="-10" y2="14" />
      <text x="-20" y="-16" fontSize="8" fill={C.wirePwr} fontFamily={FONT}>+</text>
    </g>
  );
}

function CrystalSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-32" y1="0" x2="-14" y2="0" />
      <line x1="-14" y1="-13" x2="-14" y2="13" />
      <rect x="-11" y="-11" width="22" height="22" rx="1" fill={C.symFill} stroke={C.sym} />
      <line x1="11" y1="-13" x2="11" y2="13" />
      <line x1="11" y1="0" x2="32" y2="0" />
    </g>
  );
}

function SwitchSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-32" y1="0" x2="-12" y2="0" />
      <circle cx="-12" cy="0" r="3" fill={C.sym} />
      <line x1="-10" y1="-5" x2="10" y2="-14" stroke={C.sym} />
      <circle cx="12" cy="0" r="3" fill={C.sym} />
      <line x1="12" y1="0" x2="32" y2="0" />
    </g>
  );
}

function MotorSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <circle cx="0" cy="0" r="22" fill={C.symFill} stroke={C.sym} />
      <text x="0" y="5" textAnchor="middle" fontSize="13" fontWeight="bold" fill={C.sym} fontFamily={FONT}>M</text>
      <line x1="-32" y1="0" x2="-22" y2="0" />
      <line x1="22" y1="0" x2="32" y2="0" />
    </g>
  );
}

function ICSVG({ pins, label }: { pins: string[]; label: string }) {
  const left   = pins.filter((_, i) => i % 2 === 0);
  const right  = pins.filter((_, i) => i % 2 !== 0);
  const rows   = Math.max(left.length, right.length);
  const h      = rows * 18 + 20;
  const half   = h / 2;
  const halfW  = 44;
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <rect x={-halfW} y={-half} width={halfW * 2} height={h} rx="3" fill={C.symFill} stroke={C.sym} />
      <text x="0" y="6" textAnchor="middle" fontSize="9" fill={C.labelRef} fontFamily={FONT} fontWeight="bold">
        {label.slice(0, 9)}
      </text>
      {left.map((pin, i) => {
        const py = -half + 14 + i * 18;
        return (
          <g key={pin}>
            <line x1={-halfW - 12} y1={py} x2={-halfW} y2={py} />
            <text x={-halfW + 4} y={py + 3} fontSize="6.5" fill={C.labelPin} fontFamily={FONT}>{pin.slice(0, 7)}</text>
          </g>
        );
      })}
      {right.map((pin, i) => {
        const py = -half + 14 + i * 18;
        return (
          <g key={pin}>
            <line x1={halfW} y1={py} x2={halfW + 12} y2={py} />
            <text x={halfW - 4} y={py + 3} textAnchor="end" fontSize="6.5" fill={C.labelPin} fontFamily={FONT}>{pin.slice(0, 7)}</text>
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
    case "Resistor":   return <ResistorSVG />;
    case "LED":        return <LEDSVG color={properties?.["color"] ?? model} />;
    case "Diode":      return <DiodeSVG />;
    case "ZenerDiode": return <DiodeSVG variant="zener" />;
    case "SchottkyDiode": return <DiodeSVG variant="schottky" />;
    case "TVSDiode":   return <DiodeSVG variant="tvs" />;
    case "InfraredEmitter": return <IREmitterSVG />;
    case "InfraredDetector": return <IRDetectorSVG />;
    case "Capacitor":  return <CapSVG polar={isPolar} />;
    case "Inductor":   return <InductorSVG />;
    case "NPN":
    case "Transistor": return <NPNSVG />;
    case "PNP":        return <PNPSVG />;
    case "NMOSFET":    return <MOSFETSVG n />;
    case "PMOSFET":    return <MOSFETSVG n={false} />;
    case "Buzzer":     return <BuzzerSVG />;
    case "Crystal":    return <CrystalSVG />;
    case "Button":
    case "Switch":     return <SwitchSVG />;
    case "Motor":      return <MotorSVG />;
    default:           return <ICSVG pins={pins} label={type} />;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// POWER / GND / NET-LABEL SYMBOLS
// ──────────────────────────────────────────────────────────────────────────────
function VCCSymbolSVG({ voltage, name }: { voltage?: number; name: string }) {
  const label = voltage ? `${voltage}V` : name;
  return (
    <g>
      <line x1="0" y1="0" x2="0" y2="-12" stroke={C.wirePwr} strokeWidth="1.5" />
      <polygon points="-10,-12 10,-12 0,-26" fill={C.wirePwr} />
      <text x="0" y="-29" textAnchor="middle" fontSize="9" fill={C.wirePwr} fontFamily={FONT} fontWeight="bold">
        {label}
      </text>
    </g>
  );
}

function GNDSymbolSVG({ name }: { name: string }) {
  return (
    <g>
      <line x1="0" y1="0" x2="0" y2="10" stroke={C.wireGnd} strokeWidth="1.5" />
      <line x1="-14" y1="10" x2="14" y2="10" stroke={C.wireGnd} strokeWidth="1.5" />
      <line x1="-9"  y1="16" x2="9"  y2="16" stroke={C.wireGnd} strokeWidth="1.5" />
      <line x1="-4"  y1="22" x2="4"  y2="22" stroke={C.wireGnd} strokeWidth="1.5" />
      <text x="0" y="34" textAnchor="middle" fontSize="8" fill={C.wireGnd} fontFamily={FONT}>{name}</text>
    </g>
  );
}

function NetLabelSVG({ name, netType, direction = "right" }: {
  name: string; netType: string; direction?: "left" | "right";
}) {
  const col = wireColor(netType);
  if (direction === "right") {
    return (
      <g>
        <line x1="-12" y1="0" x2="0" y2="0" stroke={col} strokeWidth="1.5" />
        <polygon points="0,-7 0,7 16,0" fill="none" stroke={col} strokeWidth="1.5" />
        <text x="4" y="4" fontSize="8" fill={col} fontFamily={FONT}>{name}</text>
      </g>
    );
  }
  return (
    <g>
      <line x1="0" y1="0" x2="12" y2="0" stroke={col} strokeWidth="1.5" />
      <polygon points="0,-7 0,7 -16,0" fill="none" stroke={col} strokeWidth="1.5" />
      <text x="-4" y="4" textAnchor="end" fontSize="8" fill={col} fontFamily={FONT}>{name}</text>
    </g>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// FORCE-DIRECTED LAYOUT
// ──────────────────────────────────────────────────────────────────────────────
const CELL_W  = 200;
const CELL_H  = 220;
const SNAP    = 20;
const MARGIN  = 120;

interface PlacedComp {
  id:         string;
  type:       string;
  category:   string;
  pins:       Array<{ name: string; direction: string; type: string; pinNumber?: number }>;
  properties?: Record<string, string>;
  x:          number;
  y:          number;
  col:        number;
  row:        number;
}

function buildLayout(netlist: Netlist): PlacedComp[] {
  const n = netlist.components.length;
  if (n === 0) return [];

  const powerNets = new Set(netlist.nets.filter((n) => n.type === "power").map((n) => n.name));
  const gndNets   = new Set(netlist.nets.filter((n) => n.type === "ground").map((n) => n.name));

  // Score for initial ordering
  const compNets = new Map<string, Set<string>>();
  netlist.components.forEach((c) => compNets.set(c.id, new Set()));
  netlist.connections.forEach((conn) => {
    if (netlist.nets.find((nn) => nn.name === conn.from)) compNets.get(conn.to)?.add(conn.from);
    if (netlist.nets.find((nn) => nn.name === conn.to))   compNets.get(conn.from)?.add(conn.to);
  });

  const scored = netlist.components.map((comp) => {
    const nets  = compNets.get(comp.id) ?? new Set();
    let score   = 0;
    if ([...nets].some((nn) => powerNets.has(nn))) score -= 20;
    if ([...nets].some((nn) => gndNets.has(nn)))   score += 20;
    if (comp.category === "passive")        score += 0;
    if (comp.category === "active_discrete") score += 5;
    if (comp.category === "active_ic")      score += 10;
    if (comp.category === "module")         score += 15;
    if (comp.category === "sensor")         score += 12;
    return { comp, score };
  });

  scored.sort((a, b) => a.score - b.score);

  const cols = Math.max(2, Math.ceil(Math.sqrt(n * 1.2)));

  // Initial grid placement
  const positions = scored.map(({ comp }, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return {
      id:  comp.id,
      x:   MARGIN + col * CELL_W,
      y:   MARGIN + row * CELL_H,
      vx:  0,
      vy:  0,
    };
  });

  // Force-directed repulsion simulation
  const REPULSION  = 12000;
  const DAMPING    = 0.72;
  const ITERATIONS = 80;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = positions.map(() => ({ fx: 0, fy: 0 }));
    const scale  = 1 - iter / (ITERATIONS * 2); // cool down

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const d2 = dx * dx + dy * dy + 100;
        const d  = Math.sqrt(d2);
        const f  = (REPULSION / d2) * scale;
        const fx = (f * dx) / d;
        const fy = (f * dy) / d;
        forces[i].fx += fx;
        forces[i].fy += fy;
        forces[j].fx -= fx;
        forces[j].fy -= fy;
      }
    }

    for (let i = 0; i < positions.length; i++) {
      positions[i].vx = (positions[i].vx + forces[i].fx) * DAMPING;
      positions[i].vy = (positions[i].vy + forces[i].fy) * DAMPING;
      positions[i].x  = Math.max(MARGIN, positions[i].x + positions[i].vx);
      positions[i].y  = Math.max(MARGIN, positions[i].y + positions[i].vy);
    }
  }

  // Snap to grid and assemble
  const posMap = new Map(positions.map((p) => [p.id, p]));
  return scored.map(({ comp }, idx) => {
    const p   = posMap.get(comp.id)!;
    const sx  = Math.round(p.x / SNAP) * SNAP;
    const sy  = Math.round(p.y / SNAP) * SNAP;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return {
      ...comp,
      x: sx,
      y: sy,
      col,
      row,
    };
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// PIN LABEL COMPONENT
// ──────────────────────────────────────────────────────────────────────────────
function PinLabels({
  compType,
  pins,
}: {
  compType: string;
  pins: Array<{ name: string; pinNumber?: number }>;
}) {
  // IC-style components render pin labels internally → skip external labels
  const noExternalLabels = !PIN_ANCHORS[compType];
  if (noExternalLabels) return null;

  return (
    <>
      {pins.map((pin, idx) => {
        const anchor = resolveAnchor(compType, pin.name, pins.map((p) => p.name));
        const dir    = pinDir(anchor);
        const LABEL_OFFSET = 10;

        let tx = anchor.x;
        let ty = anchor.y;
        let textAnchor: "start" | "middle" | "end" = "middle";

        if (dir === "left")  { tx = anchor.x - LABEL_OFFSET; textAnchor = "end"; }
        if (dir === "right") { tx = anchor.x + LABEL_OFFSET; textAnchor = "start"; }
        if (dir === "up")    { ty = anchor.y - LABEL_OFFSET; }
        if (dir === "down")  { ty = anchor.y + LABEL_OFFSET + 4; }

        return (
          <g key={pin.name}>
            {/* Pin name */}
            <text
              x={tx}
              y={ty}
              textAnchor={textAnchor}
              fontSize="7"
              fill={C.labelPin}
              fontFamily={FONT}
            >
              {pin.name}
            </text>
            {/* Pin number (small, at the wire endpoint) */}
            {pin.pinNumber !== undefined && (
              <text
                x={anchor.x}
                y={anchor.y - 5}
                textAnchor="middle"
                fontSize="6"
                fill={C.labelPinNum}
                fontFamily={FONT}
              >
                {pin.pinNumber}
              </text>
            )}
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
  const [zoom, setZoom]         = useState(1);
  const [pan,  setPan]          = useState<Pt>({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [hoveredNet, setHoveredNet] = useState<string | null>(null);
  const isDragging = useRef(false);
  const lastPt     = useRef<Pt>({ x: 0, y: 0 });
  const svgRef     = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const placed = useMemo(() => buildLayout(netlist), [netlist]);

  // Auto-center on new layout
  useEffect(() => {
    if (placed.length === 0) return;
    const xs = placed.map((c) => c.x);
    const ys = placed.map((c) => c.y);
    const minX = Math.min(...xs) - MARGIN;
    const minY = Math.min(...ys) - MARGIN;
    const maxX = Math.max(...xs) + MARGIN;
    const maxY = Math.max(...ys) + MARGIN;
    const bbW  = maxX - minX;
    const bbH  = maxY - minY;

    const cW = containerRef.current?.clientWidth  ?? 800;
    const cH = containerRef.current?.clientHeight ?? 600;

    const scaleX = cW / bbW;
    const scaleY = cH / bbH;
    const newZoom = Math.min(1.4, Math.max(0.3, Math.min(scaleX, scaleY) * 0.85));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(newZoom);
    setPan({
      x: cW  / 2 - centerX * newZoom,
      y: cH  / 2 - centerY * newZoom,
    });
  }, [placed]);

  const compById = useMemo(() => {
    const m = new Map<string, PlacedComp>();
    placed.forEach((c) => m.set(c.id, c));
    return m;
  }, [placed]);

  const netByName = useMemo(() => {
    const m = new Map<string, (typeof netlist.nets)[number]>();
    netlist.nets.forEach((n) => m.set(n.name, n));
    return m;
  }, [netlist.nets]);

  const pinWorld = useCallback(
    (compId: string, pinName: string): Pt | null => {
      const comp = compById.get(compId);
      if (!comp) return null;
      const local = resolveAnchor(comp.type, pinName, comp.pins.map((p) => p.name));
      return { x: comp.x + local.x, y: comp.y + local.y };
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

  // Canvas size
  const maxX  = Math.max(800, ...placed.map((p) => p.x)) + MARGIN * 2;
  const maxY  = Math.max(600, ...placed.map((p) => p.y)) + MARGIN * 2;

  // Interaction handlers
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.2, Math.min(4, z - e.deltaY * 0.001)));
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

  const onMouseUp    = useCallback(() => { isDragging.current = false; }, []);
  const fitToScreen  = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  const exportSVG = useCallback(() => {
    if (!svgRef.current) return;
    const s   = new XMLSerializer();
    const str = s.serializeToString(svgRef.current);
    const blob = new Blob([str], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = "schematic.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Build wire/power/junction data ──────────────────────────────────────────
  interface WireEntry {
    path:    string;
    color:   string;
    netName: string;
    netType: string;
  }
  interface PowerEntry {
    x: number; y: number;
    type: "vcc" | "gnd";
    netName: string;
    voltage?: number;
  }
  interface NetLabelEntry {
    x: number; y: number;
    netName: string;
    netType: string;
  }

  const wires:           WireEntry[]    = [];
  const powerSymbols:    PowerEntry[]   = [];
  const netLabelSymbols: NetLabelEntry[] = [];

  // Track all points each wire passes through to find T-junctions
  const pointCount = new Map<string, { x: number; y: number; color: string; count: number }>();

  function trackPt(x: number, y: number, color: string) {
    const key = `${Math.round(x)},${Math.round(y)}`;
    const ex  = pointCount.get(key);
    if (ex) { ex.count += 1; ex.color = color; }
    else     pointCount.set(key, { x, y, color, count: 1 });
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
      const toPos   = pinWorld(conn.to, conn.toPin);
      if (!fromPos || !toPos) continue;

      const net     = netByName.get(conn.net ?? "");
      const netType = net?.type ?? "signal";
      const color   = wireColor(netType);
      const fd      = pinWorldDir(conn.from, conn.fromPin);
      const td      = pinWorldDir(conn.to, conn.toPin);
      const path    = routeWire(fromPos, fd, toPos, td);

      wires.push({ path, color, netName: conn.net ?? "", netType });
      trackPt(fromPos.x, fromPos.y, color);
      trackPt(toPos.x, toPos.y, color);
    }
  }

  // Junction dots: points shared by 3+ wire ends
  const junctions = [...pointCount.values()].filter((p) => p.count >= 3);

  const selected     = selectedId ? compById.get(selectedId) : null;
  const selectedConns = selectedId
    ? netlist.connections.filter((c) => c.from === selectedId || c.to === selectedId)
    : [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ background: C.bg }}
    >
      {/* ── Toolbar ── */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5" style={{ pointerEvents: "all" }}>
        {[
          { label: "+",          onClick: () => setZoom((z) => Math.min(4, z + 0.2)) },
          { label: "−",          onClick: () => setZoom((z) => Math.max(0.2, z - 0.2)) },
          { label: "⊡ Fit",      onClick: fitToScreen },
          { label: showGrid ? "Grid ●" : "Grid ○", onClick: () => setShowGrid((v) => !v) },
          { label: "↓ SVG",      onClick: exportSVG },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            style={{
              background: "#1F2937",
              border:     "1px solid #374151",
              color:      "#E5E7EB",
              borderRadius: "4px",
              padding:    "3px 8px",
              fontSize:   "10px",
              fontFamily: FONT,
              cursor:     "pointer",
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ fontSize: "9px", color: "#6B7280", fontFamily: FONT, marginLeft: 4 }}>
          {Math.round(zoom * 100)}% · {placed.length} comp
        </span>
      </div>

      {/* ── Selected component details ── */}
      {selected && (
        <div
          className="absolute top-2 right-2 z-20 rounded p-3 text-[10px] font-mono space-y-1.5"
          style={{
            background: "#1F2937EE",
            border:     "1px solid #374151",
            maxWidth:   "210px",
            backdropFilter: "blur(8px)",
            fontFamily: FONT,
            color:      "#E5E7EB",
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
            const net = netByName.get(c.net ?? "");
            return (
              <div key={i} style={{ color: wireColor(net?.type ?? "signal"), fontSize: "9px" }}>
                .{c.from === selectedId ? c.fromPin : c.toPin} → {c.from === selectedId ? c.to : c.from}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Net hover tooltip ── */}
      {hoveredNet && (
        <div
          className="absolute bottom-12 left-2 z-20 px-2 py-1 rounded"
          style={{ background: "#1F2937EE", border: "1px solid #374151", color: "#E5E7EB", fontSize: "9px", fontFamily: FONT }}
        >
          net: <span style={{ color: C.wire }}>{hoveredNet}</span>
        </div>
      )}

      {/* ── Legend ── */}
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
            <div style={{ width: 16, height: 2, background: col, borderRadius: 1 }} />
            <span style={{ color: "#9CA3AF" }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* ── SVG Canvas ── */}
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
        {/* Dot grid */}
        {showGrid && (
          <g>
            {Array.from({ length: Math.ceil(maxX / 20) + 1 }, (_, i) =>
              Array.from({ length: Math.ceil(maxY / 20) + 1 }, (_, j) => (
                <circle key={`${i}-${j}`} cx={i * 20} cy={j * 20} r="0.9" fill={C.gridDot} />
              ))
            )}
          </g>
        )}

        {/* Wires */}
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

        {/* Junction dots (T-junctions ≥3 wires) */}
        {junctions.map((j, i) => (
          <circle key={i} cx={j.x} cy={j.y} r="4" fill={C.junction} />
        ))}

        {/* Power symbols */}
        {powerSymbols.map((sym, i) => (
          <g key={i} transform={`translate(${sym.x},${sym.y})`}>
            {sym.type === "vcc"
              ? <VCCSymbolSVG voltage={sym.voltage} name={sym.netName} />
              : <GNDSymbolSVG name={sym.netName} />
            }
          </g>
        ))}

        {/* Net labels */}
        {netLabelSymbols.map((sym, i) => (
          <g key={i} transform={`translate(${sym.x},${sym.y})`}>
            <NetLabelSVG name={sym.netName} netType={sym.netType} />
          </g>
        ))}

        {/* Components */}
        {placed.map((comp) => {
          const isSelected = comp.id === selectedId;
          const pinNames   = comp.pins.map((p) => p.name);
          const value      = comp.properties?.["value"]
            ?? comp.properties?.["resistance"]
            ?? comp.properties?.["capacitance"]
            ?? comp.properties?.["model"]
            ?? comp.properties?.["color"]
            ?? "";

          return (
            <g
              key={comp.id}
              className="schematic-component"
              transform={`translate(${comp.x},${comp.y})`}
              onClick={() => setSelectedId(comp.id === selectedId ? null : comp.id)}
              style={{ cursor: "pointer" }}
            >
              {/* Selection highlight */}
              {isSelected && (
                <rect
                  x="-40" y="-40" width="80" height="80"
                  rx="5"
                  fill={C.selFill}
                  fillOpacity="0.5"
                  stroke={C.sel}
                  strokeWidth="1.5"
                  strokeDasharray="5,3"
                />
              )}

              {/* Symbol */}
              <CompSymbol type={comp.type} pins={pinNames} properties={comp.properties} />

              {/* Pin labels */}
              <PinLabels
                compType={comp.type}
                pins={comp.pins.map((p) => ({ name: p.name, pinNumber: p.pinNumber }))}
              />

              {/* Ref designator — top-left, bold */}
              <text
                x="-38"
                y="-32"
                textAnchor="start"
                fontSize="10"
                fontWeight="bold"
                fontFamily={FONT}
                fill={isSelected ? C.sel : C.labelRef}
              >
                {comp.id}
              </text>

              {/* Value — bottom-left, smaller */}
              {value && (
                <text
                  x="-38"
                  y="44"
                  textAnchor="start"
                  fontSize="8.5"
                  fontFamily={FONT}
                  fill={C.labelVal}
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
