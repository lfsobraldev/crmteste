import { NextResponse } from "next/server";
import { lerChamado } from "@/lib/consultas";
import { comentarioSchema, podeVerChamado } from "@/lib/regras";
import { contextoGP, erroGP, H, q } from "@/lib/servidor";

export const runtime = "nodejs";

/** Comunicação dentro do chamado: solicitante (no próprio chamado) e atendentes. Não altera a versão do chamado. */
export async function POST(req: Request) {
  try {
    const c = await contextoGP();
    const b = comentarioSchema.parse(await req.json());
    const ch = await lerChamado(b.id);
    if (!ch || !podeVerChamado(c.papel, c.usuario, ch)) return NextResponse.json({ error: "Chamado não encontrado." }, { status: 404, headers: H });
    const [ev] = await q(`with ev as (insert into gp_chamado_eventos(chamado_id,tipo,texto,autor_usuario,autor_nome) values($1,'comentario',$2,$3,$4)
        returning id::int id,tipo,texto,de,para,autor_usuario,autor_nome,criado_em)
      , up as (update gp_chamados set atualizado_em=now() where id=$1)
      select * from ev`, [b.id, b.texto, c.usuario, c.nome]);
    return NextResponse.json({ ok: true, evento: ev }, { status: 201, headers: H });
  } catch (e) { return erroGP(e, "Não foi possível enviar o comentário."); }
}
