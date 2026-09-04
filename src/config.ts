import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';

// Load .env from project root
dotenvConfig({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid Postgres connection string'),

  // Razorpay (test mode)
  RAZORPAY_KEY_ID: z.string().min(1, 'RAZORPAY_KEY_ID is required'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET is required'),

  // Groq LLM
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),

  // Gateway Auth
  GATEWAY_API_KEY: z.string().min(1, 'GATEWAY_API_KEY is required'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export type EnvConfig = z.infer<typeof envSchema>;

function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    console.error('❌ Invalid environment configuration:');
    for (const [field, errors] of Object.entries(formatted)) {
      console.error(`  ${field}: ${errors?.join(', ')}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
