import { runtimePool, query } from '../db/pool.js';
import {
  SALON_NAME,
  SALON_TIMEZONE,
  DEFAULT_ONLINE_CUTOFF_MINUTES,
  PublicSalonSummary,
  Service,
  Barber,
  BarberStatusEnum,
} from '@velora/shared';
import { calculateEstimatedWaitTime } from '../domain/waitEstimator.js';
import { getSalonDateString } from '../utils/date.js';

// Default Seed Data for local fallback when DATABASE_URL is not yet connected
const DEFAULT_SERVICES: Service[] = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    name_en: 'Haircut & Styling',
    name_gu: 'વાળ કાપવા અને સ્ટાઇલ',
    duration_minutes: 30,
    price_inr: 350,
    is_enabled: true,
    sort_order: 1,
  },
  {
    id: '11111111-1111-1111-1111-111111111102',
    name_en: 'Beard Trim & Shaping',
    name_gu: 'દાઢી ટ્રીમ અને આકાર',
    duration_minutes: 20,
    price_inr: 200,
    is_enabled: true,
    sort_order: 2,
  },
  {
    id: '11111111-1111-1111-1111-111111111103',
    name_en: 'Royal Hot Towel Shave',
    name_gu: 'રોયલ હોટ ટુવાલ શેવ',
    duration_minutes: 25,
    price_inr: 250,
    is_enabled: true,
    sort_order: 3,
  },
  {
    id: '11111111-1111-1111-1111-111111111104',
    name_en: 'Hair Spa & Scalp Therapy',
    name_gu: 'હેર સ્પા અને સ્કેલ્પ થેરાપી',
    duration_minutes: 45,
    price_inr: 800,
    is_enabled: true,
    sort_order: 4,
  },
  {
    id: '11111111-1111-1111-1111-111111111105',
    name_en: 'Herbal Facial & De-Tan',
    name_gu: 'હર્બલ ફેશિયલ અને ડી-ટેન',
    duration_minutes: 45,
    price_inr: 950,
    is_enabled: true,
    sort_order: 5,
  },
  {
    id: '11111111-1111-1111-1111-111111111106',
    name_en: 'Ayurvedic Head Massage',
    name_gu: 'આયુર્વેદિક હેડ મસાજ',
    duration_minutes: 20,
    price_inr: 250,
    is_enabled: true,
    sort_order: 6,
  },
];

const DEFAULT_BARBERS: Barber[] = [
  {
    id: '22222222-2222-2222-2222-222222222201',
    name: 'Aarav Patel',
    speciality: 'Classic Fades & Styling',
    is_on_duty: true,
    status: BarberStatusEnum.AVAILABLE,
  },
  {
    id: '22222222-2222-2222-2222-222222222202',
    name: 'Rohan Sharma',
    speciality: 'Beard Sculpting & Royal Shave',
    is_on_duty: true,
    status: BarberStatusEnum.AVAILABLE,
  },
  {
    id: '22222222-2222-2222-2222-222222222203',
    name: 'Vikram Dave',
    speciality: 'Hair Spa & Grooming',
    is_on_duty: true,
    status: BarberStatusEnum.ON_BREAK,
  },
  {
    id: '22222222-2222-2222-2222-222222222204',
    name: 'Kabir Mehta',
    speciality: 'Creative Cuts & Colour',
    is_on_duty: true,
    status: BarberStatusEnum.AVAILABLE,
  },
];

export class SalonService {
  /**
   * Check if salon is currently open based on Asia/Kolkata hours
   */
  static isSalonOpenNow(
    openingTimeStr: string = '09:00:00',
    closingTimeStr: string = '21:00:00',
    timezone: string = SALON_TIMEZONE
  ): { isOpen: boolean; currentKolkataTime: string } {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const currentKolkataTime = formatter.format(new Date());

    const isOpen = currentKolkataTime >= openingTimeStr && currentKolkataTime < closingTimeStr;
    return { isOpen, currentKolkataTime };
  }

  /**
   * Check if online joining is currently open
   */
  static isOnlineJoinOpen(
    isOpen: boolean,
    isOnlineEnabled: boolean,
    closingTimeStr: string = '21:00:00',
    cutoffMinutes: number = DEFAULT_ONLINE_CUTOFF_MINUTES,
    currentKolkataTime: string
  ): boolean {
    if (!isOpen || !isOnlineEnabled) return false;

    // Calculate cutoff time
    const [ch, cm] = closingTimeStr.split(':').map(Number);
    const closingTotalMinutes = ch * 60 + cm;
    const cutoffTotalMinutes = closingTotalMinutes - cutoffMinutes;

    const [curH, curM] = currentKolkataTime.split(':').map(Number);
    const currentTotalMinutes = curH * 60 + curM;

    return currentTotalMinutes < cutoffTotalMinutes;
  }

  /**
   * Get public summary for Home screen and customer status
   */
  static async getPublicSummary(): Promise<PublicSalonSummary> {
    if (runtimePool) {
      try {
        // Fetch salon settings
        const settingsRes = await query<{
          salon_name: string;
          timezone: string;
          opening_time: string;
          closing_time: string;
          online_cutoff_minutes: number;
          is_online_joining_enabled: boolean;
        }>('SELECT * FROM salon_settings WHERE id = 1');

        const settings = settingsRes.rows[0] || {
          salon_name: SALON_NAME,
          timezone: SALON_TIMEZONE,
          opening_time: '09:00:00',
          closing_time: '21:00:00',
          online_cutoff_minutes: 30,
          is_online_joining_enabled: true,
        };

        const { isOpen, currentKolkataTime } = this.isSalonOpenNow(
          settings.opening_time,
          settings.closing_time,
          settings.timezone
        );

        const isOnlineJoiningEnabled = this.isOnlineJoinOpen(
          isOpen,
          settings.is_online_joining_enabled,
          settings.closing_time,
          settings.online_cutoff_minutes,
          currentKolkataTime
        );

        // Fetch enabled services
        const servicesRes = await query<Service>(
          'SELECT id, name_en, name_gu, duration_minutes, price_inr::numeric, is_enabled, sort_order FROM services WHERE is_enabled = true ORDER BY sort_order ASC'
        );

        // Fetch on-duty barbers
        const barbersRes = await query<Barber>(
          'SELECT id, name, speciality, is_on_duty, status FROM barbers WHERE is_on_duty = true ORDER BY name ASC'
        );

        // Fetch waiting count
        const waitingRes = await query<{ count: string }>(
          "SELECT COUNT(*) as count FROM queue_entries WHERE status = 'WAITING' AND salon_date = $1",
          [getSalonDateString()]
        );
        const waitingCount = parseInt(waitingRes.rows[0]?.count || '0', 10);

        // Compute approx wait
        const approxWaitMinutes = calculateEstimatedWaitTime({
          targetItem: { joinedAt: new Date() },
          barbers: barbersRes.rows.map((b) => ({
            barberId: b.id,
            isOnDuty: b.is_on_duty,
            status: b.status,
          })),
          waitingQueue: [],
        });

        return {
          salon: {
            name: settings.salon_name,
            timezone: settings.timezone,
            isOpen,
            isOnlineJoiningEnabled,
            openingTime: settings.opening_time,
            closingTime: settings.closing_time,
            onlineCutoffMinutes: settings.online_cutoff_minutes,
          },
          stats: {
            waitingCount,
            approxWaitMinutes: approxWaitMinutes || (waitingCount > 0 ? waitingCount * 15 : 0),
            onDutyBarbersCount: barbersRes.rows.length,
          },
          barbers: barbersRes.rows,
          services: servicesRes.rows,
        };
      } catch (err) {
        console.warn('[SalonService] Error querying PostgreSQL, using fallback:', err);
      }
    }

    // In-memory fallback
    const { isOpen, currentKolkataTime } = this.isSalonOpenNow();
    const isOnlineJoiningEnabled = this.isOnlineJoinOpen(isOpen, true, '21:00:00', 30, currentKolkataTime);
    const { memoryQueue } = await import('./queueService.js');
    const today = getSalonDateString();
    const waitingCount = memoryQueue.filter(
      (entry) => entry.status === 'WAITING' && entry.salon_date === today
    ).length;

    return {
      salon: {
        name: SALON_NAME,
        timezone: SALON_TIMEZONE,
        isOpen,
        isOnlineJoiningEnabled,
        openingTime: '09:00:00',
        closingTime: '21:00:00',
        onlineCutoffMinutes: 30,
      },
      stats: {
        waitingCount,
        approxWaitMinutes: waitingCount > 0 ? waitingCount * 15 : null,
        onDutyBarbersCount: DEFAULT_BARBERS.filter((b) => b.is_on_duty).length,
      },
      barbers: DEFAULT_BARBERS,
      services: DEFAULT_SERVICES,
    };
  }

  static async getServices(): Promise<Service[]> {
    const summary = await this.getPublicSummary();
    return summary.services;
  }

  static async getBarbers(): Promise<Barber[]> {
    const summary = await this.getPublicSummary();
    return summary.barbers;
  }
}
