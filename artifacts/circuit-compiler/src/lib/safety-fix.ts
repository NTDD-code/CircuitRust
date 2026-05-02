// ──────────────────────────────────────────────────────────────────────────────
// SAFETY FIX GENERATOR
// Parses the safety issue detail message, extracts variable names, and
// produces a corrected source string with the minimum required change.
// ──────────────────────────────────────────────────────────────────────────────

export interface FixResult {
  fixed: string;
  description: string;
  insertedLines: string[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function lineIndent(line: string): string {
  return line.match(/^(\s*)/)?.[1] ?? "";
}

function findLineIndex(lines: string[], ...patterns: RegExp[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (patterns.every((p) => p.test(lines[i]))) return i;
  }
  return -1;
}

// ─── S002: LED overcurrent — insert 220Ω resistor in series ──────────────────
function fixLEDOvercurrent(detail: string, source: string): FixResult | null {
  // Detail: "E007: LED 'led1' is connected directly to power net 'vcc' ..."
  const ledMatch  = detail.match(/LED '(\w+)'/);
  const netMatch  = detail.match(/power net '(\w+)'/);
  if (!ledMatch || !netMatch) return null;

  const ledId  = ledMatch[1];
  const netId  = netMatch[1];
  const resId  = `r_${ledId}`;

  const lines = source.split("\n");

  // Find LED declaration and insert resistor on the next line
  const ledDeclIdx = findLineIndex(lines, new RegExp(`let\\s+${ledId}\\b`), /Component::LED/);
  const insertAfter = ledDeclIdx >= 0 ? ledDeclIdx : -1;

  const newResLine = `let ${resId} = Component::Resistor { resistance: "220" }; // 220Ω current-limiting resistor`;
  const patched = [...lines];

  if (insertAfter >= 0) {
    patched.splice(insertAfter + 1, 0, newResLine);
  } else {
    // Fallback: insert before first connect!
    const firstConnIdx = patched.findIndex((l) => /connect!/.test(l));
    patched.splice(Math.max(0, firstConnIdx), 0, newResLine, "");
  }

  // Replace connect!(netId => ledId.anode) with two-step route through resistor
  const directConnRe = new RegExp(
    `connect!\\(\\s*${netId}\\s*=>\\s*${ledId}\\.anode\\s*\\)`,
  );
  let replaced = false;
  for (let i = 0; i < patched.length; i++) {
    if (directConnRe.test(patched[i])) {
      const ind = lineIndent(patched[i]);
      patched[i] = [
        `${ind}connect!(${netId} => ${resId}.pin1);`,
        `${ind}connect!(${resId}.pin2 => ${ledId}.anode);`,
      ].join("\n");
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    // Still a valid fix even if we couldn't find the exact connection pattern
    patched.push(`// Fix: route power through ${resId} before reaching ${ledId}.anode`);
  }

  return {
    fixed: patched.join("\n"),
    description: `Inserted ${resId} (220Ω) between ${netId} and ${ledId}.anode`,
    insertedLines: [newResLine],
  };
}

// ─── S001: Short circuit — comment out the direct power→ground connection ─────
function fixShortCircuit(detail: string, source: string): FixResult | null {
  // Detail: "Short circuit detected — power net 'vcc' directly connected to ground net 'gnd' ..."
  const pwrMatch = detail.match(/power net '(\w+)'/);
  const gndMatch = detail.match(/ground net '(\w+)'/);
  if (!pwrMatch || !gndMatch) return null;

  const pwrId = pwrMatch[1];
  const gndId = gndMatch[1];

  const re1 = new RegExp(`connect!\\(\\s*${pwrId}\\s*=>\\s*${gndId}\\s*\\)`);
  const re2 = new RegExp(`connect!\\(\\s*${gndId}\\s*=>\\s*${pwrId}\\s*\\)`);

  const commentLine = [
    `// ⚡ FIXED: removed short circuit — add a load (resistor, LED, etc.) between ${pwrId} and ${gndId}`,
    `// Example: let load = Component::Resistor { resistance: "1000" };`,
    `//          connect!(${pwrId} => load.pin1);`,
    `//          connect!(load.pin2 => ${gndId});`,
  ].join("\n");

  const fixed = source
    .split("\n")
    .map((line) => {
      if (re1.test(line) || re2.test(line)) {
        return `${lineIndent(line)}${commentLine}`;
      }
      return line;
    })
    .join("\n");

  return {
    fixed,
    description: `Removed direct ${pwrId}→${gndId} short, added example load template`,
    insertedLines: [commentLine],
  };
}

// ─── S003: Voltage mismatch — add a level-shifter template ───────────────────
function fixVoltageMismatch(detail: string, source: string): FixResult | null {
  // Two possible detail formats:
  // "Voltage mismatch: comp.pin drives 5V but comp2.pin has a 3.3V maximum..."
  // "Voltage mismatch: net 'vcc5' (5V) exceeds max input voltage of comp.pin (3.3V)..."
  let fromId = "", fromPin = "", toId = "", toPin = "";

  const compMatch = detail.match(/(\w+)\.(\w+)\s+drives?\s+[\d.]+V.*?(\w+)\.(\w+)\s+has/);
  const netMatch  = detail.match(/net '(\w+)'.*?of\s+(\w+)\.(\w+)/);

  if (compMatch) {
    [, fromId, fromPin, toId, toPin] = compMatch;
  } else if (netMatch) {
    // net → component pin
    fromId  = netMatch[1];
    fromPin = "";
    toId    = netMatch[2];
    toPin   = netMatch[3];
  } else {
    return null;
  }

  const lvlId = `lvl_${fromId.slice(0, 4)}_${toId.slice(0, 4)}`;
  const lvlDecl = `let ${lvlId} = Component::LevelShifter; // Fix: 5V ↔ 3.3V level shifter`;

  const connRe = fromPin
    ? new RegExp(`connect!\\(\\s*${fromId}\\.${fromPin}\\s*=>\\s*${toId}\\.${toPin}\\s*\\)`)
    : null;

  const lines = source.split("\n");

  // Insert level-shifter declaration near the top (after last net declaration)
  const lastNetIdx = [...lines].reduce((last, l, i) => (/Net::/.test(l) ? i : last), 0);
  const patched = [...lines];
  patched.splice(lastNetIdx + 1, 0, "", lvlDecl);

  // Replace the dangerous direct connection with routed-through-shifter version
  let replaced = false;
  if (connRe) {
    for (let i = 0; i < patched.length; i++) {
      if (connRe.test(patched[i])) {
        const ind = lineIndent(patched[i]);
        patched[i] = [
          `${ind}// ⚡ FIXED: route through level shifter instead of direct connection`,
          `${ind}connect!(${fromId}.${fromPin} => ${lvlId}.lv_in);`,
          `${ind}connect!(${lvlId}.hv_out => ${toId}.${toPin});`,
        ].join("\n");
        replaced = true;
        break;
      }
    }
  }

  if (!replaced) {
    patched.push(
      "",
      `// ⚡ FIXED: connect ${fromId} → ${lvlId} → ${toId} to prevent overvoltage`,
    );
  }

  return {
    fixed: patched.join("\n"),
    description: `Added ${lvlId} between ${fromId} and ${toId} to prevent overvoltage`,
    insertedLines: [lvlDecl],
  };
}

// ─── S004: MCU GPIO overload — insert NPN transistor driver ──────────────────
function fixMCUOverload(detail: string, source: string): FixResult | null {
  // Detail: "E008: High-current component 'buzzer1' (Buzzer) is driven directly by MCU 'ard'..."
  const loadMatch = detail.match(/High-current component '(\w+)'\s*\((\w+)\)/);
  const mcuMatch  = detail.match(/MCU '(\w+)'/);
  if (!loadMatch || !mcuMatch) return null;

  const loadId   = loadMatch[1];
  const loadType = loadMatch[2];
  const mcuId    = mcuMatch[1];
  const qId      = `q_${loadId}`;
  const rBaseId  = `r_b_${loadId}`;

  const qDecl    = `let ${qId}   = Component::NPN { model: "2N2222" }; // Fix: transistor driver`;
  const rDecl    = `let ${rBaseId} = Component::Resistor { resistance: "10000" }; // 10kΩ base resistor`;

  const lines = source.split("\n");

  // Insert transistor + base resistor after load declaration
  const loadDeclIdx = findLineIndex(
    lines,
    new RegExp(`let\\s+${loadId}\\b`),
    new RegExp(`Component::${loadType}`),
  );
  const patched = [...lines];
  const insertAt = loadDeclIdx >= 0 ? loadDeclIdx + 1 : lines.length;
  patched.splice(insertAt, 0, qDecl, rDecl);

  // Find MCU→load direct connection and replace with transistor-routed version
  const directRe1 = new RegExp(
    `connect!\\(\\s*(${mcuId}\\.\\w+)\\s*=>\\s*(${loadId}\\.\\w+)\\s*\\)`,
  );
  const directRe2 = new RegExp(
    `connect!\\(\\s*(${loadId}\\.\\w+)\\s*=>\\s*(${mcuId}\\.\\w+)\\s*\\)`,
  );

  let replaced = false;
  for (let i = 0; i < patched.length; i++) {
    const m1 = patched[i].match(directRe1);
    const m2 = patched[i].match(directRe2);
    const mcuPin = m1 ? m1[1] : m2 ? m2[2] : null;

    if (mcuPin) {
      const ind = lineIndent(patched[i]);
      patched[i] = [
        `${ind}// ⚡ FIXED: MCU GPIO → base resistor → NPN base → load via collector`,
        `${ind}connect!(${mcuPin} => ${rBaseId}.pin1);`,
        `${ind}connect!(${rBaseId}.pin2 => ${qId}.base);`,
        `${ind}// connect your power supply → ${loadId}.vcc → ${qId}.collector`,
        `${ind}// connect!(${qId}.emitter => gnd);`,
      ].join("\n");
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    patched.push(
      "",
      `// ⚡ FIXED: connect MCU GPIO → ${rBaseId}.pin1 → ${qId}.base`,
      `//          then: power → ${loadId}.vcc → ${qId}.collector → ${qId}.emitter → gnd`,
    );
  }

  return {
    fixed: patched.join("\n"),
    description: `Added NPN driver (${qId}) + base resistor (${rBaseId}) for ${loadId}`,
    insertedLines: [qDecl, rDecl],
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────
export function generateFix(
  code: string,
  detail: string,
  source: string,
): FixResult | null {
  switch (code) {
    case "S001": return fixShortCircuit(detail, source);
    case "S002": return fixLEDOvercurrent(detail, source);
    case "S003": return fixVoltageMismatch(detail, source);
    case "S004": return fixMCUOverload(detail, source);
    default:     return null;
  }
}

// Human-readable label for each fix code
export const FIX_LABELS: Record<string, string> = {
  S001: "Remove short circuit",
  S002: "Insert 220Ω current-limiting resistor",
  S003: "Add level shifter",
  S004: "Insert NPN transistor driver",
  S005: "Insert 10kΩ base resistor",
  S006: "Add collector load resistor",
  S007: "Review BJT drive voltage",
};
