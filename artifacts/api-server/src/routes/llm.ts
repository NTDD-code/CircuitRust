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
  const risks: Array<{ severity: "low" | "medium" | "high" | "critical"; description: string; component?: string }> = [];
  const suggestions: string[] = [];
  let safetyScore = 95;

  const components = netlist?.components ?? [];
  const nets = netlist?.nets ?? [];
  const connections = netlist?.connections ?? [];

  const byType = (type: string) => components.filter((c) => c.type === type);
  const byCategory = (cat: string) => components.filter((c) => c.category === cat);

  const hasESP32 = byType("ESP32").length > 0;
  const hasEsp8266 = byType("ESP8266").length > 0;
  const hasArduinoUno = byType("ArduinoUno").length > 0;
  const hasArduinoNano = byType("ArduinoNano").length > 0;
  const hasPico = byType("RaspberryPiPico").length > 0;
  const hasMPU6050 = byType("MPU6050").length > 0;
  const hasDHT11 = byType("DHT11").length > 0;
  const hasDHT22 = byType("DHT22").length > 0;
  const hasUltrasonic = byType("Ultrasonic").length > 0;
  const hasOpAmp = byCategory("active_ic").some((c) => c.type.startsWith("OpAmp"));
  const hasCapacitor = byType("Capacitor").length > 0;
  const hasResistor = byType("Resistor").length > 0;
  const hasLED = byType("LED").length > 0;
  const hasNPN = byType("NPN").length > 0 || byType("Transistor").length > 0;
  const hasMOSFET = byType("NMOSFET").length > 0 || byType("PMOSFET").length > 0;
  const hasZener = byType("ZenerDiode").length > 0;
  const hasTVS = byType("TVSDiode").length > 0;
  const hasBuck = byType("BuckConverter").length > 0;
  const hasBoost = byType("BoostConverter").length > 0;
  const hasLevelShifter = byType("LevelShifter").length > 0;
  const componentCount = components.length;

  const powerNets = nets.filter((n) => n.type === "power");
  const highVoltage = powerNets.some((n) => (n.voltage ?? 0) > 12);
  const has3v3Net = powerNets.some((n) => n.voltage !== undefined && Math.abs(n.voltage - 3.3) < 0.2);
  const has5vNet  = powerNets.some((n) => n.voltage !== undefined && Math.abs(n.voltage - 5.0) < 0.2);
  const mixedVoltage = has3v3Net && has5vNet;

  if (highVoltage) {
    risks.push({ severity: "high", description: "High voltage detected (>12V). Ensure proper insulation, creepage distances, and trace widths on PCB." });
    safetyScore -= 15;
    suggestions.push("Add TVS diodes on power inputs for transient voltage protection.");
    suggestions.push("Verify PCB trace widths can handle current at the specified voltage using IPC-2221.");
  }

  if (hasLED && !hasResistor) {
    risks.push({ severity: "critical", description: "LED present without any current-limiting resistor. LEDs will fail immediately without series resistance." });
    safetyScore -= 30;
    suggestions.push("Add a current-limiting resistor in series with each LED. R = (Vsupply - Vf) / Iforward (typically 1.8-3.3V forward voltage, 10-20mA current).");
  }

  if (mixedVoltage && !hasLevelShifter) {
    risks.push({ severity: "high", description: "Mixed 5V and 3.3V power domains detected without a level shifter. Direct connections between these domains will damage 3.3V components.", component: "LevelShifter" });
    safetyScore -= 20;
    suggestions.push("Add a bidirectional level shifter (e.g. TXB0108 or BSS138-based) between 5V and 3.3V logic domains.");
    suggestions.push("Use Component::LevelShifter in your circuit definition to declare the level shifting stage.");
  }

  if ((hasESP32 || hasEsp8266 || hasPico) && has5vNet && !hasLevelShifter) {
    risks.push({ severity: "high", description: `${hasESP32 ? "ESP32" : hasEsp8266 ? "ESP8266" : "RP2040"} is a 3.3V device. Direct connection to 5V signals (Arduino GPIO, etc.) will permanently damage it.`, component: hasESP32 ? "ESP32" : "ESP8266" });
    safetyScore -= 15;
    suggestions.push("The ESP32/ESP8266/RP2040 are NOT 5V tolerant. Use a level shifter for all signal connections to/from 5V devices.");
  }

  if (hasMPU6050 && has5vNet) {
    risks.push({ severity: "high", description: "MPU6050 is a 3.3V device. Connecting its I2C pins directly to 5V logic (Arduino) will damage the sensor.", component: "MPU6050" });
    safetyScore -= 10;
    suggestions.push("Use 4.7kΩ pull-up resistors on I2C lines connected to 3.3V, not 5V.");
    suggestions.push("Add a LevelShifter between Arduino 5V I2C and MPU6050 3.3V I2C.");
  }

  if (hasUltrasonic && (hasESP32 || hasEsp8266 || hasPico)) {
    risks.push({ severity: "medium", description: "HC-SR04 ultrasonic sensor has a 5V echo output. Connecting it directly to ESP32/RP2040 (3.3V max) will damage the MCU.", component: "Ultrasonic" });
    safetyScore -= 8;
    suggestions.push("Use a voltage divider (1kΩ/2kΩ) on the Echo pin when connecting HC-SR04 to a 3.3V MCU.");
  }

  if (hasMOSFET && !hasResistor) {
    risks.push({ severity: "medium", description: "MOSFET gate with no gate resistor detected. Without a gate resistor, the driver may see a short circuit momentarily during switching.", component: "NMOSFET" });
    safetyScore -= 8;
    suggestions.push("Add a 10-100Ω gate resistor to limit switching transients and reduce EMI.");
  }

  if ((hasNPN || hasMOSFET) && !hasResistor) {
    risks.push({ severity: "medium", description: "Transistor without base/gate resistor detected. This may cause excessive base current or gate drive stress." });
    safetyScore -= 5;
    suggestions.push("Add base resistor for BJT (R = (Vdrive - 0.7V) / Ibase_max).");
  }

  if (hasOpAmp && !hasCapacitor) {
    risks.push({ severity: "medium", description: "Op-amp without decoupling capacitors. Op-amps are sensitive to power supply noise and may oscillate without bypass capacitors." });
    safetyScore -= 8;
    suggestions.push("Add 100nF ceramic + 10µF electrolytic bypass capacitors directly at the op-amp VCC and VEE pins.");
  }

  if ((hasBuck || hasBoost) && !hasCapacitor) {
    risks.push({ severity: "high", description: "DC-DC converter without input/output filtering capacitors detected. This will cause severe output ripple and may damage connected components.", component: hasBuck ? "BuckConverter" : "BoostConverter" });
    safetyScore -= 15;
    suggestions.push("Add 100µF electrolytic input capacitor and 220µF electrolytic output capacitor for the DC-DC converter.");
    suggestions.push("Add 100nF ceramic bypass capacitors in parallel with the electrolytic capacitors.");
  }

  if (hasZener) {
    risks.push({ severity: "low", description: "Zener diode detected — verify the power dissipation (Pz = Vz × Iz) is within the rated wattage." });
    safetyScore -= 3;
    suggestions.push("Calculate Zener power dissipation: Pmax = Vz × (Vsupply - Vz) / R_series. Use Pz with at least 50% derating.");
  }

  if (!hasTVS && highVoltage) {
    risks.push({ severity: "medium", description: "No transient voltage suppression (TVS) diodes detected in a high-voltage circuit." });
    safetyScore -= 5;
    suggestions.push("Add TVS diodes (Component::TVSDiode) on power inputs and signal lines exposed to external connections.");
  }

  if (!hasCapacitor && componentCount > 2) {
    risks.push({ severity: "medium", description: "No bypass capacitors detected. Power supply noise may cause digital instability and measurement errors." });
    safetyScore -= 8;
    suggestions.push("Add 100nF ceramic bypass capacitors close to each IC VCC pin and 10-47µF bulk capacitor at the power entry point.");
  }

  if (componentCount > 10) {
    suggestions.push("Consider adding test points (TP) on key nets for debugging. This is especially important for I2C, SPI, and UART lines.");
  }

  if (suggestions.length === 0) {
    suggestions.push("Circuit structure looks good. Cross-reference all component datasheets for absolute maximum ratings.");
    suggestions.push("Perform a thermal analysis — ensure all components operate below 70% of their rated junction temperature.");
  }

  const analysisVerb = safetyScore >= 85 ? "appears safe" : safetyScore >= 60 ? "has concerns" : "has critical issues";
  let analysis = `Circuit analysis complete. Found ${componentCount} component${componentCount !== 1 ? "s" : ""}, ${nets.length} net${nets.length !== 1 ? "s" : ""}, and ${connections.length} connection${connections.length !== 1 ? "s" : ""}. `;

  if (componentCount === 0) {
    analysis = "No compiled netlist provided. Compile the circuit successfully before running LLM analysis.";
  } else {
    const criticalCount = risks.filter((r) => r.severity === "critical").length;
    const highCount     = risks.filter((r) => r.severity === "high").length;
    analysis += `The circuit ${analysisVerb}. `;
    if (criticalCount > 0) analysis += `${criticalCount} critical issue${criticalCount > 1 ? "s" : ""} must be resolved before building. `;
    if (highCount > 0)     analysis += `${highCount} high-severity risk${highCount > 1 ? "s" : ""} identified. `;
    if (risks.length === 0) analysis += "No significant safety risks detected.";
  }

  safetyScore = Math.max(0, Math.min(100, safetyScore));

  res.json({
    safetyScore,
    analysis: analysis.trim(),
    risks,
    suggestions,
    model: "Gemma 2B (Placeholder — replace with actual LLM API call in /api/llm/analyze)",
  });
});

export default router;
