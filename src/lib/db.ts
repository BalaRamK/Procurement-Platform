import { Pool, PoolClient } from "pg";

const globalForDb = globalThis as unknown as { pool: Pool };

function getPool(): Pool {
  if (!globalForDb.pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    globalForDb.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return globalForDb.pool;
}

/** Convert snake_case keys to camelCase (one level) */
function toCamel<T>(row: Record<string, unknown> | null): T | null {
  if (row === null || row === undefined) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out as T;
}

function mapRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => toCamel<T>(r) as T);
}

/**
 * Run a parameterized query and return rows as camelCase objects.
 * Use $1, $2, ... for parameters.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return mapRows(result.rows as Record<string, unknown>[]) as T[];
}

/** Run a query and return the first row or null (camelCase). */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Get a client for transactions. Caller must release. */
export function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/** Run a function inside a transaction. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Raw query on a client (for transactions). Returns rows as camelCase. */
export async function queryClient<T = Record<string, unknown>>(
  client: PoolClient,
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await client.query(text, params);
  return mapRows(result.rows as Record<string, unknown>[]) as T[];
}

export async function queryOneClient<T = Record<string, unknown>>(
  client: PoolClient,
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await queryClient<T>(client, text, params);
  return rows[0] ?? null;
}
