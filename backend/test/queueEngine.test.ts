import { describe, it, expect } from 'vitest';
import {
  QueueStatusEnum,
  isValidStatusTransition,
  normalizeIndianPhone,
  IndianPhoneSchema,
} from '@velora/shared';
import { InMemoryTokenGenerator } from '../src/domain/tokenService.js';
import { canMarkNoShow, selectNextCompatibleEntry } from '../src/domain/queueEngine.js';
import { calculateEstimatedWaitTime } from '../src/domain/waitEstimator.js';

describe('Queue Domain Rules', () => {
  describe('Indian Mobile Phone Normalization & Validation', () => {
    it('normalizes 10-digit Indian numbers starting with 6, 7, 8, 9', () => {
      expect(normalizeIndianPhone('9876543210')).toBe('+919876543210');
      expect(normalizeIndianPhone('8123456789')).toBe('+918123456789');
      expect(normalizeIndianPhone('7000012345')).toBe('+917000012345');
      expect(normalizeIndianPhone('6398765432')).toBe('+916398765432');
    });

    it('normalizes numbers with spaces, dashes, +91, 91, or leading 0', () => {
      expect(normalizeIndianPhone('+91 98765 43210')).toBe('+919876543210');
      expect(normalizeIndianPhone('91-9876543210')).toBe('+919876543210');
      expect(normalizeIndianPhone('09876543210')).toBe('+919876543210');
    });

    it('rejects invalid or foreign numbers', () => {
      expect(() => normalizeIndianPhone('1234567890')).toThrow(); // Starts with 1
      expect(() => normalizeIndianPhone('98765')).toThrow(); // Too short
      expect(() => normalizeIndianPhone('9876543210123')).toThrow(); // Too long
      expect(() => normalizeIndianPhone('abcdefghij')).toThrow();
    });

    it('Zod IndianPhoneSchema validates and transforms correctly', () => {
      const parsed = IndianPhoneSchema.safeParse('  98765 43210  ');
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toBe('+919876543210');
      }
    });
  });

  describe('Status Transition State Machine', () => {
    it('allows valid forward-only transitions', () => {
      expect(isValidStatusTransition(QueueStatusEnum.WAITING, QueueStatusEnum.CALLED)).toBe(true);
      expect(isValidStatusTransition(QueueStatusEnum.WAITING, QueueStatusEnum.CANCELLED)).toBe(true);
      expect(isValidStatusTransition(QueueStatusEnum.CALLED, QueueStatusEnum.IN_SERVICE)).toBe(true);
      expect(isValidStatusTransition(QueueStatusEnum.CALLED, QueueStatusEnum.NO_SHOW)).toBe(true);
      expect(isValidStatusTransition(QueueStatusEnum.IN_SERVICE, QueueStatusEnum.DONE)).toBe(true);
    });

    it('strictly forbids invalid, backward, or terminal transitions', () => {
      // Backward transitions
      expect(isValidStatusTransition(QueueStatusEnum.CALLED, QueueStatusEnum.WAITING)).toBe(false);
      expect(isValidStatusTransition(QueueStatusEnum.IN_SERVICE, QueueStatusEnum.CALLED)).toBe(false);
      expect(isValidStatusTransition(QueueStatusEnum.DONE, QueueStatusEnum.IN_SERVICE)).toBe(false);

      // Skipping steps
      expect(isValidStatusTransition(QueueStatusEnum.WAITING, QueueStatusEnum.IN_SERVICE)).toBe(false);
      expect(isValidStatusTransition(QueueStatusEnum.WAITING, QueueStatusEnum.DONE)).toBe(false);

      // Terminal state escapes
      expect(isValidStatusTransition(QueueStatusEnum.DONE, QueueStatusEnum.WAITING)).toBe(false);
      expect(isValidStatusTransition(QueueStatusEnum.CANCELLED, QueueStatusEnum.WAITING)).toBe(false);
      expect(isValidStatusTransition(QueueStatusEnum.NO_SHOW, QueueStatusEnum.WAITING)).toBe(false);
    });
  });

  describe('Daily Token Generation Logic', () => {
    it('increments tokens sequentially within the same day', () => {
      const generator = new InMemoryTokenGenerator();
      const date = new Date('2026-11-22T10:00:00+05:30');

      const t1 = generator.getNextDailyToken(date);
      const t2 = generator.getNextDailyToken(date);
      const t3 = generator.getNextDailyToken(date);

      expect(t1.tokenNumber).toBe(1);
      expect(t2.tokenNumber).toBe(2);
      expect(t3.tokenNumber).toBe(3);
      expect(t1.salonDate).toBe('2026-11-22');
    });

    it('resets token sequence when date changes to next day', () => {
      const generator = new InMemoryTokenGenerator();
      const day1 = new Date('2026-11-22T23:55:00+05:30');
      const day2 = new Date('2026-11-23T09:15:00+05:30');

      generator.getNextDailyToken(day1);
      generator.getNextDailyToken(day1);

      const nextDayToken = generator.getNextDailyToken(day2);
      expect(nextDayToken.salonDate).toBe('2026-11-23');
      expect(nextDayToken.tokenNumber).toBe(1);
    });
  });

  describe('Barber Compatibility & Queue Ordering (FCFS)', () => {
    const barberA = 'barber-a-id';
    const barberB = 'barber-b-id';

    const queue = [
      {
        id: 'cust-1',
        customer_name: 'Amit',
        preferred_barber_id: barberB, // Chose Barber B
        joined_at: new Date('2026-11-22T10:00:00Z'),
      },
      {
        id: 'cust-2',
        customer_name: 'Dhaval',
        preferred_barber_id: null, // Chose Any
        joined_at: new Date('2026-11-22T10:05:00Z'),
      },
      {
        id: 'cust-3',
        customer_name: 'Chirag',
        preferred_barber_id: barberA, // Chose Barber A
        joined_at: new Date('2026-11-22T10:10:00Z'),
      },
    ];

    it('Barber A calling next skips earlier customer who requested Barber B and picks earliest compatible entry', () => {
      // cust-1 requested Barber B, so Barber A must skip cust-1 and pick cust-2 (Any)
      const next = selectNextCompatibleEntry(barberA, queue);
      expect(next).not.toBeNull();
      expect(next?.id).toBe('cust-2');
    });

    it('Barber B calling next picks cust-1 first because cust-1 requested Barber B and joined earliest', () => {
      const next = selectNextCompatibleEntry(barberB, queue);
      expect(next).not.toBeNull();
      expect(next?.id).toBe('cust-1');
    });

    it('Never assigns a specific-preference customer to the wrong barber', () => {
      const specificQueueOnly = [
        {
          id: 'cust-b-only',
          customer_name: 'Manoj',
          preferred_barber_id: barberB,
          joined_at: new Date('2026-11-22T10:00:00Z'),
        },
      ];

      const forBarberA = selectNextCompatibleEntry(barberA, specificQueueOnly);
      expect(forBarberA).toBeNull(); // Barber A cannot take Manoj!
    });
  });

  describe('Wait Time Estimation Algorithm', () => {
    const barberA = 'barber-a';
    const barberB = 'barber-b';

    it('calculates wait time for a specific barber including current service remaining time', () => {
      const now = new Date('2026-11-22T10:20:00Z');
      const barbers = [
        {
          barberId: barberA,
          isOnDuty: true,
          status: 'BUSY' as const,
          activeServiceDurationMinutes: 30,
          activeServiceStartedAt: new Date('2026-11-22T10:10:00Z'), // 10m elapsed -> 20m remaining
        },
      ];

      const waitingQueue = [
        {
          id: 'wait-1',
          preferredBarberId: barberA,
          totalDurationMinutes: 25,
          joinedAt: new Date('2026-11-22T10:05:00Z'), // ahead of target
        },
      ];

      const targetItem = {
        preferredBarberId: barberA,
        joinedAt: new Date('2026-11-22T10:15:00Z'),
      };

      // Remaining on active = 30 - 10 = 20 min
      // Workload ahead = 25 min
      // Expected = 20 + 25 = 45 min
      const estimate = calculateEstimatedWaitTime({
        targetItem,
        barbers,
        waitingQueue,
        now,
      });

      expect(estimate).toBe(45);
    });

    it('calculates wait time for "Any" customer divided by eligible on-duty barbers', () => {
      const now = new Date('2026-11-22T10:00:00Z');
      const barbers = [
        {
          barberId: barberA,
          isOnDuty: true,
          status: 'AVAILABLE' as const,
          activeServiceDurationMinutes: 0,
          activeServiceStartedAt: null,
        },
        {
          barberId: barberB,
          isOnDuty: true,
          status: 'AVAILABLE' as const,
          activeServiceDurationMinutes: 0,
          activeServiceStartedAt: null,
        },
      ];

      const waitingQueue = [
        {
          id: 'w1',
          preferredBarberId: null,
          totalDurationMinutes: 30,
          joinedAt: new Date('2026-11-22T09:50:00Z'),
        },
        {
          id: 'w2',
          preferredBarberId: null,
          totalDurationMinutes: 30,
          joinedAt: new Date('2026-11-22T09:55:00Z'),
        },
      ];

      const targetItem = {
        preferredBarberId: null,
        joinedAt: new Date('2026-11-22T10:00:00Z'),
      };

      // Total workload = 30 + 30 = 60 min
      // 2 on-duty barbers -> 60 / 2 = 30 min
      const estimate = calculateEstimatedWaitTime({
        targetItem,
        barbers,
        waitingQueue,
        now,
      });

      expect(estimate).toBe(30);
    });

    it('returns null (Wait time unavailable) when no barbers are on duty', () => {
      const estimate = calculateEstimatedWaitTime({
        targetItem: {
          preferredBarberId: null,
          joinedAt: new Date(),
        },
        barbers: [
          {
            barberId: barberA,
            isOnDuty: false,
            status: 'AVAILABLE' as const,
          },
        ],
        waitingQueue: [],
      });

      expect(estimate).toBeNull();
    });

    it('excludes an on-break barber from "Any" eligible barbers', () => {
      const estimate = calculateEstimatedWaitTime({
        targetItem: {
          preferredBarberId: null,
          joinedAt: new Date('2026-11-22T10:00:00Z'),
        },
        barbers: [
          {
            barberId: barberA,
            isOnDuty: true,
            status: 'ON_BREAK',
          },
          {
            barberId: barberB,
            isOnDuty: true,
            status: 'AVAILABLE',
          },
        ],
        waitingQueue: [
          {
            id: 'w1',
            preferredBarberId: null,
            totalDurationMinutes: 30,
            joinedAt: new Date('2026-11-22T09:55:00Z'),
          },
        ],
        now: new Date('2026-11-22T10:00:00Z'),
      });

      expect(estimate).toBe(30);
    });
  });

  describe('No-Show Timing', () => {
    it('allows no-show only at or after ten minutes after call', () => {
      const calledAt = new Date('2026-11-22T10:00:00Z');
      expect(canMarkNoShow(calledAt, new Date('2026-11-22T10:09:59Z'))).toBe(false);
      expect(canMarkNoShow(calledAt, new Date('2026-11-22T10:10:00Z'))).toBe(true);
    });
  });

  describe('Concurrency & Duplicate Active Customer Guard', () => {
    it('simulates phone duplicate check correctly', () => {
      const activeEntries = new Map<string, string>(); // phone -> status

      function canCustomerJoin(phone: string): boolean {
        const normalized = normalizeIndianPhone(phone);
        const currentStatus = activeEntries.get(normalized);
        if (currentStatus && ['WAITING', 'CALLED', 'IN_SERVICE'].includes(currentStatus)) {
          return false; // Active exists!
        }
        return true;
      }

      const phone = '9876543210';
      expect(canCustomerJoin(phone)).toBe(true);

      // Customer joins -> status WAITING
      activeEntries.set(normalizeIndianPhone(phone), 'WAITING');
      expect(canCustomerJoin(phone)).toBe(false);

      // Customer is CALLED
      activeEntries.set(normalizeIndianPhone(phone), 'CALLED');
      expect(canCustomerJoin(phone)).toBe(false);

      // Customer is IN_SERVICE
      activeEntries.set(normalizeIndianPhone(phone), 'IN_SERVICE');
      expect(canCustomerJoin(phone)).toBe(false);

      // Customer is DONE (terminal) -> can join again
      activeEntries.set(normalizeIndianPhone(phone), 'DONE');
      expect(canCustomerJoin(phone)).toBe(true);

      // Customer is CANCELLED (terminal) -> can join again
      activeEntries.set(normalizeIndianPhone(phone), 'CANCELLED');
      expect(canCustomerJoin(phone)).toBe(true);

      // Customer is NO_SHOW (terminal) -> can join again
      activeEntries.set(normalizeIndianPhone(phone), 'NO_SHOW');
      expect(canCustomerJoin(phone)).toBe(true);
    });
  });
});
