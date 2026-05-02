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
- Animated splash screen (framer-motion, auto-dismisses at 2.4s)
- Monaco Editor with `circuit-dsl` language (syntax highlighting, autocomplete, hover, Ctrl+Enter to compile)
- 3-panel IDE layout: Library sidebar (left, 240px) | Editor+Output (center, flex) | AI Assistant (right, 320px)
- Compiler-style validation with error markers in Monaco editor
- Interactive SVG netlist visualizer with category-based component symbols, color-coded nets
- BOM generator with estimated unit prices + CSV/JSON download
- KiCad/Proteus/SPICE netlist exporter
- Component Library browser (37 components, 6 categories, searchable)
- AI Circuit Generation (Anthropic Claude or Ollama) — generates circuit DSL code from description
- AI Safety Analysis — scores circuit risks with severity breakdown
- AI Provider Settings drawer — configure Cloud (Anthropic API key + model) or Local (Ollama URL + model pull/detect)
- Provider badge in header + status bar shows active AI provider
- W003 voltage mismatch warnings (5V→3.3V without level shifter)

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
- `artifacts/api-server/src/routes/ai.ts` — Anthropic proxy + Ollama proxy + SSE pull endpoint

**Key frontend files:**
- `artifacts/circuit-compiler/src/pages/home.tsx` — main IDE (3-panel layout, splash, header, output tabs, status bar)
- `artifacts/circuit-compiler/src/components/splash-screen.tsx` — animated splash
- `artifacts/circuit-compiler/src/components/circuit-editor.tsx` — Monaco with circuit-dsl language
- `artifacts/circuit-compiler/src/components/library-panel.tsx` — searchable component sidebar
- `artifacts/circuit-compiler/src/components/ai-settings-drawer.tsx` — AI provider settings sheet
- `artifacts/circuit-compiler/src/components/ai-assistant-panel.tsx` — Generate + Safety tabs
- `artifacts/circuit-compiler/src/components/netlist-graph.tsx` — SVG circuit visualizer
- `artifacts/circuit-compiler/src/components/bom-panel.tsx` — BOM table + CSV/JSON export
- `artifacts/circuit-compiler/src/lib/bom.ts` — BOM generation + CSV serialization
- `artifacts/circuit-compiler/src/lib/ai-provider.ts` — AI provider settings, system prompts, localStorage

**OpenAPI spec:** `lib/api-spec/openapi.yaml` (v0.3.0) — source of truth for all API types and hooks
- After updating the spec: `pnpm --filter @workspace/api-spec run codegen` → then `pnpm run typecheck:libs`
- AI endpoints: `POST /api/ai/chat`, `POST /api/ollama/models`, `POST /api/ollama/status`, `POST /api/ollama/pull` (SSE)
