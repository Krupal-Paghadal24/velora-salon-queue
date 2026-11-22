# Antigravity Prompt Log — Velora Salon Queue

Keep every prompt actually used, in order. Do not delete failed prompts; add a short note explaining what failed and how the prompt was improved. The prompts below are the planned starting sequence. After using one, record the date and actual result.

## Prompt 0 — Understand before coding
Read `AGENTS.md` and all files in `docs/`. Do not write or modify code yet. Summarize the product, seven screens, queue rules, data that must persist, security boundaries and deployment architecture. Identify contradictions, missing decisions and risks. Propose a phased implementation plan and exact environment variables. Wait for my approval before coding.
*Date:* 2026-11-22
*Result:* Success. Architecture summary provided, free-tier guarantees verified, Render IPv4-pooler connection strategy established, and phased plan approved.

## Prompt 1 — Repository and architecture setup
Implement setup only. Create a React + Vite + TypeScript + Tailwind frontend and a Node.js + Express + TypeScript backend with Socket.IO. Use hosted PostgreSQL (Supabase PostgreSQL is the target) through a server-side database connection. Add shared types, environment validation, health-check endpoint, CORS configuration, error middleware, lint/format scripts and a clean folder structure. Add `.env.example` files and ensure secrets are not committed. Do not build the seven screens yet. Explain the data model and how local frontend/backend development runs. Run install, typecheck and build; report exact results and changed files.
*Date:* 2026-11-22
*Result:* Success. Initialized monorepo (`shared`, `backend`, `frontend`). Configured TypeScript, Tailwind CSS, Express, Socket.IO, health endpoint, `.env.example`, `.gitignore`, and Vitest. Full build, typecheck, and unit test passed with code 0. No secrets committed.

## Prompt 2 — Database schema and domain rules
Read `docs/03-flows-rules.md`. Design and implement the PostgreSQL schema/migrations for services, barbers, staff users/roles, daily token counters and queue entries. Add constraints/indexes for one active queue entry per normalized phone, unique daily token, valid statuses and barber active-work limits where practical. Implement server-side domain services for token creation, duplicate detection, barber compatibility, status transitions and wait-time estimates. Use transactions/locking for simultaneous joins and Call Next. Seed clearly labelled demo services/barbers. Do not build UI yet. Add unit/integration tests for critical rules and run them.
*Date:* 2026-11-22
*Result:* Success. Designed normalized PostgreSQL schema (salon_settings, services, barbers, staff_users, daily_token_counters, queue_entries, queue_entry_services, queue_status_logs, schema_migrations) with partial unique indexes for single active customer per phone and barber limits. Created versioned SQL migrations and idempotent seed scripts. Implemented domain services for atomic tokens, queue state machine, barber compatibility, wait time estimation, and Indian phone validation. Added 16 automated tests in Vitest (all passed). No secrets committed.

## Prompt 3 — Shared app shell and design system
Build the premium Velora visual system and responsive app shell from `docs/02-screens.md`: typography, colour tokens, buttons, inputs, cards, status badges, modal, toast, loading/empty/error states and EN/GU language dictionary. Add route skeletons for all seven screens. Do not implement queue mutations yet. Verify mobile and desktop layouts and report changed files/tests.
*Date:* 2026-11-22
*Result:* Success. Built common React application shell with React Router covering all 7 approved routes (`/`, `/join`, `/status/:publicId`, `/reception`, `/barber/:barberId`, `/display`, `/admin`, plus 404). Created reusable design system components (`Button`, `Badge`, `Card`, `Input`, `Skeleton`, `EmptyState`) adhering to the Velora palette (warm ivory, forest green, sage, copper, amber, red). Implemented bilingual English/Gujarati infrastructure (`LanguageContext`, `translations.ts`). Verified touch targets (min 44px) and responsive layouts (mobile, tablet, and 1920x1080 TV layout). Passed all 19 tests, typecheck, and Vite production build. No secrets committed.

## Prompt 4 — Home and Join Queue
Build only `/` and `/join` exactly as documented. Use real API data for services, barbers and queue summary; do not hard-code live counts. Implement name/mobile validation, maximum three services, barber selection, live summary and submit loading/error states. Submit to the backend; server calculates totals and validates availability. If phone already has an active entry, show the existing token/status instead of creating another. Test all form cases and do not modify other screens.
*Date:* 2026-11-22
*Result:* Success. Built live REST API endpoints (`/api/salon/status`, `/api/services`, `/api/barbers`, `/api/queue/join`, `/api/queue/:publicId`) with Socket.IO event broadcasting. Integrated `HomePage` with live salon status, dynamic wait-time summary, barber availability cards, and bilingual services catalogue. Built interactive 4-step `JoinPage` wizard (Details → Services → Barber → Confirm) with real-time Indian phone normalization (`+91`), 1–3 service multi-selection, and atomic queue entry generation. Implemented duplicate phone detection returning existing active tokens. Added 7 new integration tests in Vitest (26 total tests passing), 0 typecheck errors, and production build passed. No secrets committed.

## Prompt 5 — Customer tracking
Build `/status/:publicId`. Show token, compatible queue position, estimated wait, selected services, barber, progress timeline and conditional cancel action. Connect it to real persisted data and Socket.IO. Add reconnect/refetch handling and stale connection state. Test refresh, invalid public ID, cancellation and every status state. Do not expose other customers' personal data.

## Prompt 6 — Staff authentication and Reception Dashboard
Implement secure staff login/session and role checks first, then build `/reception` for tablet landscape. Add barber lanes, waiting list, filters/search, Add Walk-in, Call Next, No-show and Cancel. All actions must call server endpoints; do not implement queue selection in React. Confirm the server enforces barber compatibility and atomic calling. Broadcast successful mutations only after database commit. Test two reception sessions attempting Call Next simultaneously.

## Prompt 7 — Barber View
Build `/barber/:barberId` for phone screens. Show current customer, services, timer, next compatible entry and availability/break controls. Enforce role-to-barber authorization, one active customer per barber and forward-only transitions on the backend. Test Called → In Service → Done, invalid transitions and break/off-duty behaviour.

## Prompt 8 — TV display
Build `/display` as a read-only 1920×1080 screen. Show current token per barber and the next five queue tokens. Use large readable typography, high contrast and subtle newly-called animation. Never show customer names, phone numbers or private URLs. Subscribe to real-time updates and refetch after reconnect. Test at 1920×1080 and a smaller laptop viewport.

## Prompt 9 — Owner Settings
Build `/admin` with owner-only authorization. Implement service CRUD and enable/disable, barber duty/availability management, salon opening hours, online joining cutoff and today's statistics. Persist all changes and broadcast updates. Validate inputs on the server. Do not allow deleting a barber with active work or disabling a service already selected by an active customer in a way that corrupts that entry.

## Prompt 10 — Bilingual and UX audit
Audit every route in English and Gujarati. Translate labels, validation, toast messages, statuses, empty states and dialogs. Fix clipping, overflow, weak contrast, inconsistent spacing, small touch targets and keyboard accessibility. Preserve working functionality. Report each change and test mobile, tablet, desktop and TV breakpoints.

## Prompt 11 — End-to-end QA
Act as a senior QA engineer. Run the application and execute every checkbox in `docs/03-flows-rules.md`, not merely inspect source code. Test multiple browser windows, simultaneous joins/calls, refresh, backend restart, Socket.IO disconnect/reconnect, invalid inputs, all state transitions, role permissions and mobile layouts. Add automated tests for critical queue logic. Fix reproducible bugs without redesigning working screens. Provide PASS/FAIL with evidence and list untested items honestly. Do not claim success without actually testing.

## Prompt 12 — Deployment readiness
Prepare frontend for Vercel and backend for Render, with PostgreSQL hosted on Supabase. Check production build, server start command, health route, CORS allowlist, WebSocket support, environment variables, migrations and seed strategy. Search for accidental localhost URLs and secrets. Do not deploy yet. Give exact environment-variable names and provider dashboard steps for this repository.

## Prompt 13 — Deploy and verify
Deploy backend to Render and frontend to Vercel. Configure production environment variables and CORS using the actual deployed URLs. Apply database migrations and seed only safe demo data. Verify health endpoint, customer join, staff login, Call Next, barber Start/Done, TV update, refresh persistence and direct-route refresh on the live URL. Fix deployment-only failures. Put the verified live URL at the very top of `README.md`, immediately below the project title. Never invent a URL or claim deployment succeeded until the live site has been opened and tested.

## Prompt 14 — Submission package
Complete `README.md` with the verified live demo link first, hosted architecture, features, local setup, environment variable names (never values), test commands, screenshots, demo staff access instructions and known limitations. Ensure `prompts.md` contains every prompt actually used in order. Prepare a 3-minute demo script and a half-page reflection explaining one mistake the agent made, how it was detected and how the prompt/docs were improved. Check GitHub repository is public and contains no secrets, database dumps or private customer data.

## Reusable bug prompt
On `[route/screen]`, when I `[exact action]`, the actual result is `[what happened]`. The expected result from `docs/03-flows-rules.md` is `[expected behaviour]`. Reproduce it, explain the root cause, fix only the relevant code, add a regression test and report the commands/results. Do not redesign unrelated screens.

## Reusable visual refinement prompt
On `[route]`, change only `[specific component]`: `[precise layout, size, spacing, typography, colour and responsive behaviour]`. Preserve all existing actions, data flow and other screens. Show the changed files and verify the screen at `[viewport sizes]`.
