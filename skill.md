# Circuit DSL Skill

Use this guide when generating code for the Strict Circuit Compiler.
The compiler describes electronic circuits with a small Rust-inspired DSL,
then parses, validates, tests, and exports the resulting netlist.

## Generation rules

1. Generate only the syntax documented here. Do not invent component types,
   pins, properties, models, or assertion names.
2. Declare every net and component before using it in `connect!`.
3. Use lower-case `snake_case` identifiers for net and component variables.
4. Use one declaration or one `connect!` statement per line.
5. End statements with `;` for readability. The parser also accepts statements
   without a semicolon.
6. Add a real ground net and connect all required power and ground pins.
7. Never connect a power net directly to ground. Use the appropriate load or
   driver circuit.
8. For an LED connected to a supply, include a series current-limiting resistor.
9. Drive motors, buzzers, relays, and solenoids through a transistor or driver,
   and add a flyback diode where required.
10. Prefer `->` in generated code. The legacy `=>` operator is also accepted.
11. Do not claim a circuit is safe until the compiler result has been checked.

## Complete file shape

The outer `circuit Name { ... }` wrapper is optional. The parser ignores the
wrapper and validates the statements inside it.

```circuit
circuit LedIndicator {
  let vcc = Net::VCC { voltage: 5.0 };
  let gnd = Net::GND;

  let r1 = Component::Resistor { resistance: "220" };
  let led1 = Component::LED { color: "red" };

  connect!(vcc -> r1.pin1);
  connect!(r1.pin2 -> led1.anode);
  connect!(led1.cathode -> gnd);
}
```

Comments begin with `//` and can appear on their own line or after a statement.
Blank lines are ignored.

## Net declarations

The variable on the left is the name used later in `connect!` and in tests.

```circuit
let vcc = Net::power(5.0);       // power net with explicit voltage
let gnd = Net::ground();         // ground net
let signal = Net::signal();      // ordinary signal net

let vcc = Net::VCC;              // strict form; defaults to 5.0 V
let vcc = Net::VCC { voltage: 3.3 };
let gnd = Net::GND;
let signal = Net::Signal;
let pwm = Net::PWM;

let unused = Net::nc();          // no-connect marker
let named = Net::new("i2c_bus"); // custom signal; variable is the net reference
let anonymous_nc = Net::new();   // custom signal without a display name
```

Use distinct variable names for separate power rails, such as `vcc5` and
`vcc3v3`. Do not declare two nets or components with the same variable name.

## Component declarations

Basic form:

```circuit
let r1 = Component::Resistor;
let r1 = Component::Resistor { resistance: "220" };
```

Properties are comma-separated `key: value` pairs. String values should be
quoted. Numbers and booleans are accepted, but use the property names supported
by the selected component.

Supported component types:

### Passive

- `Resistor` — pins `pin1`, `pin2`; common property `resistance`
- `Capacitor` — pins `pin1`, `pin2`; common property `capacitance`
- `Inductor` — pins `pin1`, `pin2`; common property `inductance`
- `Button` — pins `pin1`, `pin2`
- `Switch` — pins `pin1`, `pin2`
- `Crystal` — pins `pin1`, `pin2`
- `Transformer` — pins `p1`, `p2`, `s1`, `s2`

### Diodes and transistors

- `LED` — pins `anode`, `cathode`; common property `color`
- `Diode` — pins `anode`, `cathode`
- `ZenerDiode` — pins `anode`, `cathode`
- `SchottkyDiode` — pins `anode`, `cathode`
- `TVSDiode` — pins `anode`, `cathode`
- `NPN` — pins `base`, `collector`, `emitter`; common property `model`
- `PNP` — pins `base`, `collector`, `emitter`; common property `model`
- `NMOSFET` — pins `gate`, `drain`, `source`; common property `model`
- `PMOSFET` — pins `gate`, `drain`, `source`; common property `model`

### ICs and power

- `OpAmp741` — `in_pos`, `in_neg`, `out`, `vcc`, `vee`, `os1`, `os2`
- `OpAmpTL082` — `in_pos`, `in_neg`, `out`, `vcc`, `vee`
- `OpAmpLM358` — `in_pos`, `in_neg`, `out`, `vcc`, `gnd`
- `LevelShifter` — `lv`, `hv`, `gnd`, `a`, `b`
- `IC` — `vcc`, `gnd`, `in`, `out`
- `VoltageRegulator` — `in`, `out`, `gnd`
- `LDO` — `in`, `out`, `gnd`, `adj`
- `BuckConverter` — `vin`, `vout`, `gnd`, `en`, `fb`
- `BoostConverter` — `vin`, `vout`, `gnd`, `en`
- `L298N` — `in1`, `in2`, `in3`, `in4`, `enA`, `enB`, `vs`, `vss`,
  `gnd`, `out1`, `out2`, `out3`, `out4`

### Sensors

- `DHT11` — `vcc`, `data`, `nc`, `gnd`
- `DHT22` — `vcc`, `data`, `nc`, `gnd`
- `MPU6050` — `vcc`, `gnd`, `scl`, `sda`, `int`, `ad0`
- `Ultrasonic` — `vcc`, `gnd`, `trigger`, `echo`
- `IRSensor` — `vcc`, `gnd`, `out`
- `PhotoResistor` — `pin1`, `pin2`
- `Thermistor` — `pin1`, `pin2`

### Boards and actuators

- `ArduinoUno` — power pins `vcc`, `v3v3`, `gnd`; digital pins `d0`–`d13`;
  analog pins `a0`–`a5`; also `tx`, `rx`, `sda`, `scl`, `reset`, `aref`
- `ArduinoNano` — power pins `vcc`, `v3v3`, `gnd`; digital pins `d2`–`d13`;
  analog pins `a0`–`a7`; also `tx`, `rx`, `sda`, `scl`, `reset`
- `ESP32` — `vcc`, optional `v5`, `gnd`, GPIO pins, `tx`, `rx`, `sda`, `scl`,
  and `en`
- `ESP8266` — `vcc`, `gnd`, `d0`–`d8`, `a0`, `tx`, `rx`, `en`, `rst`
- `RaspberryPiPico` — `vsys`, `v3v3`, `gnd`, `gp0`–`gp15`, `sda`, `scl`,
  `tx`, `rx`
- `Motor` — `m_pos`, `m_neg`
- `Buzzer` — `vcc`, `gnd`
- `Relay` — `coil_a`, `coil_b`, `com`, `no`, `nc`
- `Solenoid` — `coil_a`, `coil_b`

Aliases are accepted case-insensitively where registered, for example `Uno`,
`Nano`, `LM358`, `Schottky`, `Buck`, `Pico`, `DCMotor`, and `Relay`.
When uncertain about a pin, query the component library endpoint rather than
guessing.

## Connections

Both endpoints can be a component pin or a declared net:

```circuit
connect!(vcc -> r1.pin1);
connect!(r1.pin2 -> led1.anode);
connect!(led1.cathode -> gnd);
connect!(ard.d2 -> sensor.data);
connect!(sensor.data -> Net::nc());
```

Accepted operators are `->`, `=>`, and the Unicode arrow `→`.
Use the explicit `component.pin` form for component endpoints. A bare endpoint
such as `vcc` or `gnd` refers to the declared net. If a component endpoint has
no pin, the parser falls back to `pin1`, but AI-generated code should always
write the pin name explicitly.

## Test blocks

Tests are optional. They are removed from the circuit parser and executed
against the generated netlist after compilation.

```circuit
test "LED protection verified" {
  assert_connected!(r1.pin2, led1.anode);
  assert_net_exists!(vcc);
  assert_component_exists!(led1);
  assert_eq!(led1.type, "LED");
  assert_eq!(r1.pin1.net, "vcc");
  assert_gt!(r1.resistance, "100");
  assert_lt!(r1.resistance, "1000");
  assert_voltage!(vcc, 5.0);
}
```

Supported assertions:

- `assert_connected!(component.pin, component.pin)`
- `assert_net_exists!(net_name)`
- `assert_component_exists!(component_id)`
- `assert_eq!(component.type, "TypeName")`
- `assert_eq!(component.pin.net, "net_name")`
- `assert_gt!(component.property, "number")`
- `assert_lt!(component.property, "number")`
- `assert_voltage!(net_name, number)`

Each test must contain at least one assertion. Test names are quoted strings.
Tests do not repair invalid circuit code; the circuit must compile first.

## Validation behavior

The compiler may return errors and warnings. Treat errors as a failed build and
do not present the circuit as ready. Important safety checks include:

- `E001` — short circuit or invalid dangerous topology
- `E002` — unknown component type
- `E003` — invalid `connect!` syntax
- `E004` — undefined variable
- `E005` — unknown pin
- `E006` — incompatible pin types
- `E007` — LED without a series current-limiting resistor
- `E008` — high-current load driven directly from an MCU GPIO
- `E009` — transistor base without a current-limiting resistor
- `E010` — unsafe NPN collector/emitter topology
- `E011` — output-to-output logic contention
- `E012` — inductive load without a flyback diode
- `E013` — inverted IC power/ground polarity

Common warnings include direct power-to-power connections, duplicate
connections, voltage mismatches, unconnected required pins, floating signal
pins, and an empty circuit (`W006`).

An empty or whitespace-only source is not a circuit and must not be assigned a
health score. The UI skips automatic compilation for empty source.

## AI response protocol

When asked to create a circuit:

1. State the assumed supply voltage and the purpose of the circuit.
2. Generate complete DSL with all declarations before connections.
3. Include ground, required power connections, protection components, and tests
   where they are meaningful.
4. Compile the generated source through the application's compiler endpoint.
5. Read every error and warning; revise the source instead of hiding issues.
6. Report component count, connection count, net count, test results, and all
   remaining safety issues.
7. Never fabricate a successful compile result or a safety score.