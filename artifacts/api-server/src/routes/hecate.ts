import { Router } from "express";
import { HecateAnalyzeBody } from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

// ── DSL reference (kept as a single const so the prompt is self-contained) ──
const DSL_REFERENCE = `
CircuitRust DSL rules:
- Nets: let vcc = Net::power(5.0);  |  let gnd = Net::ground();  |  let sig = Net::signal();
- Components: let r1 = Component::Resistor { resistance: "10k" };
- Connections: connect!(vcc => r1.pin1);

Available component types and key properties:
  Resistor { resistance }  |  Capacitor { capacitance }  |  Inductor { inductance }
  LED { color: red/green/blue/yellow/white/ir }
  Diode  |  ZenerDiode { voltage }  |  SchottkyDiode  |  TVSDiode
  NPN { model }  |  PNP  |  NMOSFET  |  PMOSFET
  OpAmp741  |  OpAmpLM358  |  OpAmpTL082
  VoltageRegulator { voltage }  |  LDO { voltage }
  BuckConverter { voltage, current }  |  BoostConverter
  ArduinoUno  |  ArduinoNano  |  ESP32  |  ESP8266  |  RaspberryPiPico  |  STM32
  DHT11  |  DHT22  |  MPU6050  |  Ultrasonic  |  IRSensor
  Button  |  Switch  |  Crystal { frequency }  |  Buzzer  |  Motor  |  Relay  |  Solenoid

Pin names:
  Resistor/Capacitor/Inductor/Button/Switch/Buzzer/Motor/Solenoid: pin1, pin2
  LED/Diode/ZenerDiode/SchottkyDiode: anode, cathode
  NPN/PNP: base, collector, emitter
  NMOSFET/PMOSFET: gate, drain, source
  OpAmp*: plus, minus, out, vcc, gnd
  VoltageRegulator/LDO: in, out, gnd
  Crystal: pin1, pin2
  ArduinoUno/Nano: vcc, gnd, d2…d13, a0…a5
  ESP32/ESP8266: vcc, gnd, gpio2/4/5/12/13/14/15/16/17/18/19/21/22/23
  DHT11/DHT22: vcc, gnd, data
  MPU6050: vcc, gnd, sda, scl
  Ultrasonic: vcc, gnd, trig, echo
  IRSensor: vcc, gnd, out
  Relay: coilPlus, coilMinus, no, nc, com`.trim();

// ── Master system prompt ──────────────────────────────────────────────────────
const HECATE_UGLY_BUILD_PROMPT = `You are HECATE, an expert circuit reverse-engineering AI embedded in CircuitRust.
Your specialty is reconstructing functional netlists from messy, real-world "ugly builds" —
hand-soldered prototypes, breadboards covered in flux, point-to-point wiring, and cramped dead-bug constructions.

You operate in four sequential phases:

══ PHASE 1 — VISUAL INVENTORY (ignore the mess, find the function) ══
Scan the entire image. For each component:
  • Identify its type by package shape, markings, color bands, or silkscreen.
  • Record any readable values or part numbers (e.g. "2N2222", "10k", "100uF").
  • If a value is unreadable, label it as generic (e.g. "generic_resistor") and pick a
    standard functional value based on context.
  • Do NOT be deterred by solder blobs, bent leads, messy wires, or flux residue.
  • Also assess build quality: clean_pcb | breadboard | ugly_build | dangerous_build.
  • Flag safety concerns: exposed HV wires, components too close together, burned marks,
    missing fuses, inadequate insulation.

══ PHASE 2 — DESCRIPTION PARSING (Primary Truth) ══
If a "HECATE Guidance" description is provided by the user:
  • Treat it as PRIMARY TRUTH for the functional intent of the circuit.
  • Extract: circuit topology (H-bridge, oscillator, regulator, sensor, etc.),
    operating voltages, load type, MCU if any.
  • If the description conflicts with the image, description wins for function;
    image wins for component count.
  • If no description is given, infer intent from the visual inventory alone.

══ PHASE 3 — FUNCTIONAL RECONSTRUCTION (The Merge) ══
Using Phase 1 inventory + Phase 2 intent, reconstruct a functional, safe, type-correct netlist:
  • Use standard canonical topologies (e.g. NPN H-bridge, common-emitter amplifier, etc.).
  • Assign proper net names (vcc, gnd, motor_a, motor_b, pwm, etc.).
  • Use correct standard values (base resistors 1k–10k, pull-ups 10k, bypass caps 100nF, etc.).
  • ONLY use component types and pin names from the DSL reference below.
  • Every component must be connected to at least one net.

══ PHASE 4 — HEURISTIC SAFETY AUDIT ══
After reconstruction:
  • If uglyBuildDetected is true OR any dangerous physical practice was observed,
    compose a safetyNote. Example:
    "HECATE detected messy wiring in the physical build. The reconstructed netlist is
    functionally safe, but the physical implementation in the photo risks short-circuits
    due to [specific issues observed]. Proper PCB layout is strongly recommended."
  • Determine reconstructionMode:
    - "vision-only"        → no description provided, image was clear enough
    - "description-guided" → no clear image, description was primary source
    - "merged"             → both image and description used together

${DSL_REFERENCE}

OUTPUT FORMAT — respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "dslCode": "// CircuitRust DSL\\nlet vcc = Net::power(5.0);\\n...",
  "analysis": "Human-readable description of what was identified and how it was reconstructed",
  "confidence": 72,
  "componentCount": 6,
  "reconstructionMode": "merged",
  "uglyBuildDetected": true,
  "safetyNote": "optional safety note about physical build quality — omit key if not needed"
}

Confidence scale: 85–100 = clear image all values readable · 60–84 = some guesswork ·
30–59 = heavily obscured, description dominated · 10–29 = mostly assumed from description`.trim();

router.post("/hecate/analyze", async (req, res) => {
  const parsed = HecateAnalyzeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { imageBase64, mimeType, description } = parsed.data;

  // Build the user-turn text prompt, injecting guidance if provided
  const userText = description?.trim()
    ? `Analyze this circuit image using your 4-phase protocol.\n\nHECATE Guidance (Primary Truth): "${description.trim()}"\n\nReturn ONLY the JSON object as specified.`
    : "Analyze this circuit image using your 4-phase protocol. No description provided — infer intent from visual inventory only. Return ONLY the JSON object as specified.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: userText },
          ],
        },
      ],
      config: {
        maxOutputTokens: 32768,
        temperature: 0.15,
        systemInstruction: HECATE_UGLY_BUILD_PROMPT,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const rawText = response.text ?? "";

    if (!rawText.trim()) {
      req.log.error({ candidates: response.candidates }, "HECATE: empty response from Gemini");
      res.status(500).json({ error: "HECATE received an empty response from the vision model. Try a clearer image." });
      return;
    }

    // Strip markdown fences if the model ignored responseMimeType
    const stripped = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    // Extract outermost JSON object robustly
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.error({ rawText: rawText.slice(0, 500) }, "HECATE: no JSON found in Gemini response");
      res.status(500).json({ error: "HECATE could not parse the circuit image. The model returned an unexpected format." });
      return;
    }

    let out: {
      dslCode?: string;
      analysis?: string;
      confidence?: number;
      componentCount?: number;
      reconstructionMode?: string;
      uglyBuildDetected?: boolean;
      safetyNote?: string;
    };
    try {
      out = JSON.parse(jsonMatch[0]) as typeof out;
    } catch {
      req.log.error({ rawText: rawText.slice(0, 500) }, "HECATE: JSON parse failed");
      res.status(500).json({ error: "HECATE returned malformed analysis. Try a clearer image or add a description." });
      return;
    }

    const validModes = ["vision-only", "description-guided", "merged"] as const;
    const reconstructionMode = validModes.includes(out.reconstructionMode as typeof validModes[number])
      ? (out.reconstructionMode as typeof validModes[number])
      : description?.trim() ? "description-guided" : "vision-only";

    res.json({
      dslCode:           out.dslCode      ?? "// HECATE: insufficient signal\nlet vcc = Net::power(5.0);\nlet gnd = Net::ground();",
      analysis:          out.analysis     ?? "Visual analysis was inconclusive.",
      confidence:        typeof out.confidence    === "number" ? Math.max(0, Math.min(100, out.confidence))    : 40,
      componentCount:    typeof out.componentCount === "number" ? out.componentCount : 0,
      reconstructionMode,
      uglyBuildDetected: out.uglyBuildDetected === true,
      safetyNote:        typeof out.safetyNote === "string" && out.safetyNote.trim() ? out.safetyNote.trim() : undefined,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "HECATE analysis failed");
    res.status(500).json({ error: `HECATE vision analysis failed: ${msg}` });
  }
});

export default router;
