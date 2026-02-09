# CLAUDE.md

## Project Overview

Werewolf (狼人杀) — a real-time multiplayer werewolf game with a React frontend, Node.js backend, and shared type definitions. Three npm workspaces: `client`, `server`, `shared`.

## Quick Reference

```bash
# Development
npm run dev              # Start both client (port 3000) and server (port 3001)
npm run dev:client       # Client only
npm run dev:server       # Server only

# Build
npm run build            # Build server then client
npm run build:client     # Client only (tsc + vite build)
npm run build:server     # Server only (tsc)

# Client tests (vitest v1, jsdom)
cd client && npx vitest run          # Run all
cd client && npx vitest run --coverage

# Server tests (vitest v4, node)
cd server && npx vitest run          # Unit + integration
cd server && npm run test:e2e        # E2E tests
cd server && npm run test:e2e:smoke  # Smoke only
```

## Architecture

```
client/src/
  pages/          LoginPage, AdminDashboard, GodConsole, PlayerView
  components/     Toast, RoleActionPanel, ConnectionStatus, god/, replay/
  hooks/          useGameSocket, useReplayData
  stores/         authStore (localStorage), gameStore (in-memory) — Zustand
  services/       websocket.ts — singleton WebSocketService (Socket.IO client)
  config.ts       API/WS URLs, auto-detects dev vs prod

server/src/
  game/
    flow/         GameFlowEngine — phase progression, win conditions, death triggers
    roles/        IRoleHandler implementations (Wolf, Seer, Witch, Hunter, Guard, etc.)
    script/       ScriptPresets, ScriptValidator, ScriptPhaseGenerator
    skill/        SkillResolver — priority-based skill interactions
    VotingSystem  Sheriff election + exile voting + PK
  services/       AuthService, GameService, ScriptService, BotService, ReplayService
  websocket/      SocketManager — message routing, user-socket mapping, rooms
  index.ts        Express + Socket.IO entry point

shared/src/
  types.ts        ~550 lines: Game, GamePlayer, ClientMessage, ServerMessage, etc.
  constants.ts    ROLES, ROLE_INFO, PHASES, OUT_REASONS, WS_EVENTS
```

## Key Patterns

**WebSocket protocol**: Client sends typed `ClientMessage`, server responds with `ServerMessage`. All messages go through `socket.emit('message', msg)` / `socket.on('message', handler)`. The `wsService` singleton manages connection, auto-reconnect, and room persistence via sessionStorage.

**State management**: Zustand stores — `authStore` persists to localStorage, `gameStore` is in-memory. The `useGameSocket` hook bridges WebSocket messages to store updates with page-level delegation.

**Game flow**: `GameFlowEngine` drives phase progression. Each role has a handler implementing `IRoleHandler`. Night actions are collected per-phase, then `SkillResolver` resolves them by priority (e.g., guard protect vs wolf kill vs witch save).

**Data persistence**: JSON files in `server/data/` (users.json, games.json, scripts.json, sessions.json). Uses `proper-lockfile` for concurrency. No database.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite 5, Tailwind CSS 3, Zustand 4, Socket.IO Client 4, Lucide React
- **Backend**: Express 4, Socket.IO 4, TypeScript, bcryptjs, uuid
- **Testing**: Vitest + React Testing Library + jsdom (client), Vitest node env (server)
- **Dev tools**: tsx (server hot reload), concurrently (parallel dev servers)

## TypeScript

- Target: ES2020, Module: ESNext
- `strict: false` in both client and server tsconfigs
- No path aliases in source (relative imports only); test config has `@` → `./src`, `@shared` → `../shared/src`
- Client includes `../shared/src/**/*` directly (no build step for shared)

## Testing Conventions

**Client tests** live next to source files or under `client/src/test/`. Use `renderWithProviders` from `test/test-utils.tsx` for component tests. Mock stores via `(useAuthStore as any).mockReturnValue(...)`. Mock child components as stubs with `data-testid`. Use `userEvent` (not `fireEvent`) for interactions.

**Server tests** are under `server/src/test/` organized as `unit/`, `integration/`, `e2e/`. E2E tests use a custom framework (`E2ETestFramework.ts`) with priority levels (P0-P3). Test helpers in `server/src/test/helpers/`.

**Mock data factories** in `client/src/test/mockData/gameMocks.ts` — use these to create game states for testing.

## Default Test Accounts

Auto-created on first run: `admin/admin123`, `god/god`, `test1` through `test12` (password: `test`).

## Deployment

Docker multi-stage build: nginx serves frontend on port 80, proxies `/api` and `/socket.io` to Node backend on port 3001. Also configured for Railway, Render, and Vercel (frontend-only). See `docs/deployment/` for guides.

## Language

The codebase uses Chinese (中文) for user-facing strings, test descriptions, comments, and role/phase names. All game roles, phases, and UI text are in Chinese.
