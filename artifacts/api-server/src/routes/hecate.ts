import { Router } from "express";
import { HecateAnalyzeBody } from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

const HECATE_SYSTEM_PROMPT = `You are HECATE, an expert electronic circuit reverse-engineering AI embedded in CircuitRust — a Hardware-as-Code compiler.

Analyze the provided PCB/circuit image and reverse-engineer it into CircuitRust DSL code.

CircuitRust DSL syntax rules:
- Net declarations: \`let vcc = Net::power(5.0);\` or \`let gnd = Net::ground();\` or \`let sig = Net::signal();\`
- Component declarations: \`let r1 = Component::Resistor { resistance: "10k" };\`
- Connections: \`connect!(vcc => r1.pin1);\`
- Component types and their key properties:
  - Resistor { resistance: "10k" }
  - Capacitor { capacitance: "100nF" }
  - Inductor { inductance: "10uH" }
  - LED { color: "red" } | color options: red/green/blue/yellow/white/ir
  - Diode | ZenerDiode { voltage: "5.1" } | SchottkyDiode
  - NPN { model: "2N2222" } | PNP | NMOSFET | PMOSFET
  - OpAmp741 | OpAmpLM358 | OpAmpTL082
  - VoltageRegulator { voltage: "5.0" } | LDO { voltage: "3.3" }
  - BuckConverter { voltage: "3.3", current: "1.0" } | BoostConverter
  - ArduinoUno | ArduinoNano | ESP32 | ESP8266 | RaspberryPiPico | STM32
  - DHT11 | DHT22 | MPU6050 | Ultrasonic | IRSensor
  - Button | Switch | Crystal { frequency: "16MHz" }
  - Buzzer | Motor | Relay | Solenoid
- Pin names by component:
  - Resistor/Capacitor/Inductor: pin1, pin2
  - LED: anode, cathode
  - Diode/ZenerDiode/SchottkyDiode: anode, cathode
  - NPN/PNP: base, collector, emitter
  - MOSFET: gate, drain, source
  - OpAmp: plus, minus, out, vcc, gnd
  - VoltageRegulator/LDO: in, out, gnd
  - Button/Switch: pin1, pin2
  - Crystal: pin1, pin2
  - ArduinoUno/Nano: vcc, gnd, d2, d3, d4, d5, d6, d7, d8, d9, d10, d11, d12, d13, a0, a1, a2, a3, a4, a5
  - ESP32/ESP8266: vcc, gnd, gpio2, gpio4, gpio5, gpio12, gpio13, gpio14, gpio15, gpio16, gpio17, gpio18, gpio19, gpio21, gpio22, gpio23
  - DHT11/DHT22: vcc, gnd, data
  - MPU6050: vcc, gnd, sda, scl
  - Ultrasonic: vcc, gnd, trig, echo
  - IRSensor: vcc, gnd, out
  - Buzzer/Motor: pin1, pin2
  - Relay: coilPlus, coilMinus, no, nc, com
  - Solenoid: pin1, pin2

OUTPUT FORMAT — respond with ONLY a valid JSON object, no markdown:
{
  "dslCode": "// CircuitRust DSL code here\\nlet vcc = Net::power(5.0);\\n...",
  "analysis": "Brief human-readable description of what you identified",
  "confidence": 75,
  "componentCount": 5
}

Rules:
- If you cannot clearly identify a component, use a reasonable standard value
- Always include vcc and gnd nets
- Confidence 0-100: 90+ if all components clearly visible, 60-89 if partially obscured, 30-59 if heavily obscured
- The dslCode must be syntactically valid CircuitRust — use ONLY the component types and pin names listed above
- Do not hallucinate exotic component types — map unknowns to the closest standard type
- Estimate standard values if markings are unclear (e.g. pullup resistors are usually 10k)`;

router.post("/hecate/analyze", async (req, res) => {
  const parsed = HecateAnalyzeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { imageBase64, mimeType } = parsed.data;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            {
              text: "Analyze this electronic circuit board image and reverse-engineer it into CircuitRust DSL code. Return ONLY the JSON object as specified.",
            },
          ],
        },
      ],
      config: {
        maxOutputTokens: 8192,
        temperature: 0.2,
        systemInstruction: HECATE_SYSTEM_PROMPT,
      },
    });

    const rawText = response.text ?? "";

    // Extract JSON from the response (strip any markdown code fences if present)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.error({ rawText }, "HECATE: no JSON found in Gemini response");
      res.status(500).json({ error: "HECATE could not parse the circuit image. The model returned an unexpected format." });
      return;
    }

    let parsed2: { dslCode?: string; analysis?: string; confidence?: number; componentCount?: number };
    try {
      parsed2 = JSON.parse(jsonMatch[0]) as typeof parsed2;
    } catch (e) {
      req.log.error({ rawText }, "HECATE: JSON parse failed");
      res.status(500).json({ error: "HECATE returned malformed JSON. Try again with a clearer image." });
      return;
    }

    const dslCode      = parsed2.dslCode      ?? "// HECATE could not identify components\nlet vcc = Net::power(5.0);\nlet gnd = Net::ground();";
    const analysis     = parsed2.analysis     ?? "Analysis unavailable.";
    const confidence   = typeof parsed2.confidence === "number" ? Math.max(0, Math.min(100, parsed2.confidence)) : 50;
    const componentCount = typeof parsed2.componentCount === "number" ? parsed2.componentCount : 0;

    res.json({ dslCode, analysis, confidence, componentCount });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "HECATE analysis failed");
    res.status(500).json({ error: `HECATE vision analysis failed: ${msg}` });
  }
});

export default router;
