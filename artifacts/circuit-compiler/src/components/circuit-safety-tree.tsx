import { useState, useEffect, useRef, useMemo } from "react";
import {
  ChevronRight, ChevronDown,
  CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import type { Netlist } from "@workspace/api-client-react";

// ── Styles ────────────────────────────────────────────────────────────────────

const TREE_STYLES = `
  @keyframes pin-blink {
    0%,100% { background: rgba(248,81,73,0.08); }
    50%      { background: rgba(248,81,73,0.22); }
  }
  .pin-error-blink { animation: pin-blink 1.1s ease-in-out infinite; }

  @keyframes warn-pulse {
    0%,100% { background: rgba(210,153,34,0.06); }
    50%      { background: rgba(210,153,34,0.18); }
  }
  .pin-warn-pulse { animation: warn-pulse 2s ease-in-out infinite; }

  @keyframes tooltip-in {
    from { opacity: 0; transform: translateX(-5px); }
    to   { opacity: 1; transform: translateX(0);    }
  }
  .tree-tooltip { animation: tooltip-in 0.12s ease-out forwards; }
`;

// ── Component specs database ───────────────────────────────────────────────────

interface CompSpec {
  desc:    string;
  specs:   Array<{ label: string; value: string }>;
  maxVcc?: number;
  warnVcc?: number;
}

const COMPONENT_SPECS: Record<string, CompSpec> = {
  Resistor:        { desc: "Carbon/Metal Film Resistor",         specs: [{ label:"Max P",     value:"250mW"       }] },
  Capacitor:       { desc: "Ceramic/Electrolytic Capacitor",     specs: [{ label:"Max V",     value:"50V"         }], maxVcc:50 },
  Inductor:        { desc: "Wound Coil Inductor",                specs: [{ label:"Max I",     value:"1A"          }] },
  Button:          { desc: "Tactile Push Button",                specs: [{ label:"Max V",     value:"50V"         }, { label:"Max I", value:"50mA" }] },
  Switch:          { desc: "SPST Toggle Switch",                 specs: [{ label:"Max V",     value:"30V"         }, { label:"Max I", value:"200mA" }] },
  Crystal:         { desc: "Quartz Crystal Oscillator",          specs: [{ label:"Common",    value:"16MHz"       }] },
  LED:             { desc: "Light Emitting Diode",               specs: [{ label:"Vf",        value:"2.0V"        }, { label:"Max If", value:"20mA" }], maxVcc:3.6, warnVcc:3.0 },
  Diode:           { desc: "1N4007 Silicon Rectifier",           specs: [{ label:"Max Vr",    value:"1000V"       }, { label:"Max If", value:"1A"   }] },
  ZenerDiode:      { desc: "Zener Voltage Regulator",            specs: [{ label:"Max Iz",    value:"50mA"        }] },
  SchottkyDiode:   { desc: "Schottky Low-Drop Diode",            specs: [{ label:"Max Vr",    value:"40V"         }, { label:"Max If", value:"1A"   }] },
  TVSDiode:        { desc: "Transient Voltage Suppressor",       specs: [{ label:"Max Ppk",   value:"600W"        }] },
  NPN:             { desc: "2N2222 NPN BJT",                     specs: [{ label:"Max Vce",   value:"40V"         }, { label:"Max Ic", value:"600mA" }, { label:"Max P", value:"500mW" }], maxVcc:40 },
  PNP:             { desc: "2N2907 PNP BJT",                     specs: [{ label:"Max Vce",   value:"40V"         }, { label:"Max Ic", value:"600mA" }], maxVcc:40 },
  NMOSFET:         { desc: "2N7000 N-Channel MOSFET",            specs: [{ label:"Max Vds",   value:"60V"         }, { label:"Max Id", value:"200mA" }, { label:"Vgs(th)", value:"2V" }], maxVcc:60 },
  PMOSFET:         { desc: "IRF9540N P-Channel MOSFET",          specs: [{ label:"Max Vds",   value:"100V"        }, { label:"Max Id", value:"19A"   }], maxVcc:100 },
  OpAmp741:        { desc: "μA741 General-Purpose Op-Amp",       specs: [{ label:"Max ±Vcc",  value:"18V"         }, { label:"GBW",    value:"1MHz"  }], maxVcc:36 },
  OpAmpLM358:      { desc: "LM358 Dual Op-Amp",                  specs: [{ label:"Max Vcc",   value:"32V"         }, { label:"GBW",    value:"1MHz"  }], maxVcc:32 },
  OpAmpTL082:      { desc: "TL082 JFET Input Op-Amp",            specs: [{ label:"Max ±Vcc",  value:"18V"         }, { label:"GBW",    value:"4MHz"  }], maxVcc:36 },
  LevelShifter:    { desc: "Bi-directional Level Shifter",       specs: [{ label:"Levels",    value:"3.3V ↔ 5V"   }] },
  VoltageRegulator:{ desc: "7805 Linear Regulator (5V/1.5A)",    specs: [{ label:"Max Vin",   value:"35V"         }, { label:"Max Io", value:"1.5A"  }], maxVcc:35 },
  LDO:             { desc: "LDO Linear Voltage Regulator",       specs: [{ label:"Max Vin",   value:"20V"         }, { label:"Max Io", value:"800mA" }], maxVcc:20 },
  BuckConverter:   { desc: "DC-DC Step-Down Converter",          specs: [{ label:"Max Vin",   value:"40V"         }, { label:"Max Io", value:"3A"    }], maxVcc:40 },
  BoostConverter:  { desc: "DC-DC Step-Up Converter",            specs: [{ label:"Max Vin",   value:"40V"         }, { label:"Max Io", value:"2A"    }], maxVcc:40 },
  ArduinoUno:      { desc: "ATmega328P @ 16MHz",                 specs: [{ label:"Vcc",       value:"5V"          }, { label:"GPIO",   value:"14"    }, { label:"Max I/O", value:"40mA" }], maxVcc:5.5, warnVcc:5.2 },
  ArduinoNano:     { desc: "ATmega328P Nano Form Factor",         specs: [{ label:"Vcc",       value:"5V"          }, { label:"GPIO",   value:"14"    }], maxVcc:5.5, warnVcc:5.2 },
  ESP32:           { desc: "Dual-Core 240MHz Wi-Fi/BT SoC",      specs: [{ label:"Vcc",       value:"3.3V"        }, { label:"Max GPIO", value:"12mA" }], maxVcc:3.6, warnVcc:3.4 },
  ESP8266:         { desc: "80MHz Wi-Fi SoC",                    specs: [{ label:"Vcc",       value:"3.3V"        }, { label:"Max Io",   value:"170mA"}], maxVcc:3.6, warnVcc:3.4 },
  RaspberryPiPico: { desc: "RP2040 Dual-Core ARM Cortex-M0+",    specs: [{ label:"Vcc",       value:"3.3V"        }, { label:"GPIO",   value:"26"    }], maxVcc:5.5 },
  DHT11:           { desc: "Digital Temp/Humidity Sensor",       specs: [{ label:"Vcc",       value:"3.3–5V"      }, { label:"Accuracy", value:"±5%RH"}], maxVcc:5.5 },
  DHT22:           { desc: "High-Accuracy Temp/Humidity Sensor", specs: [{ label:"Vcc",       value:"3.3–5V"      }, { label:"Accuracy", value:"±2%RH"}], maxVcc:5.5 },
  MPU6050:         { desc: "6-Axis IMU (Accel + Gyro)",          specs: [{ label:"Vcc",       value:"3.3V"        }, { label:"Interface","value":"I2C" }], maxVcc:3.6 },
  Ultrasonic:      { desc: "HC-SR04 Ultrasonic Distance Sensor", specs: [{ label:"Vcc",       value:"5V"          }, { label:"Range",  value:"2–400cm"}], maxVcc:5.5 },
  IRSensor:        { desc: "IR Proximity / Line Sensor",         specs: [{ label:"Vcc",       value:"3.3–5V"      }], maxVcc:5.5 },
  PhotoResistor:   { desc: "LDR Light-Dependent Resistor",       specs: [{ label:"Dark R",    value:"1MΩ"         }] },
  Thermistor:      { desc: "NTC 10kΩ Thermistor",               specs: [{ label:"R@25°C",    value:"10kΩ"        }] },
  Motor:           { desc: "DC Motor",                           specs: [{ label:"Type",      value:"DC"          }, { label:"Flyback", value:"Required" }] },
  Relay:           { desc: "Electromechanical Relay",            specs: [{ label:"Coil",      value:"5V/12V"      }, { label:"Flyback", value:"Required" }] },
  Buzzer:          { desc: "Piezo/Magnetic Buzzer",              specs: [{ label:"Type",      value:"Active/Passive"}] },
};

// ── Domain types ─────────────────────────────────────────────────────────────

type Status = "ok" | "warning" | "error";

interface PinRow {
  name:       string;
  type:       string;
  net:        string | null;
  netVoltage: number | null;
  others:     string[];
  status:     Status;
  issueCode:  string | null;
}

interface CompRow {
  id:           string;
  type:         string;
  category:     string;
  value:        string;
  voltageLevel: number | null;
  pins:         PinRow[];
  status:       Status;
  errorCount:   number;
  warningCount: number;
}

interface IssueRef {
  message: string;
  code:    string;
  level:   Status;
}

// ── Style maps ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  passive:         "#6b7280",
  active_discrete: "#f59e0b",
  active_ic:       "#8b5cf6",
  sensor:          "#06b6d4",
  module:          "#22c55e",
  power:           "#ef4444",
  actuator:        "#f97316",
};

const PIN_TYPE_COLORS: Record<string, string> = {
  power:         "#ef4444",
  ground:        "#6b7280",
  signal:        "#22c55e",
  analog:        "#f59e0b",
  digital:       "#3b82f6",
  bidirectional: "#a855f7",
  passive:       "#9ca3af",
};

// ── Tree builder ──────────────────────────────────────────────────────────────

function getCompValue(comp: Netlist["components"][number]): string {
  const p = (comp.properties ?? {}) as Record<string, string>;
  return p["resistance"] ?? p["capacitance"] ?? p["inductance"] ?? p["model"] ?? p["color"] ?? "";
}

function buildTree(netlist: Netlist, issues: IssueRef[]): CompRow[] {
  const netMap = new Map(netlist.nets.map((n) => [n.name, n]));

  return netlist.components.map((comp) => {
    const compIssues = issues.filter(
      (i) =>
        i.message.includes(`'${comp.name}'`) ||
        i.message.includes(`"${comp.name}"`),
    );
    const errorCount   = compIssues.filter((i) => i.level === "error").length;
    const warningCount = compIssues.filter((i) => i.level === "warning").length;

    const pins: PinRow[] = (comp.pins ?? []).map((pin) => {
      const others: string[] = [];
      let pinNet: string | null = pin.net ?? null;

      for (const conn of netlist.connections) {
        const isFrom = conn.from === comp.name && conn.fromPin === pin.name;
        const isTo   = conn.to   === comp.name && conn.toPin   === pin.name;
        if (!isFrom && !isTo) continue;
        if (!pinNet) pinNet = conn.net;
        const otherId  = isFrom ? conn.to   : conn.from;
        const otherPin = isFrom ? conn.toPin : conn.fromPin;
        if (!netMap.has(otherId) && otherId !== comp.name) {
          const label = `${otherId}.${otherPin}`;
          if (!others.includes(label)) others.push(label);
        }
      }

      const netInfo = pinNet ? netMap.get(pinNet) : null;

      let pinStatus: Status = "ok";
      let issueCode: string | null = null;

      for (const issue of compIssues) {
        const mentioned =
          issue.message.includes(`.${pin.name}`)           ||
          issue.message.includes(` ${pin.name} `)          ||
          issue.message.includes(`'${pin.name}'`)          ||
          issue.message.toLowerCase().includes(`${pin.name} pin`);

        if (mentioned) {
          pinStatus = issue.level;
          issueCode = issue.code;
          break;
        }
      }

      // H001: Client-side heuristic — floating digital/signal pin
      if ((pin.type === "digital" || pin.type === "signal") && !pinNet && pinStatus === "ok") {
        pinStatus = "warning";
        issueCode = "H001";
      }

      return {
        name:       pin.name,
        type:       pin.type ?? "passive",
        net:        pinNet,
        netVoltage: netInfo?.voltage ?? null,
        others,
        status:     pinStatus,
        issueCode,
      };
    });

    return {
      id:           comp.name,
      type:         comp.type,
      category:     comp.category,
      value:        getCompValue(comp),
      voltageLevel: comp.voltageLevel ?? null,
      pins,
      status:       errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "ok",
      errorCount,
      warningCount,
    };
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusIcon({ status, size = "sm" }: { status: Status; size?: "sm" | "xs" }) {
  const sz = size === "sm" ? "w-3.5 h-3.5" : "w-2.5 h-2.5";
  if (status === "error")   return <XCircle      className={`${sz} shrink-0`} style={{ color: "#F85149" }} />;
  if (status === "warning") return <AlertTriangle className={`${sz} shrink-0`} style={{ color: "#D29922" }} />;
  return                           <CheckCircle2  className={`${sz} shrink-0`} style={{ color: "#3FB950" }} />;
}

function PinTypeBadge({ type }: { type: string }) {
  const color = PIN_TYPE_COLORS[type] ?? "#6b7280";
  const label = type === "bidirectional" ? "bi" : type.slice(0, 3);
  return (
    <span
      className="shrink-0 text-[8px] px-1 rounded font-mono uppercase tracking-wide"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  );
}

// ── Digital-Twin Tooltip ──────────────────────────────────────────────────────

interface TooltipData {
  comp: CompRow;
  x:    number;
  y:    number;
}

function CompTooltip({ comp, x, y }: TooltipData) {
  const spec = COMPONENT_SPECS[comp.type];

  const safeX = Math.min(x + 8, (typeof window !== "undefined" ? window.innerWidth  : 1280) - 220);
  const safeY = Math.max(4, Math.min(y - 6, (typeof window !== "undefined" ? window.innerHeight : 800) - 240));

  let statusColor = "#3FB950";
  let statusIcon  = "✓";
  let statusMsg   = comp.voltageLevel != null
    ? `${comp.voltageLevel}V · operating within limits`
    : "No voltage constraints detected";

  if (comp.voltageLevel != null && spec?.maxVcc != null) {
    if (comp.voltageLevel > spec.maxVcc) {
      statusColor = "#F85149";
      statusIcon  = "⚠";
      statusMsg   = `${comp.voltageLevel}V exceeds max ${spec.maxVcc}V — DANGER`;
    } else if (spec.warnVcc != null && comp.voltageLevel > spec.warnVcc) {
      statusColor = "#D29922";
      statusIcon  = "⚠";
      statusMsg   = `${comp.voltageLevel}V near limit (max ${spec.maxVcc}V)`;
    } else {
      statusMsg   = `${comp.voltageLevel}V · within safe range (<${spec.maxVcc}V)`;
    }
  }

  return (
    <div
      className="tree-tooltip fixed z-[9999] w-52 pointer-events-none"
      style={{
        left:         safeX,
        top:          safeY,
        background:   "#161B22",
        border:       "1px solid #30363D",
        borderRadius: "8px",
        boxShadow:    "0 8px 32px rgba(0,0,0,0.75)",
        fontFamily:   '"JetBrains Mono", "Fira Code", monospace',
        fontSize:     "10px",
      }}
    >
      {/* Header */}
      <div className="px-3 pt-2 pb-1.5" style={{ borderBottom: "1px solid #21262D" }}>
        <div style={{ color: "#C9D1D9", fontWeight: 700, lineHeight: "1.4" }}>
          <span style={{ color: "#E3B341" }}>{comp.id}</span>
          <span style={{ color: "#6E7681" }}>: </span>
          <span style={{ color: "#79C0FF" }}>{comp.type}</span>
          {comp.value && <span style={{ color: "#F0883E" }}> · {comp.value}</span>}
        </div>
        <div style={{ color: "#6E7681", marginTop: "1px" }}>
          {spec?.desc ?? comp.category}
        </div>
      </div>

      {/* Spec grid */}
      {spec?.specs && spec.specs.length > 0 && (
        <div
          className="px-3 py-1.5"
          style={{
            display:             "grid",
            gridTemplateColumns: "1fr 1fr",
            gap:                 "2px 8px",
            borderBottom:        "1px solid #21262D",
          }}
        >
          {spec.specs.map(({ label, value }) => (
            <div key={label} style={{ display: "flex", gap: "4px" }}>
              <span style={{ color: "#6E7681" }}>{label}:</span>
              <span style={{ color: "#D2A679" }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Safety status */}
      <div className="px-3 py-1.5 flex items-start gap-1.5">
        <span style={{ color: statusColor, flexShrink: 0 }}>{statusIcon}</span>
        <span style={{ color: statusColor, lineHeight: "1.4" }}>{statusMsg}</span>
      </div>

      {/* Hint */}
      <div
        className="px-3 py-1"
        style={{
          borderTop:  "1px solid #21262D",
          color:      "#3C4450",
          fontSize:   "9px",
          letterSpacing: "0.03em",
        }}
      >
        Double-click to trace in editor
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface CircuitSafetyTreeProps {
  netlist:           Netlist;
  errors:            Array<{ errorCode: string; message: string }>;
  warnings:          Array<{ warningCode: string; message: string }>;
  safetyIssues:      Array<{ code: string; severity: string; message: string }>;
  testResults?:      Array<{ description: string; passed: boolean; assertions: Array<{ code: string; passed: boolean; message: string }> }>;
  focusedComponent?: string | null;
  onComponentFocus?: (id: string) => void;
  onTraceToCode?:    (compId: string, pinName?: string) => void;
  healthScore?:      number | null;
}

export function CircuitSafetyTree({
  netlist,
  errors,
  warnings,
  safetyIssues,
  testResults = [],
  focusedComponent,
  onComponentFocus,
  onTraceToCode,
  healthScore,
}: CircuitSafetyTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tooltip,  setTooltip]  = useState<TooltipData | null>(null);
  const rowRefs       = useRef<Map<string, HTMLDivElement>>(new Map());

  const issues = useMemo<IssueRef[]>(
    () => [
      ...errors.map((e) => ({ message: e.message, code: e.errorCode,    level: "error"   as Status })),
      ...warnings.map((w) => ({ message: w.message, code: w.warningCode, level: "warning" as Status })),
      ...safetyIssues.map((s) => ({
        message: s.message,
        code:    s.code,
        level:   (s.severity === "FATAL" || s.severity === "CRITICAL") ? "error" as Status : "warning" as Status,
      })),
    ],
    [errors, warnings, safetyIssues],
  );

  const tree = useMemo(() => buildTree(netlist, issues), [netlist, issues]);

  // Auto-expand on focus
  useEffect(() => {
    if (!focusedComponent) return;
    setExpanded((prev) => {
      if (prev.has(focusedComponent)) return prev;
      return new Set([...prev, focusedComponent]);
    });
    setTimeout(() => {
      rowRefs.current.get(focusedComponent)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  }, [focusedComponent]);

  const testsPassed = testResults.filter((t) => t.passed).length;
  const testsTotal  = testResults.length;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    onComponentFocus?.(id);
  };

  const totalErrors   = tree.reduce((s, c) => s + c.errorCount,   0);
  const totalWarnings = tree.reduce((s, c) => s + c.warningCount, 0);

  // Health score badge color
  const hColor =
    healthScore === null || healthScore === undefined ? "#6E7681"
    : healthScore >= 85 ? "#3FB950"
    : healthScore >= 60 ? "#D29922"
    : "#F85149";

  return (
    <div
      className="h-full overflow-auto font-mono text-[11px]"
      style={{ background: "#0D1117", color: "#C9D1D9" }}
      onMouseLeave={() => setTooltip(null)}
    >
      <style>{TREE_STYLES}</style>

      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-10 flex items-center gap-2 px-3 h-8 border-b"
        style={{ background: "#161B22", borderColor: "#21262D" }}
      >
        <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "#6E7681" }}>
          Circuit Safety Tree
        </span>
        <span className="text-[9px]" style={{ color: "#21262D" }}>│</span>
        <span className="text-[9px]" style={{ color: "#6E7681" }}>
          {tree.length} component{tree.length !== 1 ? "s" : ""}
        </span>

        {/* Health score badge */}
        {healthScore !== null && healthScore !== undefined && (
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[9px] ml-1"
            style={{
              background:  `${hColor}14`,
              border:      `1px solid ${hColor}40`,
              color:        hColor,
            }}
          >
            <span>Health: {healthScore}/100</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {totalErrors > 0 && (
            <span
              className="text-[9px] px-1.5 rounded font-mono flex items-center gap-1"
              style={{ background: "#3D0A0A", color: "#F85149", border: "1px solid #F8514944" }}
            >
              <XCircle className="w-2.5 h-2.5" />
              {totalErrors} error{totalErrors !== 1 ? "s" : ""}
            </span>
          )}
          {totalWarnings > 0 && (
            <span
              className="text-[9px] px-1.5 rounded font-mono flex items-center gap-1"
              style={{ background: "#2D2200", color: "#D29922", border: "1px solid #D2992244" }}
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              {totalWarnings} warning{totalWarnings !== 1 ? "s" : ""}
            </span>
          )}
          {totalErrors === 0 && totalWarnings === 0 && (
            <span className="text-[9px] flex items-center gap-1 font-mono" style={{ color: "#3FB950" }}>
              <CheckCircle2 className="w-2.5 h-2.5" />
              all clean
            </span>
          )}
        </div>
      </div>

      {/* ── Component rows ── */}
      {tree.map((comp) => {
        const isExpanded = expanded.has(comp.id);
        const isFocused  = focusedComponent === comp.id;
        const catColor   = CATEGORY_COLORS[comp.category] ?? "#8B949E";

        return (
          <div
            key={comp.id}
            ref={(el) => {
              if (el) rowRefs.current.set(comp.id, el);
              else rowRefs.current.delete(comp.id);
            }}
          >
            {/* Component header row */}
            <div
              className="flex items-center gap-1.5 h-7 px-2 cursor-pointer select-none"
              style={{
                background: isFocused ? "#132034" : "transparent",
                borderLeft: isFocused ? "2px solid #58A6FF" : "2px solid transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!isFocused) e.currentTarget.style.background = "#161B22";
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({ comp, x: rect.right, y: rect.top });
              }}
              onMouseLeave={(e) => {
                if (!isFocused) e.currentTarget.style.background = "transparent";
                setTooltip(null);
              }}
              onClick={() => toggle(comp.id)}
            >
              {/* Expand chevron */}
              <span className="shrink-0" style={{ color: "#6E7681" }}>
                {comp.pins.length > 0 ? (
                  isExpanded
                    ? <ChevronDown  className="w-3 h-3" />
                    : <ChevronRight className="w-3 h-3" />
                ) : (
                  <span className="w-3 h-3 inline-block" />
                )}
              </span>

              <StatusIcon status={comp.status} />

              {/* Name — double-click traces to `let compId =` */}
              <span
                className="font-bold"
                style={{ color: isFocused ? "#79C0FF" : "#C9D1D9" }}
                title="Double-click to trace in editor"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onTraceToCode?.(comp.id);
                }}
              >
                {comp.id}
              </span>
              <span style={{ color: "#6E7681" }}>:</span>
              <span style={{ color: "#8B949E" }}>{comp.type}</span>

              {comp.value && (
                <span style={{ color: "#F0883E" }}>{comp.value}</span>
              )}

              {/* Category badge */}
              <span
                className="text-[9px] px-1.5 py-px rounded font-mono ml-0.5"
                style={{
                  background: `${catColor}22`,
                  color:       catColor,
                  border:      `1px solid ${catColor}33`,
                }}
              >
                {comp.category}
              </span>

              {comp.voltageLevel != null && (
                <span className="text-[9px]" style={{ color: "#6E7681" }}>
                  {comp.voltageLevel}V
                </span>
              )}

              {/* Issue badges */}
              <div className="ml-auto flex items-center gap-1">
                {comp.errorCount > 0 && (
                  <span
                    className="text-[9px] px-1 rounded font-mono"
                    style={{ background: "#3D0A0A", color: "#F85149", border: "1px solid #F8514933" }}
                  >
                    {comp.errorCount}E
                  </span>
                )}
                {comp.warningCount > 0 && (
                  <span
                    className="text-[9px] px-1 rounded font-mono"
                    style={{ background: "#2D2200", color: "#D29922", border: "1px solid #D2992233" }}
                  >
                    {comp.warningCount}W
                  </span>
                )}
              </div>
            </div>

            {/* Pin rows */}
            {isExpanded && comp.pins.length > 0 && (
              <div>
                {comp.pins.map((pin, i) => {
                  const isLast    = i === comp.pins.length - 1;
                  const typeColor = PIN_TYPE_COLORS[pin.type] ?? "#6b7280";

                  void typeColor;

                  let connLabel: string;
                  if (!pin.net) {
                    connLabel = pin.issueCode === "H001"
                      ? "⚠ floating input — add pull-up resistor"
                      : "⚠ floating";
                  } else if (pin.others.length > 0) {
                    connLabel = pin.others[0];
                    if (pin.others.length > 1) connLabel += ` +${pin.others.length - 1} more`;
                    connLabel += `  [${pin.net}${pin.netVoltage != null ? ` · ${pin.netVoltage}V` : ""}]`;
                  } else {
                    connLabel = `${pin.net}${pin.netVoltage != null ? ` · ${pin.netVoltage}V` : ""}`;
                  }

                  const connColor =
                    !pin.net        ? "#3C4450"
                    : pin.type === "power"  ? "#ef4444"
                    : pin.type === "ground" ? "#6b7280"
                    : "#8B949E";

                  const connectedLabel = pin.net && pin.netVoltage != null
                    ? `Connected (${pin.netVoltage}V)`
                    : null;

                  const isH001 = pin.issueCode === "H001";

                  return (
                    <div
                      key={pin.name}
                      className={`flex items-center gap-1.5 h-6 pr-3 cursor-pointer${pin.status === "error" ? " pin-error-blink" : isH001 ? " pin-warn-pulse" : ""}`}
                      style={{
                        paddingLeft: "28px",
                        background:
                          pin.status === "error" ? undefined
                          : pin.status === "warning" && !isH001 ? "#2D220022"
                          : "transparent",
                        borderLeft: "2px solid transparent",
                      }}
                      title={isH001 ? "Floating input may cause erratic behavior. Consider a pull-up resistor." : undefined}
                      onDoubleClick={() => onTraceToCode?.(comp.id, pin.name)}
                    >
                      {/* Tree art */}
                      <span
                        className="shrink-0 text-[10px] select-none"
                        style={{ color: "#30363D", fontFamily: "monospace" }}
                      >
                        {isLast ? "└─" : "├─"}
                      </span>

                      <StatusIcon status={pin.status} size="xs" />

                      <span style={{ color: "#79C0FF", fontWeight: "600" }}>{pin.name}</span>

                      <PinTypeBadge type={pin.type} />

                      <span className="text-[10px]" style={{ color: "#30363D" }}>→</span>

                      <span
                        className="text-[10px] truncate"
                        style={{ color: connColor, maxWidth: "200px" }}
                        title={connectedLabel ?? connLabel}
                      >
                        {connectedLabel ?? connLabel}
                      </span>

                      {pin.issueCode && (
                        <span
                          className="ml-auto shrink-0 text-[9px] px-1 rounded font-mono"
                          style={{
                            background: pin.status === "error" ? "#3D0A0A" : "#2D2200",
                            color:      pin.status === "error" ? "#F85149" : "#D29922",
                            border:     `1px solid ${pin.status === "error" ? "#F8514933" : "#D2992233"}`,
                          }}
                        >
                          {pin.issueCode}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {tree.length === 0 && (
        <div className="flex items-center justify-center h-20" style={{ color: "#3C4450" }}>
          No components in netlist
        </div>
      )}

      {/* ── Test Results Status Bar ── */}
      {testsTotal > 0 && (
        <div
          className="sticky bottom-0 border-t font-mono"
          style={{ background: "#0D1117", borderColor: "#21262D" }}
        >
          {/* Summary row */}
          <div
            className="flex items-center gap-2 px-3 py-2 border-b"
            style={{
              background: testsPassed === testsTotal ? "#0D2B1A" : "#2B0D0D",
              borderColor: testsPassed === testsTotal ? "#1A4D2E" : "#4D1A1A",
            }}
          >
            {testsPassed === testsTotal ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#3FB950" }} />
            ) : (
              <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "#F85149" }} />
            )}
            <span
              className="text-[11px] font-semibold"
              style={{ color: testsPassed === testsTotal ? "#3FB950" : "#F85149" }}
            >
              Tests Passed: {testsPassed}/{testsTotal}
            </span>
            {testsPassed === testsTotal && testsTotal > 0 && (
              <span className="text-[10px]" style={{ color: "#3FB950" }}>
                — all assertions satisfied ✓
              </span>
            )}
            {testsPassed < testsTotal && (
              <span className="text-[10px]" style={{ color: "#F85149" }}>
                — {testsTotal - testsPassed} test{testsTotal - testsPassed !== 1 ? "s" : ""} failed
              </span>
            )}
          </div>

          {/* Per-test rows */}
          <div className="px-3 py-1.5 space-y-1.5 max-h-[180px] overflow-auto">
            {testResults.map((test, ti) => (
              <div key={ti}>
                <div className="flex items-center gap-1.5 text-[10px]">
                  {test.passed ? (
                    <CheckCircle2 className="w-2.5 h-2.5 shrink-0" style={{ color: "#3FB950" }} />
                  ) : (
                    <XCircle className="w-2.5 h-2.5 shrink-0" style={{ color: "#F85149" }} />
                  )}
                  <span
                    className="font-semibold"
                    style={{ color: test.passed ? "#79C0FF" : "#F85149" }}
                  >
                    {test.description}
                  </span>
                </div>
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {test.assertions.map((a, ai) => (
                    <div key={ai} className="flex items-start gap-1 text-[9px]">
                      <span style={{ color: a.passed ? "#3FB950" : "#F85149" }}>
                        {a.passed ? "✓" : "✗"}
                      </span>
                      <span
                        className="font-mono"
                        style={{ color: a.passed ? "#8B949E" : "#F0883E" }}
                      >
                        {a.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Digital-twin floating tooltip */}
      {tooltip && <CompTooltip comp={tooltip.comp} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
}
