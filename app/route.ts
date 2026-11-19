import { NextResponse } from "next/server";
import { sessao } from "@/lib/auth";
import { paginaGestaoProcessos } from "@/lib/pagina";
import { VERSAO, HTML_HEADERS } from "@/lib/versao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Página principal. Sem login, vai para /login e volta. */
export async function GET(req: Request) {
  const s = await sessao().catch(() => null);
  if (!s) return NextResponse.redirect(new URL("/login", req.url));
  return new NextResponse(paginaGestaoProcessos(VERSAO), { headers: HTML_HEADERS });
}
