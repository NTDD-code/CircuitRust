import type { Netlist, NetlistComponent } from "./circuit-netlist.js";

function toRefId(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

function toFootprint(type: string): string {
  const footprints: Record<string, string> = {
    Resistor: "Resistor_SMD:R_0805_2012Metric",
    Capacitor: "Capacitor_SMD:C_0805_2012Metric",
    Inductor: "Inductor_SMD:L_0805_2012Metric",
    LED: "LED_SMD:LED_0805_Handsoldering",
    Diode: "Diode_THT:D_DO-41_SOD81_P10.16mm_Horizontal",
    ZenerDiode: "Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal",
    SchottkyDiode: "Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal",
    TVSDiode: "Diode_THT:D_DO-41_SOD81_P10.16mm_Horizontal",
    NPN: "Package_TO_SOT_THT:TO-92_Inline",
    PNP: "Package_TO_SOT_THT:TO-92_Inline",
    NMOSFET: "Package_TO_SOT_THT:TO-92_Inline",
    PMOSFET: "Package_TO_SOT_THT:TO-92_Inline",
    OpAmp741: "Package_DIP:DIP-8_W7.62mm",
    OpAmpTL082: "Package_DIP:DIP-8_W7.62mm",
    OpAmpLM358: "Package_DIP:DIP-8_W7.62mm",
    VoltageRegulator: "Package_TO_SOT_THT:TO-220-3_Vertical",
    LDO: "Package_TO_SOT_THT:TO-252-2",
    BuckConverter: "Module:A4988",
    BoostConverter: "Module:A4988",
    LevelShifter: "Module:4xLevelShifter_4ch",
    DHT11: "Sensor:DHT11",
    DHT22: "Sensor:DHT22",
    MPU6050: "Sensor_Motion:InvenSense_MPU-6050_QFN-24_4x4mm_P0.5mm",
    Ultrasonic: "Connector_PinHeader_2.54mm:PinHeader_1x04_P2.54mm_Vertical",
    Button: "Button_Switch_THT:SW_PUSH_6mm",
    Switch: "Button_Switch_THT:SW_MEC_5GTH",
    Crystal: "Crystal:Crystal_HC49-U_Vertical",
    ArduinoUno: "Module:Arduino_UNO_R3",
    ArduinoNano: "Module:Arduino_Nano",
    ESP32: "Module:ESP32-WROOM-32",
    ESP8266: "Module:ESP-12E",
    RaspberryPiPico: "Module:RPi_Pico",
    IC: "Package_DIP:DIP-8_W7.62mm",
  };
  return footprints[type] ?? "";
}

export function exportKicadNetlist(netlist: Netlist, title: string = "circuit"): string {
  const now = new Date().toISOString();
  const lines: string[] = [];

  lines.push(`(export (version "E")`);
  lines.push(`  (design`);
  lines.push(`    (source "${title}.net")`);
  lines.push(`    (date "${now}")`);
  lines.push(`    (tool "Strict Circuit Compiler v2.0")`);
  lines.push(`  )`);
  lines.push(`  (components`);

  for (const comp of netlist.components) {
    const ref = toRefId(comp.name);
    const value = comp.properties["resistance"] ?? comp.properties["capacitance"]
      ?? comp.properties["model"] ?? comp.type;
    const footprint = toFootprint(comp.type);
    lines.push(`    (comp (ref "${ref}")`);
    lines.push(`      (value "${value}")`);
    lines.push(`      (footprint "${footprint}")`);
    lines.push(`      (libsource (lib "Device") (part "${comp.type}") (description "${comp.type}"))`);
    lines.push(`    )`);
  }
  lines.push(`  )`);

  const netMap = new Map<string, Array<{ ref: string; pin: string }>>();
  for (const conn of netlist.connections) {
    const fromRef = toRefId(conn.from);
    const toRef   = toRefId(conn.to);
    const fromComp = netlist.components.find((c) => c.id === conn.from);
    const toComp   = netlist.components.find((c) => c.id === conn.to);
    const fromPinNum = fromComp?.pins.find((p) => p.name === conn.fromPin)?.pinNumber?.toString() ?? conn.fromPin;
    const toPinNum   = toComp?.pins.find((p) => p.name === conn.toPin)?.pinNumber?.toString() ?? conn.toPin;

    if (!netMap.has(conn.net)) netMap.set(conn.net, []);
    const nodes = netMap.get(conn.net)!;
    if (!nodes.some((n) => n.ref === fromRef && n.pin === fromPinNum)) {
      nodes.push({ ref: fromRef, pin: fromPinNum });
    }
    if (!nodes.some((n) => n.ref === toRef && n.pin === toPinNum)) {
      nodes.push({ ref: toRef, pin: toPinNum });
    }
  }

  lines.push(`  (nets`);
  let netCode = 1;
  for (const [netName, nodes] of netMap) {
    lines.push(`    (net (code "${netCode++}") (name "${netName}")`);
    for (const node of nodes) {
      lines.push(`      (node (ref "${node.ref}") (pin "${node.pin}"))`);
    }
    lines.push(`    )`);
  }
  lines.push(`  )`);
  lines.push(`)`);

  return lines.join("\n");
}

export function exportProteusNetlist(netlist: Netlist, title: string = "circuit"): string {
  const now = new Date().toISOString();
  const lines: string[] = [];

  lines.push(`* Strict Circuit Compiler v2.0 — Proteus ISIS Compatible Netlist`);
  lines.push(`* Title: ${title}`);
  lines.push(`* Generated: ${now}`);
  lines.push(``);
  lines.push(`[COMPONENTS]`);
  for (const comp of netlist.components) {
    const ref = toRefId(comp.name);
    const value = comp.properties["resistance"] ?? comp.properties["capacitance"]
      ?? comp.properties["model"] ?? comp.type;
    lines.push(`${ref} ${comp.type} ${value}`);
  }
  lines.push(``);
  lines.push(`[NETS]`);
  const netMap = new Map<string, Array<{ ref: string; pin: string }>>();
  for (const conn of netlist.connections) {
    const fromRef = toRefId(conn.from);
    const toRef   = toRefId(conn.to);
    const fromComp = netlist.components.find((c) => c.id === conn.from);
    const toComp   = netlist.components.find((c) => c.id === conn.to);
    const fromPinNum = fromComp?.pins.find((p) => p.name === conn.fromPin)?.pinNumber?.toString() ?? conn.fromPin;
    const toPinNum   = toComp?.pins.find((p) => p.name === conn.toPin)?.pinNumber?.toString() ?? conn.toPin;
    if (!netMap.has(conn.net)) netMap.set(conn.net, []);
    const nodes = netMap.get(conn.net)!;
    if (!nodes.some((n) => n.ref === fromRef && n.pin === fromPinNum)) nodes.push({ ref: fromRef, pin: fromPinNum });
    if (!nodes.some((n) => n.ref === toRef   && n.pin === toPinNum))   nodes.push({ ref: toRef,   pin: toPinNum });
  }
  for (const [netName, nodes] of netMap) {
    const nodeStr = nodes.map((n) => `${n.ref}.${n.pin}`).join(" ");
    lines.push(`${netName} ${nodeStr}`);
  }
  lines.push(``);
  lines.push(`[END]`);
  return lines.join("\n");
}

export function exportSpiceNetlist(netlist: Netlist, title: string = "circuit"): string {
  const now = new Date().toISOString();
  const lines: string[] = [];
  lines.push(`* ${title} — SPICE Netlist`);
  lines.push(`* Generated by Strict Circuit Compiler v2.0 on ${now}`);
  lines.push(``);

  const netMap = new Map<string, string>();
  for (const conn of netlist.connections) {
    netMap.set(conn.net, conn.net);
  }

  for (const comp of netlist.components) {
    const ref = toRefId(comp.name);
    const pinNets = comp.pins.map((p) => p.net ?? "?").join(" ");
    const value = comp.properties["resistance"] ?? comp.properties["capacitance"] ?? "1";
    lines.push(`* ${comp.type}`);
    lines.push(`X${ref} ${pinNets} ${comp.type} val="${value}"`);
  }
  lines.push(``);
  lines.push(`.END`);
  return lines.join("\n");
}
