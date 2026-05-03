export interface PinSpec {
  type: "input" | "output" | "passive" | "power_in" | "power_out" | "io" | "common";
  voltage?: number;
  maxCurrent?: number;
  polarity?: "positive" | "negative";
  driving?: "strong" | "weak";
  loading?: "light" | "medium" | "heavy";
}

export interface ModelSpec {
  package?: string[];
  pins: Record<string, PinSpec>;
  maxRatings?: {
    vce_max?: number;
    ic_max?: number;
    p_max?: number;
    vcb_max?: number;
    vds_max?: number;
    id_max?: number;
    vgs_max?: number;
    vf?: number;
    if_max?: number;
  };
  safeRatings?: {
    vce_work?: number;
    ic_work?: number;
    p_work?: number;
  };
  mustHave?: string[];
  cannotConnect?: string[];
  isHighCurrent?: boolean;
  isMCU?: boolean;
  isLED?: boolean;
  isTransistor?: boolean;
  description?: string;
}

export interface ComponentTypeSpec {
  models: Record<string, ModelSpec>;
}

export const COMPONENT_REGISTRY: Record<string, ComponentTypeSpec> = {
  "Component::Transistor": {
    models: {
      "2N2222": {
        package: ["TO-92", "SMD-SOT23"],
        pins: {
          base:      { type: "input",  driving: "weak" },
          collector: { type: "output", loading: "medium" },
          emitter:   { type: "common" },
        },
        maxRatings: { vce_max: 40, ic_max: 0.6, p_max: 0.5 },
        safeRatings: { vce_work: 20, ic_work: 0.1, p_work: 0.2 },
        mustHave: ["baseResistor"],
        isTransistor: true,
        description: "NPN general-purpose transistor",
      },
      "BC547": {
        package: ["TO-92"],
        pins: {
          base:      { type: "input",  driving: "weak" },
          collector: { type: "output", loading: "medium" },
          emitter:   { type: "common" },
        },
        maxRatings: { vce_max: 45, ic_max: 0.1, p_max: 0.5 },
        safeRatings: { vce_work: 20, ic_work: 0.05 },
        mustHave: ["baseResistor"],
        isTransistor: true,
        description: "NPN small-signal transistor",
      },
      "BC557": {
        package: ["TO-92"],
        pins: {
          base:      { type: "input",  driving: "weak" },
          collector: { type: "output", loading: "medium" },
          emitter:   { type: "common" },
        },
        maxRatings: { vce_max: 45, ic_max: 0.1, p_max: 0.5 },
        isTransistor: true,
        description: "PNP small-signal transistor",
      },
      "TIP120": {
        package: ["TO-220"],
        pins: {
          base:      { type: "input",  driving: "weak" },
          collector: { type: "output", loading: "heavy" },
          emitter:   { type: "common" },
        },
        maxRatings: { vce_max: 60, ic_max: 5, p_max: 65 },
        mustHave: ["baseResistor"],
        isTransistor: true,
        description: "NPN Darlington power transistor",
      },
      "TIP122": {
        package: ["TO-220"],
        pins: {
          base:      { type: "input",  driving: "weak" },
          collector: { type: "output", loading: "heavy" },
          emitter:   { type: "common" },
        },
        maxRatings: { vce_max: 100, ic_max: 5, p_max: 65 },
        mustHave: ["baseResistor"],
        isTransistor: true,
        description: "NPN Darlington power transistor",
      },
      "2N3906": {
        package: ["TO-92"],
        pins: {
          base:      { type: "input",  driving: "weak" },
          collector: { type: "output", loading: "medium" },
          emitter:   { type: "common" },
        },
        maxRatings: { vce_max: 40, ic_max: 0.2, p_max: 0.6 },
        isTransistor: true,
        description: "PNP general-purpose transistor",
      },
    },
  },

  "Component::MOSFET": {
    models: {
      "IRF540N": {
        package: ["TO-220"],
        pins: {
          gate:   { type: "input" },
          drain:  { type: "output", loading: "heavy" },
          source: { type: "common" },
        },
        maxRatings: { vds_max: 100, id_max: 33, p_max: 150, vgs_max: 20 },
        isTransistor: true,
        description: "N-channel power MOSFET",
      },
      "IRF520N": {
        package: ["TO-220"],
        pins: {
          gate:   { type: "input" },
          drain:  { type: "output", loading: "heavy" },
          source: { type: "common" },
        },
        maxRatings: { vds_max: 100, id_max: 10, p_max: 50, vgs_max: 20 },
        isTransistor: true,
        description: "N-channel power MOSFET",
      },
      "IRLZ44N": {
        package: ["TO-220"],
        pins: {
          gate:   { type: "input" },
          drain:  { type: "output", loading: "heavy" },
          source: { type: "common" },
        },
        maxRatings: { vds_max: 55, id_max: 47, p_max: 110, vgs_max: 16 },
        isTransistor: true,
        description: "Logic-level N-channel MOSFET — gate driven directly by 3.3V/5V MCU",
      },
    },
  },

  "Component::LED": {
    models: {
      "red":   { pins: { anode: { type: "input", voltage: 2.0 }, cathode: { type: "output" } }, maxRatings: { vf: 2.2, if_max: 0.02 }, isLED: true, description: "Red LED, Vf≈2V" },
      "green": { pins: { anode: { type: "input", voltage: 3.2 }, cathode: { type: "output" } }, maxRatings: { vf: 3.5, if_max: 0.02 }, isLED: true, description: "Green LED, Vf≈3.2V" },
      "blue":  { pins: { anode: { type: "input", voltage: 3.2 }, cathode: { type: "output" } }, maxRatings: { vf: 3.5, if_max: 0.02 }, isLED: true, description: "Blue LED, Vf≈3.2V" },
      "white": { pins: { anode: { type: "input", voltage: 3.2 }, cathode: { type: "output" } }, maxRatings: { vf: 3.5, if_max: 0.02 }, isLED: true, description: "White LED, Vf≈3.2V" },
      "yellow":{ pins: { anode: { type: "input", voltage: 2.1 }, cathode: { type: "output" } }, maxRatings: { vf: 2.2, if_max: 0.02 }, isLED: true, description: "Yellow LED, Vf≈2.1V" },
      "IR":    { pins: { anode: { type: "input", voltage: 1.2 }, cathode: { type: "output" } }, maxRatings: { vf: 1.6, if_max: 0.1  }, isLED: true, description: "IR LED 940nm, Vf≈1.2V" },
      "UV":    { pins: { anode: { type: "input", voltage: 3.4 }, cathode: { type: "output" } }, maxRatings: { vf: 3.8, if_max: 0.02 }, isLED: true, description: "UV LED 395nm, Vf≈3.4V" },
    },
  },

  "Component::Resistor": {
    models: {
      "generic": {
        pins: {
          pin1: { type: "passive" },
          pin2: { type: "passive" },
        },
        description: "Generic resistor",
      },
    },
  },

  "Component::Capacitor": {
    models: {
      "ceramic":      { pins: { pin1: { type: "passive" }, pin2: { type: "passive" } }, description: "Ceramic capacitor (non-polarized)" },
      "electrolytic": { pins: { pos: { type: "passive", polarity: "positive" }, neg: { type: "passive", polarity: "negative" } }, description: "Electrolytic capacitor (polarized)" },
      "tantalum":     { pins: { pos: { type: "passive", polarity: "positive" }, neg: { type: "passive", polarity: "negative" } }, description: "Tantalum capacitor (polarized, critical polarity)" },
    },
  },

  "Component::MCU": {
    models: {
      "Arduino_Uno": {
        pins: {
          d0: { type: "io", voltage: 5, maxCurrent: 0.04 }, d1: { type: "io", voltage: 5, maxCurrent: 0.04 },
          d2: { type: "io", voltage: 5, maxCurrent: 0.04 }, d3: { type: "io", voltage: 5, maxCurrent: 0.04 },
          d4: { type: "io", voltage: 5, maxCurrent: 0.04 }, d5: { type: "io", voltage: 5, maxCurrent: 0.04 },
          d6: { type: "io", voltage: 5, maxCurrent: 0.04 }, d7: { type: "io", voltage: 5, maxCurrent: 0.04 },
          d8: { type: "io", voltage: 5, maxCurrent: 0.04 }, d9: { type: "io", voltage: 5, maxCurrent: 0.04 },
          d10: { type: "io", voltage: 5, maxCurrent: 0.04 }, d11: { type: "io", voltage: 5, maxCurrent: 0.04 },
          d12: { type: "io", voltage: 5, maxCurrent: 0.04 }, d13: { type: "io", voltage: 5, maxCurrent: 0.04 },
          a0: { type: "io", voltage: 5, maxCurrent: 0.02 }, a1: { type: "io", voltage: 5, maxCurrent: 0.02 },
          a2: { type: "io", voltage: 5, maxCurrent: 0.02 }, a3: { type: "io", voltage: 5, maxCurrent: 0.02 },
          a4: { type: "io", voltage: 5, maxCurrent: 0.02 }, a5: { type: "io", voltage: 5, maxCurrent: 0.02 },
          vcc: { type: "power_in", voltage: 5 }, gnd: { type: "power_in", voltage: 0 },
          v5: { type: "power_out", voltage: 5 }, v33: { type: "power_out", voltage: 3.3 },
          vin: { type: "power_in" }, tx: { type: "output" }, rx: { type: "input" },
        },
        isMCU: true,
        description: "Arduino Uno (ATmega328P), 5V, 14 digital + 6 analog I/O",
      },
      "Arduino_Nano": {
        pins: {
          d2: { type: "io", voltage: 5, maxCurrent: 0.04 }, d3: { type: "io", voltage: 5, maxCurrent: 0.04 },
          d4: { type: "io", voltage: 5, maxCurrent: 0.04 }, d5: { type: "io", voltage: 5, maxCurrent: 0.04 },
          d6: { type: "io", voltage: 5, maxCurrent: 0.04 }, d7: { type: "io", voltage: 5, maxCurrent: 0.04 },
          d8: { type: "io", voltage: 5, maxCurrent: 0.04 }, d9: { type: "io", voltage: 5, maxCurrent: 0.04 },
          d10: { type: "io", voltage: 5, maxCurrent: 0.04 }, d11: { type: "io", voltage: 5, maxCurrent: 0.04 },
          d12: { type: "io", voltage: 5, maxCurrent: 0.04 }, d13: { type: "io", voltage: 5, maxCurrent: 0.04 },
          a0: { type: "io", voltage: 5 }, a1: { type: "io", voltage: 5 },
          a2: { type: "io", voltage: 5 }, a3: { type: "io", voltage: 5 },
          vcc: { type: "power_in", voltage: 5 }, gnd: { type: "power_in", voltage: 0 },
          v5: { type: "power_out", voltage: 5 }, vin: { type: "power_in" },
          tx: { type: "output" }, rx: { type: "input" },
        },
        isMCU: true,
        description: "Arduino Nano (ATmega328P), 5V",
      },
      "ESP32": {
        pins: {
          gpio0:  { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio2:  { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio4:  { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio5:  { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio12: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio13: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio14: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio15: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio16: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio17: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio18: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio19: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio21: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio22: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio23: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio25: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio26: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio27: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio32: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio33: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio34: { type: "input", voltage: 3.3 },
          gpio35: { type: "input", voltage: 3.3 },
          vcc: { type: "power_in", voltage: 3.3 },
          gnd: { type: "power_in", voltage: 0 },
          en:  { type: "input" }, tx: { type: "output" }, rx: { type: "input" },
        },
        isMCU: true,
        description: "ESP32 (Xtensa LX6), 3.3V, WiFi + BT, max 12mA per GPIO",
      },
      "ESP8266": {
        pins: {
          gpio0:  { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio2:  { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio4:  { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio5:  { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio12: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio13: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio14: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio15: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          gpio16: { type: "io", voltage: 3.3, maxCurrent: 0.012 },
          vcc: { type: "power_in", voltage: 3.3 },
          gnd: { type: "power_in", voltage: 0 },
          en:  { type: "input" }, tx: { type: "output" }, rx: { type: "input" },
        },
        isMCU: true,
        description: "ESP8266 NodeMCU, 3.3V, WiFi",
      },
      "STM32F103": {
        pins: {
          pa0:  { type: "io", voltage: 3.3, maxCurrent: 0.025 },
          pa1:  { type: "io", voltage: 3.3, maxCurrent: 0.025 },
          pa2:  { type: "io", voltage: 3.3, maxCurrent: 0.025 },
          pa3:  { type: "io", voltage: 3.3, maxCurrent: 0.025 },
          pa4:  { type: "io", voltage: 3.3, maxCurrent: 0.025 },
          pa5:  { type: "io", voltage: 3.3, maxCurrent: 0.025 },
          pa6:  { type: "io", voltage: 3.3, maxCurrent: 0.025 },
          pa7:  { type: "io", voltage: 3.3, maxCurrent: 0.025 },
          pb0:  { type: "io", voltage: 3.3, maxCurrent: 0.025 },
          pb1:  { type: "io", voltage: 3.3, maxCurrent: 0.025 },
          pb8:  { type: "io", voltage: 3.3, maxCurrent: 0.025 },
          pb9:  { type: "io", voltage: 3.3, maxCurrent: 0.025 },
          pc13: { type: "io", voltage: 3.3, maxCurrent: 0.003 },
          vcc: { type: "power_in", voltage: 3.3 },
          gnd: { type: "power_in", voltage: 0 },
          tx:  { type: "output" }, rx: { type: "input" },
        },
        isMCU: true,
        description: "STM32F103 Blue Pill, 3.3V, 72MHz ARM Cortex-M3",
      },
    },
  },

  "Component::Buzzer": {
    models: {
      "active_5v": {
        pins: {
          vcc:     { type: "power_in" },
          gnd_pin: { type: "power_in" },
        },
        maxRatings: { vce_max: 5, ic_max: 0.03 },
        isHighCurrent: true,
        description: "Active buzzer 5V — beeps when power applied",
      },
      "passive": {
        pins: {
          pin1: { type: "passive" },
          pin2: { type: "passive" },
        },
        description: "Passive buzzer — needs PWM signal",
      },
    },
  },

  "Component::Motor": {
    models: {
      "dc_motor_3v": {
        pins: {
          m_pos: { type: "power_in" },
          m_neg: { type: "power_in" },
        },
        maxRatings: { vce_max: 3, ic_max: 0.3, p_max: 0.9 },
        isHighCurrent: true,
        description: "DC motor 3V",
      },
      "dc_motor_5v": {
        pins: {
          m_pos: { type: "power_in" },
          m_neg: { type: "power_in" },
        },
        maxRatings: { vce_max: 6, ic_max: 0.5, p_max: 3 },
        isHighCurrent: true,
        description: "DC motor 5V",
      },
      "servo_5v": {
        pins: {
          signal: { type: "input" },
          vcc:    { type: "power_in" },
          gnd:    { type: "power_in" },
        },
        maxRatings: { vce_max: 6, ic_max: 0.7 },
        isHighCurrent: true,
        description: "Hobby servo motor 5V, PWM control",
      },
    },
  },

  "Component::IC": {
    models: {
      "L298N":   { pins: { in1: { type: "input" }, in2: { type: "input" }, in3: { type: "input" }, in4: { type: "input" }, out1: { type: "output" }, out2: { type: "output" }, out3: { type: "output" }, out4: { type: "output" }, ena: { type: "input" }, enb: { type: "input" }, vcc: { type: "power_in" }, vs: { type: "power_in" }, gnd: { type: "power_in" } }, description: "Dual H-bridge motor driver, up to 2A per channel" },
      "L293D":   { pins: { in1: { type: "input" }, in2: { type: "input" }, in3: { type: "input" }, in4: { type: "input" }, out1: { type: "output" }, out2: { type: "output" }, out3: { type: "output" }, out4: { type: "output" }, en1: { type: "input" }, en2: { type: "input" }, vcc1: { type: "power_in" }, vcc2: { type: "power_in" }, gnd: { type: "power_in" } }, description: "Dual H-bridge motor driver, up to 600mA per channel" },
      "NE555":   { pins: { vcc: { type: "power_in" }, gnd: { type: "power_in" }, out: { type: "output" }, trig: { type: "input" }, thres: { type: "input" }, rst: { type: "input" }, cv: { type: "passive" }, dis: { type: "output" } }, description: "555 timer IC — monostable, astable, bistable modes" },
      "LM358":   { pins: { vcc: { type: "power_in" }, gnd: { type: "power_in" }, out1: { type: "output" }, inp1: { type: "input" }, inn1: { type: "input" }, out2: { type: "output" }, inp2: { type: "input" }, inn2: { type: "input" } }, description: "Dual op-amp, single-supply, LM358" },
      "ULN2003": { pins: { in1: { type: "input" }, in2: { type: "input" }, in3: { type: "input" }, in4: { type: "input" }, in5: { type: "input" }, in6: { type: "input" }, in7: { type: "input" }, out1: { type: "output" }, out2: { type: "output" }, out3: { type: "output" }, out4: { type: "output" }, out5: { type: "output" }, out6: { type: "output" }, out7: { type: "output" }, com: { type: "power_in" }, gnd: { type: "power_in" } }, description: "Darlington transistor array, 7 channels, 500mA each" },
    },
  },

  "Component::Sensor": {
    models: {
      "IR_receiver": { pins: { signal: { type: "output" }, vcc: { type: "power_in" }, gnd: { type: "power_in" } }, description: "IR receiver module (TSOP38238)" },
      "PIR":         { pins: { signal: { type: "output" }, vcc: { type: "power_in" }, gnd: { type: "power_in" } }, description: "Passive infrared motion sensor" },
      "LDR":         { pins: { pin1: { type: "passive" }, pin2: { type: "passive" } }, description: "Light-dependent resistor (photoresistor)" },
      "DHT11":       { pins: { data: { type: "io" }, vcc: { type: "power_in" }, gnd: { type: "power_in" } }, description: "Temperature & humidity sensor, 3.5V–5V" },
      "HC_SR04":     { pins: { trig: { type: "input" }, echo: { type: "output" }, vcc: { type: "power_in" }, gnd: { type: "power_in" } }, description: "Ultrasonic distance sensor HC-SR04" },
    },
  },

  "Component::Diode": {
    models: {
      "1N4007":  { pins: { anode: { type: "passive" }, cathode: { type: "passive" } }, maxRatings: { vf: 1.1, if_max: 1.0 }, description: "1N4007 rectifier diode, 1A 1000V" },
      "1N4148":  { pins: { anode: { type: "passive" }, cathode: { type: "passive" } }, maxRatings: { vf: 0.7, if_max: 0.2 }, description: "1N4148 small-signal fast-switching diode" },
      "schottky_1N5819": { pins: { anode: { type: "passive" }, cathode: { type: "passive" } }, maxRatings: { vf: 0.6, if_max: 1.0 }, description: "1N5819 Schottky diode, low Vf≈0.3V" },
    },
  },

  "Component::Switch": {
    models: {
      "SPST":       { pins: { pin1: { type: "passive" }, pin2: { type: "passive" } }, description: "SPST toggle switch" },
      "SPDT":       { pins: { com: { type: "passive" }, nc: { type: "passive" }, no: { type: "passive" } }, description: "SPDT toggle switch" },
      "pushbutton": { pins: { pin1: { type: "passive" }, pin2: { type: "passive" } }, description: "Momentary pushbutton switch (normally open)" },
    },
  },

  "Component::Crystal": {
    models: {
      "16MHz": { pins: { pin1: { type: "passive" }, pin2: { type: "passive" } }, description: "16MHz quartz crystal" },
      "8MHz":  { pins: { pin1: { type: "passive" }, pin2: { type: "passive" } }, description: "8MHz quartz crystal" },
      "12MHz": { pins: { pin1: { type: "passive" }, pin2: { type: "passive" } }, description: "12MHz quartz crystal" },
    },
  },

  "Component::Relay": {
    models: {
      "5V_relay": {
        pins: {
          coil_pos: { type: "power_in" },
          coil_neg: { type: "power_in" },
          com:      { type: "passive" },
          nc:       { type: "passive" },
          no:       { type: "passive" },
        },
        isHighCurrent: true,
        description: "5V relay module — coil driven by transistor",
      },
    },
  },
};

export function getRegistrySpec(componentType: string, model: string): ModelSpec | null {
  const typeKey = componentType.startsWith("Component::") ? componentType : `Component::${componentType}`;
  const typeSpec = COMPONENT_REGISTRY[typeKey];
  if (!typeSpec) return null;
  return typeSpec.models[model] ?? null;
}

export function getRegistryTypeSpec(componentType: string): ComponentTypeSpec | null {
  const typeKey = componentType.startsWith("Component::") ? componentType : `Component::${componentType}`;
  return COMPONENT_REGISTRY[typeKey] ?? null;
}

export function getAllRegistryTypes(): string[] {
  return Object.keys(COMPONENT_REGISTRY).map((k) => k.replace("Component::", ""));
}

export function getAllRegistryModels(componentType: string): string[] {
  const spec = getRegistryTypeSpec(componentType);
  if (!spec) return [];
  return Object.keys(spec.models);
}

export function getRegistryPins(componentType: string, model: string): string[] {
  const spec = getRegistrySpec(componentType, model);
  if (!spec) return [];
  return Object.keys(spec.pins);
}

export function isHighCurrentComponent(componentType: string, model: string): boolean {
  return getRegistrySpec(componentType, model)?.isHighCurrent ?? false;
}

export function isMCUComponent(componentType: string, model: string): boolean {
  return getRegistrySpec(componentType, model)?.isMCU ?? false;
}

export function isLEDComponent(componentType: string, model: string): boolean {
  return getRegistrySpec(componentType, model)?.isLED ?? false;
}

export function isTransistorComponent(componentType: string, model: string): boolean {
  return getRegistrySpec(componentType, model)?.isTransistor ?? false;
}
