import { NextResponse } from "next/server";
import { emailConfigurado } from "@/lib/email";
import { ipDe } from "@/lib/limites";
import { enviarLinkConta } from "@/lib/links";
import { uuid } from "@/lib/regras";
import { erroGP, exigirAdministrador, H, q, regra } from "@/lib/servidor";
import { z } from "zod";

export const runtime = "nodejs";

/** Administrador envia à pessoa o link de ativação (conta pendente) ou de redefinição de senha (conta ativa). */
export async function POST(req: Request) {
  try {
    await exigirAdministrador();
    const { id } = z.object({ id: uuid }).parse(await req.json());
    if (!emailConfigurado()) throw regra("O envio de e-mail não está configurado no servidor (SMTP_HOST e EMAIL_REMETENTE).");
    const [u] = await q("select id,email,nome,ativo,senha_hash is not null senha_definida from gp_usuarios where id=$1", [id]);
    if (!u) throw regra("Usuário não encontrado.");
    if (!u.ativo) throw regra("A conta está bloqueada. Desbloqueie antes de enviar o link.");
    if (!u.email) throw regra("Este usuário não tem e-mail cadastrado.");
    try { const tipo = await enviarLinkConta(u as never, ipDe(req)); return NextResponse.json({ ok: true, tipo }, { headers: H }); }
    catch (e) { console.error("[email]", e instanceof Error ? e.message : e); throw regra("Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos."); }
  } catch (e) { return erroGP(e, "Não foi possível enviar o link."); }
}
