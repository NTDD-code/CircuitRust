import { Router } from "express";
import { CompileCircuitBody } from "@workspace/api-zod";
import { parseCircuit } from "../lib/circuit-parser.js";
import { validateCircuit } from "../lib/circuit-validator.js";
import { buildNetlist } from "../lib/circuit-netlist.js";

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
  const allWarnings = validationResult.warnings;

  const success = allErrors.length === 0;
  const netlist = success ? buildNetlist(parseResult.components, parseResult.connections, parseResult.nets) : undefined;

  res.json({
    success,
    errors: allErrors.map((e) => ({
      line: e.line,
      column: e.column,
      message: e.message,
      errorCode: e.errorCode,
      severity: e.severity,
    })),
    warnings: allWarnings.map((w) => ({
      line: w.line,
      column: w.column,
      message: w.message,
      warningCode: w.warningCode,
    })),
    ...(netlist ? { netlist } : {}),
  });
});

const EXAMPLES = [
  {
    name: "LED Circuit",
    description: "Basic LED with current-limiting resistor",
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
    name: "Transistor Switch",
    description: "NPN transistor used as a digital switch",
    source: `// Transistor switch circuit
let vcc = Net::power(5.0);
let gnd = Net::ground();
let signal = Net::signal();

let r_base = Component::Resistor { resistance: "10000" };
let r_collector = Component::Resistor { resistance: "1000" };
let q1 = Component::Transistor { type: "NPN" };
let led1 = Component::LED { color: "green" };

connect!(signal => r_base.pin1);
connect!(r_base.pin2 => q1.base);
connect!(vcc => r_collector.pin1);
connect!(r_collector.pin2 => led1.anode);
connect!(led1.cathode => q1.collector);
connect!(q1.emitter => gnd);`,
  },
  {
    name: "Voltage Divider",
    description: "Simple resistive voltage divider",
    source: `// Resistive voltage divider
let vcc = Net::power(12.0);
let gnd = Net::ground();

let r1 = Component::Resistor { resistance: "10000" };
let r2 = Component::Resistor { resistance: "10000" };

connect!(vcc => r1.pin1);
connect!(r1.pin2 => r2.pin1);
connect!(r2.pin2 => gnd);`,
  },
  {
    name: "Short Circuit (Error)",
    description: "Demonstrates the E001 short circuit compile error",
    source: `// Short circuit — THIS WILL FAIL TO COMPILE
// VCC connected directly to GND without a load
let vcc = Net::power(5.0);
let gnd = Net::ground();

connect!(vcc => gnd);`,
  },
  {
    name: "Regulated Power Supply",
    description: "Voltage regulator with bypass capacitors",
    source: `// Regulated 5V power supply
let vin = Net::power(12.0);
let v5 = Net::power(5.0);
let gnd = Net::ground();

let vreg = Component::VoltageRegulator { model: "LM7805" };
let c1 = Component::Capacitor { capacitance: "0.1uF" };
let c2 = Component::Capacitor { capacitance: "10uF" };

connect!(vin => vreg.in);
connect!(vreg.out => v5);
connect!(vreg.gnd => gnd);
connect!(vin => c1.pin1);
connect!(c1.pin2 => gnd);
connect!(v5 => c2.pin1);
connect!(c2.pin2 => gnd);`,
  },
];

router.get("/compiler/examples", (_req, res) => {
  res.json({ examples: EXAMPLES });
});

export default router;
