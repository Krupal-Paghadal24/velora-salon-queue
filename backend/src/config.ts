import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SALON_TIMEZONE: z.string().default('Asia/Kolkata'),
  DEFAULT_SALON_NAME: z.string().default('Velora Salon'),
  DATABASE_URL: z.string().optional(),
  TEST_DATABASE_URL: z.string().optional(),
  MIGRATION_URL: z.string().optional(),
  DATABASE_SSL_CA: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  if (parsed.error.issues.some((issue) => issue.path[0] === 'JWT_SECRET')) {
    console.error('JWT_SECRET is required and must contain at least 32 characters in every environment.');
  }
  process.exit(1);
}

export const config = parsed.data;

if (config.NODE_ENV === 'production' && !config.DATABASE_URL) {
  console.error('DATABASE_URL must be set to PostgreSQL in production. In-memory queue storage is not allowed.');
  process.exit(1);
}

if (config.NODE_ENV === 'production' && !config.DATABASE_SSL_CA) {
  console.error('DATABASE_SSL_CA must point to the Supabase CA certificate in production.');
  process.exit(1);
}
