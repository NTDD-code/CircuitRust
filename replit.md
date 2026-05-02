# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Strict Circuit Compiler (`/`)
A developer tool for defining electronic circuits using Rust-inspired syntax, with:
- Code editor with Rust-inspired syntax (let declarations, Component::Type, connect!() macro)
- Real-time validation engine catching short circuits, incompatible pins, undefined variables, etc.
- SVG netlist visualizer showing components and wired connections
- LLM safety analysis placeholder (ready for Gemma 2B integration)

**Key files:**
- `artifacts/circuit-compiler/src/pages/home.tsx` — main UI
- `artifacts/api-server/src/lib/circuit-parser.ts` — Rust-inspired syntax parser
- `artifacts/api-server/src/lib/circuit-validator.ts` — validation engine (E001-E006 error codes)
- `artifacts/api-server/src/lib/circuit-netlist.ts` — netlist builder
- `artifacts/api-server/src/routes/compiler.ts` — compile + examples endpoints
- `artifacts/api-server/src/routes/llm.ts` — LLM analysis placeholder

**Supported components:** LED, Resistor, Capacitor, Transistor, Button, IC, Diode, VoltageRegulator

**Error codes:**
- E001: Short circuit (VCC directly to GND)
- E002: Unknown component type
- E003: Invalid connect! syntax
- E004: Undefined variable
- E005: Unknown pin name
- E006: Incompatible pin types
