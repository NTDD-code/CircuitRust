import type { ParsedComponent, ParsedConnection, ParsedNet } from "./circuit-parser.js";

export interface NetlistComponent {
  id: string;
  name: string;
  type: string;
  pins: NetlistPin[];
  properties: Record<string, string>;
}

export interface NetlistPin {
  name: string;
  type: string;
  net?: string;
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
    pins: c.pins.map((p) => ({ name: p.name, type: p.type, net: p.net })),
    properties: c.properties,
  }));

  const netCounter = new Map<string, number>();
  let autoNetIdx = 0;

  const netlistConnections: NetlistConnection[] = connections.map((conn) => {
    const fromNet = nets.get(conn.from);
    const toNet = nets.get(conn.to);

    let netName: string;
    if (fromNet) {
      netName = fromNet.name;
    } else if (toNet) {
      netName = toNet.name;
    } else {
      const key = `${conn.from}.${conn.fromPin}:${conn.to}.${conn.toPin}`;
      if (!netCounter.has(key)) {
        netCounter.set(key, autoNetIdx++);
      }
      netName = `net${netCounter.get(key)}`;
    }

    const fromComp = netlistComponents.find((c) => c.id === conn.from);
    const toComp = netlistComponents.find((c) => c.id === conn.to);
    if (fromComp) {
      const pin = fromComp.pins.find((p) => p.name === conn.fromPin);
      if (pin) pin.net = netName;
    }
    if (toComp) {
      const pin = toComp.pins.find((p) => p.name === conn.toPin);
      if (pin) pin.net = netName;
    }

    return {
      from: conn.from,
      fromPin: conn.fromPin,
      to: conn.to,
      toPin: conn.toPin,
      net: netName,
    };
  });

  const allNets: Net[] = Array.from(nets.values()).map((n) => ({
    name: n.name,
    type: n.type,
    voltage: n.voltage,
  }));

  const autoNets = new Set(netlistConnections.map((c) => c.net).filter((n) => !nets.has(n)));
  for (const netName of autoNets) {
    allNets.push({ name: netName, type: "signal" });
  }

  return {
    components: netlistComponents,
    connections: netlistConnections,
    nets: allNets,
  };
}
