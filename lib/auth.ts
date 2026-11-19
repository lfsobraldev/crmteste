/** Acesso corporativo: senha com scrypt (salt por usuário), cookie de sessão assinado (HMAC) e conferência da conta no banco a cada requisição. */
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { q } from "./db";
import type { PapelGP } from "./regras";

export const COOKIE = "gp_sessao";
export type Usuario = { id: string; usuario: string; nome: string; papel: PapelGP; email: string; setor: string };

function segredo() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET não configurada (mínimo de 16 caracteres).");
  return s;
}
export function horasSessao() {
  const n = Number(process.env.SESSAO_HORAS);
  return Number.isFinite(n) && n >= 1 && n <= 24 ? Math.floor(n) : 12;
}
const assinar = (p: string) => crypto.createHmac("sha256", segredo()).update(p).digest("base64url");

export function hashSenha(senha: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return "scrypt$" + salt + "$" + crypto.scryptSync(senha, salt, 64).toString("hex");
}
export function conferirSenha(senha: string, hash: string) {
  const [alg, salt, hex] = String(hash || "").split("$");
  if (alg !== "scrypt" || !salt || !hex) return false;
  const esperado = Buffer.from(hex, "hex");
  const calc = crypto.scryptSync(senha, salt, esperado.length);
  return calc.length === esperado.length && crypto.timingSafeEqual(calc, esperado);
}
export function iguais(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function criarToken(usuario: string, agora = Date.now()) {
  const p = `${usuario}|${agora}`;
  return Buffer.from(p).toString("base64url") + "." + assinar(p);
}
export function lerToken(token: string | undefined, agora = Date.now()): { usuario: string; emitidoEm: number } | null {
  if (!token) return null;
  const [enc, sig] = token.split(".");
  if (!enc || !sig) return null;
  let p = "";
  try { p = Buffer.from(enc, "base64url").toString("utf8"); } catch { return null; }
  if (!iguais(sig, assinar(p))) return null;
  const [usuario, ts] = p.split("|");
  const idade = agora - Number(ts);
  if (!usuario || !Number.isFinite(idade) || idade < 0 || idade > horasSessao() * 3600_000) return null;
  return { usuario, emitidoEm: Number(ts) };
}
/** Opções do cookie; `secure` só quando o acesso é por HTTPS (permite uso em rede interna sem certificado). */
export function opcoesCookie(req: Request, maxAge = horasSessao() * 3600) {
  const https = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  return { httpOnly: true, sameSite: "lax" as const, secure: https, path: "/", maxAge };
}

/** Usuário da sessão atual, ou null. A conta precisa estar ativa e a sessão não pode ser anterior à última troca de senha
 *  (sessao_desde é sempre gravado com o relógio da aplicação, o mesmo do token). */
export async function sessao(): Promise<Usuario | null> {
  const t = lerToken((await cookies()).get(COOKIE)?.value);
  if (!t) return null;
  const [u] = await q("select id,usuario,nome,papel,email,setor,ativo,sessao_desde,senha_hash is not null senha from gp_usuarios where usuario=$1", [t.usuario]);
  if (!u || !u.ativo || !u.senha || new Date(u.sessao_desde).getTime() > t.emitidoEm) return null;
  return { id: u.id, usuario: u.usuario, nome: u.nome, papel: u.papel, email: u.email, setor: u.setor };
}
