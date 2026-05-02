export type PinType = "power" | "ground" | "signal" | "analog" | "digital" | "bidirectional" | "passive";
export type NetType = "power" | "ground" | "signal" | "nc";
export type PinDirection = "in" | "out" | "passive" | "power" | "ground" | "open_collector" | "bidirectional";
export type ComponentCategory = "passive" | "active_discrete" | "active_ic" | "sensor" | "module" | "power" | "actuator";

export interface ComponentPinDef {
  name: string;
  type: PinType;
  direction: PinDirection;
  maxVoltage?: number;
  driveVoltage?: number;
  pinNumber: number;
  required?: boolean;
}

export interface ComponentDef {
  pins: ComponentPinDef[];
  voltageLevel?: number;
  category: ComponentCategory;
  description: string;
  aliases?: string[];
}

export interface ParsedPin {
  name: string;
  type: PinType;
  direction: PinDirection;
  maxVoltage?: number;
  driveVoltage?: number;
  pinNumber: number;
  required?: boolean;
  net?: string;
}

export interface ParsedComponent {
  id: string;
  name: string;
  type: string;
  pins: ParsedPin[];
  properties: Record<string, string>;
  line: number;
  category: ComponentCategory;
  voltageLevel?: number;
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
  noConnect?: boolean;
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

export const COMPONENT_DEFS: Record<string, ComponentDef> = {
  // ── Passives ──────────────────────────────────────────────────────────────
  Resistor: {
    category: "passive",
    description: "Two-terminal passive resistor",
    pins: [
      { name: "pin1", type: "passive", direction: "passive", pinNumber: 1 },
      { name: "pin2", type: "passive", direction: "passive", pinNumber: 2 },
    ],
  },
  Capacitor: {
    category: "passive",
    description: "Two-terminal passive capacitor",
    pins: [
      { name: "pin1", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "pin2", type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },
  Inductor: {
    category: "passive",
    description: "Two-terminal passive inductor",
    pins: [
      { name: "pin1", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "pin2", type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },
  Button: {
    category: "passive",
    description: "Momentary push button",
    pins: [
      { name: "pin1", type: "signal", direction: "passive", pinNumber: 1 },
      { name: "pin2", type: "signal", direction: "passive", pinNumber: 2 },
    ],
  },
  Switch: {
    category: "passive",
    description: "SPST switch",
    pins: [
      { name: "pin1", type: "signal", direction: "passive", pinNumber: 1 },
      { name: "pin2", type: "signal", direction: "passive", pinNumber: 2 },
    ],
  },
  Crystal: {
    category: "passive",
    description: "Quartz crystal oscillator",
    pins: [
      { name: "pin1", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "pin2", type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },
  Transformer: {
    category: "passive",
    description: "Two-winding transformer",
    pins: [
      { name: "p1", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "p2", type: "analog", direction: "passive", pinNumber: 2 },
      { name: "s1", type: "analog", direction: "passive", pinNumber: 3 },
      { name: "s2", type: "analog", direction: "passive", pinNumber: 4 },
    ],
  },

  // ── Diodes ────────────────────────────────────────────────────────────────
  LED: {
    category: "active_discrete",
    description: "Light-emitting diode",
    pins: [
      { name: "anode", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "cathode", type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },
  Diode: {
    category: "active_discrete",
    description: "Standard rectifier diode (1N4007)",
    aliases: ["1N4007"],
    pins: [
      { name: "anode", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "cathode", type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },
  ZenerDiode: {
    category: "active_discrete",
    description: "Zener diode for voltage reference/clamping",
    aliases: ["Zener"],
    pins: [
      { name: "anode", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "cathode", type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },
  SchottkyDiode: {
    category: "active_discrete",
    description: "Schottky diode — low forward voltage drop (~0.3V)",
    aliases: ["Schottky", "1N5819"],
    pins: [
      { name: "anode", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "cathode", type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },
  TVSDiode: {
    category: "active_discrete",
    description: "Transient voltage suppressor diode (ESD protection)",
    aliases: ["TVS"],
    pins: [
      { name: "anode", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "cathode", type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },

  // ── BJT Transistors ───────────────────────────────────────────────────────
  NPN: {
    category: "active_discrete",
    description: "NPN bipolar junction transistor (e.g. 2N2222, BC547)",
    aliases: ["Transistor", "BJT_NPN"],
    voltageLevel: 5.0,
    pins: [
      { name: "base",      type: "signal",  direction: "in",  maxVoltage: 40, driveVoltage: 0.7, pinNumber: 1 },
      { name: "collector", type: "analog",  direction: "open_collector",      pinNumber: 2 },
      { name: "emitter",   type: "analog",  direction: "out",                 pinNumber: 3 },
    ],
  },
  PNP: {
    category: "active_discrete",
    description: "PNP bipolar junction transistor (e.g. 2N2907, BC557)",
    aliases: ["BJT_PNP"],
    voltageLevel: 5.0,
    pins: [
      { name: "base",      type: "signal",  direction: "in",  maxVoltage: 40, driveVoltage: 0.7, pinNumber: 1 },
      { name: "collector", type: "analog",  direction: "open_collector",      pinNumber: 2 },
      { name: "emitter",   type: "analog",  direction: "out",                 pinNumber: 3 },
    ],
  },

  // ── MOSFETs ───────────────────────────────────────────────────────────────
  NMOSFET: {
    category: "active_discrete",
    description: "N-Channel Enhancement MOSFET (e.g. 2N7000, IRF540N)",
    aliases: ["NFET", "MOSFET_N"],
    voltageLevel: 5.0,
    pins: [
      { name: "gate",   type: "digital", direction: "in",  maxVoltage: 20, pinNumber: 1 },
      { name: "drain",  type: "analog",  direction: "open_collector",      pinNumber: 2 },
      { name: "source", type: "analog",  direction: "out",                 pinNumber: 3 },
    ],
  },
  PMOSFET: {
    category: "active_discrete",
    description: "P-Channel Enhancement MOSFET (e.g. IRF9540N)",
    aliases: ["PFET", "MOSFET_P"],
    voltageLevel: 5.0,
    pins: [
      { name: "gate",   type: "digital", direction: "in",  maxVoltage: 20, pinNumber: 1 },
      { name: "drain",  type: "analog",  direction: "open_collector",      pinNumber: 2 },
      { name: "source", type: "analog",  direction: "out",                 pinNumber: 3 },
    ],
  },

  // ── Op-Amps ───────────────────────────────────────────────────────────────
  OpAmp741: {
    category: "active_ic",
    description: "LM741 operational amplifier (±15V supply)",
    aliases: ["LM741", "UA741"],
    voltageLevel: 15.0,
    pins: [
      { name: "in_pos", type: "analog",  direction: "in",  pinNumber: 3 },
      { name: "in_neg", type: "analog",  direction: "in",  pinNumber: 2 },
      { name: "out",    type: "analog",  direction: "out", pinNumber: 6 },
      { name: "vcc",    type: "power",   direction: "power",  maxVoltage: 18, pinNumber: 7 },
      { name: "vee",    type: "ground",  direction: "ground",                 pinNumber: 4 },
      { name: "os1",    type: "analog",  direction: "passive", pinNumber: 1 },
      { name: "os2",    type: "analog",  direction: "passive", pinNumber: 5 },
    ],
  },
  OpAmpTL082: {
    category: "active_ic",
    description: "TL082 JFET-input dual op-amp (±15V supply)",
    aliases: ["TL082", "TL081"],
    voltageLevel: 15.0,
    pins: [
      { name: "in_pos", type: "analog",  direction: "in",  pinNumber: 3 },
      { name: "in_neg", type: "analog",  direction: "in",  pinNumber: 2 },
      { name: "out",    type: "analog",  direction: "out", pinNumber: 1 },
      { name: "vcc",    type: "power",   direction: "power",  maxVoltage: 18, pinNumber: 8 },
      { name: "vee",    type: "ground",  direction: "ground",                 pinNumber: 4 },
    ],
  },
  OpAmpLM358: {
    category: "active_ic",
    description: "LM358 dual op-amp, single-supply (3V–32V)",
    aliases: ["LM358"],
    voltageLevel: 5.0,
    pins: [
      { name: "in_pos", type: "analog",  direction: "in",  pinNumber: 3 },
      { name: "in_neg", type: "analog",  direction: "in",  pinNumber: 2 },
      { name: "out",    type: "analog",  direction: "out", pinNumber: 1 },
      { name: "vcc",    type: "power",   direction: "power",  maxVoltage: 32, pinNumber: 8 },
      { name: "gnd",    type: "ground",  direction: "ground",                 pinNumber: 4 },
    ],
  },

  // ── Voltage Regulators ────────────────────────────────────────────────────
  VoltageRegulator: {
    category: "power",
    description: "LM78xx series linear voltage regulator",
    aliases: ["LM7805", "LM7812", "LM78xx"],
    pins: [
      { name: "in",  type: "power",  direction: "power",  pinNumber: 1 },
      { name: "out", type: "power",  direction: "power",  pinNumber: 3 },
      { name: "gnd", type: "ground", direction: "ground", pinNumber: 2 },
    ],
  },
  LDO: {
    category: "power",
    description: "Low-dropout linear voltage regulator (e.g. AMS1117-3.3)",
    aliases: ["AMS1117", "LD1117"],
    pins: [
      { name: "in",   type: "power",  direction: "power",  pinNumber: 3 },
      { name: "out",  type: "power",  direction: "power",  pinNumber: 1 },
      { name: "gnd",  type: "ground", direction: "ground", pinNumber: 2 },
      { name: "adj",  type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },
  BuckConverter: {
    category: "power",
    description: "Step-down (buck) DC-DC converter",
    aliases: ["Buck", "StepDown"],
    pins: [
      { name: "vin",  type: "power",  direction: "power",  maxVoltage: 40, pinNumber: 1 },
      { name: "vout", type: "power",  direction: "power",                  pinNumber: 2 },
      { name: "gnd",  type: "ground", direction: "ground",                 pinNumber: 3 },
      { name: "en",   type: "digital", direction: "in",                    pinNumber: 4 },
      { name: "fb",   type: "analog",  direction: "in",                    pinNumber: 5 },
    ],
  },
  BoostConverter: {
    category: "power",
    description: "Step-up (boost) DC-DC converter",
    aliases: ["Boost", "StepUp"],
    pins: [
      { name: "vin",  type: "power",  direction: "power",  maxVoltage: 40, pinNumber: 1 },
      { name: "vout", type: "power",  direction: "power",                  pinNumber: 2 },
      { name: "gnd",  type: "ground", direction: "ground",                 pinNumber: 3 },
      { name: "en",   type: "digital", direction: "in",                    pinNumber: 4 },
    ],
  },
  LevelShifter: {
    category: "active_ic",
    description: "Bidirectional logic level shifter (e.g. BSS138-based)",
    aliases: ["BSS138", "TXB0108"],
    pins: [
      { name: "lv",     type: "power",       direction: "power",  maxVoltage: 3.6, pinNumber: 1 },
      { name: "hv",     type: "power",       direction: "power",  maxVoltage: 5.5, pinNumber: 2 },
      { name: "gnd",    type: "ground",      direction: "ground",                 pinNumber: 3 },
      { name: "a",      type: "digital",     direction: "bidirectional", maxVoltage: 3.6, pinNumber: 4 },
      { name: "b",      type: "digital",     direction: "bidirectional", maxVoltage: 5.5, pinNumber: 5 },
    ],
  },
  IC: {
    category: "active_ic",
    description: "Generic integrated circuit",
    pins: [
      { name: "vcc", type: "power",   direction: "power",  maxVoltage: 5.5, pinNumber: 1 },
      { name: "gnd", type: "ground",  direction: "ground",                  pinNumber: 2 },
      { name: "in",  type: "signal",  direction: "in",                      pinNumber: 3 },
      { name: "out", type: "signal",  direction: "out",                     pinNumber: 4 },
    ],
  },

  // ── Sensors ───────────────────────────────────────────────────────────────
  DHT11: {
    category: "sensor",
    description: "Digital temperature & humidity sensor",
    voltageLevel: 3.5,
    pins: [
      { name: "vcc",  type: "power",   direction: "power",  maxVoltage: 5.5, pinNumber: 1 },
      { name: "data", type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 3.5, pinNumber: 2 },
      { name: "nc",   type: "analog",  direction: "passive",                  pinNumber: 3 },
      { name: "gnd",  type: "ground",  direction: "ground",                  pinNumber: 4 },
    ],
  },
  DHT22: {
    category: "sensor",
    description: "High-accuracy digital temperature & humidity sensor",
    aliases: ["AM2302"],
    voltageLevel: 3.3,
    pins: [
      { name: "vcc",  type: "power",   direction: "power",  maxVoltage: 5.5, pinNumber: 1 },
      { name: "data", type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 3.3, pinNumber: 2 },
      { name: "nc",   type: "analog",  direction: "passive",                  pinNumber: 3 },
      { name: "gnd",  type: "ground",  direction: "ground",                  pinNumber: 4 },
    ],
  },
  MPU6050: {
    category: "sensor",
    description: "6-axis IMU: 3-axis gyroscope + 3-axis accelerometer (I2C)",
    aliases: ["GY-521"],
    voltageLevel: 3.3,
    pins: [
      { name: "vcc",  type: "power",   direction: "power",   maxVoltage: 3.6, pinNumber: 1 },
      { name: "gnd",  type: "ground",  direction: "ground",                   pinNumber: 2 },
      { name: "scl",  type: "digital", direction: "in",      maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 3 },
      { name: "sda",  type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 4 },
      { name: "int",  type: "digital", direction: "out",     driveVoltage: 3.3, pinNumber: 5, required: false },
      { name: "ad0",  type: "digital", direction: "in",      maxVoltage: 3.6, pinNumber: 6, required: true },
    ],
  },
  Ultrasonic: {
    category: "sensor",
    description: "HC-SR04 ultrasonic distance sensor",
    aliases: ["HC-SR04", "HCSR04"],
    voltageLevel: 5.0,
    pins: [
      { name: "vcc",     type: "power",   direction: "power",  maxVoltage: 5.5, pinNumber: 1 },
      { name: "gnd",     type: "ground",  direction: "ground",                  pinNumber: 2 },
      { name: "trigger", type: "digital", direction: "in",     maxVoltage: 5.0, driveVoltage: 0, pinNumber: 3 },
      { name: "echo",    type: "digital", direction: "out",    driveVoltage: 5.0, pinNumber: 4 },
    ],
  },
  IRSensor: {
    category: "sensor",
    description: "IR proximity/obstacle sensor (FC-51)",
    aliases: ["FC-51"],
    voltageLevel: 3.3,
    pins: [
      { name: "vcc",    type: "power",   direction: "power",  maxVoltage: 5.5, pinNumber: 1 },
      { name: "gnd",    type: "ground",  direction: "ground",                  pinNumber: 2 },
      { name: "out",    type: "digital", direction: "out",    driveVoltage: 3.3, pinNumber: 3 },
    ],
  },
  PhotoResistor: {
    category: "sensor",
    description: "Light-dependent resistor (LDR / photocell)",
    aliases: ["LDR", "Photocell"],
    pins: [
      { name: "pin1", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "pin2", type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },
  Thermistor: {
    category: "sensor",
    description: "NTC/PTC thermistor (temperature-dependent resistor)",
    aliases: ["NTC", "PTC"],
    pins: [
      { name: "pin1", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "pin2", type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },

  // ── Modules / Boards ──────────────────────────────────────────────────────
  ArduinoUno: {
    category: "module",
    description: "Arduino Uno R3 — ATmega328P, 5V logic",
    aliases: ["Uno"],
    voltageLevel: 5.0,
    pins: [
      { name: "vcc",    type: "power",   direction: "power",  pinNumber: 1 },
      { name: "v3v3",   type: "power",   direction: "power",  pinNumber: 2 },
      { name: "gnd",    type: "ground",  direction: "ground", pinNumber: 3 },
      { name: "d0",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 4 },
      { name: "d1",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 5 },
      { name: "d2",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 6 },
      { name: "d3",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 7 },
      { name: "d4",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 8 },
      { name: "d5",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 9 },
      { name: "d6",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 10 },
      { name: "d7",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 11 },
      { name: "d8",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 12 },
      { name: "d9",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 13 },
      { name: "d10",    type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 14 },
      { name: "d11",    type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 15 },
      { name: "d12",    type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 16 },
      { name: "d13",    type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 17 },
      { name: "a0",     type: "analog",  direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 18 },
      { name: "a1",     type: "analog",  direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 19 },
      { name: "a2",     type: "analog",  direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 20 },
      { name: "a3",     type: "analog",  direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 21 },
      { name: "a4",     type: "analog",  direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 22 },
      { name: "a5",     type: "analog",  direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 23 },
      { name: "tx",     type: "digital", direction: "out",  driveVoltage: 5.0, pinNumber: 24 },
      { name: "rx",     type: "digital", direction: "in",   maxVoltage: 5.0, pinNumber: 25 },
      { name: "sda",    type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 26 },
      { name: "scl",    type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 27 },
      { name: "reset",  type: "digital", direction: "in",   maxVoltage: 5.0, pinNumber: 28 },
      { name: "aref",   type: "analog",  direction: "in",   maxVoltage: 5.0, pinNumber: 29 },
    ],
  },
  ArduinoNano: {
    category: "module",
    description: "Arduino Nano V3 — ATmega328P, 5V logic",
    aliases: ["Nano"],
    voltageLevel: 5.0,
    pins: [
      { name: "vcc",    type: "power",   direction: "power",  pinNumber: 1 },
      { name: "v3v3",   type: "power",   direction: "power",  pinNumber: 2 },
      { name: "gnd",    type: "ground",  direction: "ground", pinNumber: 3 },
      { name: "d2",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 4 },
      { name: "d3",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 5 },
      { name: "d4",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 6 },
      { name: "d5",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 7 },
      { name: "d6",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 8 },
      { name: "d7",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 9 },
      { name: "d8",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 10 },
      { name: "d9",     type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 11 },
      { name: "d10",    type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 12 },
      { name: "d11",    type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 13 },
      { name: "d12",    type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 14 },
      { name: "d13",    type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 15 },
      { name: "a0",     type: "analog",  direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 16 },
      { name: "a1",     type: "analog",  direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 17 },
      { name: "a2",     type: "analog",  direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 18 },
      { name: "a3",     type: "analog",  direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 19 },
      { name: "a4",     type: "analog",  direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 20 },
      { name: "a5",     type: "analog",  direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 21 },
      { name: "a6",     type: "analog",  direction: "in",            maxVoltage: 5.0, pinNumber: 22 },
      { name: "a7",     type: "analog",  direction: "in",            maxVoltage: 5.0, pinNumber: 23 },
      { name: "tx",     type: "digital", direction: "out",  driveVoltage: 5.0, pinNumber: 24 },
      { name: "rx",     type: "digital", direction: "in",   maxVoltage: 5.0, pinNumber: 25 },
      { name: "sda",    type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 26 },
      { name: "scl",    type: "digital", direction: "bidirectional", maxVoltage: 5.0, driveVoltage: 5.0, pinNumber: 27 },
      { name: "reset",  type: "digital", direction: "in",   maxVoltage: 5.0, pinNumber: 28 },
    ],
  },
  ESP32: {
    category: "module",
    description: "ESP32 DevKit — dual-core Xtensa LX6, WiFi+BT, 3.3V logic",
    aliases: ["ESP32-WROOM", "ESP32-DevKit"],
    voltageLevel: 3.3,
    pins: [
      { name: "vcc",    type: "power",   direction: "power",  maxVoltage: 3.6, pinNumber: 1 },
      { name: "v5",     type: "power",   direction: "power",  maxVoltage: 5.5, pinNumber: 2, required: false },
      { name: "gnd",    type: "ground",  direction: "ground",                  pinNumber: 3 },
      { name: "gpio0",  type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 4 },
      { name: "gpio2",  type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 5 },
      { name: "gpio4",  type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 6 },
      { name: "gpio5",  type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 7 },
      { name: "gpio12", type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 8 },
      { name: "gpio13", type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 9 },
      { name: "gpio14", type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 10 },
      { name: "gpio15", type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 11 },
      { name: "gpio16", type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 12 },
      { name: "gpio17", type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 13 },
      { name: "gpio18", type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 14 },
      { name: "gpio19", type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 15 },
      { name: "gpio21", type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 16 },
      { name: "gpio22", type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 17 },
      { name: "gpio23", type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 18 },
      { name: "gpio25", type: "analog",  direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 19 },
      { name: "gpio26", type: "analog",  direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 20 },
      { name: "gpio27", type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 21 },
      { name: "gpio32", type: "analog",  direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 22 },
      { name: "gpio33", type: "analog",  direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 23 },
      { name: "gpio34", type: "analog",  direction: "in",            maxVoltage: 3.6, pinNumber: 24 },
      { name: "gpio35", type: "analog",  direction: "in",            maxVoltage: 3.6, pinNumber: 25 },
      { name: "tx",     type: "digital", direction: "out",  driveVoltage: 3.3, pinNumber: 26 },
      { name: "rx",     type: "digital", direction: "in",   maxVoltage: 3.6, pinNumber: 27 },
      { name: "sda",    type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 28 },
      { name: "scl",    type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 29 },
      { name: "en",     type: "digital", direction: "in",   maxVoltage: 3.6, pinNumber: 30 },
    ],
  },
  ESP8266: {
    category: "module",
    description: "ESP8266 — single-core Tensilica L106, WiFi, 3.3V logic",
    aliases: ["NodeMCU", "ESP-12"],
    voltageLevel: 3.3,
    pins: [
      { name: "vcc",   type: "power",   direction: "power",  maxVoltage: 3.6, pinNumber: 1 },
      { name: "gnd",   type: "ground",  direction: "ground",                  pinNumber: 2 },
      { name: "d0",    type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 3 },
      { name: "d1",    type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 4 },
      { name: "d2",    type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 5 },
      { name: "d3",    type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 6 },
      { name: "d4",    type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 7 },
      { name: "d5",    type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 8 },
      { name: "d6",    type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 9 },
      { name: "d7",    type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 10 },
      { name: "d8",    type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 11 },
      { name: "a0",    type: "analog",  direction: "in",            maxVoltage: 1.0, pinNumber: 12 },
      { name: "tx",    type: "digital", direction: "out",  driveVoltage: 3.3, pinNumber: 13 },
      { name: "rx",    type: "digital", direction: "in",   maxVoltage: 3.6, pinNumber: 14 },
      { name: "en",    type: "digital", direction: "in",   maxVoltage: 3.6, pinNumber: 15 },
      { name: "rst",   type: "digital", direction: "in",   maxVoltage: 3.6, pinNumber: 16 },
    ],
  },
  RaspberryPiPico: {
    category: "module",
    description: "Raspberry Pi Pico — RP2040, dual-core, 3.3V logic",
    aliases: ["Pico", "RP2040"],
    voltageLevel: 3.3,
    pins: [
      { name: "vsys",  type: "power",   direction: "power",  maxVoltage: 5.5, pinNumber: 1 },
      { name: "v3v3",  type: "power",   direction: "power",  maxVoltage: 3.6, pinNumber: 2 },
      { name: "gnd",   type: "ground",  direction: "ground",                  pinNumber: 3 },
      { name: "gp0",   type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 4 },
      { name: "gp1",   type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 5 },
      { name: "gp2",   type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 6 },
      { name: "gp3",   type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 7 },
      { name: "gp4",   type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 8 },
      { name: "gp5",   type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 9 },
      { name: "gp6",   type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 10 },
      { name: "gp7",   type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 11 },
      { name: "gp8",   type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 12 },
      { name: "gp9",   type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 13 },
      { name: "gp10",  type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 14 },
      { name: "gp11",  type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 15 },
      { name: "gp12",  type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 16 },
      { name: "gp13",  type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 17 },
      { name: "gp14",  type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 18 },
      { name: "gp15",  type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 19 },
      { name: "sda",   type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 20 },
      { name: "scl",   type: "digital", direction: "bidirectional", maxVoltage: 3.6, driveVoltage: 3.3, pinNumber: 21 },
      { name: "tx",    type: "digital", direction: "out",  driveVoltage: 3.3, pinNumber: 22 },
      { name: "rx",    type: "digital", direction: "in",   maxVoltage: 3.6, pinNumber: 23 },
    ],
  },

  // ── Actuators / High-current loads ────────────────────────────────────────
  Motor: {
    category: "actuator",
    description: "DC motor — requires transistor/H-bridge driver and flyback diode",
    aliases: ["DCMotor", "DCM"],
    pins: [
      { name: "m_pos", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "m_neg", type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },
  Buzzer: {
    category: "actuator",
    description: "Piezoelectric or electromagnetic buzzer — high-current, needs driver and flyback",
    aliases: ["Speaker", "Piezo"],
    pins: [
      { name: "vcc", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "gnd", type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },
  Relay: {
    category: "actuator",
    description: "Electromagnetic relay — inductive coil with switch contacts, requires flyback diode",
    aliases: ["RELAY", "ElectroRelay"],
    pins: [
      { name: "coil_a", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "coil_b", type: "analog", direction: "passive", pinNumber: 2 },
      { name: "com",    type: "analog", direction: "passive", pinNumber: 3 },
      { name: "no",     type: "analog", direction: "passive", pinNumber: 4 },
      { name: "nc",     type: "analog", direction: "passive", pinNumber: 5 },
    ],
  },
  Solenoid: {
    category: "actuator",
    description: "Electromagnetic solenoid / linear actuator — inductive, requires flyback diode",
    aliases: ["LinearActuator"],
    pins: [
      { name: "coil_a", type: "analog", direction: "passive", pinNumber: 1 },
      { name: "coil_b", type: "analog", direction: "passive", pinNumber: 2 },
    ],
  },
};

function buildAlias(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [key, def] of Object.entries(COMPONENT_DEFS)) {
    m.set(key.toLowerCase(), key);
    for (const alias of def.aliases ?? []) {
      m.set(alias.toLowerCase(), key);
    }
  }
  return m;
}

const ALIAS_MAP = buildAlias();

function resolveComponentType(raw: string): string | undefined {
  return COMPONENT_DEFS[raw] ? raw : ALIAS_MAP.get(raw.toLowerCase());
}

function stripComments(line: string): string {
  const idx = line.indexOf("//");
  return idx === -1 ? line : line.substring(0, idx);
}

function parseNetDeclaration(line: string, lineNum: number, errors: ParseError[], nets: Map<string, ParsedNet>): boolean {
  // Original syntax: Net::power(5.0), Net::ground(), Net::signal()
  const netPowerMatch = line.match(/^let\s+(\w+)\s*=\s*Net::power\(([0-9.]+)\)\s*;?$/);
  if (netPowerMatch) {
    nets.set(netPowerMatch[1], { name: netPowerMatch[1], type: "power", voltage: parseFloat(netPowerMatch[2]) });
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

  // Strict syntax: Net::VCC { voltage: 5.0 }, Net::GND, Net::Signal { ... }
  const vccBraceMatch = line.match(/^let\s+(\w+)\s*=\s*Net::VCC\s*\{([^}]*)\}\s*;?$/i);
  if (vccBraceMatch) {
    const voltMatch = vccBraceMatch[2].match(/voltage\s*:\s*([0-9.]+)/);
    nets.set(vccBraceMatch[1], { name: vccBraceMatch[1], type: "power", voltage: voltMatch ? parseFloat(voltMatch[1]) : 5.0 });
    return true;
  }
  const vccBareMatch = line.match(/^let\s+(\w+)\s*=\s*Net::VCC\s*;?$/i);
  if (vccBareMatch) {
    nets.set(vccBareMatch[1], { name: vccBareMatch[1], type: "power", voltage: 5.0 });
    return true;
  }
  const gndBraceMatch = line.match(/^let\s+(\w+)\s*=\s*Net::GND\s*(?:\{[^}]*\})?\s*;?$/i);
  if (gndBraceMatch) {
    nets.set(gndBraceMatch[1], { name: gndBraceMatch[1], type: "ground" });
    return true;
  }
  const sigBraceMatch = line.match(/^let\s+(\w+)\s*=\s*Net::Signal\s*(?:\{[^}]*\})?\s*;?$/i);
  if (sigBraceMatch) {
    nets.set(sigBraceMatch[1], { name: sigBraceMatch[1], type: "signal" });
    return true;
  }
  const pwmBraceMatch = line.match(/^let\s+(\w+)\s*=\s*Net::PWM\s*(?:\{[^}]*\})?\s*;?$/i);
  if (pwmBraceMatch) {
    nets.set(pwmBraceMatch[1], { name: pwmBraceMatch[1], type: "signal" });
    return true;
  }

  // Net::nc()  — no-connect marker; silences W004/W005 on the connected pin
  const ncMatch = line.match(/^let\s+(\w+)\s*=\s*Net::nc\(\)\s*;?$/i);
  if (ncMatch) {
    nets.set(ncMatch[1], { name: ncMatch[1], type: "nc", noConnect: true });
    return true;
  }

  // Net::new('NAME') or Net::new("NAME") or Net::new()  — custom named signal net
  const newMatch = line.match(/^let\s+(\w+)\s*=\s*Net::new\s*\(\s*(?:'[^']*'|"[^"]*")?\s*\)\s*;?$/i);
  if (newMatch) {
    nets.set(newMatch[1], { name: newMatch[1], type: "signal" });
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
    const [, varName, rawType] = simpleMatch;
    const resolvedType = resolveComponentType(rawType);
    if (!resolvedType) {
      errors.push({
        line: lineNum,
        column: line.indexOf(rawType) + 1,
        message: `Unknown component type '${rawType}'. See documentation for available components.`,
        errorCode: "E002",
        severity: "error",
        sourceLine: line,
      });
      return true;
    }
    const def = COMPONENT_DEFS[resolvedType];
    components.set(varName, {
      id: varName, name: varName, type: resolvedType,
      pins: def.pins.map((p) => ({ ...p })),
      properties: {},
      line: lineNum,
      category: def.category,
      voltageLevel: def.voltageLevel,
    });
    return true;
  }

  const propsMatch = line.match(/^let\s+(\w+)\s*=\s*Component::(\w+)\s*\{([^}]*)\}\s*;?$/);
  if (propsMatch) {
    const [, varName, rawType, propsStr] = propsMatch;
    const resolvedType = resolveComponentType(rawType);
    if (!resolvedType) {
      errors.push({
        line: lineNum,
        column: line.indexOf(rawType) + 1,
        message: `Unknown component type '${rawType}'. See documentation for available components.`,
        errorCode: "E002",
        severity: "error",
        sourceLine: line,
      });
      return true;
    }
    const def = COMPONENT_DEFS[resolvedType];
    const props: Record<string, string> = {};
    for (const prop of propsStr.split(",")) {
      const kv = prop.trim().match(/^(\w+)\s*:\s*(.+)$/);
      if (kv) props[kv[1]] = kv[2].replace(/^"|"$/g, "").trim();
    }

    let voltageOverride = def.voltageLevel;
    if (props["voltage"]) voltageOverride = parseFloat(props["voltage"]);

    components.set(varName, {
      id: varName, name: varName, type: resolvedType,
      pins: def.pins.map((p) => ({ ...p })),
      properties: props,
      line: lineNum,
      category: def.category,
      voltageLevel: voltageOverride,
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
): boolean {
  // Support both => (original) and -> (strict DSL)
  const connectMatch = line.match(/^connect!\((.+?)\s*(?:=>|->|→)\s*(.+?)\)\s*;?$/);
  if (!connectMatch) return false;

  function parseEndpoint(s: string): { varName: string; pin?: string } | null {
    const dotMatch = s.match(/^(\w+)\.(\w+)$/);
    if (dotMatch) return { varName: dotMatch[1], pin: dotMatch[2] };
    const bareMatch = s.match(/^(\w+)$/);
    if (bareMatch) return { varName: bareMatch[1] };
    return null;
  }

  const from = parseEndpoint(connectMatch[1].trim());
  const to = parseEndpoint(connectMatch[2].trim());

  if (!from || !to) {
    errors.push({
      line: lineNum, column: 1,
      message: `Invalid connect! syntax. Use: connect!(component.pin => component.pin) or connect!(component.pin => net)`,
      errorCode: "E003", severity: "error", sourceLine: line,
    });
    return true;
  }

  connections.push({
    from: from.varName, fromPin: from.pin ?? "pin1",
    to: to.varName,    toPin: to.pin ?? "pin1",
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

    // Strict DSL: skip 'circuit Name {' opening and closing '}'
    if (/^circuit\s+\w+\s*\{/.test(line)) continue;
    if (/^\}$/.test(line)) continue;

    if (parseNetDeclaration(line, lineNum, errors, nets)) continue;
    if (parseComponentDeclaration(line, lineNum, errors, components)) continue;
    if (parseConnectionMacro(line, lineNum, errors, connections)) continue;

    errors.push({
      line: lineNum, column: 1,
      message: `Unexpected statement: '${line}'. Expected: let declaration, Net::, Component::, or connect!()`,
      errorCode: "E000", severity: "error", sourceLine: raw,
    });
  }

  return { components, connections, nets, errors };
}
