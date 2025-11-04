# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a translation app built with TanStack Start (React) for the frontend and Tauri v2 for the desktop application wrapper. The project uses TypeScript, Tailwind CSS v4, and Vite as the build tool.

## Architecture

**Hybrid Desktop Application:**

- Frontend: TanStack Start (full-stack React framework) with file-based routing
- Desktop Wrapper: Tauri v2 (Rust-based) for native desktop capabilities
- The Vite dev server runs on port 1420 (configured in `tauri.conf.json` and `vite.config.ts`)
- Frontend builds output to `.output/` directory (consumed by Tauri)

**Key Stack Components:**

- TanStack Router: File-based routing in `src/routes/` directory
- TanStack Nitro v2: Server-side rendering support
- React 19 with React Compiler (babel-plugin-react-compiler)
- Tailwind CSS v4 with Vite plugin
- T3 Env: Type-safe environment variables (see `src/env.ts`)
- Shadcn UI: Component library (install with `pnpx shadcn@latest add <component>`)

**Project Structure:**

- `src/routes/`: File-based routing (auto-generates `src/routeTree.gen.ts`)
- `src/routes/__root.tsx`: Root layout with devtools and shell component
- `src/router.tsx`: Router configuration
- `src/env.ts`: Environment variable schema with Zod validation
- `src/lib/utils.ts`: Shared utility functions
- `src/components/`: UI components (currently empty - use Shadcn to add)
- `src-tauri/`: Rust/Tauri backend code
  - `src-tauri/src/main.rs`: Tauri application entry point
  - `src-tauri/tauri.conf.json`: Tauri configuration

**Tauri Integration:**

- Dev mode: Tauri runs `pnpm dev` (starts Vite) and connects to localhost:1420
- Build mode: Tauri runs `pnpm build` then packages the `.output/` directory
- The app uses `@tauri-apps/api` and `@tauri-apps/plugin-opener` for native functionality

## Development Commands

**Package Manager:** This project uses `pnpm`

**Development:**

```bash
# Start web dev server only (without Tauri)
pnpm dev

# Start Tauri desktop app in dev mode (starts Vite automatically)
pnpm tauri dev
```

**Building:**

```bash
# Build frontend for production
pnpm build

# Build Tauri desktop app (includes frontend build)
pnpm tauri build

# Preview production build
pnpm serve
```

**Testing:**

```bash
# Run all tests
pnpm test

# Run tests in watch mode (Vitest)
vitest
```

**Code Quality:**

```bash
# Run ESLint
pnpm lint

# Run Prettier
pnpm format

# Run both Prettier and ESLint with auto-fix
pnpm check
```

**UI Components:**

```bash
# Add Shadcn components (always use latest version)
pnpx shadcn@latest add <component-name>
```

## Important Configuration Details

**Path Aliases:**

- `@/*` maps to `./src/*` (configured in `tsconfig.json` and enabled via `vite-tsconfig-paths`)

**Environment Variables:**

- Client vars must be prefixed with `VITE_`
- Server vars have no prefix requirement
- All env vars are validated via Zod schemas in `src/env.ts`
- Import with: `import { env } from '@/env'`

**TanStack Router:**

- File-based routing: adding files to `src/routes/` auto-generates routes
- `routeTree.gen.ts` is auto-generated - don't edit manually
- Root layout lives in `src/routes/__root.tsx`
- Use `<Link to="/path">` from `@tanstack/react-router` for SPA navigation

**Tailwind CSS:**

- Version 4.x with Vite plugin
- Includes `prettier-plugin-tailwindcss` for class sorting
- Uses `tw-animate-css` for animations
- Uses `class-variance-authority` and `tailwind-merge` (via `src/lib/utils.ts`)

**React Compiler:**

- React 19 with experimental React Compiler enabled
- Compiler runs via `babel-plugin-react-compiler` in Vite config

## Cursor Rules

When adding Shadcn components, always use the latest version:

```bash
pnpx shadcn@latest add <component-name>
```
