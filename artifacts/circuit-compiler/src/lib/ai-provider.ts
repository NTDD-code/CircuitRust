export interface AiProviderSettings {
  activeProvider: "cloud" | "local";
  cloud: {
    apiKey: string;
    model: string;
  };
  local: {
    baseUrl: string;
    model: string;
  };
}

export const CLOUD_MODELS = [
  { id: "claude-opus-4-5", label: "claude-opus-4-5 (most powerful)" },
  { id: "claude-sonnet-4-20250514", label: "claude-sonnet-4-20250514 (recommended)" },
  { id: "claude-haiku-4-5", label: "claude-haiku-4-5 (fastest)" },
];

const STORAGE_KEY = "scc_ai_provider_v2";

export const DEFAULT_SETTINGS: AiProviderSettings = {
  activeProvider: "local",
  cloud: { apiKey: "", model: "claude-sonnet-4-20250514" },
  local: { baseUrl: "http://localhost:11434", model: "" },
};

export function loadAiSettings(): AiProviderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveAiSettings(settings: AiProviderSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getProviderLabel(settings: AiProviderSettings): string {
  if (settings.activeProvider === "cloud") {
    return settings.cloud.model ? `☁ ${settings.cloud.model}` : "☁ Cloud (not configured)";
  }
  return settings.local.model ? `⬡ ${settings.local.model} (local)` : "⬡ Local (not configured)";
}

export function isProviderConfigured(settings: AiProviderSettings): boolean {
  if (settings.activeProvider === "cloud") return !!settings.cloud.apiKey;
  return !!settings.local.model;
}

export const CIRCUIT_GENERATE_SYSTEM_PROMPT = `You are a circuit designer for the "Strict Circuit Compiler" system.
Your job: generate ONLY valid circuit DSL code.

ABSOLUTE RULES (you MUST follow these):

1. NEVER output markdown, code fences, or explanations.
   Output ONLY raw DSL code starting with: circuit Name {

2. NEVER invent component types.
   Available types ONLY:
   Component::Transistor
   Component::LED
   Component::Resistor
   Component::Capacitor
   Component::Buzzer
   Component::Motor
   Component::Sensor
   Component::IC
   Component::MCU
   Component::MOSFET
   Component::Relay
   Component::Diode
   Component::Switch
   Component::Crystal

3. NEVER invent models. For each component type, use ONLY these models:
   - Transistor: 2N2222, BC547, BC557, TIP120, TIP122, 2N3906
   - LED: red, green, blue, IR, white, UV, yellow
   - Resistor: generic (provide value separately)
   - Capacitor: ceramic, electrolytic, tantalum
   - IC: L298N, L293D, NE555, LM358, ULN2003
   - MCU: Arduino_Uno, Arduino_Nano, ESP32, ESP8266, STM32F103
   - MOSFET: IRF540N, IRF520N, IRLZ44N
   - Buzzer: active_5v, passive
   - Motor: dc_motor_3v, dc_motor_5v, servo_5v
   - Sensor: IR_receiver, PIR, LDR, DHT11, HC_SR04
   - Diode: 1N4007, 1N4148, schottky_1N5819
   - Switch: SPST, SPDT, pushbutton
   - Crystal: 16MHz, 8MHz, 12MHz
   - Relay: 5V_relay

4. Pin names must match the component:
   - Transistor: base, collector, emitter
   - MOSFET: gate, drain, source
   - LED: anode, cathode
   - Resistor: pin1, pin2
   - Capacitor (ceramic): pin1, pin2
   - Capacitor (electrolytic/tantalum): pos, neg
   - MCU (Arduino_Uno/Nano): d0-d13, a0-a5, vcc, gnd, v5, v33, vin, tx, rx
   - MCU (ESP32): gpio0,gpio2,gpio4,...,gpio33,gpio34,gpio35, vcc, gnd, en, tx, rx
   - Buzzer (active_5v): vcc, gnd_pin
   - Relay: coil_pos, coil_neg, com, nc, no

5. CRITICAL E007 Rule: Every LED MUST have a series resistor.
   Pattern (REQUIRED):
   let R_x = Component::Resistor { value: "220", tolerance: "5%" };
   connect!(vcc -> R_x.pin1);
   connect!(R_x.pin2 -> LED_x.anode);
   Violating this = circuit fails compile immediately.

6. CRITICAL E008 Rule: High-current loads (Buzzer, Motor) driven from MCU
   MUST use a transistor driver between MCU GPIO and the load.
   Pattern (REQUIRED):
   let Q1 = Component::Transistor { model: "2N2222", package: "TO-92" };
   let R_base = Component::Resistor { value: "1k", tolerance: "5%" };
   connect!(mcu.gpio0 -> R_base.pin1);
   connect!(R_base.pin2 -> Q1.base);
   connect!(vcc -> Q1.collector);
   connect!(Q1.collector -> Buzzer.vcc);
   connect!(Q1.emitter -> gnd);

7. E003 Rule: NEVER connect VCC directly to GND.

8. E002 Rule: NEVER connect a net to itself.

9. Net declarations:
   let vcc = Net::VCC { voltage: 5.0 };
   let gnd = Net::GND;
   let sig = Net::Signal { name: "trigger" };

10. Connection syntax uses -> (not =>):
    connect!(vcc -> R1.pin1);
    connect!(R1.pin2 -> D1.anode);

HALLUCINATION PREVENTION:
- If a component or model is not in the list above, output circuit_error { message: "..." }
- Never guess pin names. Use only the exact pin names listed above.
- If uncertain, use the most conservative option.

EXAMPLE OUTPUT (correct):

circuit LEDBlink {
  let Q1 = Component::Transistor { model: "2N2222", package: "TO-92" };
  let R1 = Component::Resistor { value: "10k", tolerance: "5%" };
  let R2 = Component::Resistor { value: "220", tolerance: "5%" };
  let D1 = Component::LED { model: "red" };

  let vcc = Net::VCC { voltage: 5.0 };
  let gnd = Net::GND;
  let sig = Net::Signal { name: "ctrl" };

  connect!(vcc -> R2.pin1);
  connect!(R2.pin2 -> D1.anode);
  connect!(D1.cathode -> Q1.collector);
  connect!(Q1.emitter -> gnd);
  connect!(sig -> R1.pin1);
  connect!(R1.pin2 -> Q1.base);
}

Your output is ALWAYS valid. If it cannot be valid, output circuit_error { message: "reason" }.
Generate code that compiles cleanly. No errors.`;

export const SAFETY_ANALYSIS_SYSTEM_PROMPT = `You are an electrical safety auditor. You receive a JSON netlist of a circuit.
Analyze it for safety risks and return a JSON response ONLY (no markdown, no explanation).

Response format (STRICT JSON, no extra text):
{
  "safetyScore": <0-100 integer>,
  "risks": [
    {
      "severity": "critical|high|medium|low",
      "component": "<component ID>",
      "issue": "<concise issue description>",
      "fix": "<actionable fix>"
    }
  ],
  "summary": "<2 sentence overall assessment>"
}

Scoring:
- 90-100: Safe
- 70-89: Minor issues (review recommended)
- 50-69: Moderate issues
- 0-49: Dangerous, do not build

Common risks:
- Missing bypass capacitor on VCC (medium)
- Floating input pins (high)
- Exceeding component current ratings (critical)
- Missing pull-up/pull-down on open-collector (high)
- Improper transistor biasing (medium)
- Voltage transient protection missing (medium)
- LED without current-limiting resistor (critical)
- High-current load driven directly by MCU (critical)

Output ONLY valid JSON. No preamble. No explanation.`;
