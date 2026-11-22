import { z } from 'zod';

// Brand & Localization Constants
export const SALON_NAME = 'Velora Salon';
export const SALON_TIMEZONE = 'Asia/Kolkata';
export const DEFAULT_ONLINE_CUTOFF_MINUTES = 30;

// Queue Status Model
export const QueueStatusEnum = {
  WAITING: 'WAITING',
  CALLED: 'CALLED',
  IN_SERVICE: 'IN_SERVICE',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;

export type QueueStatus = (typeof QueueStatusEnum)[keyof typeof QueueStatusEnum];

// Barber Status Model
export const BarberStatusEnum = {
  AVAILABLE: 'AVAILABLE',
  BUSY: 'BUSY',
  ON_BREAK: 'ON_BREAK',
} as const;

export type BarberStatus = (typeof BarberStatusEnum)[keyof typeof BarberStatusEnum];

// Staff Roles
export const StaffRoleEnum = {
  RECEPTIONIST: 'RECEPTIONIST',
  BARBER: 'BARBER',
  OWNER: 'OWNER',
} as const;

export type StaffRole = (typeof StaffRoleEnum)[keyof typeof StaffRoleEnum];

// Indian Mobile Number Validator & Normalizer
export const INDIAN_PHONE_REGEX = /^(?:\+91|91|0)?[6-9]\d{9}$/;

export function normalizeIndianPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    return `+91${digits.slice(2)}`;
  }
  throw new Error('Invalid Indian mobile number. Must be a 10-digit number starting with 6, 7, 8, or 9.');
}

// Indian Phone Zod Schema
export const IndianPhoneSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      try {
        normalizeIndianPhone(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).' }
  )
  .transform((val) => normalizeIndianPhone(val));

// Service Model
export const ServiceSchema = z.object({
  id: z.string().uuid(),
  name_en: z.string().min(2).max(100),
  name_gu: z.string().min(2).max(100),
  duration_minutes: z.number().int().min(5).max(240),
  price_inr: z.number().min(0),
  is_enabled: z.boolean(),
  sort_order: z.number().int().default(0),
});

export type Service = z.infer<typeof ServiceSchema>;

// Barber Model
export const BarberSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100),
  speciality: z.string().max(150).nullable().optional(),
  is_on_duty: z.boolean(),
  status: z.nativeEnum(BarberStatusEnum),
});

export type Barber = z.infer<typeof BarberSchema>;

// Join Queue DTO Schema
export const JoinQueueInputSchema = z.object({
  customer_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name must be 60 characters or less'),
  customer_phone: IndianPhoneSchema,
  service_ids: z.array(z.string().uuid()).min(1, 'Select at least one service').max(3, 'Select up to 3 services'),
  preferred_barber_id: z.string().uuid().nullable().optional(), // null or undefined means "Any"
  is_walk_in: z.boolean().default(false),
});

export type JoinQueueInput = z.infer<typeof JoinQueueInputSchema>;

// Join Queue Response
export interface JoinQueueResponse {
  success: boolean;
  isExisting: boolean;
  entry: {
    id: string;
    public_id: string;
    daily_token: number;
    salon_date: string;
    customer_name: string;
    customer_phone: string;
    preferred_barber_id: string | null;
    status: QueueStatus;
    total_duration_minutes: number;
    total_price_inr: number;
    is_walk_in: boolean;
    joined_at: string;
  };
}

// Detailed Customer Status Response for /status/:publicId
export interface CustomerQueueStatusResponse {
  public_id: string;
  daily_token: number;
  salon_date: string;
  customer_name: string;
  status: QueueStatus;
  preferred_barber_id: string | null;
  preferred_barber_name: string | null;
  assigned_barber_id: string | null;
  assigned_barber_name: string | null;
  total_duration_minutes: number;
  total_price_inr: number;
  is_walk_in: boolean;
  position_ahead: number | null;
  estimated_wait_minutes: number | null;
  services: Array<{
    name_en: string;
    name_gu: string;
    duration_minutes: number;
    price_inr: number;
  }>;
  joined_at: string;
  called_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  cancelled_at: string | null;
}

// Public Salon Summary (for Home page & live status)
export interface PublicSalonSummary {
  salon: {
    name: string;
    timezone: string;
    isOpen: boolean;
    isOnlineJoiningEnabled: boolean;
    openingTime: string;
    closingTime: string;
    onlineCutoffMinutes: number;
  };
  stats: {
    waitingCount: number;
    approxWaitMinutes: number | null;
    onDutyBarbersCount: number;
  };
  barbers: Barber[];
  services: Service[];
}

// Allowed Status Transitions Map
export const ALLOWED_STATUS_TRANSITIONS: Record<QueueStatus, readonly QueueStatus[]> = {
  [QueueStatusEnum.WAITING]: [QueueStatusEnum.CALLED, QueueStatusEnum.CANCELLED],
  [QueueStatusEnum.CALLED]: [QueueStatusEnum.IN_SERVICE, QueueStatusEnum.NO_SHOW],
  [QueueStatusEnum.IN_SERVICE]: [QueueStatusEnum.DONE],
  [QueueStatusEnum.DONE]: [],
  [QueueStatusEnum.CANCELLED]: [],
  [QueueStatusEnum.NO_SHOW]: [],
};

export function isValidStatusTransition(from: QueueStatus, to: QueueStatus): boolean {
  const allowed = ALLOWED_STATUS_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

// Health Check Response Schema
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  salonName: z.string(),
  timezone: z.string(),
  timestamp: z.string(),
  database: z.enum(['connected', 'not_configured', 'unavailable']).optional(),
  persistent: z.boolean().optional(),
  socketConnectedClients: z.number().optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// =========================================================================
// Staff / Display / Admin API contracts (additive; shared by backend + frontend)
// =========================================================================

export interface StaffUserPublic {
  id: string;
  username: string;
  full_name: string;
  role: StaffRole;
  barber_id: string | null;
}

export interface LoginResponse {
  token: string;
  expires_in_seconds: number;
  user: StaffUserPublic;
}

export const LoginInputSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
});

export interface StaffQueueEntry {
  id: string;
  daily_token: number;
  status: QueueStatus;
  customer_name: string;
  customer_phone: string; // staff-only; never exposed on public endpoints
  preferred_barber_id: string | null;
  preferred_barber_name: string | null;
  assigned_barber_id: string | null;
  total_duration_minutes: number;
  total_price_inr: number;
  is_walk_in: boolean;
  services: Array<{ name_en: string; name_gu: string; duration_minutes: number }>;
  joined_at: string;
  called_at: string | null;
  started_at: string | null;
  position_ahead: number | null; // WAITING only
  estimated_wait_minutes: number | null; // WAITING only; null = unavailable
}

export interface StaffBarber {
  id: string;
  name: string;
  speciality: string | null;
  is_on_duty: boolean;
  status: BarberStatus;
  active_entry_id: string | null;
}

export interface StaffBoardResponse {
  salon_date: string;
  server_time: string;
  stats: {
    waiting: number;
    called: number;
    in_service: number;
    done: number;
    cancelled: number;
    no_show: number;
    avg_wait_minutes: number | null;
  };
  barbers: StaffBarber[];
  entries: StaffQueueEntry[]; // today's entries, oldest first
}

export interface DisplayResponse {
  salon_name: string;
  server_time: string;
  stations: Array<{
    barber_name: string;
    state: 'SERVING' | 'CALLED' | 'AVAILABLE' | 'ON_BREAK';
    token: number | null;
  }>;
  next: Array<{
    token: number;
    preferred_barber_name: string | null;
    estimated_wait_minutes: number | null;
  }>;
  waiting_count: number;
}

export interface AdminSettingsResponse {
  settings: {
    salon_name: string;
    opening_time: string; // HH:MM:SS
    closing_time: string;
    online_cutoff_minutes: number;
    is_online_joining_enabled: boolean;
  };
  services: Service[]; // including disabled
  barbers: StaffBarber[];
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const AdminSettingsPatchSchema = z
  .object({
    is_online_joining_enabled: z.boolean().optional(),
    opening_time: z.string().regex(TIME_REGEX, 'Use HH:MM').optional(),
    closing_time: z.string().regex(TIME_REGEX, 'Use HH:MM').optional(),
    online_cutoff_minutes: z.number().int().min(0).max(240).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes supplied' });

export const BarberAvailabilityPatchSchema = z
  .object({
    status: z.enum(['AVAILABLE', 'ON_BREAK']).optional(),
    is_on_duty: z.boolean().optional(),
  })
  .refine((v) => v.status !== undefined || v.is_on_duty !== undefined, { message: 'No changes supplied' });
