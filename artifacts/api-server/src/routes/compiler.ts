import { Router } from "express";
import { CompileCircuitBody, ExportNetlistBody } from "@workspace/api-zod";
import { parseCircuit } from "../lib/circuit-parser.js";
import { validateCircuit } from "../lib/circuit-validator.js";
import { buildNetlist } from "../lib/circuit-netlist.js";
import { exportKicadNetlist, exportProteusNetlist, exportSpiceNetlist } from "../lib/circuit-exporter.js";
import { COMPONENT_DEFS } from "../lib/circuit-parser.js";
import { stripTestBlocks, runTests } from "../lib/circuit-tester.js";

const router = Router();

router.post("/compiler/compile", (req, res) => {
  const parsed = CompileCircuitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { source } = parsed.data;
  const sourceLines = source.split("\n");

  // Strip test{} blocks before parsing — they're executed separately below
  const cleanSource = stripTestBlocks(source);
  const parseResult = parseCircuit(cleanSource);
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

  // ── Safety Audit layer ─────────────────────────────────────────────────────
  // Maps specific error/warning codes to human-readable safety issues with
  // named severity levels. These always appear regardless of compile success.
  type SafetySeverity = "CRITICAL" | "FATAL" | "WARNING" | "DANGER";
  interface SafetyIssue {
    severity: SafetySeverity;
    code: string;
    message: string;
    line: number;
    detail?: string;
  }
  const safetyIssues: SafetyIssue[] = [];

  for (const err of allErrors) {
    // E001 — short circuit (power directly to ground)
    if (err.errorCode === "E001") {
      safetyIssues.push({
        severity: "FATAL",
        code: "S001",
        message: "Short circuit detected! Power supply will be damaged.",
        detail: err.message,
        line: err.line,
      });
    }
    // E007 — LED with no current-limiting resistor
    if (err.errorCode === "E007") {
      safetyIssues.push({
        severity: "CRITICAL",
        code: "S002",
        message: "LED will burn out immediately! Current limiting resistor is missing.",
        detail: err.message,
        line: err.line,
      });
    }
    // E008 — high-current load driven directly by MCU GPIO
    if (err.errorCode === "E008") {
      safetyIssues.push({
        severity: "DANGER",
        code: "S004",
        message: "High current detected! This will fry your microcontroller pin.",
        detail: err.message,
        line: err.line,
      });
    }
    // E011 — logic contention: two MCU GPIO pins directly connected
    if (err.errorCode === "E011") {
      safetyIssues.push({
        severity: "DANGER",
        code: "S008",
        message: "Logic contention detected! Connecting two output pins directly can damage the internal circuitry of the MCU.",
        detail: err.message,
        line: err.line,
      });
    }
    // E012 — inductive load with no flyback diode
    if (err.errorCode === "E012") {
      safetyIssues.push({
        severity: "CRITICAL",
        code: "S009",
        message: "Missing flyback diode! Inductive kickback will destroy your transistor or MCU pin.",
        detail: err.message,
        line: err.line,
      });
    }
    // E013 — inverted polarity on IC power/ground pin
    if (err.errorCode === "E013") {
      safetyIssues.push({
        severity: "FATAL",
        code: "S010",
        message: "Reverse polarity detected! This will instantly destroy the IC.",
        detail: err.message,
        line: err.line,
      });
    }
    // E009 — transistor base without current-limiting resistor
    if (err.errorCode === "E009") {
      safetyIssues.push({
        severity: err.severity === "fatal" ? "FATAL" : "CRITICAL",
        code: "S005",
        message: "Transistor base will burn! Missing base resistor.",
        detail: err.message,
        line: err.line,
      });
    }
    // E010 — NPN collector-emitter short when saturated
    if (err.errorCode === "E010") {
      safetyIssues.push({
        severity: "FATAL",
        code: "S006",
        message: "Potential Collector-Emitter short circuit when transistor is saturated!",
        detail: err.message,
        line: err.line,
      });
    }
  }

  for (const warn of validationResult.warnings) {
    // W003 — voltage mismatch (e.g. 5V output into 3.3V input)
    if (warn.warningCode === "W003") {
      safetyIssues.push({
        severity: "WARNING",
        code: "S003",
        message: "Overvoltage risk! Component may be damaged by excessive voltage.",
        detail: warn.message,
        line: warn.line,
      });
    }
    // W007 — transistor pin voltage mismatch (5V BJT in 3.3V logic circuit)
    if (warn.warningCode === "W007") {
      safetyIssues.push({
        severity: "WARNING",
        code: "S007",
        message: "Transistor voltage mismatch! 5V net on BJT in a 3.3V logic circuit.",
        detail: warn.message,
        line: warn.line,
      });
    }
  }

  // ── Test Suite execution ───────────────────────────────────────────────────
  const testResults = netlist ? runTests(source, netlist) : [];

  res.json({
    success,
    errors: allErrors.map((e) => ({
      line: e.line, column: e.column, message: e.message, errorCode: e.errorCode, severity: e.severity,
    })),
    warnings: validationResult.warnings.map((w) => ({
      line: w.line, column: w.column, message: w.message, warningCode: w.warningCode,
    })),
    safetyIssues,
    testResults,
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
  {
    name: "Logic Contention (E011)",
    description: "Two MCU GPIO pins wired directly — triggers DANGER logic contention warning",
    source: `// DANGER: Arduino d3 and ESP32 gpio0 directly wired without a resistor
let vcc5  = Net::power(5.0);
let vcc33 = Net::power(3.3);
let gnd   = Net::ground();

let ard = Component::ArduinoUno;
let esp = Component::ESP32;

connect!(vcc5  => ard.vcc);
connect!(gnd   => ard.gnd);
connect!(vcc33 => esp.vcc);
connect!(gnd   => esp.gnd);

// E011: direct GPIO-to-GPIO connection — logic contention when both are outputs
connect!(ard.d3 => esp.gpio0);`,
  },
  {
    name: "Inductive Kickback (E012)",
    description: "Relay coil driven without a flyback diode — triggers CRITICAL kickback warning",
    source: `// CRITICAL: Relay without flyback diode — transistor will be destroyed by kickback
let vcc = Net::power(5.0);
let gnd = Net::ground();

let ard    = Component::ArduinoUno;
let r_base = Component::Resistor { resistance: "10000" };
let q1     = Component::NPN     { model: "2N2222" };
let relay1 = Component::Relay;

connect!(vcc => ard.vcc);
connect!(gnd => ard.gnd);
connect!(ard.d4 => r_base.pin1);
connect!(r_base.pin2 => q1.base);
connect!(vcc => relay1.coil_a);
connect!(relay1.coil_b => q1.collector);
connect!(q1.emitter    => gnd);
// Fix: add connect!(vcc => d1.cathode); connect!(d1.anode => q1.collector); using SchottkyDiode`,
  },
  {
    name: "Inverted Polarity (E013)",
    description: "Ground net wired to buzzer VCC pin — triggers FATAL reverse polarity error",
    source: `// FATAL: Buzzer connected backwards — VCC to GND pin, GND to VCC pin
let vcc = Net::power(5.0);
let gnd = Net::ground();

let bz1 = Component::Buzzer;

// E013: reversed! ground to power pin, power to ground pin
connect!(gnd => bz1.vcc);
connect!(vcc => bz1.gnd);`,
  },
  {
    name: "Transistor Burn Scenarios",
    description: "Demonstrates E009 (no base resistor) and E010 (collector-emitter short) transistor safety errors",
    source: `// DANGER: Three transistor safety violations in one circuit
let vcc = Net::power(5.0);
let gnd = Net::ground();

let ard = Component::ArduinoUno;
let q1  = Component::NPN { model: "2N2222" };
let q2  = Component::NPN { model: "BC547" };

connect!(vcc => ard.vcc);
connect!(gnd => ard.gnd);

// E009a — base connected directly to power net (no resistor) → transistor burns
connect!(vcc => q1.base);
connect!(q1.collector => gnd);
connect!(q1.emitter   => gnd);

// E009b — MCU GPIO drives base with no series resistor → GPIO + junction at risk
connect!(ard.d5 => q2.base);

// E010 — collector wired directly to VCC, emitter to GND, no load → saturation short
connect!(vcc => q2.collector);
connect!(q2.emitter => gnd);`,
  },
];

router.get("/compiler/examples", (_req, res) => {
  res.json({ examples: EXAMPLES });
});

export default router;
