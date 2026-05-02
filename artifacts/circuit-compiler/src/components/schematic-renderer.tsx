import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { Netlist } from "@workspace/api-client-react";
import { getSymbol, type SymbolDef } from "@/renderer/symbols";
import { getRegistryEntry } from "@/renderer/componentRegistry";

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE  (Proteus-standard)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:       "#F5F5F5",
  gridDot:  "#D0D0D0",
  sym:      "#1A1A1A",
  labelRef: "#1A1A1A",
  labelVal: "#444444",
  labelPin: "#555555",
  wire:     "#0000FF",
  wirePwr:  "#FF0000",
  wireGnd:  "#000000",
  wireAna:  "#7C3AED",
  wirePwm:  "#D97706",
  sel:      "#F59E0B",
  selFill:  "#FFFBEB",
};

const FONT  = "'Roboto Mono', 'JetBrains Mono', 'Courier New', monospace";
const GRID  = 20;
const SNAP  = 20;
const MIN_SPACING = 100;

function wireColor(netType: string): string {
  if (netType === "power")  return C.wirePwr;
  if (netType === "ground") return C.wireGnd;
  if (netType === "analog") return C.wireAna;
  if (netType === "pwm")    return C.wirePwm;
  return C.wire;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Pt   = { x: number; y: number };
type Dir  = "left" | "right" | "up" | "down";
type Rect = { x: number; y: number; w: number; h: number };

// ─────────────────────────────────────────────────────────────────────────────
// PIN RESOLUTION
// Reads anchors from the symbol library; falls back to dynamic IC layout.
// ─────────────────────────────────────────────────────────────────────────────
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

function resolveAnchor(symbolId: string, sym: SymbolDef | undefined, pinName: string, allPins: string[]): Pt {
  if (sym?.pins[pinName]) return { x: sym.pins[pinName].x, y: sym.pins[pinName].y };
  if (symbolId === "IC")  return getICAnchors(allPins)[pinName] ?? { x: 0, y: 0 };
  return { x: 0, y: 0 };
}

function resolveDir(sym: SymbolDef | undefined, pinName: string, allPins: string[]): Dir {
  if (sym?.pins[pinName]) return sym.pins[pinName].dir;
  const anchor = getICAnchors(allPins)[pinName];
  if (!anchor) return "right";
  return anchor.x < 0 ? "left" : "right";
}

function snapN(v: number): number { return Math.round(v / GRID) * GRID; }

// ─────────────────────────────────────────────────────────────────────────────
// MANHATTAN ROUTING WITH OBSTACLE AVOIDANCE
// ─────────────────────────────────────────────────────────────────────────────
function segHitsRect(ax: number, ay: number, bx: number, by: number, r: Rect): boolean {
  const rx1 = r.x, ry1 = r.y, rx2 = r.x + r.w, ry2 = r.y + r.h;
  if (ax === bx) {
    if (ax <= rx1 || ax >= rx2) return false;
    const lo = Math.min(ay, by), hi = Math.max(ay, by);
    return hi > ry1 && lo < ry2;
  } else {
    if (ay <= ry1 || ay >= ry2) return false;
    const lo = Math.min(ax, bx), hi = Math.max(ax, bx);
    return hi > rx1 && lo < rx2;
  }
}

function buildPath(pts: Pt[]): string {
  if (!pts.length) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = pts[i - 1];
    d += p.x === q.x ? ` V${p.y}` : ` H${p.x}`;
  }
  return d;
}

function routeWire(from: Pt, fromDir: Dir, to: Pt, toDir: Dir, obstacles: Rect[]): string {
  const EXT = GRID * 2;
  const sn  = snapN;

  const fx = sn(from.x), fy = sn(from.y);
  const tx = sn(to.x),   ty = sn(to.y);

  const stub = (p: Pt, d: Dir, len: number): Pt => {
    if (d === "right") return { x: p.x + len, y: p.y };
    if (d === "left")  return { x: p.x - len, y: p.y };
    if (d === "up")    return { x: p.x, y: p.y - len };
    return { x: p.x, y: p.y + len };
  };

  const f = stub({ x: fx, y: fy }, fromDir, EXT);
  const t = stub({ x: tx, y: ty }, toDir,   EXT);

  const clean = (pts: Pt[]): string | null => {
    for (let i = 0; i < pts.length - 1; i++) {
      if (obstacles.some((r) => segHitsRect(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, r)))
        return null;
    }
    return buildPath(pts);
  };

  const candidates: Pt[][] = [];
  const offsets = [-3, 3, -6, 6, -9, 9].map((n) => n * GRID);

  if ((fromDir === "right" || fromDir === "left") && (toDir === "right" || toDir === "left")) {
    const midX = sn((f.x + t.x) / 2);
    candidates.push([{ x: fx, y: fy }, f, { x: midX, y: f.y }, { x: midX, y: t.y }, t, { x: tx, y: ty }]);
    for (const off of offsets) {
      const vy = sn(f.y + off);
      candidates.push([{ x: fx, y: fy }, f, { x: midX, y: f.y }, { x: midX, y: vy }, { x: t.x, y: vy }, t, { x: tx, y: ty }]);
    }
  } else if ((fromDir === "up" || fromDir === "down") && (toDir === "up" || toDir === "down")) {
    const midY = sn((f.y + t.y) / 2);
    candidates.push([{ x: fx, y: fy }, f, { x: f.x, y: midY }, { x: t.x, y: midY }, t, { x: tx, y: ty }]);
    for (const off of offsets.slice(0, 4)) {
      const vx = sn(f.x + off);
      candidates.push([{ x: fx, y: fy }, f, { x: f.x, y: midY }, { x: vx, y: midY }, { x: vx, y: t.y }, t, { x: tx, y: ty }]);
    }
  } else if ((fromDir === "right" || fromDir === "left") && (toDir === "up" || toDir === "down")) {
    candidates.push([{ x: fx, y: fy }, f, { x: t.x, y: f.y }, t, { x: tx, y: ty }]);
    for (const off of offsets.slice(0, 4)) {
      const vx = sn(f.x + off);
      candidates.push([{ x: fx, y: fy }, f, { x: vx, y: f.y }, { x: vx, y: t.y }, t, { x: tx, y: ty }]);
    }
  } else {
    candidates.push([{ x: fx, y: fy }, f, { x: f.x, y: t.y }, t, { x: tx, y: ty }]);
    for (const off of offsets.slice(0, 4)) {
      const vy = sn(f.y + off);
      candidates.push([{ x: fx, y: fy }, f, { x: f.x, y: vy }, { x: t.x, y: vy }, t, { x: tx, y: ty }]);
    }
  }

  for (const c of candidates) {
    const p = clean(c);
    if (p !== null) return p;
  }
  return buildPath(candidates[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT EXTRACTION (for junction + label-collision detection)
// ─────────────────────────────────────────────────────────────────────────────
type Seg = { x1: number; y1: number; x2: number; y2: number };

function extractSegments(pathD: string): Seg[] {
  const segs: Seg[] = [];
  const tokens = pathD.replace(/([A-Z])/g, " $1 ").trim().split(/\s+/);
  let cx = 0, cy = 0, i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (cmd === "M") { [cx, cy] = tokens[i + 1].split(",").map(Number); i += 2; }
    else if (cmd === "H") { const nx = +tokens[i + 1]; if (nx !== cx) segs.push({ x1: cx, y1: cy, x2: nx, y2: cy }); cx = nx; i += 2; }
    else if (cmd === "V") { const ny = +tokens[i + 1]; if (ny !== cy) segs.push({ x1: cx, y1: cy, x2: cx, y2: ny }); cy = ny; i += 2; }
    else i++;
  }
  return segs;
}

function ptNearSeg(px: number, py: number, seg: Seg, tol = 14): boolean {
  const { x1, y1, x2, y2 } = seg;
  if (x1 === x2) {
    if (Math.abs(px - x1) > tol) return false;
    return py >= Math.min(y1, y2) - tol && py <= Math.max(y1, y2) + tol;
  }
  if (Math.abs(py - y1) > tol) return false;
  return px >= Math.min(x1, x2) - tol && px <= Math.max(x1, x2) + tol;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAMP COMPONENT — fetches SVG body from symbol library and renders it
// ─────────────────────────────────────────────────────────────────────────────
function StampSymbol({
  symbolId,
  componentType,
  pinNames,
  properties,
}: {
  symbolId:      string;
  componentType: string;
  pinNames:      string[];
  properties?:   Record<string, string>;
}) {
  if (symbolId === "IC") {
    return <ICStamp pins={pinNames} label={componentType} />;
  }

  const sym = getSymbol(symbolId);
  if (!sym) return <ICStamp pins={pinNames} label={componentType} />;

  let body = sym.body;

  // Runtime substitution: LED fill colour
  if (symbolId === "LED") {
    const color = properties?.["color"] ?? properties?.["model"] ?? "";
    const fill  = ledFill(color);
    body = body.replace("__LED_FILL__", fill);
  }

  // Polar capacitor override
  if (componentType === "Capacitor") {
    const isPolar = properties?.["type"] === "electrolytic" || properties?.["type"] === "tantalum";
    if (isPolar) {
      const polarSym = getSymbol("CAPACITOR_POLAR");
      if (polarSym) body = polarSym.body;
    }
  }

  return (
    <g
      color={C.sym}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

function ledFill(color: string): string {
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

function ICStamp({ pins, label }: { pins: string[]; label: string }) {
  const left  = pins.filter((_, i) => i % 2 === 0);
  const right = pins.filter((_, i) => i % 2 !== 0);
  const rows  = Math.max(left.length, right.length);
  const h     = rows * 18 + 20;
  const half  = h / 2;
  const hw    = 56;
  return (
    <g stroke={C.sym} strokeWidth="1.5" fill="none">
      <rect x={-hw} y={-half} width={hw * 2} height={h} rx="3" fill="white" stroke={C.sym} />
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

// ─────────────────────────────────────────────────────────────────────────────
// POWER / GND / NET LABEL STAMPS
// ─────────────────────────────────────────────────────────────────────────────
function VCCStamp({ voltage, name }: { voltage?: number; name: string }) {
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

function GNDStamp({ name }: { name: string }) {
  return (
    <g>
      <line x1="0" y1="0"   x2="0"   y2="12"  stroke={C.wireGnd} strokeWidth="1.5" />
      <line x1="-16" y1="12" x2="16" y2="12"  stroke={C.wireGnd} strokeWidth="1.5" />
      <line x1="-10" y1="18" x2="10" y2="18"  stroke={C.wireGnd} strokeWidth="1.5" />
      <line x1="-4"  y1="24" x2="4"  y2="24"  stroke={C.wireGnd} strokeWidth="1.5" />
      <text x="0" y="36" textAnchor="middle" fontSize="8" fill={C.wireGnd} fontFamily={FONT}>{name}</text>
    </g>
  );
}

function NetLabelStamp({ name, netType }: { name: string; netType: string }) {
  const col = wireColor(netType);
  return (
    <g>
      <line x1="-14" y1="0" x2="0" y2="0" stroke={col} strokeWidth="1.5" />
      <polygon points="0,-7 0,7 18,0" fill="none" stroke={col} strokeWidth="1.5" />
      <text x="22" y="4" fontSize="8" fill={col} fontFamily={FONT}>{name}</text>
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN LABELS WITH ANTI-COLLISION
// ─────────────────────────────────────────────────────────────────────────────
function PinLabels({
  symbolId, sym, pinNames, allWireSegs, cx, cy,
}: {
  symbolId:    string;
  sym:         SymbolDef | undefined;
  pinNames:    string[];
  allWireSegs: Seg[];
  cx:          number;
  cy:          number;
}) {
  if (symbolId === "IC") return null;
  const LABEL_OFF = 15;

  return (
    <>
      {pinNames.map((pinName) => {
        const anchor = resolveAnchor(symbolId, sym, pinName, pinNames);
        const dir    = resolveDir(sym, pinName, pinNames);

        let tx = anchor.x, ty = anchor.y;
        let ta: "start" | "middle" | "end" = "middle";

        const setDefault = () => {
          if (dir === "left")       { tx = anchor.x - LABEL_OFF; ty = anchor.y - 4; ta = "end";    }
          else if (dir === "right") { tx = anchor.x + LABEL_OFF; ty = anchor.y - 4; ta = "start";  }
          else if (dir === "up")    { tx = anchor.x;             ty = anchor.y - LABEL_OFF; ta = "middle"; }
          else                      { tx = anchor.x;             ty = anchor.y + LABEL_OFF + 4; ta = "middle"; }
        };
        const setOpposite = () => {
          if (dir === "left")       { tx = anchor.x + LABEL_OFF; ty = anchor.y - 4; ta = "start";  }
          else if (dir === "right") { tx = anchor.x - LABEL_OFF; ty = anchor.y - 4; ta = "end";    }
          else if (dir === "up")    { tx = anchor.x;             ty = anchor.y + LABEL_OFF + 4; ta = "middle"; }
          else                      { tx = anchor.x;             ty = anchor.y - LABEL_OFF; ta = "middle"; }
        };

        setDefault();
        if (allWireSegs.some((s) => ptNearSeg(cx + tx, cy + ty, s))) setOpposite();

        return (
          <text
            key={pinName}
            x={tx} y={ty}
            textAnchor={ta}
            fontSize="8"
            fill={C.labelPin}
            fontFamily={FONT}
            style={{ pointerEvents: "none" }}
          >
            {pinName}
          </text>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORCE-DIRECTED LAYOUT
// ─────────────────────────────────────────────────────────────────────────────
const CELL_W = 240;
const CELL_H = 260;
const MARGIN = 160;

interface PlacedComp {
  id:          string;
  type:        string;
  category:    string;
  symbolId:    string;
  sym:         SymbolDef | undefined;
  hw:          number;
  hh:          number;
  pins:        Array<{ name: string; direction: string; type: string; pinNumber?: number }>;
  properties?: Record<string, string>;
  x:           number;
  y:           number;
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
    const fromIsNet = !!netlist.nets.find((nn) => nn.name === conn.from);
    const toIsNet   = !!netlist.nets.find((nn) => nn.name === conn.to);
    if (!fromIsNet && !toIsNet) {
      connSet.add(`${conn.from}--${conn.to}`);
      connSet.add(`${conn.to}--${conn.from}`);
    }
  });

  const scored = netlist.components.map((comp) => {
    const reg   = getRegistryEntry(comp.type);
    const nets  = compNets.get(comp.id) ?? new Set();
    let score   = 0;
    if ([...nets].some((nn) => powerNets.has(nn))) score -= 20;
    if ([...nets].some((nn) => gndNets.has(nn)))   score += 20;
    if (reg.category === "passive")    score += 0;
    if (reg.category === "transistor") score += 5;
    if (reg.category === "active_ic")  score += 10;
    if (reg.category === "module")     score += 15;
    if (reg.category === "sensor")     score += 12;
    return { comp, reg, score };
  });
  scored.sort((a, b) => a.score - b.score);

  const cols = Math.max(2, Math.ceil(Math.sqrt(n * 1.2)));

  const positions = scored.map(({ comp }, idx) => ({
    id: comp.id,
    x:  MARGIN + (idx % cols) * CELL_W,
    y:  MARGIN + Math.floor(idx / cols) * CELL_H,
    vx: 0, vy: 0,
  }));

  const REPULSION  = 18000;
  const ATTRACTION = 0.006;
  const DAMPING    = 0.70;
  const ITERATIONS = 120;
  const MIN_DIST   = MIN_SPACING + 80;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cool   = 1 - iter / (ITERATIONS * 1.5);
    const forces = positions.map(() => ({ fx: 0, fy: 0 }));

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const d2 = dx * dx + dy * dy + 1;
        const d  = Math.sqrt(d2);
        const rep = (REPULSION / d2) * cool;
        const rx = (rep * dx) / d, ry = (rep * dy) / d;
        forces[i].fx += rx; forces[i].fy += ry;
        forces[j].fx -= rx; forces[j].fy -= ry;

        if (d < MIN_DIST) {
          const push = ((MIN_DIST - d) / MIN_DIST) * 6 * cool;
          forces[i].fx += (dx / d) * push; forces[i].fy += (dy / d) * push;
          forces[j].fx -= (dx / d) * push; forces[j].fy -= (dy / d) * push;
        }

        if (connSet.has(`${positions[i].id}--${positions[j].id}`)) {
          const att = ATTRACTION * d * cool;
          forces[i].fx -= (dx / d) * att; forces[i].fy -= (dy / d) * att;
          forces[j].fx += (dx / d) * att; forces[j].fy += (dy / d) * att;
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
  return scored.map(({ comp, reg }) => {
    const p  = posMap.get(comp.id)!;
    const sym = getSymbol(reg.symbolId);
    return {
      ...comp,
      symbolId: reg.symbolId,
      sym,
      hw: reg.hw,
      hh: reg.hh,
      x:  Math.round(p.x / SNAP) * SNAP,
      y:  Math.round(p.y / SNAP) * SNAP,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RENDERER
// ─────────────────────────────────────────────────────────────────────────────
interface Props { netlist: Netlist; }

export function SchematicRenderer({ netlist }: Props) {
  const [zoom,       setZoom]       = useState(1);
  const [pan,        setPan]        = useState<Pt>({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGrid,   setShowGrid]   = useState(true);
  const [hoveredNet, setHoveredNet] = useState<string | null>(null);

  const isDragging   = useRef(false);
  const lastPt       = useRef<Pt>({ x: 0, y: 0 });
  const svgRef       = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const placed = useMemo(() => buildLayout(netlist), [netlist]);

  // Auto-centre on new layout
  useEffect(() => {
    if (!placed.length) return;
    const xs = placed.map((c) => c.x), ys = placed.map((c) => c.y);
    const minX = Math.min(...xs) - MARGIN, minY = Math.min(...ys) - MARGIN;
    const maxX = Math.max(...xs) + MARGIN, maxY = Math.max(...ys) + MARGIN;
    const cW = containerRef.current?.clientWidth ?? 800;
    const cH = containerRef.current?.clientHeight ?? 600;
    const fz = Math.min(1.4, Math.max(0.25, Math.min(cW / (maxX - minX), cH / (maxY - minY)) * 0.82));
    setZoom(fz);
    setPan({ x: cW / 2 - ((minX + maxX) / 2) * fz, y: cH / 2 - ((minY + maxY) / 2) * fz });
  }, [placed]);

  const compById  = useMemo(() => new Map(placed.map((c) => [c.id, c])), [placed]);
  const netByName = useMemo(() => {
    const m = new Map<string, (typeof netlist.nets)[number]>();
    netlist.nets.forEach((nn) => m.set(nn.name, nn));
    return m;
  }, [netlist.nets]);

  // Obstacle rects used for wire routing (exclude from/to component)
  const allObstacles = useMemo((): Rect[] =>
    placed.map((c) => {
      const pad = 20;
      return { x: c.x - c.hw - pad, y: c.y - c.hh - pad, w: (c.hw + pad) * 2, h: (c.hh + pad) * 2 };
    }),
  [placed]);

  // Resolve a pin's world position by reading from symbol anchor table
  const pinWorld = useCallback((compId: string, pinName: string): Pt | null => {
    const comp = compById.get(compId);
    if (!comp) return null;
    const local = resolveAnchor(comp.symbolId, comp.sym, pinName, comp.pins.map((p) => p.name));
    return { x: snapN(comp.x + local.x), y: snapN(comp.y + local.y) };
  }, [compById]);

  const pinDir2 = useCallback((compId: string, pinName: string): Dir => {
    const comp = compById.get(compId);
    if (!comp) return "right";
    return resolveDir(comp.sym, pinName, comp.pins.map((p) => p.name));
  }, [compById]);

  // Canvas size
  const maxX = Math.max(800, ...placed.map((c) => c.x)) + MARGIN * 2;
  const maxY = Math.max(600, ...placed.map((c) => c.y)) + MARGIN * 2;

  // Interaction
  const onWheel     = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.15, Math.min(5, z - e.deltaY * 0.001)));
  }, []);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest(".sc-comp")) return;
    isDragging.current = true;
    lastPt.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPan((p) => ({ x: p.x + e.clientX - lastPt.current.x, y: p.y + e.clientY - lastPt.current.y }));
    lastPt.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

  const fitToScreen = useCallback(() => {
    if (!placed.length) { setZoom(1); setPan({ x: 0, y: 0 }); return; }
    const xs = placed.map((c) => c.x), ys = placed.map((c) => c.y);
    const minX = Math.min(...xs) - MARGIN, minY = Math.min(...ys) - MARGIN;
    const maxXv = Math.max(...xs) + MARGIN, maxYv = Math.max(...ys) + MARGIN;
    const cW = containerRef.current?.clientWidth ?? 800;
    const cH = containerRef.current?.clientHeight ?? 600;
    const fz = Math.min(1.4, Math.max(0.15, Math.min(cW / (maxXv - minX), cH / (maxYv - minY)) * 0.85));
    setZoom(fz);
    setPan({ x: cW / 2 - ((minX + maxXv) / 2) * fz, y: cH / 2 - ((minY + maxYv) / 2) * fz });
  }, [placed]);

  const exportSVG = useCallback(() => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.removeAttribute("style");
    clone.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `text { font-family: 'Courier New', monospace; } .sc-comp { cursor: default; }`;
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

  // ── Build wire / power / junction data ────────────────────────────────────
  interface WireEntry { path: string; color: string; netName: string; netType: string; segs: Seg[]; }
  interface PowerEntry { x: number; y: number; kind: "vcc" | "gnd"; netName: string; voltage?: number; }
  interface NetLabelEntry { x: number; y: number; netName: string; netType: string; }

  const wires:      WireEntry[]     = [];
  const pwrSyms:    PowerEntry[]    = [];
  const netLabels:  NetLabelEntry[] = [];
  const ptCount     = new Map<string, { x: number; y: number; color: string; count: number }>();

  function trackPt(x: number, y: number, color: string) {
    const key = `${Math.round(x)},${Math.round(y)}`;
    const ex  = ptCount.get(key);
    if (ex) { ex.count++; ex.color = color; } else ptCount.set(key, { x, y, color, count: 1 });
  }

  for (const conn of netlist.connections) {
    const fromNet = netByName.get(conn.from);
    const toNet   = netByName.get(conn.to);

    if (fromNet && !toNet) {
      const pos = pinWorld(conn.to, conn.toPin);
      if (!pos) continue;
      if (fromNet.type === "power")  pwrSyms.push({ ...pos, kind: "vcc", netName: fromNet.name, voltage: fromNet.voltage });
      else if (fromNet.type === "ground") pwrSyms.push({ ...pos, kind: "gnd", netName: fromNet.name });
      else netLabels.push({ ...pos, netName: fromNet.name, netType: fromNet.type });
    } else if (!fromNet && toNet) {
      const pos = pinWorld(conn.from, conn.fromPin);
      if (!pos) continue;
      if (toNet.type === "power")    pwrSyms.push({ ...pos, kind: "vcc", netName: toNet.name, voltage: toNet.voltage });
      else if (toNet.type === "ground") pwrSyms.push({ ...pos, kind: "gnd", netName: toNet.name });
      else netLabels.push({ ...pos, netName: toNet.name, netType: toNet.type });
    } else if (!fromNet && !toNet) {
      const fpos = pinWorld(conn.from, conn.fromPin);
      const tpos = pinWorld(conn.to,   conn.toPin);
      if (!fpos || !tpos) continue;
      const net     = netByName.get(conn.net ?? "");
      const netType = net?.type ?? "signal";
      const color   = wireColor(netType);
      const fd      = pinDir2(conn.from, conn.fromPin);
      const td      = pinDir2(conn.to,   conn.toPin);
      const obs     = allObstacles.filter((_, idx) => placed[idx].id !== conn.from && placed[idx].id !== conn.to);
      const path    = routeWire(fpos, fd, tpos, td, obs);
      const segs    = extractSegments(path);
      wires.push({ path, color, netName: conn.net ?? "", netType, segs });
      trackPt(fpos.x, fpos.y, color);
      trackPt(tpos.x, tpos.y, color);
    }
  }

  const allSegs  = wires.flatMap((w) => w.segs);
  const junctions = [...ptCount.values()].filter((p) => p.count >= 3);

  const selected      = selectedId ? compById.get(selectedId) : null;
  const selectedConns = selectedId
    ? netlist.connections.filter((c) => c.from === selectedId || c.to === selectedId)
    : [];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ background: C.bg }}
    >
      {/* Toolbar */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5" style={{ pointerEvents: "all" }}>
        {([
          { label: "+",            act: () => setZoom((z) => Math.min(5, z + 0.25)) },
          { label: "−",            act: () => setZoom((z) => Math.max(0.15, z - 0.25)) },
          { label: "⊡ Fit",        act: fitToScreen },
          { label: showGrid ? "Grid ●" : "Grid ○", act: () => setShowGrid((v) => !v) },
          { label: "↓ Export SVG", act: exportSVG },
        ] as const).map(({ label, act }) => (
          <button
            key={label}
            onClick={act}
            style={{
              background: "#1F2937", border: "1px solid #374151", color: "#E5E7EB",
              borderRadius: "4px", padding: "3px 9px", fontSize: "10px",
              fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap",
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
          className="absolute top-2 right-2 z-20 rounded p-3 text-[10px] space-y-1.5"
          style={{ background: "#1F2937EE", border: "1px solid #374151", maxWidth: 220, backdropFilter: "blur(8px)", fontFamily: FONT, color: "#E5E7EB" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span style={{ color: C.sel, fontWeight: "bold" }}>{selected.id}</span>
            <button onClick={() => setSelectedId(null)} style={{ color: "#6B7280", fontSize: "9px" }}>✕</button>
          </div>
          <div style={{ color: "#9CA3AF" }}>{selected.type} <span style={{ color: "#6B7280" }}>({selected.symbolId})</span></div>
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
        <div className="absolute bottom-12 left-2 z-20 px-2 py-1 rounded"
          style={{ background: "#1F2937EE", border: "1px solid #374151", color: "#E5E7EB", fontSize: "9px", fontFamily: FONT }}>
          net: <span style={{ color: C.wire }}>{hoveredNet}</span>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-20 flex flex-col gap-1 p-2 rounded"
        style={{ background: "#1F2937CC", border: "1px solid #374151" }}>
        {([
          { col: C.wirePwr, lbl: "Power" },
          { col: C.wireGnd, lbl: "Ground" },
          { col: C.wire,    lbl: "Signal" },
          { col: C.wirePwm, lbl: "PWM" },
          { col: C.wireAna, lbl: "Analog" },
        ] as const).map(({ col, lbl }) => (
          <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "9px", fontFamily: FONT }}>
            <div style={{ width: 18, height: 2, background: col, borderRadius: 1 }} />
            <span style={{ color: "#9CA3AF" }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* SVG canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        viewBox={`0 0 ${maxX} ${maxY}`}
        style={{ transform: `matrix(${zoom},0,0,${zoom},${pan.x},${pan.y})`, transformOrigin: "0 0" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* Background */}
        <rect x="0" y="0" width={maxX} height={maxY} fill={C.bg} />

        {/* 20 px dot grid */}
        {showGrid && (
          <g>
            {Array.from({ length: Math.ceil(maxX / GRID) + 1 }, (_, i) =>
              Array.from({ length: Math.ceil(maxY / GRID) + 1 }, (_, j) => (
                <circle key={`${i}-${j}`} cx={i * GRID} cy={j * GRID} r="0.8" fill={C.gridDot} />
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

        {/* Junction dots — 4 px radius at ≥3-wire intersections */}
        {junctions.map((j, i) => (
          <circle key={i} cx={j.x} cy={j.y} r="4" fill={j.color} />
        ))}

        {/* Power symbols */}
        {pwrSyms.map((s, i) => (
          <g key={i} transform={`translate(${s.x},${s.y})`}>
            {s.kind === "vcc" ? <VCCStamp voltage={s.voltage} name={s.netName} /> : <GNDStamp name={s.netName} />}
          </g>
        ))}

        {/* Net labels */}
        {netLabels.map((s, i) => (
          <g key={i} transform={`translate(${s.x},${s.y})`}>
            <NetLabelStamp name={s.netName} netType={s.netType} />
          </g>
        ))}

        {/* Components — stamped from symbol library */}
        {placed.map((comp) => {
          const isSelected = comp.id === selectedId;
          const value = comp.properties?.["value"]
            ?? comp.properties?.["resistance"]
            ?? comp.properties?.["capacitance"]
            ?? comp.properties?.["model"]
            ?? comp.properties?.["color"]
            ?? "";

          return (
            <g
              key={comp.id}
              className="sc-comp"
              transform={`translate(${comp.x},${comp.y})`}
              onClick={() => setSelectedId(comp.id === selectedId ? null : comp.id)}
              style={{ cursor: "pointer" }}
            >
              {/* Selection highlight box */}
              {isSelected && (
                <rect
                  x={-comp.hw - 8} y={-comp.hh - 8}
                  width={(comp.hw + 8) * 2} height={(comp.hh + 8) * 2}
                  rx="5" fill={C.selFill} fillOpacity="0.5"
                  stroke={C.sel} strokeWidth="1.5" strokeDasharray="5,3"
                />
              )}

              {/* ── STAMP from symbol library ── */}
              <StampSymbol
                symbolId={comp.symbolId}
                componentType={comp.type}
                pinNames={comp.pins.map((p) => p.name)}
                properties={comp.properties}
              />

              {/* Pin labels with anti-collision */}
              <PinLabels
                symbolId={comp.symbolId}
                sym={comp.sym}
                pinNames={comp.pins.map((p) => p.name)}
                allWireSegs={allSegs}
                cx={comp.x}
                cy={comp.y}
              />

              {/* Ref designator — centred above component */}
              <text
                x={0} y={-comp.hh - 15}
                textAnchor="middle"
                fontSize="10" fontWeight="bold"
                fontFamily={FONT}
                fill={isSelected ? C.sel : C.labelRef}
                style={{ pointerEvents: "none" }}
              >
                {comp.id}
              </text>

              {/* Value — centred below component */}
              {value && (
                <text
                  x={0} y={comp.hh + 24}
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
