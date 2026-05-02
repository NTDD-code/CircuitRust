import type { ParsedComponent, ParsedConnection, ParsedNet, ComponentCategory } from "./circuit-parser.js";

export interface NetlistPin {
  name: string;
  type: string;
  direction: string;
  maxVoltage?: number;
  driveVoltage?: number;
  pinNumber: number;
  net?: string;
}

export interface NetlistComponent {
  id: string;
  name: string;
  type: string;
  category: ComponentCategory;
  pins: NetlistPin[];
  properties: Record<string, string>;
  voltageLevel?: number;
}

export interface NetlistConnection {
  from: string;
  fromPin: string;
  to: string;
  toPin: string;
  net: string;
}

export interface Net {
  name: string;
  type: string;
  voltage?: number;
}

export interface Netlist {
  components: NetlistComponent[];
  connections: NetlistConnection[];
  nets: Net[];
}

export function buildNetlist(
  components: Map<string, ParsedComponent>,
  connections: ParsedConnection[],
  nets: Map<string, ParsedNet>,
): Netlist {
  const netlistComponents: NetlistComponent[] = Array.from(components.values()).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    category: c.category,
    voltageLevel: c.voltageLevel,
    pins: c.pins.map((p) => ({
      name: p.name,
      type: p.type,
      direction: p.direction,
      maxVoltage: p.maxVoltage,
      driveVoltage: p.driveVoltage,
      pinNumber: p.pinNumber,
      net: p.net,
    })),
    properties: c.properties,
  }));

  let autoNetIdx = 0;
  const edgeToNet = new Map<string, string>();

  function getEdgeNet(from: string, fromPin: string, to: string, toPin: string): string {
    const key1 = `${from}.${fromPin}:${to}.${toPin}`;
    const key2 = `${to}.${toPin}:${from}.${fromPin}`;
    if (edgeToNet.has(key1)) return edgeToNet.get(key1)!;
    if (edgeToNet.has(key2)) return edgeToNet.get(key2)!;
    const name = `net${autoNetIdx++}`;
    edgeToNet.set(key1, name);
    return name;
  }

  const netlistConnections: NetlistConnection[] = connections.map((conn) => {
    const fromNet = nets.get(conn.from);
    const toNet   = nets.get(conn.to);

    let netName: string;
    if (fromNet)      netName = fromNet.name;
    else if (toNet)   netName = toNet.name;
    else              netName = getEdgeNet(conn.from, conn.fromPin, conn.to, conn.toPin);

    const fromComp = netlistComponents.find((c) => c.id === conn.from);
    const toComp   = netlistComponents.find((c) => c.id === conn.to);
    if (fromComp) {
      const pin = fromComp.pins.find((p) => p.name === conn.fromPin);
      if (pin) pin.net = netName;
    }
    if (toComp) {
      const pin = toComp.pins.find((p) => p.name === conn.toPin);
      if (pin) pin.net = netName;
    }

    return { from: conn.from, fromPin: conn.fromPin, to: conn.to, toPin: conn.toPin, net: netName };
  });

  const allNets: Net[] = Array.from(nets.values()).map((n) => ({
    name: n.name, type: n.type, voltage: n.voltage,
  }));

  const autoNets = new Set(netlistConnections.map((c) => c.net).filter((n) => !nets.has(n)));
  for (const netName of autoNets) {
    allNets.push({ name: netName, type: "signal" });
  }

  return { components: netlistComponents, connections: netlistConnections, nets: allNets };
}
