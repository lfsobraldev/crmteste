/** Conexão com o PostgreSQL (DATABASE_URL). Um pool por processo; funciona com Neon, Supabase, RDS ou servidor próprio. */
import { Pool, type PoolClient } from "pg";

export type Row = Record<string, any>;
const g = globalThis as unknown as { __gpPool?: Pool };

export function pool() {
  if (!g.__gpPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada.");
    g.__gpPool = new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX || 5), idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 });
    g.__gpPool.on("error", (e) => console.error("[db] conexão ociosa com erro:", e.message));
  }
  return g.__gpPool;
}
export async function q(text: string, params: unknown[] = []): Promise<Row[]> {
  return (await pool().query(text, params)).rows;
}
/** Executa várias instruções na mesma transação. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try { await c.query("begin"); const r = await fn(c); await c.query("commit"); return r; }
  catch (e) { await c.query("rollback").catch(() => {}); throw e; }
  finally { c.release(); }
}
