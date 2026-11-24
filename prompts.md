# AI Prompt Log — Velora Salon Queue

This document records the AI prompts used and planned during the development, testing, debugging, and deployment of the Velora Salon Queue project.

Prompts are organized in chronological order. Original prompts are preserved wherever available, including unsuccessful attempts. Each completed prompt includes its date and actual result. Prompts that were not used are marked as **Planned — Not Used**.

Both Antigravity and GitHub Copilot were used during this project. The tool used is mentioned wherever applicable.

---

# Part 1 — Development Prompts

## Prompt 0 — Understand Before Coding

**Tool:** Antigravity

Read `AGENTS.md` and all files in `docs/`. Do not write or modify code yet. Summarize the product, seven screens, queue rules, data that must persist, security boundaries and deployment architecture. Identify contradictions, missing decisions and risks. Propose a phased implementation plan and exact environment variables. Wait for my approval before coding.

**Date:** 2026-11-22

**Result:** Success. Architecture summary provided, free-tier guarantees verified, Render IPv4-pooler connection strategy established, and phased plan approved.

---

## Prompt 1 — Repository and Architecture Setup

**Tool:** Antigravity

Implement setup only. Create a React + Vite + TypeScript + Tailwind frontend and a Node.js + Express + TypeScript backend with Socket.IO. Use hosted PostgreSQL (Supabase PostgreSQL is the target) through a server-side database connection. Add shared types, environment validation, health-check endpoint, CORS configuration, error middleware, lint/format scripts and a clean folder structure. Add `.env.example` files and ensure secrets are not committed. Do not build the seven screens yet. Explain the data model and how local frontend/backend development runs. Run install, typecheck and build; report exact results and changed files.

**Date:** 2026-11-22

**Result:** Success. Initialized monorepo (`shared`, `backend`, `frontend`). Configured TypeScript, Tailwind CSS, Express, Socket.IO, health endpoint, `.env.example`, `.gitignore`, and Vitest. Full build, typecheck, and unit test passed with code 0. No secrets committed.

---

## Prompt 2 — Database Schema and Domain Rules

**Tool:** Antigravity

Read `docs/03-flows-rules.md`. Design and implement the PostgreSQL schema/migrations for services, barbers, staff users/roles, daily token counters and queue entries. Add constraints/indexes for one active queue entry per normalized phone, unique daily token, valid statuses and barber active-work limits where practical. Implement server-side domain services for token creation, duplicate detection, barber compatibility, status transitions and wait-time estimates. Use transactions/locking for simultaneous joins and Call Next. Seed clearly labelled demo services/barbers. Do not build UI yet. Add unit/integration tests for critical rules and run them.

**Date:** 2026-11-22

**Result:** Success. Designed normalized PostgreSQL schema (`salon_settings`, `services`, `barbers`, `staff_users`, `daily_token_counters`, `queue_entries`, `queue_entry_services`, `queue_status_logs`, `schema_migrations`) with partial unique indexes for single active customer per phone and barber limits. Created versioned SQL migrations and idempotent seed scripts. Implemented domain services for atomic tokens, queue state machine, barber compatibility, wait time estimation, and Indian phone validation. Added 16 automated tests in Vitest (all passed). No secrets committed.

---

## Prompt 3 — Shared App Shell and Design System

**Tool:** Antigravity

Build the premium Velora visual system and responsive app shell from `docs/02-screens.md`: typography, colour tokens, buttons, inputs, cards, status badges, modal, toast, loading/empty/error states and EN/GU language dictionary. Add route skeletons for all seven screens. Do not implement queue mutations yet. Verify mobile and desktop layouts and report changed files/tests.

**Date:** 2026-11-22

**Result:** Success. Built common React application shell with React Router covering all 7 approved routes (`/`, `/join`, `/status/:publicId`, `/reception`, `/barber/:barberId`, `/display`, `/admin`, plus 404). Created reusable design system components (`Button`, `Badge`, `Card`, `Input`, `Skeleton`, `EmptyState`) adhering to the Velora palette (warm ivory, forest green, sage, copper, amber, red). Implemented bilingual English/Gujarati infrastructure (`LanguageContext`, `translations.ts`). Verified touch targets (minimum 44px) and responsive layouts (mobile, tablet, and 1920x1080 TV layout). Passed all 19 tests, typecheck, and Vite production build. No secrets committed.

---

## Prompt 4 — Home and Join Queue

**Tool:** Antigravity

Build only `/` and `/join` exactly as documented. Use real API data for services, barbers and queue summary; do not hard-code live counts. Implement name/mobile validation, maximum three services, barber selection, live summary and submit loading/error states. Submit to the backend; server calculates totals and validates availability. If phone already has an active entry, show the existing token/status instead of creating another. Test all form cases and do not modify other screens.

**Date:** 2026-11-22

**Result:** Success. Built live REST API endpoints (`/api/salon/status`, `/api/services`, `/api/barbers`, `/api/queue/join`, `/api/queue/:publicId`) with Socket.IO event broadcasting. Integrated `HomePage` with live salon status, dynamic wait-time summary, barber availability cards, and bilingual services catalogue. Built interactive 4-step `JoinPage` wizard (Details → Services → Barber → Confirm) with real-time Indian phone normalization (`+91`), 1–3 service multi-selection, and atomic queue entry generation. Implemented duplicate phone detection returning existing active tokens. Added 7 new integration tests in Vitest (26 total tests passing), 0 typecheck errors, and production build passed. No secrets committed.

---

## Prompt 5 — Customer Tracking

**Status:** Planned — Not Used

Build `/status/:publicId`. Show token, compatible queue position, estimated wait, selected services, barber, progress timeline and conditional cancel action. Connect it to real persisted data and Socket.IO. Add reconnect/refetch handling and stale connection state. Test refresh, invalid public ID, cancellation and every status state. Do not expose other customers' personal data.

---

## Prompt 6 — Staff Authentication and Reception Dashboard

**Status:** Planned — Not Used

Implement secure staff login/session and role checks first, then build `/reception` for tablet landscape. Add barber lanes, waiting list, filters/search, Add Walk-in, Call Next, No-show and Cancel. All actions must call server endpoints; do not implement queue selection in React. Confirm the server enforces barber compatibility and atomic calling. Broadcast successful mutations only after database commit. Test two reception sessions attempting Call Next simultaneously.

---

## Prompt 7 — Barber View

**Status:** Planned — Not Used

Build `/barber/:barberId` for phone screens. Show current customer, services, timer, next compatible entry and availability/break controls. Enforce role-to-barber authorization, one active customer per barber and forward-only transitions on the backend. Test Called → In Service → Done, invalid transitions and break/off-duty behaviour.

---

## Prompt 8 — TV Display

**Status:** Planned — Not Used

Build `/display` as a read-only 1920×1080 screen. Show current token per barber and the next five queue tokens. Use large readable typography, high contrast and subtle newly-called animation. Never show customer names, phone numbers or private URLs. Subscribe to real-time updates and refetch after reconnect. Test at 1920×1080 and a smaller laptop viewport.

---

## Prompt 9 — Owner Settings

**Status:** Planned — Not Used

Build `/admin` with owner-only authorization. Implement service CRUD and enable/disable, barber duty/availability management, salon opening hours, online joining cutoff and today's statistics. Persist all changes and broadcast updates. Validate inputs on the server. Do not allow deleting a barber with active work or disabling a service already selected by an active customer in a way that corrupts that entry.

---

## Prompt 10 — Bilingual and UX Audit

**Status:** Planned — Not Used

Audit every route in English and Gujarati. Translate labels, validation, toast messages, statuses, empty states and dialogs. Fix clipping, overflow, weak contrast, inconsistent spacing, small touch targets and keyboard accessibility. Preserve working functionality. Report each change and test mobile, tablet, desktop and TV breakpoints.

---

## Prompt 11 — End-to-End QA

**Status:** Planned — Not Used

Act as a senior QA engineer. Run the application and execute every checkbox in `docs/03-flows-rules.md`, not merely inspect source code. Test multiple browser windows, simultaneous joins/calls, refresh, backend restart, Socket.IO disconnect/reconnect, invalid inputs, all state transitions, role permissions and mobile layouts. Add automated tests for critical queue logic. Fix reproducible bugs without redesigning working screens. Provide PASS/FAIL with evidence and list untested items honestly. Do not claim success without actually testing.

---

## Prompt 12 — Deployment Readiness

**Status:** Planned — Not Used

Prepare frontend for Vercel and backend for Render, with PostgreSQL hosted on Supabase. Check production build, server start command, health route, CORS allowlist, WebSocket support, environment variables, migrations and seed strategy. Search for accidental localhost URLs and secrets. Do not deploy yet. Give exact environment-variable names and provider dashboard steps for this repository.

---

## Prompt 13 — Deploy and Verify

**Status:** Planned — Not Used as Written

Deploy backend to Render and frontend to Vercel. Configure production environment variables and CORS using the actual deployed URLs. Apply database migrations and seed only safe demo data. Verify health endpoint, customer join, staff login, Call Next, barber Start/Done, TV update, refresh persistence and direct-route refresh on the live URL. Fix deployment-only failures. Put the verified live URL at the very top of `README.md`, immediately below the project title. Never invent a URL or claim deployment succeeded until the live site has been opened and tested.

**Note:** Deployment was completed through the actual deployment and troubleshooting process. The separate troubleshooting prompts and verification details are documented in Part 2 and Part 3.

---

## Prompt 14 — Submission Package

**Status:** Planned — Not Used

Complete `README.md` with the verified live demo link first, hosted architecture, features, local setup, environment variable names (never values), test commands, screenshots, demo staff access instructions and known limitations. Ensure `prompts.md` contains every prompt actually used in order. Prepare a 3-minute demo script and a half-page reflection explaining one mistake the agent made, how it was detected and how the prompt/docs were improved. Check GitHub repository is public and contains no secrets, database dumps or private customer data.

---

# Part 2 — Deployment Troubleshooting Prompts

## Prompt 15 — Identify the Correct Backend Health Endpoint

**Tool:** GitHub Copilot

**Actual prompt used:**

Inspect the Velora Salon Queue backend routing.

1. Find all registered GET routes, especially health-check or status endpoints.
2. Check `backend/src/index.ts`, `backend/src/app.ts`, and route files.
3. Identify the correct URL path for testing the deployed backend.
4. Check whether a root (`/`) route exists.
5. Do not modify any files.

Return the exact endpoint URLs and relevant file locations.

**Date:** 2026-11-24

**Result:** Success. Copilot identified `/api/health` as the correct health-check endpoint. It also confirmed that `/` and `/health` were not registered routes. The deployed endpoint returned `status: ok`, `database: connected`, and `persistent: true`.

---

## Prompt 16 — Inspect Frontend Production Environment Variables

**Tool:** GitHub Copilot

**Actual prompt used:**

Inspect the Velora Salon Queue frontend deployment configuration.

1. Check `frontend/.env.example`, Vite configuration, and all frontend API/Socket.IO URL references.
2. Identify the exact environment variable names required for production.
3. Confirm whether both API and WebSocket URLs use the backend URL.
4. Identify the frontend build command and output directory.
5. Do not modify any files.

Return the exact Vercel configuration values.

**Date:** 2026-11-24

**Result:** Success. Copilot confirmed that `VITE_API_URL` and `VITE_WS_URL` are the required variables. Both point to the Render backend URL. It also confirmed that the WebSocket connection uses the HTTPS origin and that environment variables must be configured in Vercel before building.

---

## Prompt 17 — Verify Vercel Monorepo Configuration

**Tool:** GitHub Copilot

**Actual prompt used:**

Check the repository's root `package.json`, `frontend/package.json`, and Vercel configuration.

Tell me the exact Vercel settings for this monorepo:

1. Root Directory
2. Framework Preset
3. Build Command
4. Output Directory
5. Install Command

Ensure the settings work with npm workspaces and do not modify any files.

**Date:** 2026-11-24

**Result:** Success. Copilot recommended `frontend` as the Root Directory, Vite as the Framework Preset, `npm run build` as the Build Command, `dist` as the Output Directory, and `npm install --workspace=@velora/frontend` as the Install Command. It also recommended including source files outside the Root Directory so the shared workspace could be accessed. Frontend deployment succeeded.

---

# Part 3 — Deployment Verification

**Date:** 2026-11-24

**Result:** Deployment successful.

- **Frontend:** Deployed successfully on Vercel.
- **Backend:** Deployed successfully on Render.
- **Database:** Supabase PostgreSQL connectivity verified.
- **Health check:** The deployed backend health endpoint `/api/health` returned a successful response.
- **CORS:** Production frontend origin configured in the backend.
- **Environment variables:** Production frontend and backend environment variables configured.
- **Application:** Live frontend opened and tested successfully.

**Deployment URLs:**

- Frontend: https://velora-salon-queue.vercel.app/
- Backend: https://velora-salon-queue.onrender.com
- Backend health check: https://velora-salon-queue.onrender.com/api/health
- GitHub repository: https://github.com/Krupal-Paghadal24/velora-salon-queue

---

# Part 4 — Reusable Prompts

## Reusable Bug-Fixing Prompt

On `[route/screen]`, when I `[exact action]`, the actual result is `[what happened]`. The expected result from `docs/03-flows-rules.md` is `[expected behaviour]`.

Reproduce it, explain the root cause, fix only the relevant code, add a regression test and report the commands/results. Do not redesign unrelated screens.

---

## Reusable Visual Refinement Prompt

On `[route]`, change only `[specific component]`: `[precise layout, size, spacing, typography, colour and responsive behaviour]`.

Preserve all existing actions, data flow and other screens. Show the changed files and verify the screen at `[viewport sizes]`.
