import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE, conferirSenha, criarToken, hashSenha, iguais, opcoesCookie } from "@/lib/auth";
import { loginUsuario } from "@/lib/regras";
import { erroGP, H, q } from "@/lib/servidor";

export const runtime = "nodejs";
const MAX_FALHAS = 8, BLOQUEIO_MIN = 15;
const corpo = z.object({ usuario: z.string().max(60), senha: z.string().max(200) });
const invalido = () => NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401, headers: H });

/** Primeiro acesso: cria o administrador a partir de ADMIN_USUARIO/ADMIN_SENHA_INICIAL, só se ainda não houver administrador. */
async function primeiroAdmin(usuario: string, senha: string) {
  const u = loginUsuario(process.env.ADMIN_USUARIO || ""), s = process.env.ADMIN_SENHA_INICIAL || "";
  if (!u || s.length < 8 || usuario !== u || !iguais(senha, s)) return;
  const [tem] = await q("select 1 from gp_usuarios where papel='admin' limit 1");
  if (tem) return;
  await q(`insert into gp_usuarios(usuario,nome,papel,senha_hash,criado_por,sessao_desde) values($1,'Administrador','admin',$2,'instalacao',$3)
    on conflict(usuario) do nothing`, [u, hashSenha(s), new Date()]);
}

export async function POST(req: Request) {
  try {
    const b = corpo.parse(await req.json().catch(() => ({})));
    const usuario = loginUsuario(b.usuario);
    if (!usuario || !b.senha) return NextResponse.json({ error: "Informe usuário e senha." }, { status: 400, headers: H });
    await primeiroAdmin(usuario, b.senha);
    const [u] = await q("select usuario,senha_hash,ativo,bloqueado_ate from gp_usuarios where usuario=$1", [usuario]);
    if (!u) { await new Promise((r) => setTimeout(r, 400)); return invalido(); }
    if (u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date()) return NextResponse.json({ error: `Muitas tentativas. Tente de novo em até ${BLOQUEIO_MIN} minutos.` }, { status: 429, headers: H });
    if (!u.ativo || !conferirSenha(b.senha, u.senha_hash)) {
      await q(`update gp_usuarios set falhas_login=falhas_login+1,
        bloqueado_ate=case when falhas_login+1>=$2 then now()+make_interval(mins=>$3) else bloqueado_ate end where usuario=$1`, [usuario, MAX_FALHAS, BLOQUEIO_MIN]);
      return invalido();
    }
    await q("update gp_usuarios set falhas_login=0,bloqueado_ate=null where usuario=$1", [usuario]);
    const r = NextResponse.json({ ok: true }, { headers: H });
    r.cookies.set(COOKIE, criarToken(usuario), opcoesCookie(req));
    return r;
  } catch (e) { return erroGP(e, "Não foi possível entrar."); }
}
