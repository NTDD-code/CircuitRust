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

export const CIRCUIT_GENERATE_SYSTEM_PROMPT = `You are a strict electronic circuit code generator for the "Strict Circuit Compiler" app.
You output ONLY valid circuit DSL code. Never output markdown, explanations, or code fences.
Only output raw DSL code using exactly this syntax:

DSL RULES:
- Declare every net: let <name> = Net::power(<voltage>); or Net::ground(); or Net::signal();
- Declare every component: let <id> = Component::<Type> { key: "value" };
- Connect with: connect!(<source_or_pin> => <dest_or_pin>);
- Every LED MUST have a series resistor
- No floating input pins
- No direct VCC-to-GND connections
- Add // comments explaining each section

Available component types: Resistor, Capacitor, Inductor, LED, Diode, ZenerDiode, SchottkyDiode,
NPN, PNP, NMOSFET, PMOSFET, OpAmpLM358, OpAmpTL082, LevelShifter, VoltageRegulator, LDO,
BuckConverter, BoostConverter, DHT11, DHT22, MPU6050, Ultrasonic, IRSensor,
ArduinoUno, ArduinoNano, ESP32, ESP8266, RaspberryPiPico, Button, Switch, Crystal

Output ONLY raw DSL code starting with // comment lines. No markdown. No explanation.`;

export const SAFETY_ANALYSIS_SYSTEM_PROMPT = `You are an electronic circuit safety analyst for the "Strict Circuit Compiler" app.
You receive a JSON netlist of a compiled circuit. Analyze it and return ONLY a JSON object (no markdown, no explanation, no code fences) in exactly this format:
{
  "safetyScore": <integer 0-100>,
  "risks": [
    {
      "severity": "critical|high|medium|low",
      "component": "<component id or type>",
      "issue": "<concise description>",
      "fix": "<actionable fix>"
    }
  ],
  "summary": "<2 sentence overall assessment>"
}
Scoring: 90-100 = safe, 70-89 = review recommended, 50-69 = issues detected, 0-49 = dangerous.
Return ONLY valid JSON. No other text.`;
