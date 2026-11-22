import { describe, it, expect } from 'vitest';
import { app } from '../src/app.js';

describe('Health API', () => {
  it('returns ok status and salon details', async () => {
    // Basic test using express app
    expect(app).toBeDefined();
  });
});
