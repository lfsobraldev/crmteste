import { NextResponse } from "next/server";
import { emailConfigurado } from "@/lib/email";
import { ipDe } from "@/lib/limites";
import { enviarLinkConta } from "@/lib/links";
import { conferirMudancaAdmin, editarUsuarioSchema, novoUsuarioSchema } from "@/lib/regras";
import { erroGP, exigirAdministrador, H, q, regra } from "@/lib/servidor";

export const runtime = "nodejs";
const COLS = `id,email,nome,setor,papel,ativo,senha_hash is not null senha_definida,ultimo_acesso,ativado_em,
  case when bloqueado_ate>now() then bloqueado_ate end bloqueado_ate,criado_em,atualizado_em`;

/** Administração de usuários (somente administrador). Senhas e tokens nunca saem do banco. */
export async function GET() {
  try {
    await exigirAdministrador();
    return NextResponse.json({ usuarios: await q(`select ${COLS} from gp_usuarios order by ativo desc,nome`), emailConfigurado: emailConfigurado() }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível carregar os usuários."); }
}

/** Autoriza um e-mail corporativo. A pessoa cria a própria senha pelo link de ativação (enviado agora ou em "Primeiro acesso"). */
export async function POST(req: Request) {
  try {
    const c = await exigirAdministrador();
    const b = novoUsuarioSchema.parse(await req.json());
    const [r] = await q(`insert into gp_usuarios(usuario,email,nome,setor,papel,senha_hash,criado_por,sessao_desde) values($1,$1,$2,$3,$4,null,$5,$6)
      on conflict do nothing returning ${COLS}`, [b.email, b.nome, b.setor, b.papel, c.usuario, new Date()]);
    if (!r) throw regra(`O e-mail ${b.email} já está cadastrado. Edite o usuário existente.`);
    let aviso = "";
    if (b.enviarConvite) {
      if (!emailConfigurado()) aviso = "Usuário autorizado, mas o envio de e-mail não está configurado: o link não foi enviado.";
      else try { await enviarLinkConta({ id: r.id, email: r.email, nome: r.nome, senha_definida: false }, ipDe(req)); }
      catch (e) { console.error("[email]", e instanceof Error ? e.message : e); aviso = "Usuário autorizado, mas o e-mail com o link não pôde ser enviado agora. Use \"Enviar link de ativação\" depois."; }
    }
    return NextResponse.json({ ok: true, usuario: r, aviso }, { status: 201, headers: H });
  } catch (e) { return erroGP(e, "Não foi possível autorizar o usuário."); }
}

/** Nome, setor, perfil e bloqueio. Mudar perfil ou bloquear encerra as sessões abertas da pessoa. */
export async function PATCH(req: Request) {
  try {
    const c = await exigirAdministrador();
    const b = editarUsuarioSchema.parse(await req.json());
    const [u] = await q("select id,papel,ativo from gp_usuarios where id=$1", [b.id]);
    if (!u) throw regra("Usuário não encontrado.");
    const [{ n }] = await q("select count(*)::int n from gp_usuarios where papel='admin' and ativo and id<>$1", [b.id]);
    const erro = conferirMudancaAdmin({ eu: u.id === c.id, eraAdminAtivo: u.papel === "admin" && u.ativo, seraAdminAtivo: b.papel === "admin" && b.ativo, outrosAdminsAtivos: n });
    if (erro) throw regra(erro);
    const encerra = !b.ativo || b.papel !== u.papel;
    const reativa = b.ativo && !u.ativo;
    const [r] = await q(`update gp_usuarios set nome=$2,setor=$3,papel=$4,ativo=$5,
        sessao_desde=case when $6 then $7::timestamptz else sessao_desde end,
        falhas_login=case when $8 then 0 else falhas_login end,bloqueado_ate=case when $8 then null else bloqueado_ate end,
        atualizado_em=now() where id=$1 returning ${COLS}`, [b.id, b.nome, b.setor, b.papel, b.ativo, encerra, new Date(), reativa]);
    if (!b.ativo) await q("update gp_tokens set usado_em=now() where usuario_id=$1 and usado_em is null", [b.id]);
    return NextResponse.json({ ok: true, usuario: r }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível salvar o usuário."); }
}
