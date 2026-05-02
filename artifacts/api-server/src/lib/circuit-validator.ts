import type {
  ParsedComponent,
  ParsedConnection,
  ParsedNet,
  ParseError,
  ParsedPin,
  PinType,
} from "./circuit-parser.js";

export interface ValidationResult {
  errors: ParseError[];
  warnings: ValidationWarning[];
}

export interface ValidationWarning {
  line: number;
  column: number;
  message: string;
  warningCode: string;
}

const COMPATIBLE_PAIRS: Record<PinType, PinType[]> = {
  power:        ["analog", "signal", "digital", "bidirectional", "passive"],
  ground:       ["analog", "signal", "digital", "bidirectional", "passive"],
  signal:       ["power", "ground", "analog", "signal", "digital", "bidirectional", "passive"],
  analog:       ["power", "ground", "analog", "signal", "bidirectional", "passive"],
  digital:      ["power", "ground", "digital", "signal", "bidirectional", "passive"],
  bidirectional:["power", "ground", "analog", "signal", "digital", "bidirectional", "passive"],
  passive:      ["power", "ground", "analog", "signal", "digital", "bidirectional", "passive"],
};

// Address-select pins that MUST be tied to VCC or GND (E014)
const ADDRESS_SELECT_PINS = new Set(["ad0", "a0", "a1", "a2"]);

function isSignalPin(pin: ParsedPin): boolean {
  return pin.type === "digital" || pin.type === "signal" || pin.type === "analog";
}

function inferNetVoltage(
  varName: string,
  pinName: string,
  components: Map<string, ParsedComponent>,
  nets: Map<string, ParsedNet>,
  connections: ParsedConnection[],
): number | undefined {
  const net = nets.get(varName);
  if (net?.voltage !== undefined) return net.voltage;

  const comp = components.get(varName);
  if (!comp) return undefined;

  const pin = comp.pins.find((p) => p.name === pinName);
  if (pin?.driveVoltage !== undefined) return pin.driveVoltage;

  if (comp.voltageLevel !== undefined) {
    if (pin && isSignalPin(pin)) return comp.voltageLevel;
  }

  for (const conn of connections) {
    const isFromComp = conn.from === varName;
    const vccPinName = isFromComp ? conn.fromPin : conn.toPin;
    const otherVarName = isFromComp ? conn.to : conn.from;
    const otherPin = isFromComp ? conn.toPin : conn.fromPin;
    if (vccPinName === "vcc" || vccPinName === "vin" || vccPinName === "v5" || vccPinName === "v3v3") {
      const srcNet = nets.get(otherVarName);
      if (srcNet?.voltage !== undefined) return srcNet.voltage;
    }
  }

  return undefined;
}

export function validateCircuit(
  components: Map<string, ParsedComponent>,
  connections: ParsedConnection[],
  nets: Map<string, ParsedNet>,
  sourceLines: string[],
): ValidationResult {
  const errors: ParseError[] = [];
  const warnings: ValidationWarning[] = [];
  const seenConnKeys = new Set<string>();

  for (const conn of connections) {
    const fromComp = components.get(conn.from);
    const toComp   = components.get(conn.to);
    const fromNet  = nets.get(conn.from);
    const toNet    = nets.get(conn.to);
    const srcLine  = sourceLines[conn.line - 1] ?? "";

    // ── Undefined variable checks ──────────────────────────────────────────
    if (!fromComp && !fromNet) {
      errors.push({
        line: conn.line, column: 1,
        message: `Undefined variable '${conn.from}'. Declare it with 'let ${conn.from} = Component::...' or 'let ${conn.from} = Net::...'`,
        errorCode: "E004", severity: "error", sourceLine: srcLine,
      });
      continue;
    }
    if (!toComp && !toNet) {
      errors.push({
        line: conn.line, column: 1,
        message: `Undefined variable '${conn.to}'. Declare it with 'let ${conn.to} = Component::...' or 'let ${conn.to} = Net::...'`,
        errorCode: "E004", severity: "error", sourceLine: srcLine,
      });
      continue;
    }

    // ── Net-to-Net checks ──────────────────────────────────────────────────
    if (fromNet && toNet) {
      if (fromNet.type === "power" && toNet.type === "ground") {
        errors.push({
          line: conn.line, column: 1,
          message: `Short circuit detected — power net '${conn.from}' directly connected to ground net '${conn.to}' without a load. This will destroy your power supply.`,
          errorCode: "E001", severity: "fatal", sourceLine: srcLine,
        });
      } else if (fromNet.type === "ground" && toNet.type === "power") {
        errors.push({
          line: conn.line, column: 1,
          message: `Short circuit detected — ground net '${conn.from}' directly connected to power net '${conn.to}' without a load.`,
          errorCode: "E001", severity: "fatal", sourceLine: srcLine,
        });
      } else if (fromNet.type === "power" && toNet.type === "power"
                 && fromNet.voltage !== undefined && toNet.voltage !== undefined
                 && Math.abs(fromNet.voltage - toNet.voltage) > 0.05) {
        errors.push({
          line: conn.line, column: 1,
          message: `Voltage clash: power net '${conn.from}' (${fromNet.voltage}V) directly tied to '${conn.to}' (${toNet.voltage}V). Voltage mismatch will cause conflict or damage.`,
          errorCode: "E007", severity: "fatal", sourceLine: srcLine,
        });
      }
      continue;
    }

    // ── Component-to-Component checks ─────────────────────────────────────
    if (fromComp && toComp) {
      const fromPin = fromComp.pins.find((p) => p.name === conn.fromPin);
      const toPin   = toComp.pins.find((p) => p.name === conn.toPin);

      if (!fromPin) {
        errors.push({
          line: conn.line, column: 1,
          message: `Component '${conn.from}' (${fromComp.type}) has no pin '${conn.fromPin}'. Available pins: ${fromComp.pins.map((p) => p.name).join(", ")}`,
          errorCode: "E005", severity: "error", sourceLine: srcLine,
        });
        continue;
      }
      if (!toPin) {
        errors.push({
          line: conn.line, column: 1,
          message: `Component '${conn.to}' (${toComp.type}) has no pin '${conn.toPin}'. Available pins: ${toComp.pins.map((p) => p.name).join(", ")}`,
          errorCode: "E005", severity: "error", sourceLine: srcLine,
        });
        continue;
      }

      // Passive/bidirectional pins are universal — skip the compatibility check
      if (fromPin.type !== "passive" && fromPin.type !== "bidirectional" &&
          toPin.type  !== "passive" && toPin.type  !== "bidirectional") {
        const compatible = COMPATIBLE_PAIRS[fromPin.type] ?? [];
        if (!compatible.includes(toPin.type)) {
          errors.push({
            line: conn.line, column: 1,
            message: `Incompatible pins: ${conn.from}.${conn.fromPin} (${fromPin.type}) cannot connect to ${conn.to}.${conn.toPin} (${toPin.type})`,
            errorCode: "E006", severity: "error", sourceLine: srcLine,
          });
          continue;
        }
      }

      // W001: direct power-to-power
      if (fromPin.type === "power" && toPin.type === "power") {
        warnings.push({
          line: conn.line, column: 1,
          message: `Connecting two power pins directly — ensure voltage levels match exactly`,
          warningCode: "W001",
        });
      }

      // W002: duplicate connection
      const connKey = `${conn.from}.${conn.fromPin}:${conn.to}.${conn.toPin}`;
      if (seenConnKeys.has(connKey)) {
        warnings.push({
          line: conn.line, column: 1,
          message: `Duplicate connection: ${conn.from}.${conn.fromPin} already connected to ${conn.to}.${conn.toPin}`,
          warningCode: "W002",
        });
      } else {
        seenConnKeys.add(connKey);
      }

      // W003: Voltage mismatch — 5V output driving 3.3V-limited input
      const fromDriveV = fromPin.driveVoltage ?? fromComp.voltageLevel;
      const toMaxV     = toPin.maxVoltage;
      if (
        fromDriveV !== undefined && toMaxV !== undefined &&
        fromDriveV > toMaxV + 0.1 &&
        isSignalPin(fromPin) && isSignalPin(toPin)
      ) {
        warnings.push({
          line: conn.line, column: 1,
          message: `Voltage mismatch: ${conn.from}.${conn.fromPin} drives ${fromDriveV}V but ${conn.to}.${conn.toPin} has a ${toMaxV}V maximum input tolerance — add a level shifter to protect ${conn.to} (${toComp.type})`,
          warningCode: "W003",
        });
      }

      // E008: output-to-output collision
      if (fromPin.direction === "out" && toPin.direction === "out") {
        errors.push({
          line: conn.line, column: 1,
          message: `Output collision: cannot connect two output pins (${conn.from}.${conn.fromPin} and ${conn.to}.${conn.toPin}) directly — they will fight each other`,
          errorCode: "E008", severity: "error", sourceLine: srcLine,
        });
      }
    }

    // ── Net-to-Component checks ────────────────────────────────────────────
    if (fromNet && toComp) {
      const toPin = toComp.pins.find((p) => p.name === conn.toPin);
      if (!toPin) {
        errors.push({
          line: conn.line, column: 1,
          message: `Component '${conn.to}' (${toComp.type}) has no pin '${conn.toPin}'. Available pins: ${toComp.pins.map((p) => p.name).join(", ")}`,
          errorCode: "E005", severity: "error", sourceLine: srcLine,
        });
        continue;
      }
      if (fromNet.type === "power" && toPin.type === "ground") {
        errors.push({
          line: conn.line, column: 1,
          message: `Short circuit: power net '${conn.from}' connected to ground pin '${conn.to}.${conn.toPin}'`,
          errorCode: "E001", severity: "fatal", sourceLine: srcLine,
        });
      }
      if (fromNet.type === "ground" && toPin.type === "power") {
        errors.push({
          line: conn.line, column: 1,
          message: `Short circuit: ground net '${conn.from}' connected to power pin '${conn.to}.${conn.toPin}'`,
          errorCode: "E001", severity: "fatal", sourceLine: srcLine,
        });
      }

      // W003: power net voltage exceeds pin max tolerance
      if (fromNet.type === "power" && fromNet.voltage !== undefined && toPin.maxVoltage !== undefined) {
        if (fromNet.voltage > toPin.maxVoltage + 0.1 && isSignalPin(toPin)) {
          warnings.push({
            line: conn.line, column: 1,
            message: `Voltage mismatch: net '${conn.from}' (${fromNet.voltage}V) exceeds max input voltage of ${conn.to}.${conn.toPin} (${toPin.maxVoltage}V) — this may damage ${conn.to} (${toComp.type})`,
            warningCode: "W003",
          });
        }
      }
    }

    // ── Component-to-Net checks ────────────────────────────────────────────
    if (fromComp && toNet) {
      const fromPin = fromComp.pins.find((p) => p.name === conn.fromPin);
      if (!fromPin) {
        errors.push({
          line: conn.line, column: 1,
          message: `Component '${conn.from}' (${fromComp.type}) has no pin '${conn.fromPin}'. Available pins: ${fromComp.pins.map((p) => p.name).join(", ")}`,
          errorCode: "E005", severity: "error", sourceLine: srcLine,
        });
        continue;
      }
      if (fromPin.type === "power" && toNet.type === "ground") {
        errors.push({
          line: conn.line, column: 1,
          message: `Short circuit: power pin '${conn.from}.${conn.fromPin}' connected directly to ground net '${conn.to}'`,
          errorCode: "E001", severity: "fatal", sourceLine: srcLine,
        });
      }
      if (fromPin.type === "ground" && toNet.type === "power") {
        errors.push({
          line: conn.line, column: 1,
          message: `Short circuit: ground pin '${conn.from}.${conn.fromPin}' connected directly to power net '${conn.to}'`,
          errorCode: "E001", severity: "fatal", sourceLine: srcLine,
        });
      }
    }
  }

  // ── Per-component checks ─────────────────────────────────────────────────
  for (const [name, comp] of components) {
    const connectedPins = new Set<string>();
    for (const conn of connections) {
      if (conn.from === name) connectedPins.add(conn.fromPin);
      if (conn.to   === name) connectedPins.add(conn.toPin);
    }
    // W004: unconnected required power/ground pins
    // Only pins with required !== false count — optional pins (e.g. ESP32.v5) are exempt
    const requiredPowerPins = comp.pins.filter(
      (p) => (p.type === "power" || p.type === "ground") && p.required !== false,
    );
    const unconnectedRequired = requiredPowerPins.filter((p) => !connectedPins.has(p.name));
    if (unconnectedRequired.length > 0) {
      warnings.push({
        line: comp.line, column: 1,
        message: `Component '${name}' (${comp.type}) has unconnected power/ground pins: ${unconnectedRequired.map((p) => p.name).join(", ")} — the component will not function`,
        warningCode: "W004",
      });
    }

    // W005 / E014: floating signal/data pins
    const unconnectedPins = comp.pins.filter((p) => !connectedPins.has(p.name));
    if (unconnectedPins.length > 0 && unconnectedPins.length < comp.pins.length && unconnectedRequired.length === 0) {
      // E014: address-select pins that are floating → hard error
      const floatingAddrPins = unconnectedPins.filter((p) => ADDRESS_SELECT_PINS.has(p.name));
      for (const pin of floatingAddrPins) {
        errors.push({
          line: comp.line, column: 1,
          message: `error[E014]: ${name}.${pin.name} must be tied to VCC or GND to set the I2C address. Floating ${pin.name} causes undefined device address.`,
          errorCode: "E014", severity: "error", sourceLine: "",
        });
      }

      // W005: remaining floating pins that are not optional and not address-select
      const floatingOther = unconnectedPins.filter(
        (p) => !ADDRESS_SELECT_PINS.has(p.name) && p.required !== false,
      );
      if (floatingOther.length > 0) {
        warnings.push({
          line: comp.line, column: 1,
          message: `Component '${name}' (${comp.type}) has floating pins: ${floatingOther.map((p) => p.name).join(", ")}`,
          warningCode: "W005",
        });
      }
    }
  }

  if (components.size === 0 && connections.length === 0 && nets.size === 0) {
    warnings.push({
      line: 1, column: 1,
      message: "Circuit is empty — no components, nets, or connections defined",
      warningCode: "W006",
    });
  }

  // ── E007: LED without series current-limiting resistor ─────────────────────
  // Find every LED in the circuit. For each LED, trace the anode connection.
  // If the anode connects directly to a power net (not through a resistor), error.
  for (const [ledId, ledComp] of components) {
    const isLED = ledComp.type === "LED";
    if (!isLED) continue;

    const anodeConns = connections.filter(
      (c) =>
        (c.to === ledId && c.toPin === "anode") ||
        (c.from === ledId && c.fromPin === "anode"),
    );

    for (const aConn of anodeConns) {
      const srcId = aConn.from === ledId ? aConn.to : aConn.from;
      const srcNet = nets.get(srcId);
      if (srcNet && srcNet.type === "power") {
        // Direct VCC → LED.anode: check if there's a resistor in series
        const hasSeriesResistor = connections.some((c) => {
          const otherEnd = c.from === ledId ? c.to : c.from;
          const otherComp = components.get(otherEnd);
          if (otherComp?.type !== "Resistor") return false;
          // That resistor must also connect to the same power net
          return connections.some(
            (r) =>
              (r.from === otherEnd || r.to === otherEnd) &&
              (r.from === srcId || r.to === srcId),
          );
        });
        if (!hasSeriesResistor) {
          errors.push({
            line: ledComp.line,
            column: 1,
            message: `E007: LED '${ledId}' is connected directly to power net '${srcId}' without a current-limiting resistor. Add a series resistor (e.g., 220Ω for 5V supply).`,
            errorCode: "E007",
            severity: "error",
            sourceLine: "",
          });
        }
      }
    }
  }

  // ── E008: High-current load driven directly by MCU GPIO ────────────────────
  // High-current types: Buzzer, Motor (and motor-adjacent MCU-driven loads)
  const HIGH_CURRENT_TYPES = new Set(["Buzzer", "Motor"]);
  const MCU_TYPES = new Set([
    "ArduinoUno", "ArduinoNano", "ESP32", "ESP8266",
    "RaspberryPiPico", "STM32",
  ]);

  for (const [loadId, loadComp] of components) {
    if (!HIGH_CURRENT_TYPES.has(loadComp.type)) continue;

    // Find what's driving the load's power pin (vcc, m_pos, pin1...)
    const powerPins = loadComp.pins.filter((p) => p.type === "power" || p.name === "vcc" || p.name === "m_pos");
    for (const pin of powerPins) {
      const drivingConns = connections.filter(
        (c) =>
          (c.to === loadId && c.toPin === pin.name) ||
          (c.from === loadId && c.fromPin === pin.name),
      );
      for (const conn of drivingConns) {
        const driverId = conn.from === loadId ? conn.to : conn.from;
        const driverComp = components.get(driverId);
        if (driverComp && MCU_TYPES.has(driverComp.type)) {
          errors.push({
            line: conn.line,
            column: 1,
            message: `E008: High-current component '${loadId}' (${loadComp.type}) is driven directly by MCU '${driverId}'. Add a transistor driver (e.g., 2N2222 with base resistor) between the MCU GPIO and the load.`,
            errorCode: "E008",
            severity: "error",
            sourceLine: "",
          });
        }
      }
    }
  }

  return { errors, warnings };
}
