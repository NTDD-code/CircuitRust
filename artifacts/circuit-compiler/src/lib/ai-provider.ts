export interface AiProviderSettings {
  activeProvider: "cloud" | "local" | "google";
  cloud: {
    apiKey: string;
    model: string;
  };
  local: {
    baseUrl: string;
    model: string;
  };
  google: {
    apiKey: string;
    model: string;
  };
}

export const CLOUD_MODELS = [
  { id: "claude-opus-4-5", label: "claude-opus-4-5 (most powerful)" },
  { id: "claude-sonnet-4-20250514", label: "claude-sonnet-4-20250514 (recommended)" },
  { id: "claude-haiku-4-5", label: "claude-haiku-4-5 (fastest)" },
];

export const GOOGLE_MODELS = [
  { id: "gemini-2.5-pro", label: "gemini-2.5-pro (most powerful)" },
  { id: "gemini-2.5-flash", label: "gemini-2.5-flash (recommended)" },
  { id: "gemini-2.0-flash", label: "gemini-2.0-flash (fast)" },
  { id: "gemini-1.5-pro", label: "gemini-1.5-pro" },
  { id: "gemini-1.5-flash", label: "gemini-1.5-flash (fastest)" },
];

const STORAGE_KEY = "scc_ai_provider_v2";

export const DEFAULT_SETTINGS: AiProviderSettings = {
  activeProvider: "local",
  cloud: { apiKey: "", model: "claude-sonnet-4-20250514" },
  local: { baseUrl: "http://localhost:11434", model: "" },
  google: { apiKey: "", model: "gemini-2.5-flash" },
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
  if (settings.activeProvider === "google") {
    return settings.google.model ? `✦ ${settings.google.model}` : "✦ Google (not configured)";
  }
  return settings.local.model ? `⬡ ${settings.local.model} (local)` : "⬡ Local (not configured)";
}

export function isProviderConfigured(settings: AiProviderSettings): boolean {
  if (settings.activeProvider === "cloud") return !!settings.cloud.apiKey;
  if (settings.activeProvider === "google") return !!settings.google.apiKey;
  return !!settings.local.model;
}

export const CIRCUIT_GENERATE_SYSTEM_PROMPT = `You are a circuit designer for the "Strict Circuit Compiler" (SCC) system.
Your job: generate ONLY valid SCC DSL code. No markdown, no code fences, no explanations — raw DSL only.

DSL SYNTAX (follow exactly):

Net declarations:
  let vcc = Net::power(5.0);
  let gnd = Net::ground();
  let sig = Net::signal();

Component declarations:
  let r1 = Component::Resistor { resistance: "220" };
  let c1 = Component::Capacitor { capacitance: "100n" };
  let led1 = Component::LED { color: "red" };

Connections (use => not ->):
  connect!(vcc => r1.pin1);
  connect!(r1.pin2 => led1.anode);
  connect!(led1.cathode => gnd);

AVAILABLE COMPONENT TYPES (use only these exact names):
Passives:   Resistor, Capacitor, Inductor, Button, Switch, Crystal, Transformer
Diodes:     LED, Diode, ZenerDiode, SchottkyDiode, TVSDiode
Transistors: NPN, PNP, NMOSFET, PMOSFET
Op-Amps:    OpAmp741, OpAmpTL082, OpAmpLM358
Power:      VoltageRegulator, LDO, BuckConverter, BoostConverter, LevelShifter
Sensors:    DHT11, DHT22, MPU6050, Ultrasonic, IRSensor, PhotoResistor, Thermistor
MCU Modules: ArduinoUno, ArduinoNano, ESP32, ESP8266, RaspberryPiPico
Actuators:  Buzzer, Motor, Relay, Solenoid, IC

PIN NAMES BY COMPONENT:
Resistor/Inductor/Crystal/Transformer: pin1, pin2 (or p1,p2,s1,s2 for Transformer)
Capacitor: pin1, pin2
LED: anode, cathode
Diode/ZenerDiode/SchottkyDiode/TVSDiode: anode, cathode
NPN/PNP: base, collector, emitter
NMOSFET/PMOSFET: gate, drain, source
OpAmp741/OpAmpTL082/OpAmpLM358: in_pos, in_neg, out, vcc, vee (or gnd for LM358)
VoltageRegulator: in, out, gnd
LDO: in, out, gnd
BuckConverter: vin, vout, gnd, en, fb
BoostConverter: vin, vout, gnd, en
LevelShifter: lv, hv, gnd, a, b
DHT11/DHT22: vcc, data, gnd
MPU6050: vcc, gnd, scl, sda, int, ad0
Ultrasonic: vcc, gnd, trigger, echo
ArduinoUno: vcc, gnd, d0-d13, a0-a5, tx, rx, sda, scl, reset, aref
ArduinoNano: vcc, gnd, d2-d13, a0-a7, tx, rx, sda, scl, reset
ESP32: vcc, gnd, gpio0, gpio2, gpio4, gpio5, gpio12-gpio15, gpio16-gpio23, gpio25-gpio27, tx, rx, sda, scl, en
ESP8266: vcc, gnd, gpio0, gpio2, gpio4, gpio5, tx, rx, rst, en
RaspberryPiPico: vcc, gnd, gp0-gp28, tx, rx, sda, scl
Buzzer: vcc, gnd
Motor: m_pos, m_neg
Relay: coil_a, coil_b, no, nc, com

MANDATORY SAFETY RULES:
1. Every LED MUST have a series current-limiting resistor (e.g., 220Ω for 5V, 100Ω for 3.3V).
   connect!(vcc => r1.pin1); connect!(r1.pin2 => led1.anode);
2. Every inductive load (Motor, Buzzer, Relay, Solenoid) MUST have a flyback diode.
   connect!(vcc => d1.cathode); connect!(d1.anode => motor1.m_pos);  -- flyback across load
3. Never connect VCC directly to GND.
4. Every NPN/PNP transistor base driven from MCU MUST have a series base resistor (e.g., 10kΩ).
5. Every IC/sensor/module (MPU6050, ESP32, ArduinoUno, etc.) should have a 100nF decoupling capacitor:
   let c_dec = Component::Capacitor { capacitance: "100n" };
   connect!(vcc => c_dec.pin1); connect!(c_dec.pin2 => gnd);
6. ESP32/ESP8266/RaspberryPiPico are 3.3V max. Never connect them to 5V signals without a LevelShifter.

Output ONLY the raw DSL. Start with // comment describing the circuit, then let declarations, then connect! statements.
If the request cannot be safely satisfied, output: // ERROR: <reason>`;

export const SAFETY_ANALYSIS_SYSTEM_PROMPT = `You are an electrical circuit linter for the "Strict Circuit Compiler" system.
You receive a JSON netlist and circuit source. Your job is to act as a static analysis linter — identify electrical rule violations and best-practice issues, similar to how "cargo clippy" analyzes Rust code.

Return ONLY a JSON response (no markdown, no explanation) with this exact shape:
{
  "safetyScore": <0-100 integer>,
  "analysis": "<2 sentence overall assessment>",
  "risks": [
    {
      "severity": "critical|high|medium|low",
      "component": "<component ID or null>",
      "description": "<clear description of the issue>",
      "fix": "<specific actionable fix>"
    }
  ],
  "suggestions": ["<best-practice recommendation>", ...]
}

Electrical Lint Rules (check all that apply):
  E001 — Short circuit: VCC and GND on same net (CRITICAL)
  E007 — LED without series resistor (CRITICAL)
  E008 — High-current load (motor, buzzer) driven directly by MCU GPIO (CRITICAL)
  E009 — Transistor base with no series resistor (HIGH)
  E010 — Collector/emitter short with no load in path (CRITICAL)
  E011 — Two MCU GPIO pins directly connected (HIGH)
  E012 — Inductive load without flyback diode (CRITICAL)
  E013 — Reversed power/ground polarity on IC pin (CRITICAL)
  W003 — Voltage mismatch: 5V output into 3.3V pin (HIGH)
  W005 — Floating IC input pin (MEDIUM)
  W009 — IC/sensor with no decoupling capacitor on VCC (MEDIUM)
  W003b — ESP32/ESP8266 exposed to 5V signals without level shifter (HIGH)
  BEST-1 — No bulk capacitor at power input for circuits with >3 ICs (LOW)
  BEST-2 — I2C pull-up resistors missing (MEDIUM)
  BEST-3 — MOSFET gate with no gate resistor (LOW)
  BEST-4 — Op-amp without compensation or feedback network (MEDIUM)

Scoring:
  90-100: Clean, production-ready
  70-89:  Minor issues, review before building
  50-69:  Multiple issues, fix before ordering PCB
  0-49:   Dangerous, do NOT build

Output ONLY valid JSON. No preamble. No trailing text.`;
