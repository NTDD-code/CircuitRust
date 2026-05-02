export type PinType = "power" | "ground" | "signal" | "analog" | "digital" | "bidirectional";
export type NetType = "power" | "ground" | "signal";

export interface ParsedPin {
  name: string;
  type: PinType;
  net?: string;
}

export interface ParsedComponent {
  id: string;
  name: string;
  type: string;
  pins: ParsedPin[];
  properties: Record<string, string>;
  line: number;
}

export interface ParsedConnection {
  from: string;
  fromPin: string;
  to: string;
  toPin: string;
  line: number;
}

export interface ParsedNet {
  name: string;
  type: NetType;
  voltage?: number;
}

export interface ParseResult {
  components: Map<string, ParsedComponent>;
  connections: ParsedConnection[];
  nets: Map<string, ParsedNet>;
  errors: ParseError[];
}

export interface ParseError {
  line: number;
  column: number;
  message: string;
  errorCode: string;
  severity: "error" | "fatal";
  sourceLine?: string;
}

const COMPONENT_DEFS: Record<string, { pins: Omit<ParsedPin, "net">[] }> = {
  LED: {
    pins: [
      { name: "anode", type: "analog" },
      { name: "cathode", type: "analog" },
    ],
  },
  Resistor: {
    pins: [
      { name: "pin1", type: "analog" },
      { name: "pin2", type: "analog" },
    ],
  },
  Capacitor: {
    pins: [
      { name: "pin1", type: "analog" },
      { name: "pin2", type: "analog" },
    ],
  },
  Transistor: {
    pins: [
      { name: "base", type: "signal" },
      { name: "collector", type: "analog" },
      { name: "emitter", type: "analog" },
    ],
  },
  Button: {
    pins: [
      { name: "pin1", type: "signal" },
      { name: "pin2", type: "signal" },
    ],
  },
  IC: {
    pins: [
      { name: "vcc", type: "power" },
      { name: "gnd", type: "ground" },
      { name: "in", type: "signal" },
      { name: "out", type: "signal" },
    ],
  },
  Diode: {
    pins: [
      { name: "anode", type: "analog" },
      { name: "cathode", type: "analog" },
    ],
  },
  VoltageRegulator: {
    pins: [
      { name: "in", type: "power" },
      { name: "out", type: "power" },
      { name: "gnd", type: "ground" },
    ],
  },
};

function stripComments(line: string): string {
  const idx = line.indexOf("//");
  return idx === -1 ? line : line.substring(0, idx);
}

function parseNetDeclaration(line: string, lineNum: number, errors: ParseError[], nets: Map<string, ParsedNet>): boolean {
  const netPowerMatch = line.match(/^let\s+(\w+)\s*=\s*Net::power\(([0-9.]+)\)\s*;?$/);
  if (netPowerMatch) {
    nets.set(netPowerMatch[1], {
      name: netPowerMatch[1],
      type: "power",
      voltage: parseFloat(netPowerMatch[2]),
    });
    return true;
  }
  const netGroundMatch = line.match(/^let\s+(\w+)\s*=\s*Net::ground\(\)\s*;?$/);
  if (netGroundMatch) {
    nets.set(netGroundMatch[1], { name: netGroundMatch[1], type: "ground" });
    return true;
  }
  const netSignalMatch = line.match(/^let\s+(\w+)\s*=\s*Net::signal\(\)\s*;?$/);
  if (netSignalMatch) {
    nets.set(netSignalMatch[1], { name: netSignalMatch[1], type: "signal" });
    return true;
  }
  return false;
}

function parseComponentDeclaration(
  line: string,
  lineNum: number,
  errors: ParseError[],
  components: Map<string, ParsedComponent>,
): boolean {
  const simpleMatch = line.match(/^let\s+(\w+)\s*=\s*Component::(\w+)\s*;?$/);
  if (simpleMatch) {
    const [, varName, compType] = simpleMatch;
    const def = COMPONENT_DEFS[compType];
    if (!def) {
      errors.push({
        line: lineNum,
        column: line.indexOf(compType) + 1,
        message: `Unknown component type '${compType}'. Available: ${Object.keys(COMPONENT_DEFS).join(", ")}`,
        errorCode: "E002",
        severity: "error",
        sourceLine: line,
      });
      return true;
    }
    components.set(varName, {
      id: varName,
      name: varName,
      type: compType,
      pins: def.pins.map((p) => ({ ...p })),
      properties: {},
      line: lineNum,
    });
    return true;
  }

  const propsMatch = line.match(/^let\s+(\w+)\s*=\s*Component::(\w+)\s*\{([^}]*)\}\s*;?$/);
  if (propsMatch) {
    const [, varName, compType, propsStr] = propsMatch;
    const def = COMPONENT_DEFS[compType];
    if (!def) {
      errors.push({
        line: lineNum,
        column: line.indexOf(compType) + 1,
        message: `Unknown component type '${compType}'. Available: ${Object.keys(COMPONENT_DEFS).join(", ")}`,
        errorCode: "E002",
        severity: "error",
        sourceLine: line,
      });
      return true;
    }
    const props: Record<string, string> = {};
    for (const prop of propsStr.split(",")) {
      const kv = prop.trim().match(/^(\w+)\s*:\s*(.+)$/);
      if (kv) {
        props[kv[1]] = kv[2].replace(/^"|"$/g, "").trim();
      }
    }
    components.set(varName, {
      id: varName,
      name: varName,
      type: compType,
      pins: def.pins.map((p) => ({ ...p })),
      properties: props,
      line: lineNum,
    });
    return true;
  }
  return false;
}

function parseConnectionMacro(
  line: string,
  lineNum: number,
  errors: ParseError[],
  connections: ParsedConnection[],
  components: Map<string, ParsedComponent>,
  nets: Map<string, ParsedNet>,
): boolean {
  const connectMatch = line.match(/^connect!\((.+?)\s*=>\s*(.+?)\)\s*;?$/);
  if (!connectMatch) return false;

  const fromStr = connectMatch[1].trim();
  const toStr = connectMatch[2].trim();

  function parseEndpoint(s: string): { varName: string; pin?: string } | null {
    const dotMatch = s.match(/^(\w+)\.(\w+)$/);
    if (dotMatch) return { varName: dotMatch[1], pin: dotMatch[2] };
    const bareMatch = s.match(/^(\w+)$/);
    if (bareMatch) return { varName: bareMatch[1] };
    return null;
  }

  const from = parseEndpoint(fromStr);
  const to = parseEndpoint(toStr);

  if (!from || !to) {
    errors.push({
      line: lineNum,
      column: 1,
      message: `Invalid connect! syntax. Use: connect!(component.pin => component.pin) or connect!(component.pin => net)`,
      errorCode: "E003",
      severity: "error",
      sourceLine: line,
    });
    return true;
  }

  const netName = `net_${from.varName}_${from.pin ?? "x"}_${to.varName}_${to.pin ?? "x"}`;

  connections.push({
    from: from.varName,
    fromPin: from.pin ?? "pin1",
    to: to.varName,
    toPin: to.pin ?? "pin1",
    line: lineNum,
  });
  return true;
}

export function parseCircuit(source: string): ParseResult {
  const components = new Map<string, ParsedComponent>();
  const connections: ParsedConnection[] = [];
  const nets = new Map<string, ParsedNet>();
  const errors: ParseError[] = [];

  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const line = stripComments(raw).trim();
    if (!line) continue;

    if (parseNetDeclaration(line, lineNum, errors, nets)) continue;
    if (parseComponentDeclaration(line, lineNum, errors, components)) continue;
    if (parseConnectionMacro(line, lineNum, errors, connections, components, nets)) continue;

    errors.push({
      line: lineNum,
      column: 1,
      message: `Unexpected statement: '${line}'. Expected: let declaration, Net::, Component::, or connect!()`,
      errorCode: "E000",
      severity: "error",
      sourceLine: raw,
    });
  }

  return { components, connections, nets, errors };
}
