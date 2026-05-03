import type { Netlist, NetlistComponent } from "./circuit-netlist.js";

// ── Reference designator prefix ───────────────────────────────────────────────
function toRefId(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

// ── Sequential RefDes (R1, D1, U1, Q1 …) ─────────────────────────────────────
const REFDES_PREFIX: Record<string, string> = {
  Resistor: "R", PhotoResistor: "R", Thermistor: "R",
  Capacitor: "C",
  Inductor: "L", Transformer: "T",
  LED: "D", Diode: "D", ZenerDiode: "D", SchottkyDiode: "D", TVSDiode: "D",
  NPN: "Q", PNP: "Q", NMOSFET: "Q", PMOSFET: "Q",
  OpAmp741: "U", OpAmpTL082: "U", OpAmpLM358: "U",
  VoltageRegulator: "U", LDO: "U", BuckConverter: "U", BoostConverter: "U",
  LevelShifter: "U", IC: "U",
  DHT11: "U", DHT22: "U", MPU6050: "U", Ultrasonic: "US", IRSensor: "U",
  ArduinoUno: "MCU", ArduinoNano: "MCU", ESP32: "MCU", ESP8266: "MCU",
  RaspberryPiPico: "MCU", STM32: "MCU",
  Button: "SW", Switch: "SW",
  Crystal: "Y", Buzzer: "BZ", Motor: "M", Relay: "K", Solenoid: "L",
};

function buildRefDesMap(components: NetlistComponent[]): Map<string, string> {
  const counters = new Map<string, number>();
  const refMap   = new Map<string, string>();
  for (const comp of components) {
    const prefix = REFDES_PREFIX[comp.type] ?? "X";
    const count  = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, count);
    refMap.set(comp.id, `${prefix}${count}`);
  }
  return refMap;
}

// ── KiCad footprint mapping ────────────────────────────────────────────────────
// All entries use verified KiCad 7/8 standard library footprint IDs.
// THT variants are preferred for hobbyist use (breadboard-friendly).
const KICAD_FOOTPRINTS: Record<string, string> = {
  // Passives — THT axial / disc
  Resistor:       "Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal",
  Capacitor:      "Capacitor_THT:C_Disc_D5.0mm_W2.5mm_P5.00mm",
  Inductor:       "Inductor_THT:L_Axial_L5.3mm_D2.2mm_P7.62mm_Horizontal",
  Transformer:    "Transformer:Transformer_1P_1S",
  Button:         "Button_Switch_THT:SW_PUSH_6mm",
  Switch:         "Button_Switch_THT:SW_MEC_5GTH",
  Crystal:        "Crystal:Crystal_HC49-U_Vertical",

  // Diodes — THT
  LED:            "LED_THT:LED_D5.0mm",
  Diode:          "Diode_THT:D_DO-41_SOD81_P10.16mm_Horizontal",
  ZenerDiode:     "Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal",
  SchottkyDiode:  "Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal",
  TVSDiode:       "Diode_THT:D_DO-41_SOD81_P10.16mm_Horizontal",

  // BJTs / MOSFETs — THT
  NPN:            "Package_TO_SOT_THT:TO-92_Inline",
  PNP:            "Package_TO_SOT_THT:TO-92_Inline",
  NMOSFET:        "Package_TO_SOT_THT:TO-220-3_Vertical",
  PMOSFET:        "Package_TO_SOT_THT:TO-220-3_Vertical",

  // Op-amps — DIP-8
  OpAmp741:       "Package_DIP:DIP-8_W7.62mm",
  OpAmpTL082:     "Package_DIP:DIP-8_W7.62mm",
  OpAmpLM358:     "Package_DIP:DIP-8_W7.62mm",

  // Power — THT / SMD module
  VoltageRegulator: "Package_TO_SOT_THT:TO-220-3_Vertical",
  LDO:              "Package_TO_SOT_THT:TO-252-2",
  BuckConverter:    "Converter_DCDC:Converter_DCDC_7-SMD_11.7x10.3mm_P2.3mm",
  BoostConverter:   "Converter_DCDC:Converter_DCDC_7-SMD_11.7x10.3mm_P2.3mm",
  LevelShifter:     "Module:4xLevelShifter_4ch",

  // Sensors
  DHT11:          "Sensor:DHT11",
  DHT22:          "Sensor:DHT22",
  MPU6050:        "Sensor_Motion:InvenSense_MPU-6050_QFN-24_4x4mm_P0.5mm",
  Ultrasonic:     "Connector_PinHeader_2.54mm:PinHeader_1x04_P2.54mm_Vertical",
  IRSensor:       "Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical",
  PhotoResistor:  "Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal",
  Thermistor:     "Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal",

  // MCU modules
  ArduinoUno:       "Module:Arduino_UNO_R3",
  ArduinoNano:      "Module:Arduino_Nano",
  ESP32:            "Module:ESP32-WROOM-32",
  ESP8266:          "Module:ESP-12E",
  RaspberryPiPico:  "Module:RPi_Pico",
  STM32:            "Module:STM32F103C8T6_Blue_Pill",

  // Generic IC
  IC: "Package_DIP:DIP-8_W7.62mm",

  // Actuators
  Buzzer:   "Buzzer_Beeper:Buzzer_12x9.5RM7.6",
  Motor:    "Connector_PinHeader_2.54mm:PinHeader_1x02_P2.54mm_Vertical",
  Relay:    "Relay_THT:Relay_SPDT_Rayex_HJR-3FF_Pitch5.08mm",
  Solenoid: "Connector_PinHeader_2.54mm:PinHeader_1x02_P2.54mm_Vertical",
};

// ── KiCad symbol library mapping ──────────────────────────────────────────────
// Maps component type → { lib, part } so KiCad never prompts to remap symbols.
// Library names match the KiCad 7/8 default symbol library table.
interface LibSource { lib: string; part: string; description: string }

const KICAD_LIBSOURCE: Record<string, LibSource> = {
  // Passives
  Resistor:       { lib: "Device",               part: "R",                       description: "Resistor" },
  Capacitor:      { lib: "Device",               part: "C",                       description: "Unpolarized capacitor" },
  Inductor:       { lib: "Device",               part: "L",                       description: "Inductor" },
  Transformer:    { lib: "Device",               part: "Transformer_1P_1S",        description: "Transformer 1 primary 1 secondary" },
  Button:         { lib: "Device",               part: "SW_Push",                 description: "Push button" },
  Switch:         { lib: "Device",               part: "SW_SPST",                 description: "SPST switch" },
  Crystal:        { lib: "Device",               part: "Crystal",                 description: "Piezo crystal" },

  // Diodes
  LED:            { lib: "Device",               part: "LED",                     description: "Light emitting diode" },
  Diode:          { lib: "Device",               part: "D",                       description: "Diode" },
  ZenerDiode:     { lib: "Device",               part: "D_Zener",                 description: "Zener diode" },
  SchottkyDiode:  { lib: "Device",               part: "D_Schottky",              description: "Schottky diode" },
  TVSDiode:       { lib: "Device",               part: "D_TVS",                   description: "Transient voltage suppressor" },

  // Transistors
  NPN:            { lib: "Transistor_BJT",       part: "Q_NPN_BCE",               description: "NPN transistor" },
  PNP:            { lib: "Transistor_BJT",       part: "Q_PNP_BCE",               description: "PNP transistor" },
  NMOSFET:        { lib: "Transistor_FET",       part: "2N7000",                  description: "N-channel MOSFET" },
  PMOSFET:        { lib: "Transistor_FET",       part: "IRF9540N",                description: "P-channel MOSFET" },

  // Op-amps
  OpAmp741:       { lib: "Amplifier_Operational", part: "LM741",                  description: "LM741 op-amp" },
  OpAmpTL082:     { lib: "Amplifier_Operational", part: "TL082",                  description: "TL082 dual JFET op-amp" },
  OpAmpLM358:     { lib: "Amplifier_Operational", part: "LM358",                  description: "LM358 dual op-amp" },

  // Voltage regulators
  VoltageRegulator: { lib: "Regulator_Linear",   part: "L78xx",                   description: "LM78xx voltage regulator" },
  LDO:              { lib: "Regulator_Linear",   part: "AMS1117-3.3",             description: "AMS1117 LDO" },
  BuckConverter:    { lib: "Regulator_Switching", part: "LM2596S-ADJ",            description: "Buck DC-DC converter" },
  BoostConverter:   { lib: "Regulator_Switching", part: "MC34063AD",              description: "Boost DC-DC converter" },
  LevelShifter:     { lib: "Interface_LevelTranslator", part: "TXB0108PWR",       description: "8-ch bidirectional level shifter" },

  // Sensors
  DHT11:          { lib: "Sensor_Temperature",   part: "DHT11",                   description: "DHT11 humidity/temperature sensor" },
  DHT22:          { lib: "Sensor_Temperature",   part: "DHT22",                   description: "DHT22 humidity/temperature sensor" },
  MPU6050:        { lib: "Sensor_Motion",        part: "InvenSense_MPU-6050",     description: "MPU-6050 6-axis IMU" },
  Ultrasonic:     { lib: "Sensor_Range",         part: "HC-SR04",                 description: "HC-SR04 ultrasonic sensor" },
  IRSensor:       { lib: "Device",               part: "R_Photo",                 description: "IR proximity sensor" },
  PhotoResistor:  { lib: "Device",               part: "R_Photo",                 description: "Light-dependent resistor" },
  Thermistor:     { lib: "Device",               part: "R_Thermistor_NTC",        description: "NTC thermistor" },

  // MCU modules
  ArduinoUno:      { lib: "MCU_Module",          part: "Arduino_UNO_R3",          description: "Arduino Uno R3" },
  ArduinoNano:     { lib: "MCU_Module",          part: "Arduino_Nano_v3.x",       description: "Arduino Nano v3" },
  ESP32:           { lib: "MCU_Module",          part: "ESP32-WROOM-32",          description: "ESP32-WROOM-32 module" },
  ESP8266:         { lib: "MCU_Module",          part: "ESP-12E",                 description: "ESP-12E module" },
  RaspberryPiPico: { lib: "MCU_Module",          part: "RPi_Pico",               description: "Raspberry Pi Pico" },
  STM32:           { lib: "MCU_ST_STM32F1",      part: "STM32F103C8Tx",          description: "STM32F103C8T6 Blue Pill" },

  // Generic IC
  IC: { lib: "Device", part: "IC", description: "Generic integrated circuit" },

  // Actuators
  Buzzer:   { lib: "Device",    part: "Buzzer",    description: "Buzzer" },
  Motor:    { lib: "Device",    part: "Motor_DC",  description: "DC motor" },
  Relay:    { lib: "Relay",     part: "RELAY_4",   description: "Relay SPDT" },
  Solenoid: { lib: "Device",    part: "Solenoid",  description: "Solenoid / linear actuator" },
};

// ── KiCad Netlist (.net) ──────────────────────────────────────────────────────
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

  const refMap = buildRefDesMap(netlist.components);
  for (const comp of netlist.components) {
    const ref      = refMap.get(comp.id) ?? toRefId(comp.name);
    const props    = comp.properties ?? {};
    const value    = props["resistance"] ?? props["capacitance"] ?? props["inductance"]
                  ?? props["model"] ?? comp.type;
    const fp       = KICAD_FOOTPRINTS[comp.type] ?? "";
    const lib      = KICAD_LIBSOURCE[comp.type] ?? { lib: "Device", part: comp.type, description: comp.type };

    lines.push(`    (comp (ref "${ref}")`);
    lines.push(`      (value "${value}")`);
    lines.push(`      (footprint "${fp}")`);
    lines.push(`      (datasheet "~")`);
    lines.push(`      (libsource (lib "${lib.lib}") (part "${lib.part}") (description "${lib.description}"))`);
    lines.push(`      (sheetpath (names "/") (tstamps "/"))`);
    lines.push(`      (tstamp "${ref}-${Date.now().toString(16)}")`);
    lines.push(`    )`);
  }
  lines.push(`  )`);

  // Build net → node list from connections
  const netMap = new Map<string, Array<{ ref: string; pin: string }>>();
  for (const conn of netlist.connections) {
    // Skip nc-type internal nets in the exported netlist nodes
    const fromIsComp = netlist.components.some((c) => c.id === conn.from);
    const toIsComp   = netlist.components.some((c) => c.id === conn.to);

    const fromRef    = refMap.get(conn.from) ?? toRefId(conn.from);
    const toRef      = refMap.get(conn.to)   ?? toRefId(conn.to);
    const fromComp   = netlist.components.find((c) => c.id === conn.from);
    const toComp     = netlist.components.find((c) => c.id === conn.to);
    const fromPinNum = fromComp?.pins.find((p) => p.name === conn.fromPin)?.pinNumber?.toString() ?? conn.fromPin;
    const toPinNum   = toComp?.pins.find((p) => p.name === conn.toPin)?.pinNumber?.toString() ?? conn.toPin;

    if (!netMap.has(conn.net)) netMap.set(conn.net, []);
    const nodes = netMap.get(conn.net)!;

    if (fromIsComp && !nodes.some((n) => n.ref === fromRef && n.pin === fromPinNum)) {
      nodes.push({ ref: fromRef, pin: fromPinNum });
    }
    if (toIsComp && !nodes.some((n) => n.ref === toRef && n.pin === toPinNum)) {
      nodes.push({ ref: toRef, pin: toPinNum });
    }
  }

  lines.push(`  (nets`);
  let netCode = 1;
  for (const [netName, nodes] of netMap) {
    if (nodes.length === 0) continue;
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

// ── Proteus SDF Netlist ───────────────────────────────────────────────────────
export function exportProteusNetlist(netlist: Netlist, title: string = "circuit"): string {
  const now = new Date().toISOString();
  const lines: string[] = [];

  lines.push(`* Strict Circuit Compiler v2.0 — Proteus ISIS Compatible Netlist`);
  lines.push(`* Title: ${title}`);
  lines.push(`* Generated: ${now}`);
  lines.push(``);
  lines.push(`[COMPONENTS]`);
  const refMapP = buildRefDesMap(netlist.components);
  for (const comp of netlist.components) {
    const ref   = refMapP.get(comp.id) ?? toRefId(comp.name);
    const props = comp.properties ?? {};
    const value = props["resistance"] ?? props["capacitance"] ?? props["model"] ?? comp.type;
    const lib   = KICAD_LIBSOURCE[comp.type];
    const partName = lib ? `${lib.lib}:${lib.part}` : comp.type;
    lines.push(`${ref} ${partName} ${value}`);
  }
  lines.push(``);
  lines.push(`[NETS]`);

  const netMap = new Map<string, Array<{ ref: string; pin: string }>>();
  for (const conn of netlist.connections) {
    const fromIsComp = netlist.components.some((c) => c.id === conn.from);
    const toIsComp   = netlist.components.some((c) => c.id === conn.to);
    const fromRef    = refMapP.get(conn.from) ?? toRefId(conn.from);
    const toRef      = refMapP.get(conn.to)   ?? toRefId(conn.to);
    const fromComp   = netlist.components.find((c) => c.id === conn.from);
    const toComp     = netlist.components.find((c) => c.id === conn.to);
    const fromPinNum = fromComp?.pins.find((p) => p.name === conn.fromPin)?.pinNumber?.toString() ?? conn.fromPin;
    const toPinNum   = toComp?.pins.find((p) => p.name === conn.toPin)?.pinNumber?.toString() ?? conn.toPin;

    if (!netMap.has(conn.net)) netMap.set(conn.net, []);
    const nodes = netMap.get(conn.net)!;
    if (fromIsComp && !nodes.some((n) => n.ref === fromRef && n.pin === fromPinNum)) nodes.push({ ref: fromRef, pin: fromPinNum });
    if (toIsComp   && !nodes.some((n) => n.ref === toRef   && n.pin === toPinNum))   nodes.push({ ref: toRef,   pin: toPinNum });
  }

  for (const [netName, nodes] of netMap) {
    if (nodes.length === 0) continue;
    const nodeStr = nodes.map((n) => `${n.ref}-${n.pin}`).join(" ");
    lines.push(`${netName} ${nodeStr}`);
  }
  lines.push(``);
  lines.push(`[END]`);
  return lines.join("\n");
}

// ── SPICE Netlist (.sp / LTSpice-compatible) ──────────────────────────────────
// Rules:
//   - Ground nets → node "0"
//   - Power nets  → V{name} 0 DC {voltage}  (ideal voltage source)
//   - Resistor    → R{ref} {n1} {n2} {value}
//   - Capacitor   → C{ref} {n1} {n2} {value}
//   - Inductor    → L{ref} {n1} {n2} {value}
//   - Diode       → D{ref} {anode} {cathode} {model}
//   - NPN BJT     → Q{ref} {collector} {base} {emitter} {model}
//   - PNP BJT     → Q{ref} {collector} {base} {emitter} {model}
//   - N-MOSFET    → M{ref} {drain} {gate} {source} {source} NMOS
//   - P-MOSFET    → M{ref} {drain} {gate} {source} {source} PMOS
//   - All others  → X{ref} {pins...} {subckt_name}
//
// Unconnected pins are assigned a unique floating node name.

export function exportSpiceNetlist(netlist: Netlist, title: string = "circuit"): string {
  const now = new Date().toISOString();
  const lines: string[] = [];

  lines.push(`* ${title}`);
  lines.push(`* SPICE Netlist — LTSpice/Proteus compatible`);
  lines.push(`* Generated by Strict Circuit Compiler v2.0 on ${now}`);
  lines.push(`*`);

  // ── Resolve net names ──────────────────────────────────────────────────────
  // GND → "0", power nets → their variable name, signal nets → their variable name
  const netNodes = new Map<string, string>(); // net varName → SPICE node
  for (const net of netlist.nets) {
    if (net.type === "ground") {
      netNodes.set(net.name, "0");
    } else {
      // Sanitise to SPICE-safe identifiers (no spaces, no special chars)
      netNodes.set(net.name, net.name.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase());
    }
  }

  // ── Emit power net voltage sources ────────────────────────────────────────
  lines.push(`*`);
  lines.push(`* Power supply sources`);
  for (const net of netlist.nets) {
    if (net.type === "power" && net.voltage !== undefined) {
      const node = netNodes.get(net.name)!;
      lines.push(`V${net.name.toUpperCase()} ${node} 0 DC ${net.voltage}`);
    }
  }
  lines.push(`*`);

  // ── Helper: resolve which SPICE node a component pin is on ───────────────
  function pinNode(comp: NetlistComponent, pinName: string, floatIdx: { n: number }): string {
    const pin = comp.pins.find((p) => p.name === pinName);
    if (!pin?.net) return `FLOAT_${comp.id}_${pinName}`.toUpperCase();
    // pin.net holds the net variable name (set by buildNetlist)
    const resolved = netNodes.get(pin.net);
    if (resolved) return resolved;
    // Auto-generated signal net name — sanitise
    return pin.net.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase();
  }

  // ── SPICE Model hints ──────────────────────────────────────────────────────
  const modelHints: string[] = [];

  lines.push(`* Components`);

  const refMapS = buildRefDesMap(netlist.components);
  for (const comp of netlist.components) {
    const fullRef = refMapS.get(comp.id) ?? toRefId(comp.name);
    const ref     = fullRef.replace(/^[A-Za-z]+/, "");
    const props = comp.properties ?? {};
    const fi    = { n: 0 };

    const pn = (pinName: string) => pinNode(comp, pinName, fi);

    switch (comp.type) {
      // ── Resistor ──────────────────────────────────────────────────────────
      case "Resistor":
      case "PhotoResistor":
      case "Thermistor": {
        const val = props["resistance"] ?? "1k";
        lines.push(`R${ref} ${pn("pin1")} ${pn("pin2")} ${val}`);
        break;
      }
      // ── Capacitor ─────────────────────────────────────────────────────────
      case "Capacitor": {
        const val = props["capacitance"] ?? "100n";
        lines.push(`C${ref} ${pn("pin1")} ${pn("pin2")} ${val}`);
        break;
      }
      // ── Inductor ──────────────────────────────────────────────────────────
      case "Inductor": {
        const val = props["inductance"] ?? "10u";
        lines.push(`L${ref} ${pn("pin1")} ${pn("pin2")} ${val}`);
        break;
      }
      // ── Crystal (model as inductor network — simplified) ─────────────────
      case "Crystal": {
        lines.push(`* Crystal ${ref} — use .param for accurate model`);
        lines.push(`L${ref}_m ${pn("pin1")} N_${ref}_MID 10m`);
        lines.push(`C${ref}_m N_${ref}_MID ${pn("pin2")} 32f`);
        lines.push(`C${ref}_p ${pn("pin1")} ${pn("pin2")} 5p`);
        break;
      }
      // ── Diodes ────────────────────────────────────────────────────────────
      case "LED": {
        const color = props["color"] ?? "red";
        const model = color === "red" ? "LED_RED" : color === "green" ? "LED_GRN" : color === "blue" ? "LED_BLU" : "LED";
        lines.push(`D${ref} ${pn("anode")} ${pn("cathode")} ${model}`);
        modelHints.push(`.model ${model} D(Is=1e-15 N=1.8 Rs=1)`);
        break;
      }
      case "Diode": {
        const model = props["model"] ?? "1N4007";
        lines.push(`D${ref} ${pn("anode")} ${pn("cathode")} ${model}`);
        modelHints.push(`.model 1N4007 D(Is=4.352n N=1.906 Rs=0.6458 Ikf=0 Xti=3 Eg=1.11)`);
        break;
      }
      case "ZenerDiode": {
        const model = props["model"] ?? "DZ_ZENER";
        lines.push(`D${ref} ${pn("anode")} ${pn("cathode")} ${model}`);
        modelHints.push(`.model DZ_ZENER D(Is=1e-15 N=1.8 Rs=1 BV=5.1 IBV=0.001)`);
        break;
      }
      case "SchottkyDiode": {
        const model = props["model"] ?? "1N5819";
        lines.push(`D${ref} ${pn("anode")} ${pn("cathode")} ${model}`);
        modelHints.push(`.model 1N5819 D(Is=5.85u N=1.01 Rs=0.0306 Ikf=12.06 Xti=3 Eg=0.69 Bv=40 Ibv=0.001)`);
        break;
      }
      case "TVSDiode": {
        lines.push(`D${ref} ${pn("anode")} ${pn("cathode")} TVS`);
        modelHints.push(`.model TVS D(Is=1e-15 N=1.8 Rs=0.5 BV=6.8 IBV=0.001)`);
        break;
      }
      // ── BJT Transistors ───────────────────────────────────────────────────
      case "NPN": {
        const model = props["model"] ?? "2N2222";
        lines.push(`Q${ref} ${pn("collector")} ${pn("base")} ${pn("emitter")} ${model}`);
        modelHints.push(`.model 2N2222 NPN(Is=14.34f Xti=3 Eg=1.11 Vaf=74.03 Bf=255.9 Ise=14.34f Ne=1.307 Ikf=0.2847 Xtb=1.5 Br=6.092 Isc=0 Nc=2 Ikr=0 Rc=1 Cjc=7.306p Mjc=0.3416 Vjc=0.75 Fc=0.5 Cje=22.01p Mje=0.377 Vje=0.75 Tr=46.91n Tf=411.1p Itf=0.6 Vtf=1.7 Xtf=3 Rb=10)`);
        break;
      }
      case "PNP": {
        const model = props["model"] ?? "2N2907";
        lines.push(`Q${ref} ${pn("collector")} ${pn("base")} ${pn("emitter")} ${model}`);
        modelHints.push(`.model 2N2907 PNP(Is=650.6e-18 Xti=3 Eg=1.11 Vaf=115.7 Bf=231.7 Ne=1.829 Ise=54.81f Ikf=1.079 Xtb=1.5 Br=3.563 Isc=0 Nc=2 Ikr=0 Rc=0.715 Cjc=14.76p Mjc=0.5383 Vjc=0.75 Fc=0.5 Cje=19.82p Mje=0.3357 Vje=0.75 Tr=111.3n Tf=603.7p Itf=0.65 Vtf=5 Xtf=1.7 Rb=10)`);
        break;
      }
      // ── MOSFETs ───────────────────────────────────────────────────────────
      case "NMOSFET": {
        const model = props["model"] ?? "2N7000";
        lines.push(`M${ref} ${pn("drain")} ${pn("gate")} ${pn("source")} ${pn("source")} ${model}`);
        modelHints.push(`.model 2N7000 NMOS(Level=1 Vto=2.0 Kp=80m Gamma=0 Phi=0.6 Lambda=0.02 Rs=1 Rd=1 Is=25.0n Cgd=20p Cgs=25p Cbd=20p Cbs=25p)`);
        break;
      }
      case "PMOSFET": {
        const model = props["model"] ?? "IRF9540N";
        lines.push(`M${ref} ${pn("drain")} ${pn("gate")} ${pn("source")} ${pn("source")} ${model}`);
        modelHints.push(`.model IRF9540N PMOS(Level=3 Tox=100n Vto=-3.8 Rs=0.003 Kp=6 Phi=0.6 Lambda=0.02 Ld=5n Gamma=0 Rg=1 Rd=0.003)`);
        break;
      }
      // ── Op-Amps (subcircuits) ─────────────────────────────────────────────
      case "OpAmpLM358": {
        lines.push(`X${ref} ${pn("in_pos")} ${pn("in_neg")} ${pn("vcc")} ${pn("gnd")} ${pn("out")} LM358`);
        modelHints.push(`.subckt LM358 IN+ IN- VCC GND OUT`);
        modelHints.push(`* Use the LTSpice built-in LM358 model or import from manufacturer SPICE`);
        modelHints.push(`.ends LM358`);
        break;
      }
      case "OpAmp741": {
        lines.push(`X${ref} ${pn("in_pos")} ${pn("in_neg")} ${pn("vcc")} ${pn("vee")} ${pn("out")} LM741`);
        modelHints.push(`.subckt LM741 IN+ IN- VCC VEE OUT`);
        modelHints.push(`* Use the LTSpice built-in LM741 model`);
        modelHints.push(`.ends LM741`);
        break;
      }
      case "OpAmpTL082": {
        lines.push(`X${ref} ${pn("in_pos")} ${pn("in_neg")} ${pn("vcc")} ${pn("vee")} ${pn("out")} TL082`);
        modelHints.push(`.subckt TL082 IN+ IN- VCC VEE OUT`);
        modelHints.push(`* Use manufacturer SPICE model for TL082`);
        modelHints.push(`.ends TL082`);
        break;
      }
      // ── Voltage regulators ────────────────────────────────────────────────
      case "VoltageRegulator":
      case "LDO": {
        lines.push(`X${ref} ${pn("in")} ${pn("gnd")} ${pn("out")} ${comp.type}`);
        modelHints.push(`* ${comp.type}: import manufacturer SPICE model for accurate simulation`);
        break;
      }
      case "BuckConverter":
      case "BoostConverter": {
        lines.push(`X${ref} ${pn("vin")} ${pn("gnd")} ${pn("vout")} ${pn("en")} ${comp.type}`);
        modelHints.push(`* ${comp.type}: import manufacturer SPICE model (e.g., LM2596 / LM2577)`);
        break;
      }
      // ── Button / Switch ───────────────────────────────────────────────────
      case "Button":
      case "Switch": {
        lines.push(`S${ref} ${pn("pin1")} ${pn("pin2")} CTRL 0 SW_IDEAL`);
        modelHints.push(`.model SW_IDEAL SW(Ron=0.01 Roff=1G Vt=0.5 Vh=0)`);
        break;
      }
      // ── Arduino / MCU modules — not simulable, emit as comment ────────────
      case "ArduinoUno":
      case "ArduinoNano":
      case "ESP32":
      case "ESP8266":
      case "RaspberryPiPico":
      case "STM32": {
        lines.push(`* ${comp.type} '${comp.name}' — MCU module; not directly simulable in SPICE`);
        lines.push(`* Import manufacturer SPICE model or use behavioural sources for GPIO`);
        break;
      }
      // ── Motor / Solenoid — modelled as RL series ──────────────────────────
      case "Motor": {
        const p1 = comp.type === "Motor" ? "m_pos" : "coil_a";
        const p2 = comp.type === "Motor" ? "m_neg" : "coil_b";
        lines.push(`* Motor ${ref} modelled as series R+L (back-EMF not included)`);
        lines.push(`R${ref}_r ${pn(p1)} N_${ref}_MID 5`);
        lines.push(`L${ref}_l N_${ref}_MID ${pn(p2)} 10m`);
        break;
      }
      case "Solenoid": {
        lines.push(`* Solenoid ${ref} modelled as series R+L`);
        lines.push(`R${ref}_r ${pn("coil_a")} N_${ref}_MID 10`);
        lines.push(`L${ref}_l N_${ref}_MID ${pn("coil_b")} 50m`);
        break;
      }
      // ── Relay — coil modelled as RL, contacts as ideal switch ─────────────
      case "Relay": {
        lines.push(`* Relay ${ref} — coil modelled as RL series`);
        lines.push(`R${ref}_coil ${pn("coil_a")} N_${ref}_COIL 100`);
        lines.push(`L${ref}_coil N_${ref}_COIL ${pn("coil_b")} 30m`);
        lines.push(`* Relay contacts (NO/NC) — model as voltage-controlled switches`);
        lines.push(`S${ref}_no ${pn("com")} ${pn("no")} N_${ref}_COIL ${pn("coil_b")} SW_RELAY`);
        modelHints.push(`.model SW_RELAY SW(Ron=0.1 Roff=100Meg Vt=1.0 Vh=0.1)`);
        break;
      }
      // ── Buzzer — modelled as simple R+L ──────────────────────────────────
      case "Buzzer": {
        lines.push(`* Buzzer ${ref} — electromagnetic model (R+L)`);
        lines.push(`R${ref}_r ${pn("vcc")} N_${ref}_MID 50`);
        lines.push(`L${ref}_l N_${ref}_MID ${pn("gnd")} 5m`);
        break;
      }
      // ── All other components — generic subcircuit placeholder ─────────────
      default: {
        const pinNodes = comp.pins.map((p) => pn(p.name)).join(" ");
        lines.push(`X${ref} ${pinNodes} ${comp.type}`);
        modelHints.push(`* ${comp.type}: provide .subckt ${comp.type} or import SPICE model`);
        break;
      }
    }
  }

  // ── Model definitions ──────────────────────────────────────────────────────
  if (modelHints.length > 0) {
    lines.push(``);
    lines.push(`* ── Model definitions ────────────────────────────────────────`);
    const seen = new Set<string>();
    for (const hint of modelHints) {
      if (!seen.has(hint)) { seen.add(hint); lines.push(hint); }
    }
  }

  lines.push(``);
  lines.push(`.END`);
  return lines.join("\n");
}
