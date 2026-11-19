#!/usr/bin/env node
// Cria/atualiza a estrutura do banco (db/schema.sql é idempotente). Uso: DATABASE_URL=... npm run db:migrar
import { readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) { console.error("Defina DATABASE_URL (veja .env.example)."); process.exit(1); }
const sql = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const c = new pg.Client({ connectionString: url });
try {
  await c.connect();
  await c.query("begin");
  await c.query(sql);
  await c.query("commit");
  const { rows } = await c.query("select count(*)::int n from information_schema.tables where table_schema='public' and table_name like 'gp\\_%'");
  console.log(`Banco pronto: ${rows[0].n} tabelas gp_*.`);
} catch (e) {
  await c.query("rollback").catch(() => {});
  console.error("Falha ao preparar o banco:", e.message);
  process.exitCode = 1;
} finally { await c.end().catch(() => {}); }
