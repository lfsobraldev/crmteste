import { NextResponse } from "next/server";
import { sessao } from "@/lib/auth";
import { paginaLogin } from "@/lib/login-pagina";
import { VERSAO, HTML_HEADERS } from "@/lib/versao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await sessao().catch(() => null);
  if (s) return NextResponse.redirect(new URL("/", req.url));
  return new NextResponse(paginaLogin(VERSAO), { headers: HTML_HEADERS });
}
