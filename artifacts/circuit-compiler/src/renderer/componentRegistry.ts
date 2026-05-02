// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT REGISTRY
//
// Single source of truth that maps every component *type name* (as emitted by
// the parser/netlist) to:
//   • symbolId  — which entry in SYMBOL_LIBRARY to stamp
//   • category  — used by the force-directed layout scorer
//   • boundingBox — { hw, hh } half-width/half-height in px (must match symbol)
//
// For IC-type components that are rendered dynamically (ArduinoUno, ESP32 …)
// symbolId is set to "IC" — the renderer handles those with the generic IC box.
// ─────────────────────────────────────────────────────────────────────────────

export type ComponentCategory =
  | "passive"
  | "diode"
  | "transistor"
  | "actuator"
  | "active_ic"
  | "module"
  | "sensor";

export interface ComponentRegistryEntry {
  /** Maps to a key in SYMBOL_LIBRARY, or "IC" for the generic IC renderer */
  symbolId: string;
  category: ComponentCategory;
  /** Half-width in px — must match the symbol's hw */
  hw: number;
  /** Half-height in px — must match the symbol's hh */
  hh: number;
}

export const COMPONENT_REGISTRY: Record<string, ComponentRegistryEntry> = {
  // ── Passives ────────────────────────────────────────────────────────────────
  Resistor:         { symbolId: "RESISTOR",       category: "passive",    hw: 48, hh: 16 },
  Capacitor:        { symbolId: "CAPACITOR",       category: "passive",    hw: 48, hh: 20 },
  Inductor:         { symbolId: "INDUCTOR",        category: "passive",    hw: 48, hh: 14 },
  Crystal:          { symbolId: "CRYSTAL",         category: "passive",    hw: 48, hh: 18 },
  Button:           { symbolId: "SWITCH",          category: "passive",    hw: 48, hh: 20 },
  Switch:           { symbolId: "SWITCH",          category: "passive",    hw: 48, hh: 20 },

  // ── Diode family ────────────────────────────────────────────────────────────
  Diode:            { symbolId: "DIODE",           category: "diode",      hw: 48, hh: 16 },
  LED:              { symbolId: "LED",             category: "diode",      hw: 48, hh: 20 },
  ZenerDiode:       { symbolId: "ZENER_DIODE",     category: "diode",      hw: 48, hh: 18 },
  SchottkyDiode:    { symbolId: "SCHOTTKY_DIODE",  category: "diode",      hw: 48, hh: 18 },
  TVSDiode:         { symbolId: "TVS_DIODE",       category: "diode",      hw: 48, hh: 20 },
  InfraredEmitter:  { symbolId: "IR_EMITTER",      category: "diode",      hw: 48, hh: 20 },
  InfraredDetector: { symbolId: "IR_DETECTOR",     category: "diode",      hw: 48, hh: 20 },

  // ── Transistors ─────────────────────────────────────────────────────────────
  NPN:              { symbolId: "TRANSISTOR_NPN",  category: "transistor", hw: 48, hh: 48 },
  PNP:              { symbolId: "TRANSISTOR_PNP",  category: "transistor", hw: 48, hh: 48 },
  Transistor:       { symbolId: "TRANSISTOR_NPN",  category: "transistor", hw: 48, hh: 48 },
  NMOSFET:          { symbolId: "MOSFET_N",        category: "transistor", hw: 48, hh: 48 },
  PMOSFET:          { symbolId: "MOSFET_P",        category: "transistor", hw: 48, hh: 48 },

  // ── Op-Amps (proper triangle symbol) ────────────────────────────────────────
  OpAmp:            { symbolId: "OPAMP",           category: "active_ic",  hw: 48, hh: 40 },
  LM741:            { symbolId: "OPAMP",           category: "active_ic",  hw: 48, hh: 40 },
  LM358:            { symbolId: "OPAMP",           category: "active_ic",  hw: 48, hh: 40 },
  LM393:            { symbolId: "OPAMP",           category: "active_ic",  hw: 48, hh: 40 },
  LM324:            { symbolId: "OPAMP",           category: "active_ic",  hw: 48, hh: 40 },
  TL071:            { symbolId: "OPAMP",           category: "active_ic",  hw: 48, hh: 40 },
  TL072:            { symbolId: "OPAMP",           category: "active_ic",  hw: 48, hh: 40 },

  // ── Actuators / Electromechanical ───────────────────────────────────────────
  Motor:            { symbolId: "MOTOR",           category: "actuator",   hw: 48, hh: 40 },
  Buzzer:           { symbolId: "BUZZER",          category: "actuator",   hw: 44, hh: 44 },
  Relay:            { symbolId: "RELAY",           category: "actuator",   hw: 48, hh: 40 },

  // ── Modules / ICs (rendered with generic IC box) ────────────────────────────
  ArduinoUno:       { symbolId: "IC", category: "module",    hw: 68, hh: 80  },
  ArduinoMega:      { symbolId: "IC", category: "module",    hw: 68, hh: 100 },
  ArduinoNano:      { symbolId: "IC", category: "module",    hw: 68, hh: 80  },
  ESP32:            { symbolId: "IC", category: "module",    hw: 68, hh: 80  },
  ESP8266:          { symbolId: "IC", category: "module",    hw: 68, hh: 60  },
  RaspberryPiPico:  { symbolId: "IC", category: "module",    hw: 68, hh: 100 },
  STM32F103:        { symbolId: "IC", category: "active_ic", hw: 68, hh: 80  },
  ATmega328P:       { symbolId: "IC", category: "active_ic", hw: 68, hh: 80  },
  LM555:            { symbolId: "IC", category: "active_ic", hw: 68, hh: 60  },
  NE555:            { symbolId: "IC", category: "active_ic", hw: 68, hh: 60  },
  ULN2003:          { symbolId: "IC", category: "active_ic", hw: 68, hh: 60  },
  L293D:            { symbolId: "IC", category: "active_ic", hw: 68, hh: 80  },
  L298N:            { symbolId: "IC", category: "active_ic", hw: 68, hh: 80  },
  L7805:            { symbolId: "IC", category: "active_ic", hw: 68, hh: 40  },
  L7812:            { symbolId: "IC", category: "active_ic", hw: 68, hh: 40  },
  LM7805:           { symbolId: "IC", category: "active_ic", hw: 68, hh: 40  },
  LM317:            { symbolId: "IC", category: "active_ic", hw: 68, hh: 40  },

  // ── Sensors / Displays ──────────────────────────────────────────────────────
  DHT11:            { symbolId: "IC", category: "sensor", hw: 68, hh: 40  },
  DHT22:            { symbolId: "IC", category: "sensor", hw: 68, hh: 40  },
  DS18B20:          { symbolId: "IC", category: "sensor", hw: 68, hh: 40  },
  BMP180:           { symbolId: "IC", category: "sensor", hw: 68, hh: 40  },
  MPU6050:          { symbolId: "IC", category: "sensor", hw: 68, hh: 60  },
  HC_SR04:          { symbolId: "IC", category: "sensor", hw: 68, hh: 40  },
  SSD1306:          { symbolId: "IC", category: "sensor", hw: 68, hh: 60  },
  LCD1602:          { symbolId: "IC", category: "sensor", hw: 68, hh: 80  },
  MAX7219:          { symbolId: "IC", category: "active_ic", hw: 68, hh: 80 },
  Solenoid:         { symbolId: "MOTOR",           category: "actuator",   hw: 48, hh: 40 },
};

/**
 * Look up the registry entry for a component type.
 * Falls back to a generic IC entry for unknown types.
 */
export function getRegistryEntry(componentType: string): ComponentRegistryEntry {
  return COMPONENT_REGISTRY[componentType] ?? {
    symbolId: "IC",
    category:  "active_ic",
    hw:        68,
    hh:        60,
  };
}
