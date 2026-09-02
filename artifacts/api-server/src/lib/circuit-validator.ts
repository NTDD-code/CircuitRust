import type {
  ParsedComponent,
  ParsedConnection,
  ParsedNet,
  ParseError,
  ParsedPin,
  PinType,
  ComponentCategory,
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

// ── Union-Find (Disjoint Set Union) ──────────────────────────────────────────
// Each node is a string endpoint:
//   - Component pin : "<compId>:<pinName>"   e.g. "R1:pin1"
//   - Net variable  : "net:<varName>"         e.g. "net:vcc"

class UnionFind {
  private parent = new Map<string, string>();
  private rank   = new Map<string, number>();

  private seed(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x: string): string {
    this.seed(x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = x;
    while (cur !== root) { const nxt = this.parent.get(cur)!; this.parent.set(cur, root); cur = nxt; }
    return root;
  }

  union(x: string, y: string): void {
    const rx = this.find(x), ry = this.find(y);
    if (rx === ry) return;
    const rkx = this.rank.get(rx) ?? 0, rky = this.rank.get(ry) ?? 0;
    if (rkx < rky) { this.parent.set(rx, ry); }
    else if (rkx > rky) { this.parent.set(ry, rx); }
    else { this.parent.set(ry, rx); this.rank.set(rx, rkx + 1); }
  }

  same(x: string, y: string): boolean { return this.find(x) === this.find(y); }

  nodes(): IterableIterator<string> { return this.parent.keys(); }
}

// ── Net-group metadata ────────────────────────────────────────────────────────

interface GroupInfo {
  powerNets:  Array<{ varName: string; net: ParsedNet }>;
  groundNets: Array<{ varName: string; net: ParsedNet }>;
  hasNc:      boolean;
}

function buildNetGraph(
  components:  Map<string, ParsedComponent>,
  connections: ParsedConnection[],
  nets:        Map<string, ParsedNet>,
): UnionFind {
  const uf = new UnionFind();

  // Seed every known endpoint so isolated nodes exist in the structure
  for (const [varName] of nets)          uf.find(`net:${varName}`);
  for (const [id, comp] of components)   for (const p of comp.pins) uf.find(`${id}:${p.name}`);

  // Union endpoints from every connection
  for (const conn of connections) {
    const fromEp = nets.has(conn.from) ? `net:${conn.from}` : `${conn.from}:${conn.fromPin}`;
    const toEp   = nets.has(conn.to)   ? `net:${conn.to}`   : `${conn.to}:${conn.toPin}`;
    uf.union(fromEp, toEp);
  }
  return uf;
}

function buildGroupMap(uf: UnionFind, nets: Map<string, ParsedNet>): Map<string, GroupInfo> {
  const groups = new Map<string, GroupInfo>();
  const get = (root: string): GroupInfo => {
    if (!groups.has(root)) groups.set(root, { powerNets: [], groundNets: [], hasNc: false });
    return groups.get(root)!;
  };
  for (const [varName, net] of nets) {
    const root = uf.find(`net:${varName}`);
    const info = get(root);
    if (net.type === "power")   info.powerNets.push({ varName, net });
    else if (net.type === "ground") info.groundNets.push({ varName, net });
    else if (net.type === "nc")     info.hasNc = true;
  }
  return groups;
}

// Returns the set of group-root IDs that this component's pins belong to
function compPinRoots(id: string, comp: ParsedComponent, uf: UnionFind): Set<string> {
  const s = new Set<string>();
  for (const p of comp.pins) s.add(uf.find(`${id}:${p.name}`));
  return s;
}

// ── Compatibility table ───────────────────────────────────────────────────────

const COMPATIBLE_PAIRS: Record<PinType, PinType[]> = {
  power:        ["analog", "signal", "digital", "bidirectional", "passive"],
  ground:       ["analog", "signal", "digital", "bidirectional", "passive"],
  signal:       ["power", "ground", "analog", "signal", "digital", "bidirectional", "passive"],
  analog:       ["power", "ground", "analog", "signal", "bidirectional", "passive"],
  digital:      ["power", "ground", "digital", "signal", "bidirectional", "passive"],
  bidirectional:["power", "ground", "analog", "signal", "digital", "bidirectional", "passive"],
  passive:      ["power", "ground", "analog", "signal", "digital", "bidirectional", "passive"],
};

const ADDRESS_SELECT_PINS = new Set(["ad0", "a0", "a1", "a2"]);

function isSignalPin(pin: ParsedPin): boolean {
  return pin.type === "digital" || pin.type === "signal" || pin.type === "analog";
}

// ── Main validator ────────────────────────────────────────────────────────────

export function validateCircuit(
  components:  Map<string, ParsedComponent>,
  connections: ParsedConnection[],
  nets:        Map<string, ParsedNet>,
  sourceLines: string[],
): ValidationResult {
  const errors:   ParseError[]         = [];
  const warnings: ValidationWarning[]  = [];

  // ── Step 1: Build the netlist graph ─────────────────────────────────────────
  const uf       = buildNetGraph(components, connections, nets);
  const groupMap = buildGroupMap(uf, nets);

  // Set of pin endpoints that are in a group containing an nc net → suppress W004/W005
  const ncCoveredEndpoints = new Set<string>();
  for (const [root, info] of groupMap) {
    if (!info.hasNc) continue;
    for (const node of uf.nodes()) {
      if (uf.find(node) === root) ncCoveredEndpoints.add(node);
    }
  }

  // ── Step 2: Per-connection structural checks ──────────────────────────────
  const seenConnKeys = new Set<string>();

  for (const conn of connections) {
    const fromComp = components.get(conn.from);
    const toComp   = components.get(conn.to);
    const fromNet  = nets.get(conn.from);
    const toNet    = nets.get(conn.to);
    const srcLine  = sourceLines[conn.line - 1] ?? "";

    // E004 — undefined variable
    if (!fromComp && !fromNet) {
      errors.push({ line: conn.line, column: 1,
        message: `Undefined variable '${conn.from}'. Declare it with 'let ${conn.from} = Component::...' or 'let ${conn.from} = Net::...'`,
        errorCode: "E004", severity: "error", sourceLine: srcLine });
      continue;
    }
    if (!toComp && !toNet) {
      errors.push({ line: conn.line, column: 1,
        message: `Undefined variable '${conn.to}'. Declare it with 'let ${conn.to} = Component::...' or 'let ${conn.to} = Net::...'`,
        errorCode: "E004", severity: "error", sourceLine: srcLine });
      continue;
    }

    // Net-to-net: only flag voltage-clash here; E001 (short) is handled post-graph
    if (fromNet && toNet) {
      if (fromNet.type === "power" && toNet.type === "power"
          && fromNet.voltage !== undefined && toNet.voltage !== undefined
          && Math.abs(fromNet.voltage - toNet.voltage) > 0.05) {
        errors.push({ line: conn.line, column: 1,
          message: `Voltage clash: power net '${conn.from}' (${fromNet.voltage}V) directly tied to '${conn.to}' (${toNet.voltage}V). Voltage mismatch will cause conflict or damage.`,
          errorCode: "E007", severity: "fatal", sourceLine: srcLine });
      }
      continue;
    }

    // ── Component-to-component ────────────────────────────────────────────────
    if (fromComp && toComp) {
      const fromPin = fromComp.pins.find((p) => p.name === conn.fromPin);
      const toPin   = toComp.pins.find((p)   => p.name === conn.toPin);

      if (!fromPin) {
        errors.push({ line: conn.line, column: 1,
          message: `Component '${conn.from}' (${fromComp.type}) has no pin '${conn.fromPin}'. Available pins: ${fromComp.pins.map((p) => p.name).join(", ")}`,
          errorCode: "E005", severity: "error", sourceLine: srcLine });
        continue;
      }
      if (!toPin) {
        errors.push({ line: conn.line, column: 1,
          message: `Component '${conn.to}' (${toComp.type}) has no pin '${conn.toPin}'. Available pins: ${toComp.pins.map((p) => p.name).join(", ")}`,
          errorCode: "E005", severity: "error", sourceLine: srcLine });
        continue;
      }

      if (fromPin.type !== "passive" && fromPin.type !== "bidirectional" &&
          toPin.type   !== "passive" && toPin.type   !== "bidirectional") {
        const compatible = COMPATIBLE_PAIRS[fromPin.type] ?? [];
        if (!compatible.includes(toPin.type)) {
          errors.push({ line: conn.line, column: 1,
            message: `Incompatible pins: ${conn.from}.${conn.fromPin} (${fromPin.type}) cannot connect to ${conn.to}.${conn.toPin} (${toPin.type})`,
            errorCode: "E006", severity: "error", sourceLine: srcLine });
          continue;
        }
      }

      // W001: direct power-to-power
      if (fromPin.type === "power" && toPin.type === "power") {
        warnings.push({ line: conn.line, column: 1,
          message: `Connecting two power pins directly — ensure voltage levels match exactly`,
          warningCode: "W001" });
      }

      // W002: duplicate connection
      const connKey = `${conn.from}.${conn.fromPin}:${conn.to}.${conn.toPin}`;
      if (seenConnKeys.has(connKey)) {
        warnings.push({ line: conn.line, column: 1,
          message: `Duplicate connection: ${conn.from}.${conn.fromPin} already connected to ${conn.to}.${conn.toPin}`,
          warningCode: "W002" });
      } else {
        seenConnKeys.add(connKey);
      }

      // W003: voltage mismatch — signal drives too-high voltage into pin
      const fromDriveV = fromPin.driveVoltage ?? fromComp.voltageLevel;
      const toMaxV     = toPin.maxVoltage;
      if (fromDriveV !== undefined && toMaxV !== undefined &&
          fromDriveV > toMaxV + 0.1 &&
          isSignalPin(fromPin) && isSignalPin(toPin)) {
        warnings.push({ line: conn.line, column: 1,
          message: `Voltage mismatch: ${conn.from}.${conn.fromPin} drives ${fromDriveV}V but ${conn.to}.${conn.toPin} has a ${toMaxV}V maximum input tolerance — add a level shifter to protect ${conn.to} (${toComp.type})`,
          warningCode: "W003" });
      }

      // E008: output-to-output collision
      if (fromPin.direction === "out" && toPin.direction === "out") {
        errors.push({ line: conn.line, column: 1,
          message: `Output collision: cannot connect two output pins (${conn.from}.${conn.fromPin} and ${conn.to}.${conn.toPin}) directly — they will fight each other`,
          errorCode: "E008", severity: "error", sourceLine: srcLine });
      }
    }

    // ── Net-to-component ─────────────────────────────────────────────────────
    if (fromNet && toComp) {
      const toPin = toComp.pins.find((p) => p.name === conn.toPin);
      if (!toPin) {
        errors.push({ line: conn.line, column: 1,
          message: `Component '${conn.to}' (${toComp.type}) has no pin '${conn.toPin}'. Available pins: ${toComp.pins.map((p) => p.name).join(", ")}`,
          errorCode: "E005", severity: "error", sourceLine: srcLine });
        continue;
      }
      // W003: power net voltage exceeds pin max tolerance
      if (fromNet.type === "power" && fromNet.voltage !== undefined && toPin.maxVoltage !== undefined) {
        if (fromNet.voltage > toPin.maxVoltage + 0.1 && isSignalPin(toPin)) {
          warnings.push({ line: conn.line, column: 1,
            message: `Voltage mismatch: net '${conn.from}' (${fromNet.voltage}V) exceeds max input voltage of ${conn.to}.${conn.toPin} (${toPin.maxVoltage}V) — this may damage ${conn.to} (${toComp.type})`,
            warningCode: "W003" });
        }
      }
    }

    // ── Component-to-net ─────────────────────────────────────────────────────
    if (fromComp && toNet) {
      const fromPin = fromComp.pins.find((p) => p.name === conn.fromPin);
      if (!fromPin) {
        errors.push({ line: conn.line, column: 1,
          message: `Component '${conn.from}' (${fromComp.type}) has no pin '${conn.fromPin}'. Available pins: ${fromComp.pins.map((p) => p.name).join(", ")}`,
          errorCode: "E005", severity: "error", sourceLine: srcLine });
        continue;
      }
    }
  }

  // ── Step 3: Graph-based short-circuit detection (E001) ─────────────────────
  // Only fires when a power net and a ground net are resolved into the SAME
  // consolidated net group — i.e., they are electrically identical nodes.
  for (const [, info] of groupMap) {
    if (info.powerNets.length === 0 || info.groundNets.length === 0) continue;

    const powerName  = info.powerNets[0].varName;
    const groundName = info.groundNets[0].varName;

    // Find the connection that introduced the merge for a better line number
    const culpritConn = connections.find((c) =>
      (c.from === powerName || c.to === powerName) &&
      (c.from === groundName || c.to === groundName),
    ) ?? connections.find((c) =>
      c.from === powerName || c.to === powerName ||
      c.from === groundName || c.to === groundName,
    );

    const line    = culpritConn?.line ?? 1;
    const srcLine = sourceLines[line - 1] ?? "";

    errors.push({ line, column: 1,
      message: `Short circuit detected — power net '${powerName}' and ground net '${groundName}' are resolved to the same electrical node. This will destroy your power supply.`,
      errorCode: "E001", severity: "fatal", sourceLine: srcLine });
  }

  // ── Step 4: Per-component checks (W004 / W005 / E014) ────────────────────
  for (const [name, comp] of components) {
    const connectedPins = new Set<string>();
    for (const conn of connections) {
      if (conn.from === name) connectedPins.add(conn.fromPin);
      if (conn.to   === name) connectedPins.add(conn.toPin);
    }

    // W004: unconnected required power/ground pins
    const requiredPowerPins = comp.pins.filter(
      (p) => (p.type === "power" || p.type === "ground") && p.required !== false,
    );
    const unconnectedRequired = requiredPowerPins.filter((p) => {
      if (connectedPins.has(p.name)) return false;
      // Suppress if pin endpoint is in an nc-covered group
      const ep = `${name}:${p.name}`;
      return !ncCoveredEndpoints.has(ep);
    });
    if (unconnectedRequired.length > 0) {
      warnings.push({ line: comp.line, column: 1,
        message: `Component '${name}' (${comp.type}) has unconnected power/ground pins: ${unconnectedRequired.map((p) => p.name).join(", ")} — the component will not function`,
        warningCode: "W004" });
    }

    // W005 / E014: floating signal/data pins
    const unconnectedPins = comp.pins.filter((p) => {
      if (connectedPins.has(p.name)) return false;
      const ep = `${name}:${p.name}`;
      return !ncCoveredEndpoints.has(ep);
    });

    if (unconnectedPins.length > 0 && unconnectedPins.length < comp.pins.length && unconnectedRequired.length === 0) {
      // E014: address-select pins floating → hard error
      const floatingAddrPins = unconnectedPins.filter((p) => ADDRESS_SELECT_PINS.has(p.name));
      for (const pin of floatingAddrPins) {
        errors.push({ line: comp.line, column: 1,
          message: `error[E014]: ${name}.${pin.name} must be tied to VCC or GND to set the I2C address. Floating ${pin.name} causes undefined device address.`,
          errorCode: "E014", severity: "error", sourceLine: "" });
      }

      // W005: other floating non-optional pins
      const floatingOther = unconnectedPins.filter(
        (p) => !ADDRESS_SELECT_PINS.has(p.name) && p.required !== false,
      );
      if (floatingOther.length > 0) {
        warnings.push({ line: comp.line, column: 1,
          message: `Component '${name}' (${comp.type}) has floating pins: ${floatingOther.map((p) => p.name).join(", ")}`,
          warningCode: "W005" });
      }
    }
  }

  // ── W006: empty circuit ───────────────────────────────────────────────────
  if (components.size === 0 && connections.length === 0 && nets.size === 0) {
    warnings.push({ line: 1, column: 1,
      message: "Circuit is empty — no components, nets, or connections defined",
      warningCode: "W006" });
  }

  // ── E007: LED without series current-limiting resistor ───────────────────
  for (const [ledId, ledComp] of components) {
    if (ledComp.type !== "LED") continue;

    const anodeConns = connections.filter(
      (c) => (c.to === ledId && c.toPin === "anode") || (c.from === ledId && c.fromPin === "anode"),
    );

    for (const aConn of anodeConns) {
      const srcId  = aConn.from === ledId ? aConn.to : aConn.from;
      const srcNet = nets.get(srcId);
      if (!srcNet || srcNet.type !== "power") continue;

      // Check for a series resistor: any Resistor that sits between VCC and the LED anode
      let seriesResistorValue = -1;
      const hasSeriesResistor = [...components.entries()].some(([rId, rComp]) => {
        if (rComp.type !== "Resistor") return false;
        const rTouchesPower = connections.some(
          (c) => (c.from === rId || c.to === rId) && (c.from === srcId || c.to === srcId),
        );
        const rTouchesLed = connections.some(
          (c) => (c.from === rId || c.to === rId) && (c.from === ledId || c.to === ledId),
        );

        if (rTouchesPower && rTouchesLed) {
          if (rComp.properties["resistance"]) {
            // Parse resistance like "220", "220R", "1k", etc.
            const rawRes = rComp.properties["resistance"].toLowerCase();
            const numPart = parseFloat(rawRes);
            if (!isNaN(numPart)) {
              if (rawRes.includes("k")) seriesResistorValue = numPart * 1000;
              else if (rawRes.includes("m")) seriesResistorValue = numPart * 1000000;
              else seriesResistorValue = numPart;
            }
          }
          return true;
        }
        return false;
      });

      if (!hasSeriesResistor) {
        errors.push({ line: ledComp.line, column: 1,
          message: `E007: LED '${ledId}' is connected directly to power net '${srcId}' without a current-limiting resistor. Add a series resistor (e.g., 220Ω for 5V supply).`,
          errorCode: "E007", severity: "error", sourceLine: "" });
      } else if (srcNet.voltage !== undefined && srcNet.voltage > 3.3 && seriesResistorValue !== -1 && seriesResistorValue < 100) {
        errors.push({ line: ledComp.line, column: 1,
          message: `E015: LED '${ledId}' series resistor is too low (${seriesResistorValue}Ω) for a ${srcNet.voltage}V supply. This will exceed the maximum forward current and destroy the LED. Increase resistance (e.g., 220Ω - 1kΩ).`,
          errorCode: "E015", severity: "error", sourceLine: "" });
      }
    }
  }

  // ── E008: High-current load driven directly by MCU GPIO ──────────────────
  const HIGH_CURRENT_TYPES = new Set(["Buzzer", "Motor"]);
  const MCU_TYPES = new Set([
    "ArduinoUno", "ArduinoNano", "ESP32", "ESP8266", "RaspberryPiPico", "STM32",
  ]);
  const BJT_TYPES = new Set(["NPN", "PNP"]);

  for (const [loadId, loadComp] of components) {
    if (!HIGH_CURRENT_TYPES.has(loadComp.type)) continue;

    const powerPins = loadComp.pins.filter(
      (p) => p.type === "power" || p.name === "vcc" || p.name === "m_pos",
    );
    for (const pin of powerPins) {
      const drivingConns = connections.filter(
        (c) => (c.to === loadId && c.toPin === pin.name) ||
               (c.from === loadId && c.fromPin === pin.name),
      );
      for (const conn of drivingConns) {
        const driverId   = conn.from === loadId ? conn.to : conn.from;
        const driverComp = components.get(driverId);
        if (driverComp && MCU_TYPES.has(driverComp.type)) {
          errors.push({ line: conn.line, column: 1,
            message: `E008: High-current component '${loadId}' (${loadComp.type}) is driven directly by MCU '${driverId}'. Add a transistor driver (e.g., 2N2222 with base resistor) between the MCU GPIO and the load.`,
            errorCode: "E008", severity: "error", sourceLine: "" });
        }
      }
    }
  }

  // ── E011: Logic contention — two MCU GPIO pins wired directly ────────────
  const BUS_PIN_NAMES = new Set([
    "sda", "scl", "tx", "rx", "mosi", "miso", "sck", "ss", "cs", "nss",
    "reset", "en", "boot", "aref",
  ]);
  const GPIO_PIN_TYPES = new Set<PinType>(["digital", "analog"]);

  for (const conn of connections) {
    const fromComp = components.get(conn.from);
    const toComp   = components.get(conn.to);
    if (!fromComp || !toComp) continue;
    if (!MCU_TYPES.has(fromComp.type) || !MCU_TYPES.has(toComp.type)) continue;

    const fromPin = fromComp.pins.find((p) => p.name === conn.fromPin);
    const toPin   = toComp.pins.find((p)   => p.name === conn.toPin);
    if (!fromPin || !toPin) continue;
    if (!GPIO_PIN_TYPES.has(fromPin.type) || !GPIO_PIN_TYPES.has(toPin.type)) continue;
    if (BUS_PIN_NAMES.has(conn.fromPin) || BUS_PIN_NAMES.has(conn.toPin)) continue;

    const srcLine = sourceLines[conn.line - 1] ?? "";
    errors.push({ line: conn.line, column: 1,
      message: `E011: Logic contention — '${conn.from}.${conn.fromPin}' (MCU GPIO) is directly wired to '${conn.to}.${conn.toPin}' (MCU GPIO) with no series resistor. When both drive opposite logic levels simultaneously this creates a low-impedance conflict that destroys internal output-stage circuitry.`,
      errorCode: "E011", severity: "error", sourceLine: srcLine });
  }

  // ── E012: Inductive kickback — graph-aware flyback diode check ───────────
  // A flyback diode is valid when:
  //   diode.cathode  is in the SAME net group as the load's VCC-side pin, AND
  //   diode.anode    is in the SAME net group as the load's GND-side pin.
  // Union-Find consolidation means this works regardless of how many intermediate
  // components sit between the diode and the load.
  const INDUCTIVE_TYPES = new Set(["Motor", "Buzzer", "Relay", "Solenoid"]);
  const FLYBACK_TYPES   = new Set(["Diode", "SchottkyDiode", "TVSDiode"]);

  for (const [inductId, inductComp] of components) {
    if (!INDUCTIVE_TYPES.has(inductComp.type)) continue;

    // All net-group roots this inductive load's pins belong to
    const inductRoots = compPinRoots(inductId, inductComp, uf);
    if (inductRoots.size === 0) continue;

    let hasParallelFlyback = false;

    for (const [dId, dComp] of components) {
      if (!FLYBACK_TYPES.has(dComp.type)) continue;

      // The diode must have anode and cathode pins
      const cathodeEp = `${dId}:cathode`;
      const anodeEp   = `${dId}:anode`;
      const cathodeRoot = uf.find(cathodeEp);
      const anodeRoot   = uf.find(anodeEp);

      // Both cathode group and anode group must be in the inductive load's group set,
      // and they must be DIFFERENT groups (cathode ≠ anode → not shorted)
      if (cathodeRoot !== anodeRoot &&
          inductRoots.has(cathodeRoot) &&
          inductRoots.has(anodeRoot)) {
        hasParallelFlyback = true;
        break;
      }
    }

    if (!hasParallelFlyback) {
      errors.push({ line: inductComp.line, column: 1,
        message: `E012: '${inductId}' (${inductComp.type}) has no flyback diode in parallel. When switched off its collapsing magnetic field generates a destructive voltage spike — add a Schottky diode (cathode to +, anode to −) across the load to clamp the kickback.`,
        errorCode: "E012", severity: "error", sourceLine: "" });
    }
  }

  // ── E013: Inverted polarity — ground/power net on wrong-named IC pin ──────
  const POWER_PIN_RE  = /^(vcc|vdd|v\+|vbat|avcc|dvcc|vccio|vin)$/i;
  const GROUND_PIN_RE = /^(gnd|vss|v-|agnd|pgnd|sgnd|dgnd)$/i;

  for (const conn of connections) {
    const fromNet  = nets.get(conn.from);
    const toNet    = nets.get(conn.to);
    const fromComp = components.get(conn.from);
    const toComp   = components.get(conn.to);
    const srcLine  = sourceLines[conn.line - 1] ?? "";

    if (fromNet?.type === "power" && toComp) {
      const toPin = toComp.pins.find((p) => p.name === conn.toPin);
      if (GROUND_PIN_RE.test(conn.toPin) && toPin && toPin.type !== "ground") {
        errors.push({ line: conn.line, column: 1,
          message: `E013: Reverse polarity! Power net '${conn.from}' (${fromNet.voltage ?? "?"}V) is wired to '${conn.to}.${conn.toPin}' which is a ground/negative pin. This will instantly destroy the IC — swap the power and ground connections.`,
          errorCode: "E013", severity: "fatal", sourceLine: srcLine });
      }
    }

    if (fromNet?.type === "ground" && toComp) {
      const toPin = toComp.pins.find((p) => p.name === conn.toPin);
      if (POWER_PIN_RE.test(conn.toPin) && toPin && toPin.type !== "power") {
        errors.push({ line: conn.line, column: 1,
          message: `E013: Reverse polarity! Ground net '${conn.from}' is wired to '${conn.to}.${conn.toPin}' which is a power/positive pin. This will instantly destroy the IC — swap the power and ground connections.`,
          errorCode: "E013", severity: "fatal", sourceLine: srcLine });
      }
    }

    if (fromComp && toNet?.type === "power") {
      const fromPin = fromComp.pins.find((p) => p.name === conn.fromPin);
      if (GROUND_PIN_RE.test(conn.fromPin) && fromPin && fromPin.type !== "ground") {
        errors.push({ line: conn.line, column: 1,
          message: `E013: Reverse polarity! Pin '${conn.from}.${conn.fromPin}' (ground pin) is wired to power net '${conn.to}' (${toNet.voltage ?? "?"}V). This will instantly destroy the IC — swap the connections.`,
          errorCode: "E013", severity: "fatal", sourceLine: srcLine });
      }
    }

    if (fromComp && toNet?.type === "ground") {
      const fromPin = fromComp.pins.find((p) => p.name === conn.fromPin);
      if (POWER_PIN_RE.test(conn.fromPin) && fromPin && fromPin.type !== "power") {
        errors.push({ line: conn.line, column: 1,
          message: `E013: Reverse polarity! Pin '${conn.from}.${conn.fromPin}' (power pin) is wired to ground net '${conn.to}'. This will instantly destroy the IC — swap the connections.`,
          errorCode: "E013", severity: "fatal", sourceLine: srcLine });
      }
    }
  }

  // ── E009: Transistor base without current-limiting resistor ──────────────
  for (const [qId, qComp] of components) {
    if (!BJT_TYPES.has(qComp.type)) continue;

    const baseConns = connections.filter(
      (c) => (c.to === qId && c.toPin === "base") || (c.from === qId && c.fromPin === "base"),
    );

    for (const conn of baseConns) {
      const srcLine = sourceLines[conn.line - 1] ?? "";
      const otherId = conn.from === qId ? conn.to : conn.from;
      const srcNet  = nets.get(otherId);
      const srcComp = components.get(otherId);

      if (srcNet && srcNet.type === "power") {
        errors.push({ line: conn.line, column: 1,
          message: `E009: Transistor '${qId}' (${qComp.type}) base pin is driven directly by power net '${otherId}' (${srcNet.voltage ?? "?"}V). This provides unlimited base current and will instantly destroy the transistor junction. Add a series base resistor (e.g., 10kΩ).`,
          errorCode: "E009", severity: "fatal", sourceLine: srcLine });
        continue;
      }

      if (srcComp && MCU_TYPES.has(srcComp.type)) {
        errors.push({ line: conn.line, column: 1,
          message: `E009: Transistor '${qId}' (${qComp.type}) base is connected directly to MCU '${otherId}' with no base resistor. MCU GPIO pins source ≤40 mA — an unprotected base draws destructive current at saturation. Insert a 10kΩ resistor between the GPIO and the base.`,
          errorCode: "E009", severity: "error", sourceLine: srcLine });
      }
    }
  }

  // ── E010: NPN collector–emitter short when saturated ─────────────────────
  for (const [qId, qComp] of components) {
    if (qComp.type !== "NPN") continue;

    const collectorConns = connections.filter(
      (c) => (c.to === qId && c.toPin === "collector") || (c.from === qId && c.fromPin === "collector"),
    );
    const emitterConns = connections.filter(
      (c) => (c.to === qId && c.toPin === "emitter") || (c.from === qId && c.fromPin === "emitter"),
    );

    const collDirectVccConn = collectorConns.find((c) => {
      const otherId = c.from === qId ? c.to : c.from;
      return nets.get(otherId)?.type === "power";
    });
    const emitterDirectGnd = emitterConns.some((c) => {
      const otherId = c.from === qId ? c.to : c.from;
      return nets.get(otherId)?.type === "ground";
    });

    if (collDirectVccConn && emitterDirectGnd) {
      const pwrId   = collDirectVccConn.from === qId ? collDirectVccConn.to : collDirectVccConn.from;
      const srcLine = sourceLines[collDirectVccConn.line - 1] ?? "";
      errors.push({ line: collDirectVccConn.line, column: 1,
        message: `E010: Transistor '${qId}' collector is wired directly to power net '${pwrId}' with the emitter at ground and no load in the collector path. When saturated this is a dead short — add a load (resistor, LED, relay coil) between '${pwrId}' and '${qId}.collector'.`,
        errorCode: "E010", severity: "fatal", sourceLine: srcLine });
    }
  }

  // ── W007: Transistor pin voltage violation ────────────────────────────────
  for (const [qId, qComp] of components) {
    if (!BJT_TYPES.has(qComp.type)) continue;

    const allQConns = connections.filter((c) => c.from === qId || c.to === qId);

    const highVConn = allQConns.find((c) => {
      const otherId = c.from === qId ? c.to : c.from;
      const net = nets.get(otherId);
      return net?.type === "power" && net.voltage !== undefined && net.voltage >= 5.0;
    });
    if (!highVConn) continue;

    const highVNetId   = highVConn.from === qId ? highVConn.to : highVConn.from;
    const highVNet     = nets.get(highVNetId)!;
    const highVPinName = highVConn.from === qId ? highVConn.fromPin : highVConn.toPin;

    const lowVConn = allQConns.find((c) => {
      const otherId = c.from === qId ? c.to : c.from;
      if (otherId === highVNetId) return false;
      const net  = nets.get(otherId);
      if (net?.voltage !== undefined && net.voltage <= 3.3) return true;
      const comp = components.get(otherId);
      if (comp?.voltageLevel !== undefined && comp.voltageLevel <= 3.3) return true;
      return false;
    });

    if (lowVConn) {
      const lowId    = lowVConn.from === qId ? lowVConn.to : lowVConn.from;
      const lowLabel = nets.get(lowId)?.voltage
        ? `net '${lowId}' (${nets.get(lowId)!.voltage}V)`
        : `'${lowId}' (${components.get(lowId)?.voltageLevel ?? "?"}V)`;
      warnings.push({ line: highVConn.line, column: 1,
        message: `W007: Transistor '${qId}' (${qComp.type}) has ${highVNet.voltage}V net '${highVNetId}' on its '${highVPinName}' pin, but the transistor also interfaces with 3.3V logic at ${lowLabel}. Verify the base drive voltage is 3.3V-compatible or add appropriate protection.`,
        warningCode: "W007" });
    }
  }

  // ── W009: Missing decoupling capacitor on IC/sensor/module VCC pins ─────────
  // For every IC, sensor, or module whose VCC pin is connected to a power net,
  // check that at least one Capacitor bridges that same power root to any ground root.
  const DECOUPLE_CATEGORIES = new Set<ComponentCategory>(["active_ic", "sensor", "module"]);
  const VCC_PIN_RE = /^(vcc|vdd|v\+|vbat|avcc|dvcc|vccio|vin|v3v3|v5)$/i;
  const CAPACITOR_TYPES = new Set(["Capacitor"]);

  const powerRoots = new Set<string>();
  const groundRootsSet = new Set<string>();
  for (const [varName, net] of nets) {
    if (net.type === "power")  powerRoots.add(uf.find(`net:${varName}`));
    if (net.type === "ground") groundRootsSet.add(uf.find(`net:${varName}`));
  }

  for (const [name, comp] of components) {
    if (!DECOUPLE_CATEGORIES.has(comp.category)) continue;

    const vccPins = comp.pins.filter((p) => p.type === "power" || VCC_PIN_RE.test(p.name));
    for (const vccPin of vccPins) {
      const pinEp   = `${name}:${vccPin.name}`;
      const pinRoot = uf.find(pinEp);
      if (!powerRoots.has(pinRoot)) continue;

      let hasDecoupling = false;
      for (const [capId, capComp] of components) {
        if (!CAPACITOR_TYPES.has(capComp.type)) continue;
        const r1 = uf.find(`${capId}:pin1`);
        const r2 = uf.find(`${capId}:pin2`);
        if (
          (r1 === pinRoot && groundRootsSet.has(r2)) ||
          (r2 === pinRoot && groundRootsSet.has(r1))
        ) { hasDecoupling = true; break; }
      }

      if (!hasDecoupling) {
        warnings.push({ line: comp.line, column: 1,
          message: `W009: Component '${name}' (${comp.type}) has no decoupling capacitor on its ${vccPin.name} pin. Add a 100nF ceramic capacitor between ${vccPin.name} and GND as close to the IC as possible to suppress power supply noise.`,
          warningCode: "W009" });
        break;
      }
    }
  }

  return { errors, warnings };
}
