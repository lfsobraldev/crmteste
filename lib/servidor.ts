/** Sessão, papel e respostas de erro das rotas da API. */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { sessao } from "./auth";
import { ehEquipe, type PapelGP } from "./regras";

export { q, type Row } from "./db";
export const H = { "Cache-Control": "no-store" };

export type ContextoGP = { id: string; usuario: string; nome: string; papel: PapelGP };

/** Login obrigatório. Sem login: 401 (a tela manda para /login). */
export async function contextoGP(): Promise<ContextoGP> {
  const s = await sessao();
  if (!s) throw new Error("NAO_AUTENTICADO");
  return { id: s.id, usuario: s.usuario, nome: s.nome, papel: s.papel };
}
/** Equipe de atendimento (administrador ou atendente): chamados de todos, tarefas e cadastros. */
export async function exigirEquipe() {
  const c = await contextoGP();
  if (!ehEquipe(c.papel)) throw new Error("SEM_PERMISSAO");
  return c;
}
/** Somente administrador: usuários e níveis de acesso. */
export async function exigirAdministrador() {
  const c = await contextoGP();
  if (c.papel !== "admin") throw new Error("SEM_PERMISSAO");
  return c;
}

/** Erros com mensagem clara e status HTTP coerente (a tela mostra a mensagem como veio). */
export function erroGP(e: unknown, fallback: string) {
  if (e instanceof ZodError) return NextResponse.json({ error: [...new Set(e.issues.map((i) => i.message))].join(" ") }, { status: 400, headers: H });
  const m = e instanceof Error ? e.message : String(e ?? "");
  const r = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status, headers: H });
  if (m === "NAO_AUTENTICADO") return r("Sessão expirada. Entre novamente.", 401, { codigo: "NAO_AUTENTICADO" });
  if (m === "SEM_PERMISSAO") return r("Sem permissão para esta ação.", 403);
  if (m.includes("GP_VERSAO_DESATUALIZADA")) return r("Este chamado foi alterado por outra pessoa. Os dados foram recarregados; confira e tente de novo.", 409, { codigo: "VERSAO" });
  if (m.includes("GP_CHAMADO_NAO_ENCONTRADO")) return r("Chamado não encontrado.", 404);
  if (/does not exist/.test(m) && /gp_/.test(m)) return r("Banco de dados ainda não preparado. Rode \"npm run db:migrar\" (ou aplique db/schema.sql).", 503, { codigo: "MIGRACAO_PENDENTE" });
  if (/DATABASE_URL|AUTH_SECRET|APP_URL/.test(m)) return r("Servidor sem configuração: confira DATABASE_URL, AUTH_SECRET e APP_URL.", 500);
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout exceeded|Connection terminated/i.test(m)) { console.error("[gestao-processos] banco:", m); return r("Sem conexão com o banco de dados. Tente de novo em instantes.", 503); }
  if (m.includes("duplicate key")) return r("Registro duplicado.", 409);
  if (/^GP_/.test(m)) return r(m.replace(/^GP_\w+:\s*/, ""), 400);
  if (/violates check constraint|invalid input syntax/.test(m)) return r("Dados inválidos. Confira os campos e tente de novo.", 400);
  console.error("[gestao-processos]", m);
  return r(fallback, 500);
}
/** Mensagem de regra de negócio para o usuário (status 400). */
export const regra = (msg: string) => new Error("GP_REGRA: " + msg);
