# AGENTS.md — Velora Salon Queue

You are the implementation agent for a real, deployable Salon Queue Management System.
The product requirements are authoritative in `docs/`. Read all three documents before coding.

## Read first
- `docs/01-brief.md`: users, scope, feature boundaries.
- `docs/02-screens.md`: all seven screens, UI, responsive behaviour and interactions.
- `docs/03-flows-rules.md`: queue rules, state transitions, edge cases and acceptance tests.
- `prompts.md`: approved implementation sequence and prompt history.

## Required stack
- Frontend: React, Vite, TypeScript, Tailwind CSS, React Router.
- Backend: Node.js, Express, TypeScript, Socket.IO.
- Database: hosted PostgreSQL (Supabase is the recommended provider); do not use SQLite or local JSON files for production data.
- Validation: Zod or an equivalent shared/server-side validation library.
- Tests: Vitest for frontend/unit tests and API/integration tests where practical.
- Hosting target: Vercel frontend + Render backend + hosted PostgreSQL.

Before implementing, inspect the current repository and report the proposed architecture and environment variables. Do not invent credentials or silently choose a paid service.

## Product and design rules
- Product name: Velora Salon Queue. Keep the brand name in one config/constants location.
- Visual direction: premium contemporary salon; warm ivory surfaces, deep forest-green typography/navigation, muted sage status colours, restrained copper accents. Avoid generic admin-template styling.
- Use a consistent spacing/type scale, polished empty/loading/error states, subtle motion, accessible contrast and visible focus states.
- Mobile-first customer screens; tablet-first Reception; phone-first Barber; 1920x1080 TV display.
- Touch targets should be at least 44px.
- Support English and Gujarati for all customer-facing and staff-facing UI labels. Store translations centrally; do not hard-code visible labels in components.
- Use realistic Indian names, INR prices and Indian phone-number validation. All demo data must be clearly marked as demo data.
- Do not use lorem ipsum, dead buttons, fake charts or decorative controls that do nothing.

## Engineering rules
- Queue selection, status transitions, token generation, phone-duplicate checks and wait-time calculations must live in server-side domain logic. Never trust client-calculated totals or queue decisions.
- Persist all business data in PostgreSQL. Never rely on browser localStorage as the source of truth.
- Use Socket.IO (or a clearly documented equivalent) for cross-device updates. Reconnect and refetch authoritative state after reconnect.
- Keep secrets in environment variables. Commit only `.env.example`, never `.env`.
- Validate and authorize every staff mutation on the server. Do not expose a hard-coded staff PIN or service-role database key in frontend code.
- Use database transactions for operations that must be atomic, especially token creation and queue mutations.
- Keep customer personal data minimal. Do not display full phone numbers on public TV screens.
- Make the smallest change needed for each task. Do not redesign unrelated working screens.
- After each task: list changed files, commands run, test results, known gaps and the next recommended step.
- Never claim a test passed unless you actually ran it. If a browser/device test cannot be performed, state that limitation.
- Do not deploy until local build and core flows pass. Deploy early once a stable vertical slice exists.
