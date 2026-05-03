import type { Netlist } from "./circuit-netlist.js";

// ── Public types (mirrored in OpenAPI) ────────────────────────────────────────

export interface AssertionResult {
  code:      string;
  passed:    boolean;
  message:   string;
  expected?: string;
  actual?:   string;
}

export interface TestResult {
  description: string;
  passed:      boolean;
  assertions:  AssertionResult[];
}

// ── Internal parsing types ────────────────────────────────────────────────────

type AssertionType =
  | "assert_connected"
  | "assert_net_exists"
  | "assert_eq"
  | "assert_gt"
  | "assert_lt"
  | "assert_voltage"
  | "assert_component_exists";

interface ParsedAssertion {
  type: AssertionType;
  args: string[];
  raw:  string;
}

interface ParsedTest {
  description: string;
  assertions:  ParsedAssertion[];
}

// ── Test block extraction ─────────────────────────────────────────────────────

function parseTestBlocks(source: string): ParsedTest[] {
  const tests: ParsedTest[] = [];
  const blockRe = /test\s+"([^"]+)"\s*\{([^}]*)\}/gs;
  let m: RegExpExecArray | null;

  while ((m = blockRe.exec(source)) !== null) {
    const description = m[1];
    const body        = m[2];
    const assertions: ParsedAssertion[] = [];

    const assertRe = /(assert_\w+)\s*!\s*\(([^)]*)\)\s*;?/g;
    let am: RegExpExecArray | null;

    while ((am = assertRe.exec(body)) !== null) {
      const type    = am[1] as AssertionType;
      const argsRaw = am[2];
      // Split on commas, trim, strip surrounding quotes
      const args = argsRaw.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
      assertions.push({ type, args, raw: am[0].trim() });
    }

    if (assertions.length > 0) {
      tests.push({ description, assertions });
    }
  }

  return tests;
}

// ── Single assertion executor ─────────────────────────────────────────────────

function runAssertion(a: ParsedAssertion, netlist: Netlist): AssertionResult {
  const { type, args, raw } = a;

  switch (type) {
    case "assert_connected": {
      // assert_connected!(r1.pin2, led1.anode)
      const [left, right] = args;
      const [compA, pinA] = (left ?? "").split(".");
      const [compB, pinB] = (right ?? "").split(".");

      if (!compA || !pinA || !compB || !pinB) {
        return { code: raw, passed: false, message: `Invalid syntax — expected 'comp.pin' format in both arguments` };
      }

      const isConnected = netlist.connections.some(
        (c) =>
          (c.from === compA && c.fromPin === pinA && c.to === compB && c.toPin === pinB) ||
          (c.from === compB && c.fromPin === pinB && c.to === compA && c.toPin === pinA),
      );

      return {
        code: raw,
        passed:   isConnected,
        message:  isConnected
          ? `${left} is connected to ${right}`
          : `No connection found between ${left} and ${right}`,
        expected: `${left} → ${right}`,
        actual:   isConnected ? "connected" : "not connected",
      };
    }

    case "assert_net_exists": {
      const netName = args[0] ?? "";
      const exists  = netlist.nets.some((n) => n.name === netName);
      return {
        code:     raw,
        passed:   exists,
        message:  exists ? `Net '${netName}' exists in the netlist` : `Net '${netName}' was not found`,
        expected: netName,
        actual:   exists ? "exists" : "not found",
      };
    }

    case "assert_component_exists": {
      const id     = args[0] ?? "";
      const exists = netlist.components.some((c) => c.name === id);
      return {
        code:     raw,
        passed:   exists,
        message:  exists ? `Component '${id}' exists` : `Component '${id}' was not found`,
        expected: id,
        actual:   exists ? "exists" : "not found",
      };
    }

    case "assert_eq": {
      // assert_eq!(comp.pin.net, "net_name")  |  assert_eq!(comp.type, "Resistor")
      const [expr, expected] = args;
      const parts = (expr ?? "").split(".");

      if (parts.length === 3 && parts[2] === "net") {
        const [compId, pinName] = parts;
        const comp = netlist.components.find((c) => c.name === compId);
        if (!comp) {
          return { code: raw, passed: false, message: `Component '${compId}' not found`, expected, actual: undefined };
        }
        const pin    = comp.pins.find((p) => p.name === pinName);
        const actual = pin?.net ?? "undefined";
        const passed = actual === expected;
        return {
          code: raw, passed,
          message:  passed ? `${expr} == "${expected}"` : `${expr} is "${actual}", expected "${expected}"`,
          expected, actual,
        };
      }

      if (parts.length === 2 && parts[1] === "type") {
        const comp   = netlist.components.find((c) => c.name === parts[0]);
        const actual = comp?.type ?? "undefined";
        const passed = actual === expected;
        return {
          code: raw, passed,
          message:  passed ? `${expr} == "${expected}"` : `${expr} is "${actual}", expected "${expected}"`,
          expected, actual,
        };
      }

      return { code: raw, passed: false, message: `Unsupported assert_eq expression: '${expr}'` };
    }

    case "assert_gt":
    case "assert_lt": {
      // assert_gt!(r1.resistance, "100")  |  assert_lt!(r1.resistance, "1000")
      const [expr, threshStr] = args;
      const threshold = parseFloat((threshStr ?? "").replace(/[^\d.]/g, ""));
      const parts     = (expr ?? "").split(".");

      if (parts.length === 2) {
        const [compId, propName] = parts;
        const comp = netlist.components.find((c) => c.name === compId);
        if (!comp) {
          return { code: raw, passed: false, message: `Component '${compId}' not found`, expected: `${type === "assert_gt" ? ">" : "<"}${threshStr}`, actual: undefined };
        }
        const props = (comp.properties ?? {}) as Record<string, string>;
        const val   = parseFloat((props[propName] ?? "").replace(/[^\d.]/g, ""));
        const passed = !isNaN(val) && (type === "assert_gt" ? val > threshold : val < threshold);
        const op     = type === "assert_gt" ? ">" : "<";
        return {
          code: raw, passed,
          message:  passed
            ? `${expr} (${val}) ${op} ${threshold}`
            : `${expr} (${isNaN(val) ? "undefined" : val}) is NOT ${op} ${threshold}`,
          expected: `${op}${threshold}`,
          actual:   isNaN(val) ? "undefined" : String(val),
        };
      }

      return { code: raw, passed: false, message: `Unsupported expression: '${expr}'` };
    }

    case "assert_voltage": {
      // assert_voltage!(vcc, 5.0)
      const [netName, voltStr] = args;
      const expectedV = parseFloat(voltStr ?? "0");
      const net       = netlist.nets.find((n) => n.name === netName);
      if (!net) {
        return { code: raw, passed: false, message: `Net '${netName}' not found`, expected: `${expectedV}V`, actual: undefined };
      }
      const actualV = net.voltage;
      const passed  = actualV != null && Math.abs(actualV - expectedV) < 0.05;
      return {
        code: raw, passed,
        message:  passed
          ? `Net '${netName}' voltage is ${actualV}V`
          : `Net '${netName}' is ${actualV ?? "undefined"}V, expected ${expectedV}V`,
        expected: `${expectedV}V`,
        actual:   actualV != null ? `${actualV}V` : "undefined",
      };
    }

    default:
      return { code: raw, passed: false, message: `Unknown assertion type: '${type}'` };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Strip test blocks from source before passing to the main DSL parser.
 * Replaces each block with blank lines to preserve line numbers for error reporting.
 */
export function stripTestBlocks(source: string): string {
  return source.replace(/test\s+"[^"]*"\s*\{[^}]*\}/gs, (match) => {
    const newlines = (match.match(/\n/g) ?? []).length;
    return "\n".repeat(newlines);
  });
}

/** Run all test blocks in source against the compiled netlist. */
export function runTests(source: string, netlist: Netlist): TestResult[] {
  const tests = parseTestBlocks(source);
  return tests.map((test) => {
    const assertions = test.assertions.map((a) => runAssertion(a, netlist));
    return {
      description: test.description,
      passed:      assertions.length > 0 && assertions.every((a) => a.passed),
      assertions,
    };
  });
}
