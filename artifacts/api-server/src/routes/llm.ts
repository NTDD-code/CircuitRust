import { Router } from "express";
import { AnalyzeCircuitSafetyBody } from "@workspace/api-zod";

const router = Router();

router.post("/llm/analyze", (req, res) => {
  const parsed = AnalyzeCircuitSafetyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { source, netlist } = parsed.data;

  const risks: Array<{ severity: "low" | "medium" | "high" | "critical"; description: string; component?: string }> =
    [];
  const suggestions: string[] = [];
  let safetyScore = 90;

  const hasTransistor = netlist?.components?.some((c) => c.type === "Transistor");
  const hasCapacitor = netlist?.components?.some((c) => c.type === "Capacitor");
  const hasLED = netlist?.components?.some((c) => c.type === "LED");
  const hasResistor = netlist?.components?.some((c) => c.type === "Resistor");
  const hasVReg = netlist?.components?.some((c) => c.type === "VoltageRegulator");
  const powerNets = netlist?.nets?.filter((n) => n.type === "power") ?? [];
  const highVoltage = powerNets.some((n) => (n.voltage ?? 0) > 12);
  const componentCount = netlist?.components?.length ?? 0;

  if (highVoltage) {
    risks.push({
      severity: "high",
      description: "High voltage detected (>12V). Ensure proper insulation and safety margins on PCB traces.",
    });
    safetyScore -= 15;
    suggestions.push("Add transient voltage suppression (TVS) diodes on power inputs for high-voltage circuits.");
    suggestions.push("Verify trace width can handle the current at the specified voltage.");
  }

  if (hasLED && !hasResistor) {
    risks.push({
      severity: "critical",
      description: "LED present without current-limiting resistor. LEDs will burn out immediately without a resistor.",
    });
    safetyScore -= 30;
    suggestions.push("Add a current-limiting resistor in series with each LED (typically 220-1000 ohm for 5V).");
  }

  if (hasTransistor) {
    risks.push({
      severity: "low",
      description: "Transistor detected. Verify base resistor is properly sized for your logic voltage level.",
    });
    safetyScore -= 5;
    suggestions.push("Ensure base resistor limits base current to safe levels (Ib = Ic / hFE).");
  }

  if (!hasCapacitor && (hasVReg || componentCount > 3)) {
    risks.push({
      severity: "medium",
      description: "No bypass capacitors detected. Power supply noise may cause instability.",
    });
    safetyScore -= 10;
    suggestions.push("Add 100nF ceramic bypass capacitors close to each IC power pin.");
    suggestions.push("Add 10-100uF electrolytic capacitor at the power supply output for bulk decoupling.");
  }

  if (componentCount > 8) {
    risks.push({
      severity: "low",
      description: "Complex circuit. Consider adding test points for debugging and verification.",
    });
    suggestions.push("Add labeled test points to key nets for easier debugging.");
  }

  if (suggestions.length === 0) {
    suggestions.push("Circuit looks well-structured. Review component datasheets for operating range confirmation.");
    suggestions.push("Consider adding ESD protection on external-facing signal pins.");
  }

  const netCount = netlist?.nets?.length ?? 0;
  const connCount = netlist?.connections?.length ?? 0;

  let analysis = `Circuit analysis complete. `;
  if (componentCount === 0) {
    analysis += `No components detected in the netlist. Compile the circuit first, then re-analyze.`;
  } else {
    analysis +=
      `Found ${componentCount} component${componentCount !== 1 ? "s" : ""}, ` +
      `${netCount} net${netCount !== 1 ? "s" : ""}, and ` +
      `${connCount} connection${connCount !== 1 ? "s" : ""}. `;

    if (safetyScore >= 85) {
      analysis += `The circuit appears safe and well-designed. `;
    } else if (safetyScore >= 60) {
      analysis += `The circuit has some safety concerns that should be addressed before fabrication. `;
    } else {
      analysis += `Significant safety issues detected. Do not build this circuit without resolving the critical/high risks. `;
    }

    if (risks.length > 0) {
      const critical = risks.filter((r) => r.severity === "critical").length;
      const high = risks.filter((r) => r.severity === "high").length;
      if (critical > 0)
        analysis += `${critical} critical issue${critical !== 1 ? "s" : ""} must be fixed. `;
      if (high > 0)
        analysis += `${high} high-severity risk${high !== 1 ? "s" : ""} identified. `;
    } else {
      analysis += `No major safety risks identified.`;
    }
  }

  safetyScore = Math.max(0, Math.min(100, safetyScore));

  res.json({
    safetyScore,
    analysis: analysis.trim(),
    risks,
    suggestions,
    model: "Gemma 2B (Placeholder — connect your LLM endpoint to enable AI analysis)",
  });
});

export default router;
