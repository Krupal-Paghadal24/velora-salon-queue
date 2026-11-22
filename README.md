# Velora Salon Queue Management System

**Live demo:** [Deployment in Phase 13]
**Hosted on:** Vercel (Frontend) + Render (API / WebSocket) + Supabase PostgreSQL (Database)

## About
Velora is a salon queue management web application designed for a single-branch salon operating in the `Asia/Kolkata` timezone with Indian Rupee (₹) pricing. Customers join a live queue and track their token; receptionists manage walk-ins and barber assignments; barbers update service progress; a TV display shows current tokens; owners configure services and salon operations.

## Features
- Customer queue joining and private live tracking
- Reception dashboard and walk-in registration
- Barber-specific service workflow
- Waiting-area TV display
- Owner settings for services, staff and salon hours
- English/Gujarati interface
- Persistent PostgreSQL storage and real-time updates via Socket.IO

## Architecture & Technical Decisions
- **Monorepo:** npm workspaces (`shared`, `backend`, `frontend`)
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Socket.IO Client
- **Backend:** Node.js, Express, TypeScript, Socket.IO, `pg` (PostgreSQL client)
- **Database:** Supabase PostgreSQL Free Tier
- **Database Connection Strategy (Render IPv4 Compatibility):**
  - **Runtime:** Connects via Supabase Transaction Pooler on port `6543` (`aws-0-[REGION].pooler.supabase.com:6543`).
  - **Migrations:** Connects via Supabase Session Pooler on port `5432` (`aws-0-[REGION].pooler.supabase.com:5432`).
  - **Note:** Never rely on the direct `db.[PROJECT_REF].supabase.co` hostname from Render Free, as it resolves to IPv6 while Render Free is IPv4-only.

## Database Design & Entity Relationships

### Entity Relationship Model
```
┌─────────────────────┐
│   salon_settings    │ (Single row configuration, timezone, hours, cutoff)
└─────────────────────┘

┌─────────────────────┐       ┌──────────────────────┐
│       barbers       │◄──────┤     staff_users      │ (Role-based access)
└──────────┬──────────┘       └──────────────────────┘
           │
           │ (assigned_barber_id / preferred_barber_id)
           ▼
┌─────────────────────┐       ┌──────────────────────┐
│    queue_entries    │◄──────┤ queue_entry_services │ (Snapshotted service price & duration)
└──────────┬──────────┘       └──────────┬───────────┘
           │                             │
           │                             ▼
           │                  ┌──────────────────────┐
           │                  │       services       │ (Catalogue: EN/GU, INR price, duration)
           ▼                  └──────────────────────┘
┌─────────────────────┐
│  queue_status_logs  │ (Audit trail of state transitions)
└─────────────────────┘

┌─────────────────────┐
│daily_token_counters │ (Asia/Kolkata atomic daily sequence generator)
└─────────────────────┘
```

### Table Descriptions
1. **`salon_settings`**: Single-row configuration storing salon name, Asia/Kolkata timezone, opening/closing hours, online cutoff minutes, and online joining enable toggle.
2. **`services`**: Salon catalog with English name, Gujarati name, duration in minutes (5–240), price in INR (>= 0), enabled status, and display sort order.
3. **`barbers`**: Working barbers with name, speciality, duty status (`is_on_duty`), and availability (`AVAILABLE`, `BUSY`, `ON_BREAK`).
4. **`staff_users`**: Staff accounts with username, scrypt password hash, full name, role (`RECEPTIONIST`, `BARBER`, `OWNER`), and optional linked barber ID.
5. **`daily_token_counters`**: Atomic token sequence tracking per `salon_date` (`YYYY-MM-DD` strictly in `Asia/Kolkata`).
6. **`queue_entries`**: Authoritative queue records with `public_id` (cryptographic unguessable URL token), `daily_token`, customer name, normalized phone (`+91XXXXXXXXXX`), preferred/assigned barber, status, duration/price snapshot, and timestamps.
7. **`queue_entry_services`**: Junction table recording chosen services with snapshot of duration and price at the exact moment of joining.
8. **`queue_status_logs`**: Historical audit log recording every queue state transition with actor and timestamp.
9. **`schema_migrations`**: Tracks version-controlled migration files applied to the database.

### Important Constraints & Partial Indexes
- **Single Active Customer Per Phone:**
  `CREATE UNIQUE INDEX idx_unique_active_phone ON queue_entries (customer_phone) WHERE status IN ('WAITING', 'CALLED', 'IN_SERVICE');`
  Enforces at the database level that a customer cannot join multiple times while already active.
- **Single Active Customer Per Barber:**
  `CREATE UNIQUE INDEX idx_barber_single_active ON queue_entries (assigned_barber_id) WHERE status IN ('CALLED', 'IN_SERVICE');`
  Strictly prevents concurrency anomalies where two customers could be called or in service with the same barber.
- **Unique Daily Token:**
  `CONSTRAINT uq_date_token UNIQUE (salon_date, daily_token);`
  Guarantees sequential token numbers never collide within the same calendar day.
- **Queue Ordering Index:**
  `CREATE INDEX idx_queue_waiting_order ON queue_entries (salon_date, joined_at, id) WHERE status = 'WAITING';`
  Enforces fast First-Come, First-Served queue retrieval.

## Queue Business Rules
1. **Forward-Only State Machine:**
   `WAITING` → `CALLED` → `IN_SERVICE` → `DONE`
   `WAITING` → `CANCELLED` (Customer or Staff)
   `CALLED` → `NO_SHOW` (Staff after 10m)
   Terminal states: `DONE`, `CANCELLED`, `NO_SHOW`. No backward or skipping transitions allowed.
2. **Barber Compatibility:**
   - Specific barber preference is strictly preserved; another barber cannot be assigned.
   - Customers choosing "Any available barber" can be taken by whichever eligible on-duty barber clicks "Call Next" first.
   - Barbers who are `On Break` or `Off Duty` cannot receive new customer calls.
3. **Wait-Time Estimation:**
   - Specific Barber: (Remaining minutes on current service) + (Sum of durations of compatible waiting customers ahead).
   - "Any Available Barber": (Sum of remaining times across all on-duty barbers + waiting customer durations ahead) divided by the number of on-duty barbers.
   - Rounded up to whole minutes, never negative; shows "Wait time unavailable" when no barbers are on duty.

## Migrations and Seed Data

### Run Migrations
Applies unapplied SQL migrations using the Supabase Session Pooler (port `5432`):
```bash
npm run db:migrate --workspace=@velora/backend
```

### Seed Demo Data
Idempotently inserts default salon settings, services (EN/GU), realistic barbers, and staff accounts:
```bash
npm run db:seed --workspace=@velora/backend
```

*Demo staff accounts created with password `demo123`:*
- Owner: `owner`
- Receptionist: `reception`
- Barbers: `aarav`, `rohan`

## Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy the example environment files:
```bash
# In backend/
copy backend\.env.example backend\.env

# In frontend/
copy frontend\.env.example frontend\.env
```

### 3. Run Development Servers
**Terminal 1 (Backend):**
```bash
npm run dev:backend
```

**Terminal 2 (Frontend):**
```bash
npm run dev:frontend
```

### 4. Build, Typecheck & Test
```bash
npm run build
npm run typecheck
npm run test
```

## Environment Variables

### Backend (`backend/.env`)
- `PORT`: HTTP port for Express server (default `5000`)
- `NODE_ENV`: Environment mode (`development` | `production`)
- `SALON_TIMEZONE`: Timezone for salon operations (default `Asia/Kolkata`)
- `DEFAULT_SALON_NAME`: Brand name (default `Velora Salon`)
- `DATABASE_URL`: Supabase Transaction Pooler URI (port `6543`)
- `MIGRATION_URL`: Supabase Session Pooler URI (port `5432`)
- `DATABASE_SSL_CA`: Path to the Supabase CA certificate; required in production for certificate and server identity verification
- `JWT_SECRET`: In-house JWT secret for staff sessions
- `JWT_EXPIRES_IN`: JWT expiration window (e.g. `8h`)
- `CORS_ORIGIN`: Allowed frontend origin (e.g. `http://localhost:5173`)

### Frontend (`frontend/.env`)
- `VITE_API_URL`: Backend REST API URL (e.g. `http://localhost:5000`)
- `VITE_WS_URL`: Backend Socket.IO URL (e.g. `http://localhost:5000`)

## Staff Screens, Roles & Demo Accounts
Staff screens require sign-in (HMAC-signed token, 8h, no external auth service). Seeded **demo** accounts (password `demo123` for all; change/remove before any real use):

| Username | Role | Can open |
|---|---|---|
| `reception` | Receptionist | `/reception`, `/barber` |
| `aarav`, `rohan` | Barber (own station only) | `/barber` |
| `owner` | Owner | everything incl. `/admin` |

The TV display (`/display`) is public and shows token numbers and barber names only.

## API Summary
Public: `POST /api/queue/join`, `GET /api/queue/:publicId`, `POST /api/queue/:publicId/cancel`, `GET /api/salon/status`, `GET /api/services`, `GET /api/barbers`, `GET /api/display`
Auth: `POST /api/auth/login`, `GET /api/auth/me`
Staff (Bearer token): `GET /api/staff/queue`, `GET /api/staff/barber/:id`, `POST /api/staff/queue/call-next`, `POST /api/staff/queue/:id/{start|finish|no-show|cancel}`, `POST /api/staff/walk-in`, `PATCH /api/staff/barbers/:id/availability`
Owner: `GET|PATCH /api/admin/settings`, `PATCH /api/admin/services/:id`

All queue transitions go through `QueueEngine` (transactions + row locks); routes are thin wrappers.

## Testing
- Backend domain & queue tests: `npm run test --workspace=@velora/backend`
- Frontend tests: `npm run test --workspace=@velora/frontend`
- Full API flow tests against a real PostgreSQL (skipped unless set; **truncates queue tables** - use a throwaway database only):
  `TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/velora_test npm run test --workspace=@velora/backend`
  (run `npm run db:migrate && npm run db:seed` against that database first)

## Deployment Notes
- Render (backend): set `NODE_ENV=production`, `DATABASE_URL`, `CORS_ORIGIN` (your exact Vercel URL), and a random `JWT_SECRET` of 32+ characters. The server refuses to start in production without it.
- For production PostgreSQL TLS, configure `DATABASE_SSL_CA` with the Supabase CA certificate file path. In local development only, `sslmode=require` falls back to encrypted TLS without verifying server identity when no CA file is configured; do not use that fallback in production.
- Vercel (frontend): set `VITE_API_URL` and `VITE_WS_URL` to the Render URL. `frontend/vercel.json` rewrites all routes to `index.html` so refreshing `/status/...` works.

## Known Limitations
- Wait time is an approximation. For "Any barber" customers it divides workload across all on-duty barbers, including ones currently on break.
- Staff cancel is only possible while Waiting (per the transition rules); a Called customer who does not arrive is marked No-Show.
- Entries left open from a previous salon day are auto-closed (Waiting -> Cancelled, Called -> No-Show, In Service -> Done) the first time any screen loads on a new day.
- Owner settings cover online-joining switch, hours/cutoff, service enable/disable and barber duty. Adding/editing services, prices and staff accounts is not implemented.
- Staff tokens are kept in `sessionStorage` per tab and are not revocable before expiry.
- The in-memory fallback in `QueueService` (used when `DATABASE_URL` is unset) only supports join/track/cancel; all staff, display and admin features require PostgreSQL.
