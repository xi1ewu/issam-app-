import { prisma } from './database';

/**
 * Read a config value from the DB, falling back to process.env.
 * DB values override env vars so admins can update them without a redeploy.
 */
export async function getConfig(key: string): Promise<string> {
  const row = await prisma.platformConfig.findUnique({ where: { key } }).catch(() => null);
  return row?.value ?? process.env[key] ?? '';
}

/**
 * Write a config value to the DB and sync process.env in-memory.
 */
export async function setConfig(key: string, value: string): Promise<void> {
  await prisma.platformConfig.upsert({
    where:  { key },
    update: { value },
    create: { key, value },
  });
  // Keep in-memory env in sync for the lifetime of this process
  process.env[key] = value;
}

/** Return all payment-related config keys with their DB values (or env fallbacks). */
export async function getPaymentConfig() {
  const keys = [
    'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_ENV',
    'CHARGILY_API_KEY', 'CHARGILY_PUBLIC_KEY', 'CHARGILY_MODE',
    'USD_TO_DZD_RATE',
  ];
  const rows = await prisma.platformConfig.findMany({ where: { key: { in: keys } } });
  const dbMap = Object.fromEntries(rows.map(r => [r.key, r.value]));

  return Object.fromEntries(
    keys.map(k => [k, dbMap[k] ?? process.env[k] ?? ''])
  );
}
