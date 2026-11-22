import { describe, expect, it } from 'vitest';
import { createSslOptions, stripSslMode } from '../src/db/ssl.js';

describe('PostgreSQL TLS configuration', () => {
  it('removes sslmode=require so it cannot override explicit pool TLS options', () => {
    const result = stripSslMode(
      'postgresql://user:password@pooler.example.test:6543/postgres?sslmode=require&application_name=velora'
    );
    const parsed = new URL(result);

    expect(parsed.searchParams.has('sslmode')).toBe(false);
    expect(parsed.searchParams.get('application_name')).toBe('velora');
  });

  it('verifies certificate and server identity when a CA is configured', () => {
    expect(createSslOptions('test-ca-certificate', false)).toEqual({
      ca: 'test-ca-certificate',
      rejectUnauthorized: true,
    });
    expect(createSslOptions('test-ca-certificate', true).rejectUnauthorized).toBe(true);
  });

  it('allows unverified encrypted TLS only in local development', () => {
    expect(createSslOptions(undefined, false)).toEqual({ rejectUnauthorized: false });
    expect(() => createSslOptions(undefined, true)).toThrow('DATABASE_SSL_CA is required');
  });
});
