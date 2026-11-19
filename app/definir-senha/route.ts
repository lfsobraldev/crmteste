import { NextResponse } from "next/server";
import { sessao } from "@/lib/auth";
import { paginaAcesso } from "@/lib/login-pagina";
import { VERSAO, HTML_HEADERS } from "@/lib/versao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  void req;
  return new NextResponse(paginaAcesso("definir-senha", VERSAO), { headers: { ...HTML_HEADERS, "Referrer-Policy": "no-referrer" } });
}
