import { NextResponse } from "next/server";
import { hojeBR } from "@/lib/datas";
import { lerListas, listarAtendentes } from "@/lib/consultas";
import { contextoGP, erroGP, H } from "@/lib/servidor";

export const runtime = "nodejs";

/** Quem está usando, com qual papel, e os cadastros que a tela precisa para montar os formulários. */
export async function GET() {
  try {
    const c = await contextoGP();
    const [listas, atendentes] = await Promise.all([lerListas(), c.papel === "admin" ? listarAtendentes() : Promise.resolve([])]);
    return NextResponse.json({ usuario: c.usuario, nome: c.nome, papel: c.papel, listas, atendentes, hoje: hojeBR() }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível carregar a sessão."); }
}
