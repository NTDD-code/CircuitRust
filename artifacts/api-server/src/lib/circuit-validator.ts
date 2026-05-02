import type { ParsedComponent, ParsedConnection, ParsedNet, ParseError, ParsedPin, PinType, NetType } from "./circuit-parser.js";

export interface ValidationResult {
  errors: ParseError[];
  warnings: ValidationWarning[];
}

export interface ValidationWarning {
  line: number;
  column: number;
  message: string;
  warningCode: string;
}

function getPinNetType(pin: ParsedPin, netName: string | undefined, nets: Map<string, ParsedNet>): NetType | null {
  if (netName && nets.has(netName)) return nets.get(netName)!.type;
  if (pin.type === "power") return "power";
  if (pin.type === "ground") return "ground";
  return "signal";
}

function resolveNetType(varName: string, nets: Map<string, ParsedNet>, components: Map<string, ParsedComponent>): NetType | null {
  if (nets.has(varName)) return nets.get(varName)!.type;
  return null;
}

const COMPATIBLE_PAIRS: Record<PinType, PinType[]> = {
  power: ["analog", "signal", "digital", "bidirectional"],
  ground: ["analog", "signal", "digital", "bidirectional"],
  signal: ["power", "ground", "analog", "signal", "digital", "bidirectional"],
  analog: ["power", "ground", "analog", "signal", "bidirectional"],
  digital: ["power", "ground", "digital", "signal", "bidirectional"],
  bidirectional: ["power", "ground", "analog", "signal", "digital", "bidirectional"],
};

export function validateCircuit(
  components: Map<string, ParsedComponent>,
  connections: ParsedConnection[],
  nets: Map<string, ParsedNet>,
  sourceLines: string[],
): ValidationResult {
  const errors: ParseError[] = [];
  const warnings: ValidationWarning[] = [];

  const netConnections = new Map<string, Array<{ varName: string; pin: ParsedPin; compType: string }>>();

  for (const conn of connections) {
    const fromComp = components.get(conn.from);
    const toComp = components.get(conn.to);
    const fromNet = nets.get(conn.from);
    const toNet = nets.get(conn.to);

    if (!fromComp && !fromNet) {
      errors.push({
        line: conn.line,
        column: 1,
        message: `Undefined variable '${conn.from}'. Declare it with 'let ${conn.from} = Component::...' or 'let ${conn.from} = Net::...'`,
        errorCode: "E004",
        severity: "error",
        sourceLine: sourceLines[conn.line - 1],
      });
      continue;
    }
    if (!toComp && !toNet) {
      errors.push({
        line: conn.line,
        column: 1,
        message: `Undefined variable '${conn.to}'. Declare it with 'let ${conn.to} = Component::...' or 'let ${conn.to} = Net::...'`,
        errorCode: "E004",
        severity: "error",
        sourceLine: sourceLines[conn.line - 1],
      });
      continue;
    }

    if (fromNet && toNet) {
      if (fromNet.type === "power" && toNet.type === "ground") {
        errors.push({
          line: conn.line,
          column: 1,
          message: `Short circuit detected — power net '${conn.from}' directly connected to ground net '${conn.to}' without a load. This will destroy your power supply.`,
          errorCode: "E001",
          severity: "fatal",
          sourceLine: sourceLines[conn.line - 1],
        });
      } else if (fromNet.type === "ground" && toNet.type === "power") {
        errors.push({
          line: conn.line,
          column: 1,
          message: `Short circuit detected — ground net '${conn.from}' directly connected to power net '${conn.to}' without a load.`,
          errorCode: "E001",
          severity: "fatal",
          sourceLine: sourceLines[conn.line - 1],
        });
      }
      continue;
    }

    if (fromComp && toComp) {
      const fromPin = fromComp.pins.find((p) => p.name === conn.fromPin);
      const toPin = toComp.pins.find((p) => p.name === conn.toPin);

      if (!fromPin) {
        errors.push({
          line: conn.line,
          column: 1,
          message: `Component '${conn.from}' (${fromComp.type}) has no pin '${conn.fromPin}'. Available pins: ${fromComp.pins.map((p) => p.name).join(", ")}`,
          errorCode: "E005",
          severity: "error",
          sourceLine: sourceLines[conn.line - 1],
        });
        continue;
      }
      if (!toPin) {
        errors.push({
          line: conn.line,
          column: 1,
          message: `Component '${conn.to}' (${toComp.type}) has no pin '${conn.toPin}'. Available pins: ${toComp.pins.map((p) => p.name).join(", ")}`,
          errorCode: "E005",
          severity: "error",
          sourceLine: sourceLines[conn.line - 1],
        });
        continue;
      }

      const compatible = COMPATIBLE_PAIRS[fromPin.type] ?? [];
      if (!compatible.includes(toPin.type)) {
        errors.push({
          line: conn.line,
          column: 1,
          message: `Incompatible pins: ${conn.from}.${conn.fromPin} (${fromPin.type}) cannot connect to ${conn.to}.${conn.toPin} (${toPin.type})`,
          errorCode: "E006",
          severity: "error",
          sourceLine: sourceLines[conn.line - 1],
        });
        continue;
      }

      if (fromPin.type === "power" && toPin.type === "power") {
        warnings.push({
          line: conn.line,
          column: 1,
          message: `Connecting two power pins directly — ensure voltage levels match`,
          warningCode: "W001",
        });
      }

      const netKey = `${conn.from}.${conn.fromPin}:${conn.to}.${conn.toPin}`;
      const existing = netConnections.get(netKey);
      if (existing) {
        warnings.push({
          line: conn.line,
          column: 1,
          message: `Duplicate connection: ${conn.from}.${conn.fromPin} already connected to ${conn.to}.${conn.toPin}`,
          warningCode: "W002",
        });
      } else {
        netConnections.set(netKey, []);
      }
    }

    if (fromNet && toComp) {
      const toPin = toComp.pins.find((p) => p.name === conn.toPin);
      if (!toPin) {
        errors.push({
          line: conn.line,
          column: 1,
          message: `Component '${conn.to}' (${toComp.type}) has no pin '${conn.toPin}'. Available pins: ${toComp.pins.map((p) => p.name).join(", ")}`,
          errorCode: "E005",
          severity: "error",
          sourceLine: sourceLines[conn.line - 1],
        });
        continue;
      }

      if (fromNet.type === "power" && toPin.type === "ground") {
        errors.push({
          line: conn.line,
          column: 1,
          message: `Short circuit: power net '${conn.from}' connected to ground pin '${conn.to}.${conn.toPin}' without load`,
          errorCode: "E001",
          severity: "fatal",
          sourceLine: sourceLines[conn.line - 1],
        });
      }
      if (fromNet.type === "ground" && toPin.type === "power") {
        errors.push({
          line: conn.line,
          column: 1,
          message: `Short circuit: ground net '${conn.from}' connected to power pin '${conn.to}.${conn.toPin}'`,
          errorCode: "E001",
          severity: "fatal",
          sourceLine: sourceLines[conn.line - 1],
        });
      }
    }

    if (fromComp && toNet) {
      const fromPin = fromComp.pins.find((p) => p.name === conn.fromPin);
      if (!fromPin) {
        errors.push({
          line: conn.line,
          column: 1,
          message: `Component '${conn.from}' (${fromComp.type}) has no pin '${conn.fromPin}'. Available pins: ${fromComp.pins.map((p) => p.name).join(", ")}`,
          errorCode: "E005",
          severity: "error",
          sourceLine: sourceLines[conn.line - 1],
        });
        continue;
      }

      if (fromPin.type === "power" && toNet.type === "ground") {
        errors.push({
          line: conn.line,
          column: 1,
          message: `Short circuit: power pin '${conn.from}.${conn.fromPin}' connected directly to ground net '${conn.to}'`,
          errorCode: "E001",
          severity: "fatal",
          sourceLine: sourceLines[conn.line - 1],
        });
      }
      if (fromPin.type === "ground" && toNet.type === "power") {
        errors.push({
          line: conn.line,
          column: 1,
          message: `Short circuit: ground pin '${conn.from}.${conn.fromPin}' connected directly to power net '${conn.to}'`,
          errorCode: "E001",
          severity: "fatal",
          sourceLine: sourceLines[conn.line - 1],
        });
      }
    }
  }

  for (const [name, comp] of components) {
    const connectedPins = new Set<string>();
    for (const conn of connections) {
      if (conn.from === name) connectedPins.add(conn.fromPin);
      if (conn.to === name) connectedPins.add(conn.toPin);
    }
    const unconnectedPins = comp.pins.filter((p) => !connectedPins.has(p.name));
    if (unconnectedPins.length > 0 && unconnectedPins.length < comp.pins.length) {
      warnings.push({
        line: comp.line,
        column: 1,
        message: `Component '${name}' (${comp.type}) has unconnected pins: ${unconnectedPins.map((p) => p.name).join(", ")}`,
        warningCode: "W003",
      });
    }
  }

  if (components.size === 0 && connections.length === 0 && nets.size === 0) {
    warnings.push({
      line: 1,
      column: 1,
      message: "Circuit is empty — no components, nets, or connections defined",
      warningCode: "W004",
    });
  }

  return { errors, warnings };
}
