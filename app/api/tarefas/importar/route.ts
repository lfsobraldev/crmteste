import { NextResponse } from "next/server";
import { tarefaImportada } from "@/lib/regras";
import { erroGP, exigirEquipe, H, q, regra } from "@/lib/servidor";

export const runtime = "nodejs";

/** Migração do protótipo: recebe o dados-tarefas.json ({ tarefas: [...] }). Ids já existentes são ignorados (não duplica). */
export async function POST(req: Request) {
  try {
    const c = await exigirEquipe();
    const body = await req.json().catch(() => { throw regra("Arquivo JSON inválido."); });
    const lista: unknown[] = Array.isArray(body) ? body : Array.isArray(body?.tarefas) ? body.tarefas : [];
    if (!lista.length) throw regra("O arquivo não tem a lista \"tarefas\".");
    if (lista.length > 5000) throw regra("Máximo de 5.000 tarefas por importação.");
    const validas: ReturnType<typeof tarefaImportada>[] = [];
    const invalidas: string[] = [];
    for (const [i, x] of lista.entries()) {
      try { validas.push(tarefaImportada((x || {}) as Record<string, unknown>)); }
      catch { invalidas.push(String((x as { titulo?: string })?.titulo || `linha ${i + 1}`)); }
    }
    const r = validas.length ? await q(`insert into gp_tarefas(id,titulo,tipo,setor,jornada,data,hora_ini,hora_fim,responsavel,solicitante,prioridade,status,descricao,serie,recorrencia,criado_por,criado_em,atualizado_em)
      select id,titulo,tipo,setor,jornada,data,"horaIni","horaFim",responsavel,solicitante,prioridade,status,descricao,serie,recorrencia,coalesce(nullif("criadoPor",''),$2),coalesce("criadoEm",now()),coalesce("atualizadoEm",now())
      from jsonb_to_recordset($1::jsonb) x(id text,titulo text,tipo text,setor text,jornada text,data date,"horaIni" text,"horaFim" text,responsavel text,solicitante text,
        prioridade text,status text,descricao text,serie text,recorrencia text,"criadoPor" text,"criadoEm" timestamptz,"atualizadoEm" timestamptz)
      on conflict(id) do nothing returning id`, [JSON.stringify(validas), c.usuario]) : [];
    return NextResponse.json({ ok: true, inseridas: r.length, jaExistiam: validas.length - r.length, invalidas }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível importar as tarefas."); }
}
