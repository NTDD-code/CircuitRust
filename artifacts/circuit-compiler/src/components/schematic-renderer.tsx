import { useState, useRef, useCallback, useMemo } from "react";
import type { Netlist } from "@workspace/api-client-react";

// ──────────────────────────────────────────────────────────
// COLORS
// ──────────────────────────────────────────────────────────
const C = {
  bg: "#0d1117",
  gridDot: "#21262d",
  sym: "#c9d1d9",
  symFill: "#0d1117",
  labelPri: "#e6edf3",
  labelSec: "#8b949e",
  vcc: "#ff7b7b",
  gnd: "#8b949e",
  sig: "#3fb950",
  pwm: "#b48ede",
  analog: "#58a6ff",
  sel: "#f0883e",
};

function wireColor(netType: string) {
  if (netType === "power") return C.vcc;
  if (netType === "ground") return C.gnd;
  if (netType === "signal") return C.sig;
  return C.sig;
}

// ──────────────────────────────────────────────────────────
// PIN ANCHOR POSITIONS (relative to component center 0,0)
// ──────────────────────────────────────────────────────────
type Pt = { x: number; y: number };

const PIN_ANCHORS: Record<string, Record<string, Pt>> = {
  Resistor:     { pin1: { x: -28, y: 0  }, pin2: { x: 28, y: 0  } },
  Capacitor:    { pin1: { x: -28, y: 0  }, pin2: { x: 28, y: 0  }, pos: { x: -28, y: 0 }, neg: { x: 28, y: 0 } },
  Inductor:     { pin1: { x: -28, y: 0  }, pin2: { x: 28, y: 0  } },
  Button:       { pin1: { x: -28, y: 0  }, pin2: { x: 28, y: 0  } },
  Switch:       { pin1: { x: -28, y: 0  }, pin2: { x: 28, y: 0  } },
  Crystal:      { pin1: { x: -28, y: 0  }, pin2: { x: 28, y: 0  } },
  LED:          { anode: { x: -28, y: 0 }, cathode: { x: 28, y: 0 } },
  Diode:        { anode: { x: -28, y: 0 }, cathode: { x: 28, y: 0 } },
  ZenerDiode:   { anode: { x: -28, y: 0 }, cathode: { x: 28, y: 0 } },
  SchottkyDiode:{ anode: { x: -28, y: 0 }, cathode: { x: 28, y: 0 } },
  TVSDiode:     { anode: { x: -28, y: 0 }, cathode: { x: 28, y: 0 } },
  NPN: { base: { x: -28, y: 0 }, collector: { x: 22, y: -26 }, emitter: { x: 22, y: 26 } },
  PNP: { base: { x: -28, y: 0 }, collector: { x: 22, y: -26 }, emitter: { x: 22, y: 26 } },
  NMOSFET: { gate: { x: -28, y: 0 }, drain: { x: 22, y: -26 }, source: { x: 22, y: 26 } },
  PMOSFET: { gate: { x: -28, y: 0 }, drain: { x: 22, y: -26 }, source: { x: 22, y: 26 } },
  Buzzer: { vcc: { x: -28, y: -12 }, gnd_pin: { x: -28, y: 12 } },
};

function getICAnchors(pins: string[]): Record<string, Pt> {
  const left  = pins.filter((_, i) => i % 2 === 0);
  const right = pins.filter((_, i) => i % 2 !== 0);
  const h = Math.max(left.length, right.length) * 16 + 8;
  const halfH = h / 2;
  const out: Record<string, Pt> = {};
  left.forEach( (p, i) => { out[p] = { x: -52, y: -halfH + 12 + i * 16 }; });
  right.forEach((p, i) => { out[p] = { x:  52, y: -halfH + 12 + i * 16 }; });
  return out;
}

function resolveAnchor(
  compType: string,
  pinName: string,
  allPins: string[],
): Pt {
  const typed = PIN_ANCHORS[compType];
  if (typed?.[pinName]) return typed[pinName];
  const ic = getICAnchors(allPins);
  return ic[pinName] ?? { x: 0, y: 0 };
}

// ──────────────────────────────────────────────────────────
// SVG SYMBOL COMPONENTS
// ──────────────────────────────────────────────────────────

function ResistorSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-28" y1="0" x2="-14" y2="0" />
      <polyline points="-14,0 -10,-7 -4,7 2,-7 8,7 14,-7 14,0" />
      <line x1="14" y1="0" x2="28" y2="0" />
    </g>
  );
}

function LEDColor(color?: string) {
  switch (color) {
    case "red": return "#ff5555";
    case "green": return "#55ff88";
    case "blue": return "#5599ff";
    case "yellow": return "#ffee55";
    case "white": return "#eeeeff";
    case "UV": return "#9966ff";
    case "IR": return "#ffaaaa";
    default: return C.sym;
  }
}

function LEDSVG({ color }: { color?: string }) {
  const fill = LEDColor(color);
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={C.sig} stroke="none" />
        </marker>
      </defs>
      <line x1="-28" y1="0" x2="-12" y2="0" />
      <polygon points="-12,-10 -12,10 8,0" fill={fill} fillOpacity="0.25" stroke={C.sym} />
      <line x1="8" y1="-11" x2="8" y2="11" />
      <line x1="8" y1="0" x2="28" y2="0" />
      <line x1="10" y1="-9" x2="18" y2="-18" stroke={C.sig} markerEnd="url(#arr)" />
      <line x1="15" y1="-5" x2="23" y2="-14" stroke={C.sig} markerEnd="url(#arr)" />
    </g>
  );
}

function DiodeSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-28" y1="0" x2="-10" y2="0" />
      <polygon points="-10,-9 -10,9 8,0" fill="none" stroke={C.sym} />
      <line x1="8" y1="-10" x2="8" y2="10" />
      <line x1="8" y1="0" x2="28" y2="0" />
    </g>
  );
}

function CapSVG({ polar = false }: { polar?: boolean }) {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-28" y1="0" x2="-4" y2="0" />
      {polar ? (
        <path d="M-4,-13 Q1,-13 1,0 Q1,13 -4,13" />
      ) : (
        <line x1="-4" y1="-13" x2="-4" y2="13" />
      )}
      <line x1="4" y1="-13" x2="4" y2="13" />
      <line x1="4" y1="0" x2="28" y2="0" />
      {polar && (
        <text x="-16" y="-15" fontSize="9" fill={C.labelSec} textAnchor="middle">+</text>
      )}
    </g>
  );
}

function InductorSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-28" y1="0" x2="-14" y2="0" />
      <path d="M-14,0 A5,5 0 0 1 -4,0 A5,5 0 0 1 6,0 A5,5 0 0 1 16,0" />
      <line x1="16" y1="0" x2="28" y2="0" />
    </g>
  );
}

function NPNSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <circle cx="0" cy="0" r="22" fill={C.symFill} />
      <line x1="-28" y1="0" x2="-12" y2="0" />
      <line x1="-12" y1="-18" x2="-12" y2="18" />
      <line x1="-12" y1="-10" x2="22" y2="-26" />
      <line x1="-12" y1="10" x2="22" y2="26" />
      <polygon points="14,20 22,26 16,30" fill={C.sym} stroke="none" />
      <text x="-6" y="4" fontSize="8" fill={C.labelSec} textAnchor="middle" fontFamily="monospace">N</text>
    </g>
  );
}

function PNPSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <circle cx="0" cy="0" r="22" fill={C.symFill} />
      <line x1="-28" y1="0" x2="-12" y2="0" />
      <line x1="-12" y1="-18" x2="-12" y2="18" />
      <line x1="-12" y1="-10" x2="22" y2="-26" />
      <line x1="-12" y1="10" x2="22" y2="26" />
      <polygon points="-4,-12 -12,-10 -8,-4" fill={C.sym} stroke="none" />
      <text x="-6" y="4" fontSize="8" fill={C.labelSec} textAnchor="middle" fontFamily="monospace">P</text>
    </g>
  );
}

function MOSFETSVG({ n = true }: { n?: boolean }) {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <circle cx="0" cy="0" r="22" fill={C.symFill} />
      <line x1="-28" y1="0" x2="-10" y2="0" />
      <line x1="-10" y1="-16" x2="-10" y2="16" />
      <line x1="-6" y1="-16" x2="-6" y2="16" />
      <line x1="-6" y1="-10" x2="22" y2="-26" />
      <line x1="-6" y1="10" x2="22" y2="26" />
      <line x1="-6" y1="0" x2="6" y2="0" />
      {n && <polygon points="14,20 22,26 16,30" fill={C.sym} stroke="none" />}
      {!n && <polygon points="-4,-12 -10,-10 -6,-4" fill={C.sym} stroke="none" />}
      <text x="-2" y="4" fontSize="7" fill={C.labelSec} textAnchor="middle" fontFamily="monospace">{n?"N":"P"}</text>
    </g>
  );
}

function BuzzerSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <rect x="-8" y="-18" width="16" height="36" fill={C.symFill} />
      <path d="M8,-22 Q26,-22 26,0 Q26,22 8,22" />
      <path d="M8,-13 Q18,-13 18,0 Q18,13 8,13" />
      <line x1="-28" y1="-12" x2="-8" y2="-12" />
      <line x1="-28" y1="12" x2="-8" y2="12" />
      <text x="-22" y="-14" fontSize="8" fill={C.vcc} fontFamily="monospace">+</text>
      <text x="-22" y="20" fontSize="8" fill={C.gnd} fontFamily="monospace">−</text>
    </g>
  );
}

function CrystalSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-28" y1="0" x2="-12" y2="0" />
      <line x1="-12" y1="-12" x2="-12" y2="12" />
      <rect x="-9" y="-10" width="18" height="20" fill={C.symFill} />
      <line x1="9" y1="-12" x2="9" y2="12" />
      <line x1="9" y1="0" x2="28" y2="0" />
    </g>
  );
}

function SwitchSVG() {
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <line x1="-28" y1="0" x2="-10" y2="0" />
      <circle cx="-10" cy="0" r="2.5" fill={C.sym} />
      <line x1="-8" y1="-4" x2="8" y2="-12" />
      <circle cx="10" cy="0" r="2.5" fill={C.sym} />
      <line x1="10" y1="0" x2="28" y2="0" />
    </g>
  );
}

function ICSVG({ pins, label }: { pins: string[]; label: string }) {
  const left  = pins.filter((_, i) => i % 2 === 0);
  const right = pins.filter((_, i) => i % 2 !== 0);
  const h = Math.max(left.length, right.length) * 16 + 16;
  const halfH = h / 2;
  const halfW = 40;

  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <rect x={-halfW} y={-halfH} width={halfW * 2} height={h} rx="3" fill={C.symFill} />
      <text x="0" y="5" textAnchor="middle" fontSize="9" fill={C.labelPri} fontFamily="monospace" fontWeight="bold">{label.slice(0, 8)}</text>
      {left.map((pin, i) => {
        const py = -halfH + 12 + i * 16;
        return (
          <g key={pin}>
            <line x1={-halfW - 12} y1={py} x2={-halfW} y2={py} />
            <text x={-halfW + 3} y={py + 3} fontSize="6" fill={C.labelSec} fontFamily="monospace">{pin.slice(0, 6)}</text>
          </g>
        );
      })}
      {right.map((pin, i) => {
        const py = -halfH + 12 + i * 16;
        return (
          <g key={pin}>
            <line x1={halfW} y1={py} x2={halfW + 12} y2={py} />
            <text x={halfW - 3} y={py + 3} textAnchor="end" fontSize="6" fill={C.labelSec} fontFamily="monospace">{pin.slice(0, 6)}</text>
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
  properties?: Record<string, string> | undefined;
}) {
  const isPolar = properties?.["type"] === "electrolytic" || properties?.["type"] === "tantalum";
  switch (type) {
    case "Resistor": return <ResistorSVG />;
    case "LED": return <LEDSVG color={properties?.["color"] ?? properties?.["model"]} />;
    case "Diode":
    case "ZenerDiode":
    case "SchottkyDiode":
    case "TVSDiode": return <DiodeSVG />;
    case "Capacitor": return <CapSVG polar={isPolar} />;
    case "Inductor": return <InductorSVG />;
    case "NPN": return <NPNSVG />;
    case "PNP": return <PNPSVG />;
    case "NMOSFET": return <MOSFETSVG n />;
    case "PMOSFET": return <MOSFETSVG n={false} />;
    case "Buzzer": return <BuzzerSVG />;
    case "Crystal": return <CrystalSVG />;
    case "Button":
    case "Switch": return <SwitchSVG />;
    default: return <ICSVG pins={pins} label={type} />;
  }
}

function VCCSymbolSVG({ voltage, name }: { voltage?: number; name: string }) {
  const label = voltage ? `${voltage}V` : name;
  return (
    <g>
      <line x1="0" y1="0" x2="0" y2="-14" stroke={C.vcc} strokeWidth="1.5" />
      <polygon points="-10,-14 10,-14 0,-28" fill={C.vcc} opacity="0.85" />
      <text x="0" y="-31" textAnchor="middle" fontSize="9" fill={C.vcc} fontFamily="monospace" fontWeight="bold">
        {label}
      </text>
    </g>
  );
}

function GNDSymbolSVG({ name }: { name: string }) {
  return (
    <g>
      <line x1="0" y1="0" x2="0" y2="10" stroke={C.gnd} strokeWidth="1.5" />
      <line x1="-13" y1="10" x2="13" y2="10" stroke={C.gnd} strokeWidth="1.5" />
      <line x1="-8"  y1="16" x2="8"  y2="16" stroke={C.gnd} strokeWidth="1.5" />
      <line x1="-3"  y1="22" x2="3"  y2="22" stroke={C.gnd} strokeWidth="1.5" />
      <text x="0" y="33" textAnchor="middle" fontSize="9" fill={C.gnd} fontFamily="monospace">{name}</text>
    </g>
  );
}

function NetLabelSVG({ name, netType, direction = "right" }: { name: string; netType: string; direction?: "left" | "right" }) {
  const col = wireColor(netType);
  if (direction === "right") {
    return (
      <g>
        <line x1="-14" y1="0" x2="0" y2="0" stroke={col} strokeWidth="1.5" />
        <polygon points="0,-8 0,8 18,0" fill="none" stroke={col} strokeWidth="1.5" />
        <text x="4" y="4" fontSize="8" fill={col} fontFamily="monospace">{name}</text>
      </g>
    );
  }
  return (
    <g>
      <line x1="0" y1="0" x2="14" y2="0" stroke={col} strokeWidth="1.5" />
      <polygon points="0,-8 0,8 -18,0" fill="none" stroke={col} strokeWidth="1.5" />
      <text x="-4" y="4" fontSize="8" textAnchor="end" fill={col} fontFamily="monospace">{name}</text>
    </g>
  );
}

// ──────────────────────────────────────────────────────────
// ORTHOGONAL WIRE ROUTING
// ──────────────────────────────────────────────────────────

function routeWire(from: Pt, to: Pt): string {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dy < 2) return `M${from.x},${from.y} H${to.x}`;
  if (dx < 2) return `M${from.x},${from.y} V${to.y}`;
  const midX = (from.x + to.x) / 2;
  return `M${from.x},${from.y} H${midX} V${to.y} H${to.x}`;
}

// ──────────────────────────────────────────────────────────
// PLACEMENT
// ──────────────────────────────────────────────────────────

const CELL_W = 170;
const CELL_H = 210;

interface PlacedComp {
  id: string;
  type: string;
  category: string;
  pins: Array<{ name: string; direction: string; type: string }>;
  properties?: Record<string, string>;
  x: number;
  y: number;
  col: number;
  row: number;
}

function buildLayout(netlist: Netlist): PlacedComp[] {
  const n = netlist.components.length;
  if (n === 0) return [];

  // Build adjacency — which components connect to which nets
  const compNets = new Map<string, Set<string>>();
  for (const comp of netlist.components) compNets.set(comp.id, new Set());

  for (const conn of netlist.connections) {
    const fromNet = netlist.nets.find((n) => n.name === conn.from);
    const toNet   = netlist.nets.find((n) => n.name === conn.to);
    if (fromNet) compNets.get(conn.to)?.add(fromNet.name);
    if (toNet)   compNets.get(conn.from)?.add(toNet.name);
  }

  // Score: power-connected → lower row index
  const powerNets = new Set(netlist.nets.filter((n) => n.type === "power").map((n) => n.name));
  const gndNets   = new Set(netlist.nets.filter((n) => n.type === "ground").map((n) => n.name));

  const scores = netlist.components.map((comp) => {
    const nets = compNets.get(comp.id) ?? new Set();
    let score = 0;
    if ([...nets].some((nn) => powerNets.has(nn))) score -= 10;
    if ([...nets].some((nn) => gndNets.has(nn))) score += 10;
    if (comp.category === "passive") score += 1;
    if (comp.category === "active_discrete") score += 2;
    if (comp.category === "active_ic") score += 3;
    if (comp.category === "module" || comp.category === "sensor") score += 5;
    return { comp, score };
  });

  scores.sort((a, b) => a.score - b.score);

  const cols = Math.max(2, Math.ceil(Math.sqrt(n)));
  const OFFSET_X = 100;
  const OFFSET_Y = 80;

  return scores.map(({ comp }, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return {
      ...comp,
      x: OFFSET_X + col * CELL_W,
      y: OFFSET_Y + row * CELL_H,
      col,
      row,
    };
  });
}

// ──────────────────────────────────────────────────────────
// MAIN RENDERER
// ──────────────────────────────────────────────────────────

interface Props {
  netlist: Netlist;
}

export function SchematicRenderer({ netlist }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pt>({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [hoveredNet, setHoveredNet] = useState<string | null>(null);
  const isDragging = useRef(false);
  const lastPt = useRef<Pt>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const placed = useMemo(() => buildLayout(netlist), [netlist]);

  // Build lookup maps
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

  // Get world position of a pin
  const pinWorld = useCallback(
    (compId: string, pinName: string): Pt | null => {
      const comp = compById.get(compId);
      if (!comp) return null;
      const localAnchor = resolveAnchor(comp.type, pinName, comp.pins.map((p) => p.name));
      return { x: comp.x + localAnchor.x, y: comp.y + localAnchor.y };
    },
    [compById],
  );

  // Canvas dimensions
  const maxCol = Math.max(0, ...placed.map((p) => p.col));
  const maxRow = Math.max(0, ...placed.map((p) => p.row));
  const canvasW = Math.max(800, (maxCol + 1) * CELL_W + 200);
  const canvasH = Math.max(600, (maxRow + 1) * CELL_H + 200);

  // Wheel zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
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

  const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

  const fitToScreen = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const exportSVG = useCallback(() => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schematic.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Decide per-connection rendering
  const wires: Array<{ path: string; color: string; netName: string; netType: string }> = [];
  const powerSymbols: Array<{ x: number; y: number; type: "vcc" | "gnd"; netName: string; voltage?: number }> = [];
  const netLabelSymbols: Array<{ x: number; y: number; netName: string; netType: string }> = [];
  const junctions = new Map<string, { x: number; y: number; color: string }>();

  for (const conn of netlist.connections) {
    const fromNet = netByName.get(conn.from);
    const toNet   = netByName.get(conn.to);

    if (fromNet && !toNet) {
      // Net → component pin: draw local power/gnd symbol
      const pinPos = pinWorld(conn.to, conn.toPin);
      if (pinPos) {
        if (fromNet.type === "power") {
          powerSymbols.push({ ...pinPos, type: "vcc", netName: fromNet.name, voltage: fromNet.voltage });
        } else if (fromNet.type === "ground") {
          powerSymbols.push({ ...pinPos, type: "gnd", netName: fromNet.name });
        } else {
          netLabelSymbols.push({ ...pinPos, netName: fromNet.name, netType: fromNet.type });
        }
      }
    } else if (!fromNet && toNet) {
      // Component pin → net
      const pinPos = pinWorld(conn.from, conn.fromPin);
      if (pinPos) {
        if (toNet.type === "power") {
          powerSymbols.push({ ...pinPos, type: "vcc", netName: toNet.name, voltage: toNet.voltage });
        } else if (toNet.type === "ground") {
          powerSymbols.push({ ...pinPos, type: "gnd", netName: toNet.name });
        } else {
          netLabelSymbols.push({ ...pinPos, netName: toNet.name, netType: toNet.type });
        }
      }
    } else if (!fromNet && !toNet) {
      // Component → component: route orthogonal wire
      const fromPos = pinWorld(conn.from, conn.fromPin);
      const toPos   = pinWorld(conn.to, conn.toPin);
      if (fromPos && toPos) {
        const net = netByName.get(conn.net ?? "");
        const netType = net?.type ?? "signal";
        const color = wireColor(netType);
        const path = routeWire(fromPos, toPos);
        wires.push({ path, color, netName: conn.net ?? "", netType });

        // Junction at straight-line meeting points
        const jKey = `${Math.round(toPos.x)},${Math.round(toPos.y)}`;
        const existing = junctions.get(jKey);
        if (existing) {
          // Already seen — it's a real junction
          junctions.set(jKey, { ...existing });
        } else {
          junctions.set(jKey, { x: toPos.x, y: toPos.y, color });
        }
      }
    }
  }

  // Selected component details
  const selected = selectedId ? compById.get(selectedId) : null;
  const selectedConns = selectedId
    ? netlist.connections.filter((c) => c.from === selectedId || c.to === selectedId)
    : [];

  return (
    <div className="relative w-full h-full overflow-hidden select-none" style={{ background: C.bg }}>

      {/* ── Toolbar ── */}
      <div
        className="absolute top-2 left-2 z-20 flex items-center gap-1.5"
        style={{ pointerEvents: "all" }}
      >
        {[
          { label: "+", onClick: () => setZoom((z) => Math.min(3, z + 0.2)) },
          { label: "−", onClick: () => setZoom((z) => Math.max(0.3, z - 0.2)) },
          { label: "⊡ Fit", onClick: fitToScreen },
          { label: showGrid ? "Grid ●" : "Grid ○", onClick: () => setShowGrid((v) => !v) },
          { label: "↓ SVG", onClick: exportSVG },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="px-2 py-1 rounded text-[10px] font-mono transition-colors hover:opacity-80"
            style={{ background: "#161B22", border: "1px solid #30363D", color: "#C9D1D9" }}
          >
            {label}
          </button>
        ))}
        <span
          className="text-[9px] font-mono ml-1"
          style={{ color: "#6E7681" }}
        >
          {Math.round(zoom * 100)}% · {placed.length} components
        </span>
      </div>

      {/* ── Details panel ── */}
      {selected && (
        <div
          className="absolute top-2 right-2 z-20 rounded p-3 text-[10px] font-mono space-y-1.5"
          style={{ background: "#161B22dd", border: "1px solid #30363D", maxWidth: "200px", backdropFilter: "blur(6px)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span style={{ color: C.sel, fontWeight: "bold" }}>{selected.id}</span>
            <button
              onClick={() => setSelectedId(null)}
              className="text-[9px]"
              style={{ color: "#6E7681" }}
            >
              ✕
            </button>
          </div>
          <div style={{ color: "#8B949E" }}>{selected.type}</div>
          {Object.entries(selected.properties ?? {}).map(([k, v]) => (
            <div key={k} style={{ color: "#C9D1D9" }}>
              <span style={{ color: "#6E7681" }}>{k}:</span> {v}
            </div>
          ))}
          <div style={{ color: "#6E7681", borderTop: "1px solid #21262D", paddingTop: "4px" }}>
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

      {/* ── Hovered net tooltip ── */}
      {hoveredNet && (
        <div
          className="absolute bottom-12 left-2 z-20 px-2 py-1 rounded text-[9px] font-mono"
          style={{ background: "#161B22dd", border: "1px solid #30363D", color: "#C9D1D9" }}
        >
          net: <span style={{ color: C.sig }}>{hoveredNet}</span>
        </div>
      )}

      {/* ── Legend ── */}
      <div
        className="absolute bottom-2 left-2 z-20 flex flex-col gap-1 p-2 rounded"
        style={{ background: "#161B22aa", border: "1px solid #21262D" }}
      >
        {[
          { col: C.vcc, lbl: "Power" },
          { col: C.gnd, lbl: "Ground" },
          { col: C.sig, lbl: "Signal" },
          { col: C.pwm, lbl: "PWM" },
          { col: C.analog, lbl: "Analog" },
        ].map(({ col, lbl }) => (
          <div key={lbl} className="flex items-center gap-1.5 text-[9px] font-mono">
            <div className="w-4 h-px rounded-full" style={{ background: col, height: "2px" }} />
            <span style={{ color: "#8B949E" }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* ── SVG Canvas ── */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`, transformOrigin: "top left" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* Grid */}
        {showGrid && (
          <g>
            {Array.from({ length: Math.ceil(canvasW / 40) + 1 }, (_, i) =>
              Array.from({ length: Math.ceil(canvasH / 40) + 1 }, (_, j) => (
                <circle
                  key={`${i}-${j}`}
                  cx={i * 40}
                  cy={j * 40}
                  r="0.8"
                  fill={C.gridDot}
                />
              ))
            )}
          </g>
        )}

        {/* Wires */}
        <g>
          {wires.map((w, i) => (
            <path
              key={i}
              d={w.path}
              stroke={w.netName === hoveredNet ? "#ffffff" : w.color}
              strokeWidth={w.netName === hoveredNet ? 2.5 : 1.5}
              fill="none"
              strokeLinecap="square"
              strokeLinejoin="miter"
              className="wire"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredNet(w.netName)}
              onMouseLeave={() => setHoveredNet(null)}
            />
          ))}
        </g>

        {/* Junction dots */}
        {[...junctions.values()].map((j, i) => (
          <circle key={i} cx={j.x} cy={j.y} r="3" fill={j.color} />
        ))}

        {/* Power symbols */}
        {powerSymbols.map((sym, i) => (
          <g key={i} transform={`translate(${sym.x},${sym.y})`}>
            {sym.type === "vcc" ? (
              <VCCSymbolSVG voltage={sym.voltage} name={sym.netName} />
            ) : (
              <GNDSymbolSVG name={sym.netName} />
            )}
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
          const pinNames = comp.pins.map((p) => p.name);

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
                  x="-36" y="-36" width="72" height="72"
                  rx="4"
                  fill={C.sel}
                  fillOpacity="0.08"
                  stroke={C.sel}
                  strokeWidth="1"
                  strokeDasharray="4,3"
                />
              )}

              {/* Symbol */}
              <CompSymbol
                type={comp.type}
                pins={pinNames}
                properties={comp.properties}
              />

              {/* Reference designator above */}
              <text
                x="0"
                y="-32"
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fontFamily="JetBrains Mono, monospace"
                fill={isSelected ? C.sel : C.labelPri}
              >
                {comp.id}
              </text>

              {/* Value/model below */}
              {(comp.properties?.["value"] || comp.properties?.["model"] || comp.properties?.["color"]) && (
                <text
                  x="0"
                  y="40"
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  fill={C.labelSec}
                >
                  {comp.properties?.["value"] ?? comp.properties?.["model"] ?? comp.properties?.["color"] ?? ""}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
