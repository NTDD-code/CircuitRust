# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (configured but not used by circuit compiler)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

### Strict Circuit Compiler (`/`)
A professional-grade developer tool for defining, validating, and exporting electronic circuits using Rust-inspired syntax.

**Features:**
- Code editor with Rust-inspired syntax (`let`, `Component::Type`, `Net::power/ground/signal`, `connect!()`)
- Validation engine with compiler-style errors (E001–E008) and warnings (W001–W006)
- Interactive SVG netlist visualizer with category-based component symbols, color-coded nets
- KiCad/Proteus/SPICE netlist exporter with footprint mapping
- Component Library browser (37 components, 6 categories)
- LLM Safety Analysis placeholder (Gemma 2B ready)

**Component Library (37 components, 6 categories):**
- `passive` (7): Resistor, Capacitor, Inductor, Button, Switch, Crystal, Transformer
- `active_discrete` (9): LED, Diode, ZenerDiode, SchottkyDiode, TVSDiode, NPN, PNP, NMOSFET, PMOSFET
- `active_ic` (5): OpAmp741, OpAmpTL082, OpAmpLM358, LevelShifter, IC
- `power` (4): VoltageRegulator, LDO, BuckConverter, BoostConverter
- `sensor` (7): DHT11, DHT22, MPU6050, Ultrasonic, IRSensor, PhotoResistor, Thermistor
- `module` (5): ArduinoUno, ArduinoNano, ESP32, ESP8266, RaspberryPiPico

**Error codes:**
- E001: Short circuit (VCC directly to GND)
- E002: Unknown component type
- E003: Invalid connect! syntax
- E004: Undefined variable
- E005: Unknown pin name
- E006: Incompatible pin types
- E007: Voltage clash between power nets
- E008: Output-to-output collision

**Warning codes:**
- W001: Direct power-to-power connection
- W002: Duplicate connection
- W003: Voltage mismatch (5V output → 3.3V input without level shifter)
- W004: Unconnected power/ground pins
- W005: Floating signal pins
- W006: Empty circuit

**Key backend files:**
- `artifacts/api-server/src/lib/circuit-parser.ts` — Rust-inspired syntax parser + full component library
- `artifacts/api-server/src/lib/circuit-validator.ts` — validation engine
- `artifacts/api-server/src/lib/circuit-netlist.ts` — netlist builder
- `artifacts/api-server/src/lib/circuit-exporter.ts` — KiCad/Proteus/SPICE exporter
- `artifacts/api-server/src/routes/compiler.ts` — compile, export, examples, library endpoints
- `artifacts/api-server/src/routes/llm.ts` — LLM analysis placeholder

**Key frontend files:**
- `artifacts/circuit-compiler/src/pages/home.tsx` — full UI
