/** Tokens de ativação e recuperação: 256 bits aleatórios, só o SHA-256 vai para o banco, 30 minutos, uso único. */
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { q } from "./db";
import type { TipoLink } from "./email";

export const VALIDADE_MIN = 30;
export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** Cria um link novo e invalida os anteriores do mesmo tipo que ainda não foram usados. */
export async function novoToken(usuarioId: string, tipo: TipoLink, ip: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  await q("update gp_tokens set usado_em=now() where usuario_id=$1 and tipo=$2 and usado_em is null", [usuarioId, tipo]);
  await q("insert into gp_tokens(usuario_id,tipo,token_hash,expira_em,criado_ip) values($1,$2,$3,now()+make_interval(mins=>$4),$5)", [usuarioId, tipo, hashToken(token), VALIDADE_MIN, ip.slice(0, 64)]);
  return token;
}

/** Confere sem consumir (para mostrar a tela de criar senha). */
export async function consultarToken(token: string) {
  const [r] = await q(`select t.tipo,u.id usuario_id,u.nome,u.email from gp_tokens t join gp_usuarios u on u.id=t.usuario_id
    where t.token_hash=$1 and t.usado_em is null and t.expira_em>now() and u.ativo`, [hashToken(token)]);
  return r as { tipo: TipoLink; usuario_id: string; nome: string; email: string } | undefined;
}

/** Consome o token dentro da transação (uso único mesmo com dois envios simultâneos). */
export async function consumirToken(c: PoolClient, token: string) {
  const { rows } = await c.query(`update gp_tokens t set usado_em=now() from gp_usuarios u
    where t.token_hash=$1 and t.usado_em is null and t.expira_em>now() and u.id=t.usuario_id and u.ativo
    returning t.tipo,t.usuario_id,u.email`, [hashToken(token)]);
  return rows[0] as { tipo: TipoLink; usuario_id: string; email: string } | undefined;
}
