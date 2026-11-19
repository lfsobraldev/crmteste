import { NextResponse } from "next/server";
import { COOKIE, criarToken, hashSenha, opcoesCookie } from "@/lib/auth";
import { tx } from "@/lib/db";
import { excedeu, ipDe } from "@/lib/limites";
import { definirSenhaSchema, problemaSenha } from "@/lib/regras";
import { erroGP, H } from "@/lib/servidor";
import { consultarToken, consumirToken } from "@/lib/tokens";

export const runtime = "nodejs";
const invalido = () => NextResponse.json({ error: "Este link é inválido, já foi usado ou expirou. Peça um novo em \"Primeiro acesso\" ou \"Esqueci minha senha\".", codigo: "LINK_INVALIDO" }, { status: 410, headers: H });

/** Cria a senha a partir do link (ativação ou recuperação). Consome o link, ativa a conta, encerra outras sessões e já entra. */
export async function POST(req: Request) {
  try {
    if (await excedeu("senha-ip:" + ipDe(req), 20, 15)) return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos." }, { status: 429, headers: H });
    const b = definirSenhaSchema.parse(await req.json().catch(() => ({})));
    const previo = await consultarToken(b.token);
    if (!previo) return invalido();
    const problema = problemaSenha(b.senha, previo.email);
    if (problema) return NextResponse.json({ error: problema }, { status: 400, headers: H });
    const agora = Date.now();
    const r = await tx(async (c) => {
      const t = await consumirToken(c, b.token);
      if (!t) return null;
      const { rows } = await c.query(`update gp_usuarios set senha_hash=$2,ativado_em=coalesce(ativado_em,now()),sessao_desde=$3,falhas_login=0,bloqueado_ate=null,
        ultimo_acesso=now(),atualizado_em=now() where id=$1 returning usuario`, [t.usuario_id, hashSenha(b.senha), new Date(agora)]);
      await c.query("update gp_tokens set usado_em=now() where usuario_id=$1 and usado_em is null", [t.usuario_id]);
      return { usuario: rows[0].usuario as string, tipo: t.tipo };
    });
    if (!r) return invalido();
    const res = NextResponse.json({ ok: true, tipo: r.tipo }, { headers: H });
    res.cookies.set(COOKIE, criarToken(r.usuario, agora), opcoesCookie(req));
    return res;
  } catch (e) { return erroGP(e, "Não foi possível salvar a senha."); }
}
