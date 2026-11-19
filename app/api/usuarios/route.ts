import { NextResponse } from "next/server";
import { hashSenha } from "@/lib/auth";
import { conferirMudancaAdmin, editarUsuarioSchema, novoUsuarioSchema } from "@/lib/regras";
import { erroGP, exigirAdmin, H, q, regra } from "@/lib/servidor";

export const runtime = "nodejs";
const COLS = "id,usuario,nome,email,setor,papel,ativo,criado_em,atualizado_em";

/** Cadastro de usuários (somente Administrador/Atendente). */
export async function GET() {
  try {
    await exigirAdmin();
    return NextResponse.json({ usuarios: await q(`select ${COLS} from gp_usuarios order by ativo desc,nome`) }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível carregar os usuários."); }
}

export async function POST(req: Request) {
  try {
    const c = await exigirAdmin();
    const b = novoUsuarioSchema.parse(await req.json());
    const [r] = await q(`insert into gp_usuarios(usuario,nome,email,setor,papel,senha_hash,criado_por,sessao_desde) values($1,$2,$3,$4,$5,$6,$7,$8)
      on conflict(usuario) do nothing returning ${COLS}`, [b.usuario, b.nome, b.email, b.setor, b.papel, hashSenha(b.senha), c.usuario, new Date()]);
    if (!r) throw regra(`O login "${b.usuario}" já existe. Escolha outro ou edite o usuário existente.`);
    return NextResponse.json({ ok: true, usuario: r }, { status: 201, headers: H });
  } catch (e) { return erroGP(e, "Não foi possível criar o usuário."); }
}

/** Edição: nome, e-mail, setor, perfil, ativo e (opcional) nova senha — que encerra as sessões abertas dessa pessoa. */
export async function PATCH(req: Request) {
  try {
    const c = await exigirAdmin();
    const b = editarUsuarioSchema.parse(await req.json());
    const [u] = await q("select id,papel,ativo from gp_usuarios where id=$1", [b.id]);
    if (!u) throw regra("Usuário não encontrado.");
    const [{ n }] = await q("select count(*)::int n from gp_usuarios where papel='admin' and ativo and id<>$1", [b.id]);
    const erro = conferirMudancaAdmin({ eu: u.id === c.id, eraAdminAtivo: u.papel === "admin" && u.ativo, seraAdminAtivo: b.papel === "admin" && b.ativo, outrosAdminsAtivos: n });
    if (erro) throw regra(erro);
    if (u.id === c.id && b.senha) throw regra("Para trocar a sua própria senha, use \"Minha senha\" no menu.");
    const encerra = !!b.senha || !b.ativo || b.papel !== u.papel;
    const [r] = await q(`update gp_usuarios set nome=$2,email=$3,setor=$4,papel=$5,ativo=$6,
        senha_hash=case when $7::text<>'' then $8 else senha_hash end,
        sessao_desde=case when $9 then $10::timestamptz else sessao_desde end,
        falhas_login=case when $7::text<>'' then 0 else falhas_login end,bloqueado_ate=case when $7::text<>'' then null else bloqueado_ate end,
        atualizado_em=now() where id=$1 returning ${COLS}`,
      [b.id, b.nome, b.email, b.setor, b.papel, b.ativo, b.senha, b.senha ? hashSenha(b.senha) : "", encerra, new Date()]);
    return NextResponse.json({ ok: true, usuario: r }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível salvar o usuário."); }
}
