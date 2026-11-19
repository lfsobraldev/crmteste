import { NextResponse } from "next/server";
import { CHAVES_LISTAS, normalizarListas } from "@/lib/regras";
import { erroGP, exigirAdmin, H, q, regra } from "@/lib/servidor";

export const runtime = "nodejs";

/** Cadastros (setores, tipos, jornadas, pessoas e sistemas): só Administrador/Atendente. */
export async function PUT(req: Request) {
  try {
    const c = await exigirAdmin();
    const l = normalizarListas(await req.json());
    if (!l.sistemas.length) throw regra("Cadastre pelo menos um sistema para a Central de Chamados.");
    const linhas = CHAVES_LISTAS.map((k) => ({ chave: k, valor: l[k] }));
    await q(`insert into gp_config(chave,valor,atualizado_por,atualizado_em) select chave,valor,$2,now() from jsonb_to_recordset($1::jsonb) x(chave text,valor jsonb)
      on conflict(chave) do update set valor=excluded.valor,atualizado_por=excluded.atualizado_por,atualizado_em=now()`, [JSON.stringify(linhas), c.usuario]);
    return NextResponse.json({ ok: true, listas: l }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível salvar os cadastros."); }
}
