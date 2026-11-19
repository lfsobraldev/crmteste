import { NextResponse } from "next/server";
import { COOKIE, conferirSenha, criarToken, hashSenha, opcoesCookie } from "@/lib/auth";
import { trocarSenhaSchema } from "@/lib/regras";
import { contextoGP, erroGP, H, q, regra } from "@/lib/servidor";

export const runtime = "nodejs";

/** Troca da própria senha. Encerra as sessões abertas em outros aparelhos e renova a deste. */
export async function POST(req: Request) {
  try {
    const c = await contextoGP();
    const b = trocarSenhaSchema.parse(await req.json());
    const [u] = await q("select senha_hash from gp_usuarios where id=$1", [c.id]);
    if (!u || !conferirSenha(b.atual, u.senha_hash)) throw regra("A senha atual não confere.");
    if (b.atual === b.nova) throw regra("A nova senha precisa ser diferente da atual.");
    const agora = Date.now();
    await q("update gp_usuarios set senha_hash=$2,sessao_desde=$3,atualizado_em=now() where id=$1", [c.id, hashSenha(b.nova), new Date(agora)]);
    const r = NextResponse.json({ ok: true }, { headers: H });
    r.cookies.set(COOKIE, criarToken(c.usuario, agora), opcoesCookie(req));
    return r;
  } catch (e) { return erroGP(e, "Não foi possível trocar a senha."); }
}
