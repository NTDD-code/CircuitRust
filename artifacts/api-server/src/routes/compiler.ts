import { Router } from "express";
import { CompileCircuitBody, ExportNetlistBody } from "@workspace/api-zod";
import { parseCircuit } from "../lib/circuit-parser.js";
import { validateCircuit } from "../lib/circuit-validator.js";
import { buildNetlist } from "../lib/circuit-netlist.js";
import { exportKicadNetlist, exportProteusNetlist, exportSpiceNetlist } from "../lib/circuit-exporter.js";
import { COMPONENT_DEFS } from "../lib/circuit-parser.js";

const router = Router();

router.post("/compiler/compile", (req, res) => {
  const parsed = CompileCircuitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { source } = parsed.data;
  const sourceLines = source.split("\n");

  const parseResult = parseCircuit(source);
  const validationResult = validateCircuit(
    parseResult.components,
    parseResult.connections,
    parseResult.nets,
    sourceLines,
  );

  const allErrors = [...parseResult.errors, ...validationResult.errors];
  const success = allErrors.length === 0;
  const netlist = success
    ? buildNetlist(parseResult.components, parseResult.connections, parseResult.nets)
    : undefined;

  res.json({
    success,
    errors: allErrors.map((e) => ({
      line: e.line, column: e.column, message: e.message, errorCode: e.errorCode, severity: e.severity,
    })),
    warnings: validationResult.warnings.map((w) => ({
      line: w.line, column: w.column, message: w.message, warningCode: w.warningCode,
    })),
    ...(netlist ? { netlist } : {}),
  });
});

router.post("/compiler/export", (req, res) => {
  const parsed = ExportNetlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { netlist, format = "kicad", title = "circuit" } = parsed.data;
  let content: string;
  let filename: string;

  if (format === "proteus") {
    content  = exportProteusNetlist(netlist as any, title);
    filename = `${title}.sdf`;
  } else if (format === "spice") {
    content  = exportSpiceNetlist(netlist as any, title);
    filename = `${title}.sp`;
  } else {
    content  = exportKicadNetlist(netlist as any, title);
    filename = `${title}.net`;
  }

  res.json({ content, filename, format: format ?? "kicad" });
});

router.get("/compiler/components", (_req, res) => {
  const components = Object.entries(COMPONENT_DEFS).map(([type, def]) => ({
    type,
    category: def.category,
    description: def.description,
    aliases: def.aliases ?? [],
    voltageLevel: def.voltageLevel,
    pins: def.pins.map((p) => ({
      name: p.name,
      type: p.type,
      direction: p.direction,
      maxVoltage: p.maxVoltage,
      driveVoltage: p.driveVoltage,
      pinNumber: p.pinNumber,
    })),
  }));
  res.json({ components });
});

const EXAMPLES = [
  {
    name: "LED Circuit",
    description: "Basic LED with current-limiting resistor — first circuit for beginners",
    source: `// Simple LED circuit with current-limiting resistor
let vcc = Net::power(5.0);
let gnd = Net::ground();

let r1 = Component::Resistor { resistance: "220" };
let led1 = Component::LED { color: "red" };

connect!(vcc => r1.pin1);
connect!(r1.pin2 => led1.anode);
connect!(led1.cathode => gnd);`,
  },
  {
    name: "Arduino + DHT11",
    description: "Arduino Uno reading a DHT11 temperature sensor — voltage mismatch safe",
    source: `// Arduino Uno + DHT11 temperature & humidity sensor
let vcc5 = Net::power(5.0);
let gnd  = Net::ground();

let ard  = Component::ArduinoUno;
let dht  = Component::DHT11;
let rpu  = Component::Resistor { resistance: "10000" };

connect!(vcc5 => ard.vcc);
connect!(gnd  => ard.gnd);
connect!(vcc5 => dht.vcc);
connect!(gnd  => dht.gnd);
connect!(vcc5 => rpu.pin1);
connect!(rpu.pin2 => dht.data);
connect!(dht.data  => ard.d2);`,
  },
  {
    name: "ESP32 + MPU6050 (Level Shifter Required)",
    description: "Demonstrates W003 voltage mismatch: Arduino 5V driving ESP32 3.3V pin",
    source: `// ESP32 + MPU6050 IMU via I2C
// Both operate at 3.3V — no level shifter needed
let vcc3v3 = Net::power(3.3);
let gnd    = Net::ground();

let esp    = Component::ESP32;
let mpu    = Component::MPU6050;
let rscl   = Component::Resistor { resistance: "4700" };
let rsda   = Component::Resistor { resistance: "4700" };

connect!(vcc3v3 => esp.vcc);
connect!(gnd    => esp.gnd);
connect!(vcc3v3 => mpu.vcc);
connect!(gnd    => mpu.gnd);
connect!(vcc3v3 => rscl.pin1);
connect!(rscl.pin2 => esp.scl);
connect!(esp.scl   => mpu.scl);
connect!(vcc3v3 => rsda.pin1);
connect!(rsda.pin2 => esp.sda);
connect!(esp.sda   => mpu.sda);`,
  },
  {
    name: "Voltage Mismatch (W003 Warning)",
    description: "Arduino (5V) driving ESP32 input (3.3V max) — triggers W003 warning",
    source: `// DANGER: Arduino Uno 5V GPIO driving ESP32 3.3V GPIO directly
// This will trigger W003 voltage mismatch warning
let vcc5  = Net::power(5.0);
let vcc33 = Net::power(3.3);
let gnd   = Net::ground();

let ard = Component::ArduinoUno;
let esp = Component::ESP32;

connect!(vcc5  => ard.vcc);
connect!(gnd   => ard.gnd);
connect!(vcc33 => esp.vcc);
connect!(gnd   => esp.gnd);

// Connecting 5V output to 3.3V max input — W003!
connect!(ard.d2 => esp.gpio0);`,
  },
  {
    name: "NPN Transistor Switch",
    description: "Arduino driving an NPN transistor to switch a relay or high-current load",
    source: `// NPN transistor switch with flyback diode for inductive load
let vcc = Net::power(5.0);
let gnd = Net::ground();

let ard    = Component::ArduinoUno;
let r_base = Component::Resistor  { resistance: "10000" };
let q1     = Component::NPN       { model: "2N2222" };
let d1     = Component::SchottkyDiode;
let load   = Component::Resistor  { resistance: "100" };

connect!(vcc   => ard.vcc);
connect!(gnd   => ard.gnd);
connect!(ard.d3 => r_base.pin1);
connect!(r_base.pin2 => q1.base);
connect!(vcc   => load.pin1);
connect!(load.pin2 => d1.cathode);
connect!(d1.cathode => q1.collector);
connect!(d1.anode   => q1.emitter);
connect!(q1.emitter => gnd);`,
  },
  {
    name: "Op-Amp Comparator (LM358)",
    description: "LM358 op-amp configured as a voltage comparator",
    source: `// LM358 voltage comparator
let vcc = Net::power(5.0);
let gnd = Net::ground();

let amp = Component::OpAmpLM358;
let r1  = Component::Resistor { resistance: "10000" };
let r2  = Component::Resistor { resistance: "10000" };
let led = Component::LED { color: "green" };
let rl  = Component::Resistor { resistance: "330" };

// Voltage reference divider (2.5V on in_neg)
connect!(vcc => r1.pin1);
connect!(r1.pin2 => r2.pin1);
connect!(r2.pin2 => gnd);
connect!(r1.pin2 => amp.in_neg);

// Signal input on in_pos
connect!(amp.in_pos => amp.in_pos);
connect!(vcc => amp.vcc);
connect!(gnd => amp.gnd);
connect!(amp.out => rl.pin1);
connect!(rl.pin2 => led.anode);
connect!(led.cathode => gnd);`,
  },
  {
    name: "Buck Converter + Arduino",
    description: "12V input → 5V step-down powering Arduino",
    source: `// Buck converter providing regulated 5V for Arduino
let vin  = Net::power(12.0);
let v5   = Net::power(5.0);
let gnd  = Net::ground();

let buck = Component::BuckConverter { model: "LM2596" };
let cin  = Component::Capacitor { capacitance: "100uF" };
let cout = Component::Capacitor { capacitance: "220uF" };
let ard  = Component::ArduinoUno;

connect!(vin  => cin.pin1);
connect!(cin.pin2 => gnd);
connect!(vin  => buck.vin);
connect!(gnd  => buck.gnd);
connect!(buck.vout => v5);
connect!(v5   => cout.pin1);
connect!(cout.pin2 => gnd);
connect!(v5   => ard.vcc);
connect!(gnd  => ard.gnd);`,
  },
  {
    name: "Short Circuit (Fatal Error)",
    description: "Demonstrates E001 fatal short circuit error",
    source: `// FATAL: Short circuit — VCC directly to GND
let vcc = Net::power(5.0);
let gnd = Net::ground();

connect!(vcc => gnd);`,
  },
];

router.get("/compiler/examples", (_req, res) => {
  res.json({ examples: EXAMPLES });
});

export default router;
