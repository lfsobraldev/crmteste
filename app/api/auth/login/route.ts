import { NextResponse } from "next/server";
import { COOKIE, conferirSenha, criarToken, hashSenha, iguais, opcoesCookie } from "@/lib/auth";
import { excedeu, ipDe } from "@/lib/limites";
import { emailCorporativo, loginSchema, normalizarEmail } from "@/lib/regras";
import { erroGP, H, q } from "@/lib/servidor";

export const runtime = "nodejs";
const MAX_FALHAS = 5, BLOQUEIO_MIN = 15;
const msg = (error: string, status: number, extra: object = {}) => NextResponse.json({ error, ...extra }, { status, headers: H });
const espera = () => new Promise((r) => setTimeout(r, 300 + Math.random() * 300));

/** Instalação nova: cria o 1º administrador com ADMIN_EMAIL/ADMIN_SENHA_INICIAL, só enquanto não houver administrador com acesso ativo. */
async function primeiroAdmin(email: string, senha: string) {
  const e = normalizarEmail(process.env.ADMIN_EMAIL), s = process.env.ADMIN_SENHA_INICIAL || "";
  if (!emailCorporativo(e) || s.length < 8 || email !== e || !iguais(senha, s)) return;
  const [tem] = await q("select 1 from gp_usuarios where papel='admin' and ativo and senha_hash is not null and email<>'' limit 1");
  if (tem) return;
  const agora = new Date();
  await q(`insert into gp_usuarios(usuario,email,nome,papel,senha_hash,criado_por,sessao_desde,ativado_em) values($1,$1,'Administrador','admin',$2,'instalacao',$3,$3)
    on conflict(usuario) do update set papel='admin',ativo=true,senha_hash=excluded.senha_hash,sessao_desde=excluded.sessao_desde,ativado_em=coalesce(gp_usuarios.ativado_em,excluded.ativado_em)`, [e, hashSenha(s), agora]);
}

export async function POST(req: Request) {
  try {
    const b = loginSchema.parse(await req.json().catch(() => ({})));
    if (await excedeu("login-ip:" + ipDe(req), 30, 15)) return msg("Muitas tentativas a partir desta rede. Aguarde 15 minutos e tente de novo.", 429);
    await primeiroAdmin(b.email, b.senha);
    const [u] = await q("select id,usuario,senha_hash,ativo,bloqueado_ate,falhas_login from gp_usuarios where lower(email)=$1", [b.email]);
    if (!u) { await espera(); return msg("E-mail ou senha incorretos.", 401); }
    if (!u.ativo) return msg("Sua conta está bloqueada. Fale com o administrador do sistema.", 403, { codigo: "BLOQUEADA" });
    if (!u.senha_hash) return msg("Seu acesso ainda não foi ativado. Use \"Primeiro acesso\" para receber o link de ativação no seu e-mail.", 403, { codigo: "PENDENTE" });
    if (u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date()) {
      const min = Math.max(1, Math.ceil((new Date(u.bloqueado_ate).getTime() - Date.now()) / 60000));
      return msg(`Acesso travado por excesso de tentativas. Tente de novo em ${min} minuto(s) ou use "Esqueci minha senha".`, 429, { codigo: "TRAVADA" });
    }
    if (!conferirSenha(b.senha, u.senha_hash)) {
      const [r] = await q(`update gp_usuarios set
          bloqueado_ate=case when falhas_login+1>=$2 then now()+make_interval(mins=>$3) else bloqueado_ate end,
          falhas_login=case when falhas_login+1>=$2 then 0 else falhas_login+1 end
        where id=$1 returning falhas_login,bloqueado_ate`, [u.id, MAX_FALHAS, BLOQUEIO_MIN]);
      await espera();
      if (r?.bloqueado_ate && new Date(r.bloqueado_ate) > new Date()) return msg(`Senha incorreta. Por segurança, o acesso ficou travado por ${BLOQUEIO_MIN} minutos. Você pode usar "Esqueci minha senha".`, 429, { codigo: "TRAVADA" });
      const restam = MAX_FALHAS - Number(r?.falhas_login || 0);
      return msg(`E-mail ou senha incorretos.${restam <= 2 ? ` Restam ${restam} tentativa(s) antes de travar o acesso por ${BLOQUEIO_MIN} minutos.` : ""}`, 401);
    }
    await q("update gp_usuarios set falhas_login=0,bloqueado_ate=null,ultimo_acesso=now() where id=$1", [u.id]);
    const res = NextResponse.json({ ok: true }, { headers: H });
    res.cookies.set(COOKIE, criarToken(u.usuario), opcoesCookie(req));
    return res;
  } catch (e) { return erroGP(e, "Não foi possível entrar."); }
}
