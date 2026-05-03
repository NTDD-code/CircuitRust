import { useState, useEffect, useRef, useMemo } from "react";
import {
  ChevronRight, ChevronDown,
  CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import type { Netlist } from "@workspace/api-client-react";

const BLINK_STYLE = `
  @keyframes pin-blink {
    0%,100% { background: rgba(248,81,73,0.08); }
    50%      { background: rgba(248,81,73,0.22); }
  }
  .pin-error-blink { animation: pin-blink 1.1s ease-in-out infinite; }
`;

// ── Domain types ─────────────────────────────────────────────────────────────

type Status = "ok" | "warning" | "error";

interface PinRow {
  name: string;
  type: string;
  net: string | null;
  netVoltage: number | null;
  others: string[];
  status: Status;
  issueCode: string | null;
}

interface CompRow {
  id: string;
  type: string;
  category: string;
  value: string;
  voltageLevel: number | null;
  pins: PinRow[];
  status: Status;
  errorCount: number;
  warningCount: number;
}

interface IssueRef {
  message: string;
  code: string;
  level: Status;
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
          issue.message.includes(`.${pin.name}`)            ||
          issue.message.includes(` ${pin.name} `)           ||
          issue.message.includes(`'${pin.name}'`)           ||
          issue.message.toLowerCase().includes(`${pin.name} pin`);

        if (mentioned) {
          pinStatus = issue.level;
          issueCode = issue.code;
          break;
        }
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

// ── Main export ───────────────────────────────────────────────────────────────

export interface CircuitSafetyTreeProps {
  netlist:      Netlist;
  errors:       Array<{ errorCode: string; message: string }>;
  warnings:     Array<{ warningCode: string; message: string }>;
  safetyIssues: Array<{ code: string; severity: string; message: string }>;
  focusedComponent?: string | null;
  onComponentFocus?: (id: string) => void;
}

export function CircuitSafetyTree({
  netlist,
  errors,
  warnings,
  safetyIssues,
  focusedComponent,
  onComponentFocus,
}: CircuitSafetyTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const issues = useMemo<IssueRef[]>(
    () => [
      ...errors.map((e) => ({ message: e.message, code: e.errorCode, level: "error"   as Status })),
      ...warnings.map((w) => ({ message: w.message, code: w.warningCode, level: "warning" as Status })),
      ...safetyIssues.map((s) => ({
        message: s.message,
        code: s.code,
        level: (s.severity === "FATAL" || s.severity === "CRITICAL") ? "error" as Status : "warning" as Status,
      })),
    ],
    [errors, warnings, safetyIssues],
  );

  const tree = useMemo(() => buildTree(netlist, issues), [netlist, issues]);

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

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    onComponentFocus?.(id);
  };

  const totalErrors   = tree.reduce((s, c) => s + c.errorCount, 0);
  const totalWarnings = tree.reduce((s, c) => s + c.warningCount, 0);

  return (
    <div
      className="h-full overflow-auto font-mono text-[11px]"
      style={{ background: "#0D1117", color: "#C9D1D9" }}
    >
      <style>{BLINK_STYLE}</style>
      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-3 h-7 border-b"
        style={{ background: "#161B22", borderColor: "#21262D" }}
      >
        <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "#6E7681" }}>
          Circuit Safety Tree
        </span>
        <span className="text-[9px]" style={{ color: "#21262D" }}>│</span>
        <span className="text-[9px]" style={{ color: "#6E7681" }}>
          {tree.length} component{tree.length !== 1 ? "s" : ""}
        </span>
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
                background:  isFocused ? "#132034" : "transparent",
                borderLeft:  isFocused ? "2px solid #58A6FF" : "2px solid transparent",
                transition:  "background 0.1s",
              }}
              onMouseEnter={(e) => { if (!isFocused) e.currentTarget.style.background = "#161B22"; }}
              onMouseLeave={(e) => { if (!isFocused) e.currentTarget.style.background = "transparent"; }}
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

              {/* Name */}
              <span
                className="font-bold"
                style={{ color: isFocused ? "#79C0FF" : "#C9D1D9" }}
              >
                {comp.id}
              </span>
              <span style={{ color: "#6E7681" }}>:</span>
              <span style={{ color: "#8B949E" }}>{comp.type}</span>

              {/* Value */}
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

              {/* Voltage level */}
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
                  const isLast   = i === comp.pins.length - 1;
                  const typeColor = PIN_TYPE_COLORS[pin.type] ?? "#6b7280";

                  let connLabel: string;
                  if (!pin.net) {
                    connLabel = "⚠ floating";
                  } else if (pin.others.length > 0) {
                    connLabel = pin.others[0];
                    if (pin.others.length > 1) connLabel += ` +${pin.others.length - 1} more`;
                    connLabel += `  [${pin.net}${pin.netVoltage != null ? ` · ${pin.netVoltage}V` : ""}]`;
                  } else {
                    connLabel = `${pin.net}${pin.netVoltage != null ? ` · ${pin.netVoltage}V` : ""}`;
                  }

                  const connColor =
                    !pin.net       ? "#3C4450"
                    : pin.type === "power"  ? "#ef4444"
                    : pin.type === "ground" ? "#6b7280"
                    : "#8B949E";

                  const connectedLabel = pin.net && pin.netVoltage != null
                    ? `Connected (${pin.netVoltage}V)`
                    : null;

                  return (
                    <div
                      key={pin.name}
                      className={`flex items-center gap-1.5 h-6 pr-3${pin.status === "error" ? " pin-error-blink" : ""}`}
                      style={{
                        paddingLeft: "28px",
                        background:
                          pin.status === "error"
                            ? undefined
                            : pin.status === "warning"
                            ? "#2D220022"
                            : "transparent",
                        borderLeft: "2px solid transparent",
                      }}
                    >
                      {/* Tree art */}
                      <span
                        className="shrink-0 text-[10px] select-none"
                        style={{ color: "#30363D", fontFamily: "monospace" }}
                      >
                        {isLast ? "└─" : "├─"}
                      </span>

                      <StatusIcon status={pin.status} size="xs" />

                      {/* Pin name */}
                      <span style={{ color: "#79C0FF", fontWeight: "600" }}>{pin.name}</span>

                      {/* Type badge */}
                      <PinTypeBadge type={pin.type} />

                      {/* Arrow */}
                      <span className="text-[10px]" style={{ color: "#30363D" }}>→</span>

                      {/* Connection label */}
                      <span
                        className="text-[10px] truncate"
                        style={{ color: connColor, maxWidth: "220px" }}
                        title={connectedLabel ?? connLabel}
                      >
                        {connectedLabel ?? connLabel}
                      </span>

                      {/* Issue code badge */}
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
    </div>
  );
}
