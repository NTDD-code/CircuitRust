// ─────────────────────────────────────────────────────────────────────────────
// SYMBOL LIBRARY  —  IEEE/IEC standard SVG paths
//
// All symbols are drawn on a local coordinate system centred at (0, 0).
// Pin anchor points are defined alongside each symbol so the renderer can
// connect wires to the exact same spot every time — no magic offsets elsewhere.
//
// Conventions:
//   • Every path uses only M / L / H / V / A / Z commands (no cubic bezier)
//   • Stroke colour is applied by the renderer via `currentColor`
//   • Fill is "none" by default; explicit fills are encoded as separate rects/polys
//   • All pin anchor X/Y values are multiples of 20 (the grid snap unit)
// ─────────────────────────────────────────────────────────────────────────────

export type PinAnchor = {
  x: number;
  y: number;
  dir: "left" | "right" | "up" | "down";
};

export type SymbolDef = {
  /** Unique id referenced by componentRegistry */
  id: string;
  /** Human-readable name */
  name: string;
  /**
   * SVG elements encoded as a plain string so the renderer can inject them
   * inside a <g> without parsing overhead.  Uses `currentColor` for stroke.
   */
  body: string;
  /** Half-width and half-height of the bounding box (for obstacle avoidance) */
  hw: number;
  hh: number;
  /** Named pin anchor points relative to symbol centre */
  pins: Record<string, PinAnchor>;
};

// ─────────────────────────────────────────────────────────────────────────────
// PASSIVE SYMBOLS
// ─────────────────────────────────────────────────────────────────────────────

const RESISTOR: SymbolDef = {
  id: "RESISTOR",
  name: "Resistor",
  hw: 48, hh: 16,
  body: `
    <line x1="-40" y1="0" x2="-20" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <polyline points="-20,0 -15,-8 -8,8 0,-8 8,8 15,-8 20,0"
              fill="none" stroke="currentColor" stroke-width="1.5"/>
    <line x1="20" y1="0" x2="40" y2="0" stroke="currentColor" stroke-width="1.5"/>
  `,
  pins: {
    pin1: { x: -40, y: 0, dir: "left"  },
    pin2: { x:  40, y: 0, dir: "right" },
  },
};

const CAPACITOR: SymbolDef = {
  id: "CAPACITOR",
  name: "Capacitor",
  hw: 48, hh: 20,
  body: `
    <line x1="-40" y1="0" x2="-6" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <line x1="-6" y1="-16" x2="-6" y2="16" stroke="currentColor" stroke-width="2"/>
    <line x1="6"  y1="-16" x2="6"  y2="16" stroke="currentColor" stroke-width="2"/>
    <line x1="6"  y1="0"   x2="40" y2="0"  stroke="currentColor" stroke-width="1.5"/>
  `,
  pins: {
    pin1: { x: -40, y: 0, dir: "left"  },
    pin2: { x:  40, y: 0, dir: "right" },
    pos:  { x: -40, y: 0, dir: "left"  },
    neg:  { x:  40, y: 0, dir: "right" },
  },
};

const CAPACITOR_POLAR: SymbolDef = {
  id: "CAPACITOR_POLAR",
  name: "Electrolytic Capacitor",
  hw: 48, hh: 20,
  body: `
    <line x1="-40" y1="0" x2="-6" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <path d="M-6,-16 Q2,-16 2,0 Q2,16 -6,16"
          fill="none" stroke="currentColor" stroke-width="1.5"/>
    <line x1="6"  y1="-16" x2="6"  y2="16" stroke="currentColor" stroke-width="2"/>
    <line x1="6"  y1="0"   x2="40" y2="0"  stroke="currentColor" stroke-width="1.5"/>
    <text x="-16" y="-18" font-size="9" fill="#FF0000"
          text-anchor="middle" font-family="monospace">+</text>
  `,
  pins: {
    pos: { x: -40, y: 0, dir: "left"  },
    neg: { x:  40, y: 0, dir: "right" },
    pin1: { x: -40, y: 0, dir: "left"  },
    pin2: { x:  40, y: 0, dir: "right" },
  },
};

const INDUCTOR: SymbolDef = {
  id: "INDUCTOR",
  name: "Inductor",
  hw: 48, hh: 14,
  body: `
    <line x1="-40" y1="0" x2="-20" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <path d="M-20,0 A5,5 0 0,1 -10,0 A5,5 0,0,1 0,0 A5,5 0,0,1 10,0 A5,5 0,0,1 20,0"
          fill="none" stroke="currentColor" stroke-width="1.5"/>
    <line x1="20" y1="0" x2="40" y2="0" stroke="currentColor" stroke-width="1.5"/>
  `,
  pins: {
    pin1: { x: -40, y: 0, dir: "left"  },
    pin2: { x:  40, y: 0, dir: "right" },
  },
};

const CRYSTAL: SymbolDef = {
  id: "CRYSTAL",
  name: "Crystal",
  hw: 48, hh: 18,
  body: `
    <line x1="-40" y1="0" x2="-16" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <line x1="-16" y1="-14" x2="-16" y2="14" stroke="currentColor" stroke-width="1.5"/>
    <rect x="-12" y="-12" width="24" height="24" rx="1"
          fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="-14" x2="12" y2="14" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="0" x2="40" y2="0" stroke="currentColor" stroke-width="1.5"/>
  `,
  pins: {
    pin1: { x: -40, y: 0, dir: "left"  },
    pin2: { x:  40, y: 0, dir: "right" },
  },
};

const SWITCH: SymbolDef = {
  id: "SWITCH",
  name: "Switch / Button",
  hw: 48, hh: 20,
  body: `
    <line x1="-40" y1="0" x2="-14" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="-14" cy="0" r="3" fill="currentColor"/>
    <line x1="-12" y1="-6" x2="12" y2="-16" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="14" cy="0" r="3" fill="currentColor"/>
    <line x1="14" y1="0" x2="40" y2="0" stroke="currentColor" stroke-width="1.5"/>
  `,
  pins: {
    pin1: { x: -40, y: 0, dir: "left"  },
    pin2: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DIODE FAMILY
// ─────────────────────────────────────────────────────────────────────────────

const DIODE: SymbolDef = {
  id: "DIODE",
  name: "Diode",
  hw: 48, hh: 16,
  body: `
    <line x1="-40" y1="0" x2="-14" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <polygon points="-14,-12 -14,12 12,0"
             fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="-12" x2="12" y2="12" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="0" x2="40" y2="0" stroke="currentColor" stroke-width="1.5"/>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

const ZENER_DIODE: SymbolDef = {
  id: "ZENER_DIODE",
  name: "Zener Diode",
  hw: 48, hh: 18,
  body: `
    <line x1="-40" y1="0" x2="-14" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <polygon points="-14,-12 -14,12 12,0"
             fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="-12" x2="12" y2="12" stroke="currentColor" stroke-width="1.5"/>
    <path d="M12,-12 L16,-8 M12,12 L8,8"
          stroke="currentColor" stroke-width="1.5" fill="none"/>
    <line x1="12" y1="0" x2="40" y2="0" stroke="currentColor" stroke-width="1.5"/>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

const SCHOTTKY_DIODE: SymbolDef = {
  id: "SCHOTTKY_DIODE",
  name: "Schottky Diode",
  hw: 48, hh: 18,
  body: `
    <line x1="-40" y1="0" x2="-14" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <polygon points="-14,-12 -14,12 12,0"
             fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="-12" x2="12" y2="12" stroke="currentColor" stroke-width="1.5"/>
    <path d="M12,-12 Q14,-12 14,-9 M12,12 Q10,12 10,9"
          stroke="currentColor" stroke-width="1.5" fill="none"/>
    <line x1="12" y1="0" x2="40" y2="0" stroke="currentColor" stroke-width="1.5"/>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

const TVS_DIODE: SymbolDef = {
  id: "TVS_DIODE",
  name: "TVS Diode",
  hw: 48, hh: 20,
  body: `
    <line x1="-40" y1="0" x2="-14" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <polygon points="-14,-12 -14,12 12,0"
             fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="-14" x2="12" y2="14" stroke="currentColor" stroke-width="1.5"/>
    <line x1="8"  y1="-14" x2="16" y2="-14" stroke="currentColor" stroke-width="1.5"/>
    <line x1="8"  y1="14"  x2="16" y2="14"  stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="0" x2="40" y2="0" stroke="currentColor" stroke-width="1.5"/>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

const LED: SymbolDef = {
  id: "LED",
  name: "LED",
  hw: 48, hh: 20,
  body: `
    <defs>
      <marker id="sym-led-arr" markerWidth="5" markerHeight="5"
              refX="5" refY="2.5" orient="auto">
        <path d="M0,0 L5,2.5 L0,5 Z" fill="#0000FF" stroke="none"/>
      </marker>
    </defs>
    <line x1="-40" y1="0" x2="-14" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <polygon points="-14,-12 -14,12 12,0"
             fill="__LED_FILL__" fill-opacity="0.4"
             stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="-12" x2="12" y2="12" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="0" x2="40" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <line x1="14" y1="-8" x2="26" y2="-20"
          stroke="#0000FF" marker-end="url(#sym-led-arr)"/>
    <line x1="20" y1="-4" x2="32" y2="-16"
          stroke="#0000FF" marker-end="url(#sym-led-arr)"/>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

const IR_EMITTER: SymbolDef = {
  id: "IR_EMITTER",
  name: "IR Emitter",
  hw: 48, hh: 20,
  body: `
    <defs>
      <marker id="sym-ir-out" markerWidth="5" markerHeight="5"
              refX="5" refY="2.5" orient="auto">
        <path d="M0,0 L5,2.5 L0,5 Z" fill="#7C3AED" stroke="none"/>
      </marker>
    </defs>
    <line x1="-40" y1="0" x2="-14" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <polygon points="-14,-12 -14,12 12,0"
             fill="#EDE9FE" fill-opacity="0.5"
             stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="-12" x2="12" y2="12" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="0" x2="40" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <line x1="14" y1="-8" x2="26" y2="-20"
          stroke="#7C3AED" stroke-dasharray="3,1.5"
          marker-end="url(#sym-ir-out)"/>
    <line x1="20" y1="-4" x2="32" y2="-16"
          stroke="#7C3AED" stroke-dasharray="3,1.5"
          marker-end="url(#sym-ir-out)"/>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

const IR_DETECTOR: SymbolDef = {
  id: "IR_DETECTOR",
  name: "IR Detector",
  hw: 48, hh: 20,
  body: `
    <defs>
      <marker id="sym-ir-in" markerWidth="5" markerHeight="5"
              refX="5" refY="2.5" orient="auto">
        <path d="M0,0 L5,2.5 L0,5 Z" fill="#7C3AED" stroke="none"/>
      </marker>
    </defs>
    <line x1="-40" y1="0" x2="-14" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <polygon points="-14,-12 -14,12 12,0"
             fill="#F5F3FF" fill-opacity="0.5"
             stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="-12" x2="12" y2="12" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="0" x2="40" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <line x1="30" y1="-20" x2="18" y2="-8"
          stroke="#7C3AED" stroke-dasharray="3,1.5"
          marker-end="url(#sym-ir-in)"/>
    <line x1="36" y1="-16" x2="24" y2="-4"
          stroke="#7C3AED" stroke-dasharray="3,1.5"
          marker-end="url(#sym-ir-in)"/>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSISTOR FAMILY
// ─────────────────────────────────────────────────────────────────────────────

const TRANSISTOR_NPN: SymbolDef = {
  id: "TRANSISTOR_NPN",
  name: "NPN BJT",
  hw: 48, hh: 48,
  body: `
    <circle cx="0" cy="0" r="28" fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="-40" y1="0" x2="-16" y2="0"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-16" y1="-22" x2="-16" y2="22"
          stroke="currentColor" stroke-width="2.5"/>
    <line x1="-16" y1="-13" x2="24" y2="-34"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-16" y1="13"  x2="24" y2="34"
          stroke="currentColor" stroke-width="1.5"/>
    <polygon points="14,26 26,36 20,40" fill="currentColor" stroke="none"/>
    <line x1="24" y1="-34" x2="40" y2="-40"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="24" y1="34"  x2="40" y2="40"
          stroke="currentColor" stroke-width="1.5"/>
    <text x="8" y="-8" font-size="7" fill="#555555"
          font-family="monospace">C</text>
    <text x="8" y="16" font-size="7" fill="#555555"
          font-family="monospace">E</text>
  `,
  pins: {
    base:      { x: -40, y:   0, dir: "left"  },
    collector: { x:  40, y: -40, dir: "right" },
    emitter:   { x:  40, y:  40, dir: "right" },
  },
};

const TRANSISTOR_PNP: SymbolDef = {
  id: "TRANSISTOR_PNP",
  name: "PNP BJT",
  hw: 48, hh: 48,
  body: `
    <circle cx="0" cy="0" r="28" fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="-40" y1="0" x2="-16" y2="0"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-16" y1="-22" x2="-16" y2="22"
          stroke="currentColor" stroke-width="2.5"/>
    <line x1="-16" y1="-13" x2="24" y2="-34"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-16" y1="13"  x2="24" y2="34"
          stroke="currentColor" stroke-width="1.5"/>
    <polygon points="-6,-10 -16,-13 -12,-6" fill="currentColor" stroke="none"/>
    <line x1="24" y1="-34" x2="40" y2="-40"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="24" y1="34"  x2="40" y2="40"
          stroke="currentColor" stroke-width="1.5"/>
  `,
  pins: {
    base:      { x: -40, y:   0, dir: "left"  },
    collector: { x:  40, y: -40, dir: "right" },
    emitter:   { x:  40, y:  40, dir: "right" },
  },
};

const MOSFET_N: SymbolDef = {
  id: "MOSFET_N",
  name: "N-Channel MOSFET",
  hw: 48, hh: 48,
  body: `
    <circle cx="0" cy="0" r="28" fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="-40" y1="0" x2="-14" y2="0"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-14" y1="-22" x2="-14" y2="22"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-10" y1="-22" x2="-10" y2="-6"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-10" y1="6"   x2="-10" y2="22"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-10" y1="-13" x2="22" y2="-32"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-10" y1="13"  x2="22" y2="32"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-10" y1="0"   x2="4"  y2="0"
          stroke="currentColor" stroke-width="1.5"/>
    <polygon points="12,24 24,32 20,38" fill="currentColor" stroke="none"/>
    <line x1="22" y1="-32" x2="40" y2="-40"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="22" y1="32"  x2="40" y2="40"
          stroke="currentColor" stroke-width="1.5"/>
    <text x="2" y="4" font-size="7" fill="#555555"
          text-anchor="middle" font-family="monospace">N</text>
  `,
  pins: {
    gate:   { x: -40, y:   0, dir: "left"  },
    drain:  { x:  40, y: -40, dir: "right" },
    source: { x:  40, y:  40, dir: "right" },
  },
};

const MOSFET_P: SymbolDef = {
  id: "MOSFET_P",
  name: "P-Channel MOSFET",
  hw: 48, hh: 48,
  body: `
    <circle cx="0" cy="0" r="28" fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="-40" y1="0" x2="-14" y2="0"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-14" y1="-22" x2="-14" y2="22"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-10" y1="-22" x2="-10" y2="-6"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-10" y1="6"   x2="-10" y2="22"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-10" y1="-13" x2="22" y2="-32"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-10" y1="13"  x2="22" y2="32"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="-10" y1="0"   x2="4"  y2="0"
          stroke="currentColor" stroke-width="1.5"/>
    <polygon points="-4,-12 -12,-10 -8,-4" fill="currentColor" stroke="none"/>
    <line x1="22" y1="-32" x2="40" y2="-40"
          stroke="currentColor" stroke-width="1.5"/>
    <line x1="22" y1="32"  x2="40" y2="40"
          stroke="currentColor" stroke-width="1.5"/>
    <text x="2" y="4" font-size="7" fill="#555555"
          text-anchor="middle" font-family="monospace">P</text>
  `,
  pins: {
    gate:   { x: -40, y:   0, dir: "left"  },
    drain:  { x:  40, y: -40, dir: "right" },
    source: { x:  40, y:  40, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTUATOR / ELECTROMECHANICAL
// ─────────────────────────────────────────────────────────────────────────────

const MOTOR: SymbolDef = {
  id: "MOTOR",
  name: "DC Motor",
  hw: 48, hh: 40,
  body: `
    <circle cx="0" cy="0" r="26" fill="white" stroke="currentColor" stroke-width="1.5"/>
    <text x="0" y="6" text-anchor="middle" font-size="15" font-weight="bold"
          fill="currentColor" font-family="monospace">M</text>
    <line x1="-40" y1="0" x2="-26" y2="0" stroke="currentColor" stroke-width="1.5"/>
    <line x1="26"  y1="0" x2="40"  y2="0" stroke="currentColor" stroke-width="1.5"/>
  `,
  pins: {
    m_pos: { x: -40, y: 0, dir: "left"  },
    m_neg: { x:  40, y: 0, dir: "right" },
  },
};

const BUZZER: SymbolDef = {
  id: "BUZZER",
  name: "Buzzer",
  hw: 40, hh: 48,
  body: `
    <rect x="-14" y="-22" width="28" height="20" rx="2"
          fill="white" stroke="currentColor" stroke-width="1.5"/>
    <path d="M14,-32 Q34,-32 34,-12 Q34,8 14,8"
          fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M14,-22 Q24,-22 24,-12 Q24,-2 14,-2"
          fill="none" stroke="currentColor" stroke-width="1.5"/>
    <line x1="0" y1="-22" x2="0" y2="-40" stroke="currentColor" stroke-width="1.5"/>
    <line x1="0" y1="-2"  x2="0" y2="40"  stroke="currentColor" stroke-width="1.5"/>
    <text x="-4" y="-26" font-size="8" fill="#FF0000"
          font-family="monospace">+</text>
  `,
  pins: {
    vcc: { x: 0, y: -40, dir: "up"   },
    gnd: { x: 0, y:  40, dir: "down" },
  },
};

const RELAY: SymbolDef = {
  id: "RELAY",
  name: "Relay",
  hw: 48, hh: 40,
  body: `
    <rect x="-28" y="-28" width="28" height="56" rx="2"
          fill="white" stroke="currentColor" stroke-width="1.5"/>
    <path d="M-22,-14 Q-16,-14 -16,-7 Q-16,0 -22,0 Q-16,0 -16,7 Q-16,14 -22,14"
          fill="none" stroke="currentColor" stroke-width="1.5"/>
    <line x1="-40" y1="-20" x2="-28" y2="-20" stroke="currentColor" stroke-width="1.5"/>
    <line x1="-40" y1="20"  x2="-28" y2="20"  stroke="currentColor" stroke-width="1.5"/>
    <line x1="0"   y1="0"   x2="40"  y2="0"   stroke="currentColor" stroke-width="1.5"/>
    <line x1="0"   y1="-20" x2="40"  y2="-20" stroke="currentColor" stroke-width="1.5"/>
    <line x1="0"   y1="20"  x2="40"  y2="20"  stroke="currentColor" stroke-width="1.5"/>
    <circle cx="4" cy="-20" r="3" fill="currentColor"/>
    <line x1="4" y1="-20" x2="18" y2="-8"
          stroke="currentColor" stroke-width="2"/>
    <circle cx="18" cy="0"  r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="18" cy="20" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
  `,
  pins: {
    coil_a: { x: -40, y: -20, dir: "left"  },
    coil_b: { x: -40, y:  20, dir: "left"  },
    com:    { x:  40, y:   0, dir: "right" },
    no:     { x:  40, y: -20, dir: "right" },
    nc:     { x:  40, y:  20, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MASTER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const SYMBOL_LIBRARY: Record<string, SymbolDef> = {
  RESISTOR,
  CAPACITOR,
  CAPACITOR_POLAR,
  INDUCTOR,
  CRYSTAL,
  SWITCH,
  DIODE,
  ZENER_DIODE,
  SCHOTTKY_DIODE,
  TVS_DIODE,
  LED,
  IR_EMITTER,
  IR_DETECTOR,
  TRANSISTOR_NPN,
  TRANSISTOR_PNP,
  MOSFET_N,
  MOSFET_P,
  MOTOR,
  BUZZER,
  RELAY,
};

/**
 * Look up a SymbolDef by symbolId.
 * Returns undefined for IC-type components (they are rendered dynamically).
 */
export function getSymbol(symbolId: string): SymbolDef | undefined {
  return SYMBOL_LIBRARY[symbolId];
}
