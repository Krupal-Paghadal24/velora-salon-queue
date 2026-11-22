-- 001_initial_schema.sql
-- Velora Salon Queue Management System Schema

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Salon Configuration & Business Settings (Single-row design)
CREATE TABLE IF NOT EXISTS salon_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  salon_name VARCHAR(100) NOT NULL DEFAULT 'Velora Salon',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  opening_time TIME NOT NULL DEFAULT '09:00:00',
  closing_time TIME NOT NULL DEFAULT '21:00:00',
  online_cutoff_minutes INTEGER NOT NULL DEFAULT 30 CHECK (online_cutoff_minutes >= 0),
  is_online_joining_enabled BOOLEAN NOT NULL DEFAULT true,
  address_line TEXT DEFAULT 'Shop 4, Heritage Arcade, C.G. Road, Ahmedabad',
  contact_phone VARCHAR(20) DEFAULT '+91 98765 43210',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Services Catalogue (Bilingual EN/GU, pricing in INR)
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en VARCHAR(100) NOT NULL,
  name_gu VARCHAR(100) NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 5 AND duration_minutes <= 240),
  price_inr NUMERIC(10, 2) NOT NULL CHECK (price_inr >= 0),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Barbers & Workstation Roster
CREATE TABLE IF NOT EXISTS barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  speciality VARCHAR(150),
  is_on_duty BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BUSY', 'ON_BREAK')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Staff Accounts & RBAC
CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('RECEPTIONIST', 'BARBER', 'OWNER')),
  barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Daily Token Counters (Strictly partitioned by Asia/Kolkata date)
CREATE TABLE IF NOT EXISTS daily_token_counters (
  salon_date DATE PRIMARY KEY,
  last_token_number INTEGER NOT NULL DEFAULT 0 CHECK (last_token_number >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Queue Entries (Central state engine)
CREATE TABLE IF NOT EXISTS queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id VARCHAR(32) NOT NULL UNIQUE,
  daily_token INTEGER NOT NULL CHECK (daily_token > 0),
  salon_date DATE NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  preferred_barber_id UUID REFERENCES barbers(id) ON DELETE RESTRICT,
  assigned_barber_id UUID REFERENCES barbers(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'CALLED', 'IN_SERVICE', 'DONE', 'CANCELLED', 'NO_SHOW')),
  total_duration_minutes INTEGER NOT NULL CHECK (total_duration_minutes > 0),
  total_price_inr NUMERIC(10, 2) NOT NULL CHECK (total_price_inr >= 0),
  is_walk_in BOOLEAN NOT NULL DEFAULT false,
  cancellation_reason TEXT,
  cancelled_by VARCHAR(20) CHECK (cancelled_by IN ('CUSTOMER', 'STAFF')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  called_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_date_token UNIQUE (salon_date, daily_token)
);

-- 7. Queue Entry Services (Junction table with snapshotting of service details)
CREATE TABLE IF NOT EXISTS queue_entry_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_entry_id UUID NOT NULL REFERENCES queue_entries(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  service_name_en VARCHAR(100) NOT NULL,
  service_name_gu VARCHAR(100) NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 5 AND duration_minutes <= 240),
  price_inr NUMERIC(10, 2) NOT NULL CHECK (price_inr >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Queue Status Transition Logs (Audit history)
CREATE TABLE IF NOT EXISTS queue_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_entry_id UUID NOT NULL REFERENCES queue_entries(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  changed_by_role VARCHAR(20) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- Critical Domain Constraints & Partial Indexes
-- =========================================================================

-- Constraint A: Exactly 1 active entry per customer phone (WAITING, CALLED, IN_SERVICE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_phone
ON queue_entries (customer_phone)
WHERE status IN ('WAITING', 'CALLED', 'IN_SERVICE');

-- Constraint B: A barber can have at most ONE active customer (CALLED or IN_SERVICE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_barber_single_active
ON queue_entries (assigned_barber_id)
WHERE status IN ('CALLED', 'IN_SERVICE');

-- Index C: Fast FCFS queue ordering by date and timestamp
CREATE INDEX IF NOT EXISTS idx_queue_waiting_order
ON queue_entries (salon_date, joined_at, id)
WHERE status = 'WAITING';

-- Index D: Public tracking ID lookup
CREATE INDEX IF NOT EXISTS idx_queue_public_id
ON queue_entries (public_id);

-- Index E: Fast lookup by barber and status
CREATE INDEX IF NOT EXISTS idx_queue_assigned_barber
ON queue_entries (assigned_barber_id, status);

CREATE INDEX IF NOT EXISTS idx_queue_status
ON queue_entries (status);
