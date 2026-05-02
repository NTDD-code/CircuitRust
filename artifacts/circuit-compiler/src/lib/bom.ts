import type { Netlist } from "@workspace/api-client-react";

export interface BOMItem {
  ref: string;
  type: string;
  category: string;
  package: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

const PACKAGE_MAP: Record<string, string> = {
  Resistor: "0805 SMD",
  Capacitor: "0805 SMD",
  Inductor: "1210 SMD",
  LED: "5mm THT",
  Diode: "DO-41",
  ZenerDiode: "DO-35",
  SchottkyDiode: "DO-41",
  TVSDiode: "DO-41",
  NPN: "TO-92",
  PNP: "TO-92",
  NMOSFET: "TO-220",
  PMOSFET: "TO-220",
  OpAmp741: "DIP-8",
  OpAmpTL082: "DIP-8",
  OpAmpLM358: "DIP-8",
  LevelShifter: "TSSOP-8",
  VoltageRegulator: "TO-220",
  LDO: "SOT-223",
  BuckConverter: "TO-220-5",
  BoostConverter: "TO-220-5",
  DHT11: "4-pin THT",
  DHT22: "4-pin THT",
  MPU6050: "QFN-24",
  Ultrasonic: "HC-SR04 module",
  IRSensor: "5mm THT",
  PhotoResistor: "5mm THT",
  Thermistor: "5mm THT",
  Button: "6x6mm THT",
  Switch: "THT",
  Crystal: "HC-49",
  Transformer: "THT",
  ArduinoUno: "Arduino Uno R3",
  ArduinoNano: "Arduino Nano",
  ESP32: "ESP32-DevKitC",
  ESP8266: "NodeMCU v3",
  RaspberryPiPico: "RP2040",
  IC: "DIP-8",
};

const PRICE_MAP: Record<string, number> = {
  Resistor: 0.02,
  Capacitor: 0.05,
  Inductor: 0.15,
  LED: 0.12,
  Diode: 0.08,
  ZenerDiode: 0.10,
  SchottkyDiode: 0.15,
  TVSDiode: 0.25,
  NPN: 0.10,
  PNP: 0.10,
  NMOSFET: 0.45,
  PMOSFET: 0.45,
  OpAmp741: 0.35,
  OpAmpTL082: 0.55,
  OpAmpLM358: 0.40,
  LevelShifter: 0.80,
  VoltageRegulator: 0.55,
  LDO: 0.65,
  BuckConverter: 1.20,
  BoostConverter: 1.20,
  DHT11: 1.50,
  DHT22: 3.50,
  MPU6050: 2.20,
  Ultrasonic: 1.80,
  IRSensor: 0.20,
  PhotoResistor: 0.10,
  Thermistor: 0.25,
  Button: 0.08,
  Switch: 0.15,
  Crystal: 0.35,
  Transformer: 2.50,
  ArduinoUno: 8.50,
  ArduinoNano: 4.50,
  ESP32: 4.00,
  ESP8266: 2.50,
  RaspberryPiPico: 4.00,
  IC: 0.50,
};

export function generateBOM(netlist: Netlist): BOMItem[] {
  const counts: Record<string, { type: string; category: string; ids: string[] }> = {};

  for (const comp of netlist.components) {
    if (!counts[comp.type]) {
      counts[comp.type] = { type: comp.type, category: comp.category, ids: [] };
    }
    counts[comp.type].ids.push(comp.id);
  }

  return Object.values(counts).map(({ type, category, ids }) => {
    const qty = ids.length;
    const unit = PRICE_MAP[type] ?? 0.50;
    return {
      ref: ids.join(", "),
      type,
      category,
      package: PACKAGE_MAP[type] ?? "THT",
      quantity: qty,
      unitPrice: unit,
      totalPrice: parseFloat((unit * qty).toFixed(2)),
    };
  });
}

export function bomToCSV(items: BOMItem[]): string {
  const header = "Ref,Component,Category,Package,Qty,Unit Price (USD),Total Price (USD)";
  const rows = items.map(
    (i) => `"${i.ref}","${i.type}","${i.category}","${i.package}",${i.quantity},$${i.unitPrice.toFixed(2)},$${i.totalPrice.toFixed(2)}`
  );
  const total = items.reduce((s, i) => s + i.totalPrice, 0);
  return [header, ...rows, `"","","","TOTAL","","","$${total.toFixed(2)}"`].join("\n");
}
