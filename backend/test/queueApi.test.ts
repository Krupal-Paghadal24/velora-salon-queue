import { describe, it, expect } from 'vitest';
import { app } from '../src/app.js';
import { SalonService } from '../src/services/salonService.js';
import { QueueService } from '../src/services/queueService.js';

describe('Phase 4: Salon & Queue API Integration', () => {
  describe('Salon Status & Catalog Endpoints', () => {
    it('returns public summary with open status, stats, barbers and services', async () => {
      const summary = await SalonService.getPublicSummary();
      expect(summary).toBeDefined();
      expect(summary.salon.name).toBe('Velora Salon');
      expect(summary.salon.timezone).toBe('Asia/Kolkata');
      expect(summary.services.length).toBeGreaterThan(0);
      expect(summary.barbers.length).toBeGreaterThan(0);
      expect(summary.stats).toBeDefined();
    });

    it('returns enabled services catalogue', async () => {
      const services = await SalonService.getServices();
      expect(services.length).toBeGreaterThanOrEqual(4);
      expect(services[0].name_en).toBeDefined();
      expect(services[0].name_gu).toBeDefined();
      expect(services[0].duration_minutes).toBeGreaterThan(0);
      expect(services[0].price_inr).toBeGreaterThan(0);
    });

    it('returns on-duty barbers', async () => {
      const barbers = await SalonService.getBarbers();
      expect(barbers.length).toBeGreaterThanOrEqual(2);
      expect(barbers.every((b) => b.is_on_duty)).toBe(true);
    });
  });

  describe('Queue Joining Flow & Duplicate Protection', () => {
    const testPhone = '9876543299';
    let createdPublicId: string;
    let createdToken: number;

    it('successfully creates a new queue entry with atomic token and service snapshot', async () => {
      const services = await SalonService.getServices();
      const serviceIds = [services[0].id, services[1].id];

      const result = await QueueService.joinQueue({
        customer_name: 'Dhaval Mehta',
        customer_phone: testPhone,
        service_ids: serviceIds,
        preferred_barber_id: null,
        is_walk_in: false,
      });

      expect(result.success).toBe(true);
      expect(result.isExisting).toBe(false);
      expect(result.entry.daily_token).toBeGreaterThan(0);
      expect(result.entry.public_id).toBeDefined();
      expect(result.entry.public_id.length).toBeGreaterThan(6);
      expect(result.entry.status).toBe('WAITING');
      expect(result.entry.customer_name).toBe('Dhaval Mehta');
      expect(result.entry.customer_phone).toBe('+919876543299');
      expect(result.entry.total_duration_minutes).toBe(
        services[0].duration_minutes + services[1].duration_minutes
      );

      createdPublicId = result.entry.public_id;
      createdToken = result.entry.daily_token;
    });

    it('returns existing active token when same phone joins again without creating duplicate', async () => {
      const services = await SalonService.getServices();

      const duplicateResult = await QueueService.joinQueue({
        customer_name: 'Dhaval Mehta',
        customer_phone: testPhone,
        service_ids: [services[0].id],
        preferred_barber_id: null,
      });

      expect(duplicateResult.success).toBe(true);
      expect(duplicateResult.isExisting).toBe(true);
      expect(duplicateResult.entry.daily_token).toBe(createdToken);
      expect(duplicateResult.entry.public_id).toBe(createdPublicId);
    });

    it('retrieves private customer tracking details by publicId', async () => {
      const entry = await QueueService.getQueueEntryByPublicId(createdPublicId);
      expect(entry).not.toBeNull();
      expect(entry.public_id).toBe(createdPublicId);
      expect(entry.customer_name).toBe('Dhaval Mehta');
      expect(entry.status).toBe('WAITING');
    });

    it('returns null for nonexistent publicId', async () => {
      const entry = await QueueService.getQueueEntryByPublicId('nonexistent-public-id');
      expect(entry).toBeNull();
    });
  });
});
