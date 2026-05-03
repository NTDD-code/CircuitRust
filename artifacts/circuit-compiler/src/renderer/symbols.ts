// ─────────────────────────────────────────────────────────────────────────────
// SYMBOL LIBRARY  —  publication-quality SVG symbols
//
// Style reference: sjgallagher2/SchematicSymbolsSVG (Art of Electronics /
// Analog Devices / IEEE Std 315 style, redrawn for our coordinate space).
//
// Conventions:
//   • All symbols centred at (0, 0)
//   • stroke="currentColor" — renderer controls colour via <g color={…}>
//   • strokeWidth 1.5 (body) · 2 (thick bar/bus)
//   • Diode triangles: fill="currentColor" (solid, AoE style)
//   • BJTs: circle body + bar + slant lines (clearer at schematic scale)
//   • MOSFETs: gate insulation gap + substrate arrow
//   • OpAmp: proper triangle with +/− inside
//   • All pin anchor X/Y are multiples of 20 (grid snap unit)
// ─────────────────────────────────────────────────────────────────────────────

export type PinAnchor = {
  x: number;
  y: number;
  dir: "left" | "right" | "up" | "down";
};

export type SymbolDef = {
  id:   string;
  name: string;
  body: string;
  hw:   number;
  hh:   number;
  pins: Record<string, PinAnchor>;
};

// ─────────────────────────────────────────────────────────────────────────────
// RESISTOR  — ANSI / Analog Devices zigzag (6 peaks)
// ─────────────────────────────────────────────────────────────────────────────
const RESISTOR: SymbolDef = {
  id: "RESISTOR", name: "Resistor",
  hw: 48, hh: 14,
  body: `
    <line x1="-40" y1="0" x2="-18" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <polyline
      points="-18,0 -15,-8 -9,8 -3,-8 3,8 9,-8 15,8 18,0"
      fill="none" stroke="currentColor" stroke-width="1.5"
      stroke-linejoin="round" stroke-linecap="round"/>
    <line x1="18" y1="0" x2="40" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pins: {
    pin1: { x: -40, y: 0, dir: "left"  },
    pin2: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CAPACITOR  — two parallel plates (non-polar)
// ─────────────────────────────────────────────────────────────────────────────
const CAPACITOR: SymbolDef = {
  id: "CAPACITOR", name: "Capacitor",
  hw: 48, hh: 20,
  body: `
    <line x1="-40" y1="0" x2="-5"  y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-5"  y1="-15" x2="-5" y2="15" stroke="currentColor" stroke-width="2"   stroke-linecap="square"/>
    <line x1="5"   y1="-15" x2="5"  y2="15" stroke="currentColor" stroke-width="2"   stroke-linecap="square"/>
    <line x1="5"   y1="0"   x2="40" y2="0"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pins: {
    pin1: { x: -40, y: 0, dir: "left"  },
    pin2: { x:  40, y: 0, dir: "right" },
    pos:  { x: -40, y: 0, dir: "left"  },
    neg:  { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CAPACITOR_POLAR  — flat + plate, curved − plate, + marker
// (IEC / AoE style: curved lower plate indicates polarity)
// ─────────────────────────────────────────────────────────────────────────────
const CAPACITOR_POLAR: SymbolDef = {
  id: "CAPACITOR_POLAR", name: "Electrolytic Capacitor",
  hw: 48, hh: 20,
  body: `
    <line x1="-40" y1="0" x2="-5"  y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-5"  y1="-15" x2="-5" y2="15" stroke="currentColor" stroke-width="2"   stroke-linecap="square"/>
    <path d="M5,-15 Q12,0 5,15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="14"  y1="0"   x2="40" y2="0"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <text x="-16" y="-17" font-size="9" fill="#CC0000" font-family="monospace" text-anchor="middle">+</text>
    <line x1="-12" y1="-12" x2="-8"  y2="-12" stroke="#CC0000" stroke-width="1"/>
    <line x1="-10" y1="-14" x2="-10" y2="-10" stroke="#CC0000" stroke-width="1"/>
  `,
  pins: {
    pos:  { x: -40, y: 0, dir: "left"  },
    neg:  { x:  40, y: 0, dir: "right" },
    pin1: { x: -40, y: 0, dir: "left"  },
    pin2: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INDUCTOR  — 4 semicircular arcs, flat bottom (IEEE Std 315)
// ─────────────────────────────────────────────────────────────────────────────
const INDUCTOR: SymbolDef = {
  id: "INDUCTOR", name: "Inductor",
  hw: 48, hh: 14,
  body: `
    <line x1="-40" y1="0" x2="-20" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M-20,0 A5,6 0 0,1 -10,0 A5,6 0 0,1 0,0 A5,6 0 0,1 10,0 A5,6 0 0,1 20,0"
          fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="20" y1="0" x2="40" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pins: {
    pin1: { x: -40, y: 0, dir: "left"  },
    pin2: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CRYSTAL  — IEEE standard: two lines + box + two lines
// ─────────────────────────────────────────────────────────────────────────────
const CRYSTAL: SymbolDef = {
  id: "CRYSTAL", name: "Crystal",
  hw: 48, hh: 18,
  body: `
    <line x1="-40" y1="0" x2="-16" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-16" y1="-13" x2="-16" y2="13" stroke="currentColor" stroke-width="2"   stroke-linecap="square"/>
    <rect x="-12" y="-10" width="24" height="20" rx="1"
          fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12"  y1="-13" x2="12"  y2="13"  stroke="currentColor" stroke-width="2"   stroke-linecap="square"/>
    <line x1="12"  y1="0"   x2="40"  y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pins: {
    pin1: { x: -40, y: 0, dir: "left"  },
    pin2: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SWITCH / BUTTON  — open-contact style with dot terminals (AoE)
// ─────────────────────────────────────────────────────────────────────────────
const SWITCH: SymbolDef = {
  id: "SWITCH", name: "Switch / Button",
  hw: 48, hh: 22,
  body: `
    <line x1="-40" y1="0" x2="-14" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="-14" cy="0" r="2.5" fill="currentColor"/>
    <line x1="-12"  y1="-2" x2="12" y2="-14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="14"  cy="0" r="2.5" fill="currentColor"/>
    <line x1="14"   y1="0" x2="40"  y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pins: {
    pin1: { x: -40, y: 0, dir: "left"  },
    pin2: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DIODE  — solid filled triangle (Art of Electronics / Analog Devices style)
// ─────────────────────────────────────────────────────────────────────────────
const DIODE: SymbolDef = {
  id: "DIODE", name: "Diode",
  hw: 48, hh: 16,
  body: `
    <line x1="-40" y1="0" x2="-13" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <polygon points="-13,-12 -13,12 13,0"
             fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
    <line x1="13"  y1="-13" x2="13" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="square"/>
    <line x1="13"  y1="0"   x2="40" y2="0"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ZENER DIODE  — solid triangle + Z-bent cathode bar (IEEE)
// ─────────────────────────────────────────────────────────────────────────────
const ZENER_DIODE: SymbolDef = {
  id: "ZENER_DIODE", name: "Zener Diode",
  hw: 48, hh: 18,
  body: `
    <line x1="-40" y1="0" x2="-13" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <polygon points="-13,-12 -13,12 13,0"
             fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
    <line x1="13"  y1="-13" x2="13" y2="13"  stroke="currentColor" stroke-width="2" stroke-linecap="square"/>
    <line x1="9"   y1="-13" x2="13" y2="-13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="13"  y1="13"  x2="17" y2="13"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="13"  y1="0"   x2="40" y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SCHOTTKY DIODE  — solid triangle + S-curve cathode bar
// ─────────────────────────────────────────────────────────────────────────────
const SCHOTTKY_DIODE: SymbolDef = {
  id: "SCHOTTKY_DIODE", name: "Schottky Diode",
  hw: 48, hh: 18,
  body: `
    <line x1="-40" y1="0" x2="-13" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <polygon points="-13,-12 -13,12 13,0"
             fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
    <line x1="13"  y1="-13" x2="13" y2="13"  stroke="currentColor" stroke-width="2" stroke-linecap="square"/>
    <path d="M13,-13 Q11,-13 11,-10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M13,13  Q15,13  15,10"  fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="13"  y1="0"   x2="40" y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TVS DIODE  — solid triangle + capped bar (bidirectional TVS look)
// ─────────────────────────────────────────────────────────────────────────────
const TVS_DIODE: SymbolDef = {
  id: "TVS_DIODE", name: "TVS Diode",
  hw: 48, hh: 20,
  body: `
    <line x1="-40" y1="0" x2="-13" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <polygon points="-13,-12 -13,12 13,0"
             fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
    <line x1="13"  y1="-14" x2="13" y2="14" stroke="currentColor" stroke-width="2"   stroke-linecap="square"/>
    <line x1="9"   y1="-14" x2="13" y2="-14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="13"  y1="14"  x2="17" y2="14"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="9"   y1="14"  x2="13" y2="14"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="17"  y1="-14" x2="13" y2="-14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="13"  y1="0"   x2="40" y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LED  — solid diode triangle + two emission arrows (45°, with arrowheads)
// Arrow colour is replaced at runtime for LED colour variants.
// ─────────────────────────────────────────────────────────────────────────────
const LED: SymbolDef = {
  id: "LED", name: "LED",
  hw: 48, hh: 22,
  body: `
    <line x1="-40" y1="0" x2="-13" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <polygon points="-13,-12 -13,12 13,0"
             fill="__LED_FILL__" fill-opacity="0.85"
             stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
    <line x1="13"  y1="-13" x2="13" y2="13"  stroke="currentColor" stroke-width="2" stroke-linecap="square"/>
    <line x1="13"  y1="0"   x2="40" y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <g stroke="#0055CC" stroke-width="1.2" fill="none">
      <line x1="16" y1="-6"  x2="25" y2="-18" stroke-linecap="round"/>
      <polygon points="25,-18 19,-16 22,-11" fill="#0055CC" stroke="none"/>
      <line x1="22" y1="-2"  x2="31" y2="-14" stroke-linecap="round"/>
      <polygon points="31,-14 25,-12 28,-7"  fill="#0055CC" stroke="none"/>
    </g>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// IR EMITTER  — LED variant, dashed IR arrows (outward)
// ─────────────────────────────────────────────────────────────────────────────
const IR_EMITTER: SymbolDef = {
  id: "IR_EMITTER", name: "IR Emitter",
  hw: 48, hh: 22,
  body: `
    <line x1="-40" y1="0" x2="-13" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <polygon points="-13,-12 -13,12 13,0"
             fill="#EDE9FE" fill-opacity="0.7"
             stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
    <line x1="13"  y1="-13" x2="13" y2="13"  stroke="currentColor" stroke-width="2" stroke-linecap="square"/>
    <line x1="13"  y1="0"   x2="40" y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <g stroke="#7C3AED" stroke-width="1.2" stroke-dasharray="3,2" fill="none">
      <line x1="16" y1="-6"  x2="25" y2="-18" stroke-linecap="round"/>
      <polygon points="25,-18 19,-16 22,-11" fill="#7C3AED" stroke="none" stroke-dasharray="none"/>
      <line x1="22" y1="-2"  x2="31" y2="-14" stroke-linecap="round"/>
      <polygon points="31,-14 25,-12 28,-7"  fill="#7C3AED" stroke="none" stroke-dasharray="none"/>
    </g>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// IR DETECTOR  — IR photodiode, dashed arrows pointing inward
// ─────────────────────────────────────────────────────────────────────────────
const IR_DETECTOR: SymbolDef = {
  id: "IR_DETECTOR", name: "IR Detector",
  hw: 48, hh: 22,
  body: `
    <line x1="-40" y1="0" x2="-13" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <polygon points="-13,-12 -13,12 13,0"
             fill="#F5F3FF" fill-opacity="0.7"
             stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
    <line x1="13"  y1="-13" x2="13" y2="13"  stroke="currentColor" stroke-width="2" stroke-linecap="square"/>
    <line x1="13"  y1="0"   x2="40" y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <g stroke="#7C3AED" stroke-width="1.2" stroke-dasharray="3,2" fill="none">
      <line x1="28" y1="-20" x2="19" y2="-8"  stroke-linecap="round"/>
      <polygon points="19,-8 21,-14 26,-12"  fill="#7C3AED" stroke="none" stroke-dasharray="none"/>
      <line x1="34" y1="-16" x2="25" y2="-4"  stroke-linecap="round"/>
      <polygon points="25,-4  27,-10 32,-8"   fill="#7C3AED" stroke="none" stroke-dasharray="none"/>
    </g>
  `,
  pins: {
    anode:   { x: -40, y: 0, dir: "left"  },
    cathode: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// NPN BJT  — circle body, base bar, collector/emitter slants, emitter arrow
// Proportions: Art of Electronics / Linear Technology style
// ─────────────────────────────────────────────────────────────────────────────
const TRANSISTOR_NPN: SymbolDef = {
  id: "TRANSISTOR_NPN", name: "NPN BJT",
  hw: 48, hh: 48,
  body: `
    <circle cx="4" cy="0" r="26" fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="-40" y1="0" x2="-12" y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-12" y1="-20" x2="-12" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"/>
    <line x1="-12" y1="-12" x2="22"  y2="-32" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-12" y1="12"  x2="22"  y2="32"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <polygon points="22,32 13,27 18,22" fill="currentColor" stroke="none"/>
    <line x1="22"  y1="-32" x2="40" y2="-40" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="22"  y1="32"  x2="40" y2="40"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pins: {
    base:      { x: -40, y:   0, dir: "left"  },
    collector: { x:  40, y: -40, dir: "right" },
    emitter:   { x:  40, y:  40, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PNP BJT  — same as NPN but emitter arrow on the collector line
// ─────────────────────────────────────────────────────────────────────────────
const TRANSISTOR_PNP: SymbolDef = {
  id: "TRANSISTOR_PNP", name: "PNP BJT",
  hw: 48, hh: 48,
  body: `
    <circle cx="4" cy="0" r="26" fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="-40" y1="0" x2="-12" y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-12" y1="-20" x2="-12" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"/>
    <line x1="-12" y1="-12" x2="22"  y2="-32" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-12" y1="12"  x2="22"  y2="32"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <polygon points="-12,-12 -4,-17 -3,-10" fill="currentColor" stroke="none"/>
    <line x1="22"  y1="-32" x2="40" y2="-40" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="22"  y1="32"  x2="40" y2="40"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pins: {
    base:      { x: -40, y:   0, dir: "left"  },
    collector: { x:  40, y: -40, dir: "right" },
    emitter:   { x:  40, y:  40, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// N-CHANNEL MOSFET  — gate insulation gap, channel segments, substrate+arrow
// Matches Art of Electronics / AoE 3ed style
// ─────────────────────────────────────────────────────────────────────────────
const MOSFET_N: SymbolDef = {
  id: "MOSFET_N", name: "N-Channel MOSFET",
  hw: 48, hh: 48,
  body: `
    <circle cx="4" cy="0" r="26" fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="-40" y1="0"   x2="-14" y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-14" y1="-20" x2="-14" y2="20"  stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/>
    <line x1="-10" y1="-20" x2="-10" y2="-7"  stroke="currentColor" stroke-width="2"   stroke-linecap="square"/>
    <line x1="-10" y1="7"   x2="-10" y2="20"  stroke="currentColor" stroke-width="2"   stroke-linecap="square"/>
    <line x1="-10" y1="0"   x2="6"   y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-10" y1="-14" x2="22"  y2="-32" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-10" y1="14"  x2="22"  y2="32"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <polygon points="2,0 -6,-4 -6,4" fill="currentColor" stroke="none"/>
    <line x1="22"  y1="-32" x2="40" y2="-40"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="22"  y1="32"  x2="40" y2="40"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <text x="14" y="-4" font-size="7" fill="#555" text-anchor="middle" font-family="monospace">N</text>
  `,
  pins: {
    gate:   { x: -40, y:   0, dir: "left"  },
    drain:  { x:  40, y: -40, dir: "right" },
    source: { x:  40, y:  40, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// P-CHANNEL MOSFET  — same layout, substrate arrow reversed
// ─────────────────────────────────────────────────────────────────────────────
const MOSFET_P: SymbolDef = {
  id: "MOSFET_P", name: "P-Channel MOSFET",
  hw: 48, hh: 48,
  body: `
    <circle cx="4" cy="0" r="26" fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="-40" y1="0"   x2="-14" y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-14" y1="-20" x2="-14" y2="20"  stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/>
    <line x1="-10" y1="-20" x2="-10" y2="-7"  stroke="currentColor" stroke-width="2"   stroke-linecap="square"/>
    <line x1="-10" y1="7"   x2="-10" y2="20"  stroke="currentColor" stroke-width="2"   stroke-linecap="square"/>
    <line x1="-10" y1="0"   x2="6"   y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-10" y1="-14" x2="22"  y2="-32" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-10" y1="14"  x2="22"  y2="32"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <polygon points="-8,0 0,-4 0,4" fill="currentColor" stroke="none"/>
    <line x1="22"  y1="-32" x2="40" y2="-40"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="22"  y1="32"  x2="40" y2="40"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <text x="14" y="-4" font-size="7" fill="#555" text-anchor="middle" font-family="monospace">P</text>
  `,
  pins: {
    gate:   { x: -40, y:   0, dir: "left"  },
    drain:  { x:  40, y: -40, dir: "right" },
    source: { x:  40, y:  40, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// OPAMP  — proper triangle body with +/− pin labels (Art of Electronics style)
// Inputs on left side, output at right vertex
// ─────────────────────────────────────────────────────────────────────────────
const OPAMP: SymbolDef = {
  id: "OPAMP", name: "Op-Amp",
  hw: 48, hh: 40,
  body: `
    <polygon points="-28,-28 -28,28 28,0"
             fill="white" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <line x1="-40" y1="-16" x2="-28" y2="-16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-40" y1="16"  x2="-28" y2="16"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="28"  y1="0"   x2="40"  y2="0"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-22" y1="-16" x2="-14" y2="-16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-22" y1="16"  x2="-14" y2="16"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-18" y1="12"  x2="-18" y2="20"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <text x="-10" y="-12" font-size="9" fill="#333" text-anchor="start" font-family="monospace">−</text>
    <text x="-10" y="20"  font-size="9" fill="#333" text-anchor="start" font-family="monospace">+</text>
  `,
  pins: {
    in_minus: { x: -40, y: -20, dir: "left"  },
    in_plus:  { x: -40, y:  20, dir: "left"  },
    out:      { x:  40, y:   0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR  — circle with M label (IEC 60617)
// ─────────────────────────────────────────────────────────────────────────────
const MOTOR: SymbolDef = {
  id: "MOTOR", name: "DC Motor",
  hw: 48, hh: 40,
  body: `
    <circle cx="0" cy="0" r="24" fill="white" stroke="currentColor" stroke-width="1.5"/>
    <text x="0" y="7" text-anchor="middle" font-size="16" font-weight="bold"
          fill="currentColor" font-family="monospace">M</text>
    <line x1="-40" y1="0" x2="-24" y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="24"  y1="0" x2="40"  y2="0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pins: {
    m_pos: { x: -40, y: 0, dir: "left"  },
    m_neg: { x:  40, y: 0, dir: "right" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BUZZER  — box body with sound-wave arcs (concentric quarter-circles)
// ─────────────────────────────────────────────────────────────────────────────
const BUZZER: SymbolDef = {
  id: "BUZZER", name: "Buzzer",
  hw: 44, hh: 44,
  body: `
    <rect x="-14" y="-20" width="28" height="40" rx="2"
          fill="white" stroke="currentColor" stroke-width="1.5"/>
    <path d="M14,-12 Q26,-12 26,0 Q26,12 14,12"
          fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M14,-20 Q34,-20 34,0 Q34,20 14,20"
          fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="0" y1="-20" x2="0" y2="-40" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="0" y1="20"  x2="0" y2="40"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <text x="-18" y="-21" font-size="9" fill="#CC0000" font-family="monospace">+</text>
  `,
  pins: {
    vcc: { x: 0, y: -40, dir: "up"   },
    gnd: { x: 0, y:  40, dir: "down" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RELAY  — coil box (left) + SPDT switch (right)
// Coil represented as a rectangle with zigzag, contacts as circles
// ─────────────────────────────────────────────────────────────────────────────
const RELAY: SymbolDef = {
  id: "RELAY", name: "Relay",
  hw: 48, hh: 40,
  body: `
    <rect x="-30" y="-22" width="22" height="44" rx="2"
          fill="white" stroke="currentColor" stroke-width="1.5"/>
    <polyline points="-27,-14 -24,-8 -21,-14 -18,-8 -15,-14 -12,-8 -9,-14"
              fill="none" stroke="currentColor" stroke-width="1.5"
              stroke-linejoin="round" stroke-linecap="round"/>
    <line x1="-40" y1="-20" x2="-30" y2="-20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-40" y1="20"  x2="-30" y2="20"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-8"  y1="-20" x2="8"   y2="-20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="8" cy="-20" r="2.5" fill="currentColor"/>
    <circle cx="8" cy="0"   r="2.5" fill="white" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="8" cy="20"  r="2.5" fill="white" stroke="currentColor" stroke-width="1.5"/>
    <line x1="8"   y1="-18" x2="18"  y2="-4"   stroke="currentColor" stroke-width="2"   stroke-linecap="round"/>
    <line x1="8"   y1="-20" x2="40"  y2="-20"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="8"   y1="0"   x2="40"  y2="0"    stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="8"   y1="20"  x2="40"  y2="20"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pins: {
    coil_a: { x: -40, y: -20, dir: "left"  },
    coil_b: { x: -40, y:  20, dir: "left"  },
    com:    { x:  40, y: -20, dir: "right" },
    no:     { x:  40, y:   0, dir: "right" },
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
  OPAMP,
  MOTOR,
  BUZZER,
  RELAY,
};

export function getSymbol(symbolId: string): SymbolDef | undefined {
  return SYMBOL_LIBRARY[symbolId];
}
