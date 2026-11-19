/** Proteção contra tentativas excessivas, gravada no banco (vale entre instâncias/servidores). */
import { q } from "./db";

/** Registra uma tentativa e diz se a chave passou do limite na janela. */
export async function excedeu(chave: string, max: number, minutos: number) {
  const [r] = await q(`with ins as (insert into gp_limites(chave) values($1) returning 1)
    select count(*)::int n from gp_limites where chave=$1 and criado_em>now()-make_interval(mins=>$2)`, [chave.slice(0, 220), minutos]);
  if (Math.random() < 0.02) q("delete from gp_limites where criado_em<now()-interval '1 day'").catch(() => {});
  return r.n + 1 > max;
}
export async function contar(chave: string, minutos: number) {
  const [r] = await q("select count(*)::int n from gp_limites where chave=$1 and criado_em>now()-make_interval(mins=>$2)", [chave.slice(0, 220), minutos]);
  return r.n as number;
}
export async function registrar(chave: string) { await q("insert into gp_limites(chave) values($1)", [chave.slice(0, 220)]); }
export async function limpar(chave: string) { await q("delete from gp_limites where chave=$1", [chave.slice(0, 220)]); }

/** IP do cliente (Vercel/proxy: x-forwarded-for; primeiro endereço). */
export const ipDe = (req: Request) => (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "local").split(",")[0].trim().slice(0, 64);
