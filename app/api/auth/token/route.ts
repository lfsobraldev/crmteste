import { NextResponse } from "next/server";
import { consultarToken } from "@/lib/tokens";
import { erroGP, H } from "@/lib/servidor";

export const runtime = "nodejs";
/** Confere o link (sem consumir) para a tela de criar senha. */
export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token") || "";
    const t = /^[A-Za-z0-9_-]{43}$/.test(token) ? await consultarToken(token) : undefined;
    if (!t) return NextResponse.json({ error: "Este link é inválido, já foi usado ou expirou. Peça um novo em \"Primeiro acesso\" ou \"Esqueci minha senha\".", codigo: "LINK_INVALIDO" }, { status: 410, headers: H });
    return NextResponse.json({ ok: true, tipo: t.tipo, nome: t.nome, email: t.email }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível conferir o link."); }
}
