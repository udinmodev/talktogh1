import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

let pool: Pool | null = null;

export function getDbPool(): Pool | null {
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      maxLifetimeSeconds: 300,
    });
  }
  return pool;
}
