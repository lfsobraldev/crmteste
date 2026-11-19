import { NextResponse } from "next/server";
import { z } from "zod";
import { datasRecorrencia, novaTarefaSchema, tarefaSchema } from "@/lib/regras";
import { erroGP, exigirAdmin, H, q, regra } from "@/lib/servidor";

export const runtime = "nodejs";

const COLS = `id,titulo,tipo,setor,jornada,to_char(data,'YYYY-MM-DD') data,hora_ini "horaIni",hora_fim "horaFim",responsavel,solicitante,
 prioridade,status,descricao,serie,recorrencia,criado_por "criadoPor",criado_em "criadoEm",atualizado_em "atualizadoEm"`;
const RECORDSET = `x(id text,titulo text,tipo text,setor text,jornada text,data date,"horaIni" text,"horaFim" text,responsavel text,solicitante text,
 prioridade text,status text,descricao text,serie text,recorrencia text)`;

/** Tarefas e reuniões da equipe (Agenda, Kanban, Lista, Planejamento): só Administrador/Atendente. */
export async function GET() {
  try {
    await exigirAdmin();
    return NextResponse.json({ tarefas: await q(`select ${COLS} from gp_tarefas order by data,hora_ini`) }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível carregar as tarefas."); }
}

/** Cadastro (com repetição). Ids derivados da chave do formulário: reenvio não duplica. */
export async function POST(req: Request) {
  try {
    const c = await exigirAdmin();
    const b = novaTarefaSchema.parse(await req.json());
    const datas = datasRecorrencia(b.dados.data, b.recorrencia, b.ate || b.dados.data);
    if (datas.length > 370) throw regra(`Repetição gera ${datas.length} ocorrências; reduza a data final (máx. 370).`);
    const serie = datas.length > 1 ? "s" + b.chave.replace(/-/g, "").slice(0, 20) : null;
    const linhas = datas.map((data, i) => ({ ...b.dados, data, id: datas.length > 1 ? `${b.chave}-${i}` : b.chave, serie, recorrencia: serie ? b.recorrencia : null }));
    const r = await q(`insert into gp_tarefas(id,titulo,tipo,setor,jornada,data,hora_ini,hora_fim,responsavel,solicitante,prioridade,status,descricao,serie,recorrencia,criado_por)
      select id,titulo,tipo,setor,jornada,data,"horaIni","horaFim",responsavel,solicitante,prioridade,status,descricao,serie,recorrencia,$2
      from jsonb_to_recordset($1::jsonb) ${RECORDSET} on conflict(id) do nothing returning id`, [JSON.stringify(linhas), c.usuario]);
    return NextResponse.json({ ok: true, criadas: r.length, total: datas.length }, { status: 201, headers: H });
  } catch (e) { return erroGP(e, "Não foi possível salvar a tarefa."); }
}

const editarSchema = z.object({ id: z.string().min(1).max(64), dados: tarefaSchema.optional(), status: z.enum(["afazer", "andamento", "aguardando", "concluido", "cancelado"]).optional(), serie: z.boolean().default(false) });

/** Edição completa (dados) ou só o status (arrastar no Kanban). Com serie=true vale para as próximas ocorrências, exceto status e data. */
export async function PATCH(req: Request) {
  try {
    await exigirAdmin();
    const b = editarSchema.parse(await req.json());
    const [t] = await q("select id,serie,to_char(data,'YYYY-MM-DD') data from gp_tarefas where id=$1", [b.id]);
    if (!t) return NextResponse.json({ error: "Tarefa não encontrada (pode ter sido excluída). Recarregue." }, { status: 404, headers: H });
    if (!b.dados) {
      if (!b.status) throw regra("Nada para alterar.");
      await q("update gp_tarefas set status=$2,atualizado_em=now() where id=$1", [b.id, b.status]);
      return NextResponse.json({ ok: true, alteradas: 1 }, { headers: H });
    }
    const d = b.dados;
    await q(`update gp_tarefas set titulo=$2,tipo=$3,setor=$4,jornada=$5,data=$6,hora_ini=$7,hora_fim=$8,responsavel=$9,solicitante=$10,prioridade=$11,status=$12,descricao=$13,atualizado_em=now() where id=$1`,
      [b.id, d.titulo, d.tipo, d.setor, d.jornada, d.data, d.horaIni, d.horaFim, d.responsavel, d.solicitante, d.prioridade, d.status, d.descricao]);
    let outras = 0;
    if (b.serie && t.serie) {
      const r = await q(`update gp_tarefas set titulo=$3,tipo=$4,setor=$5,jornada=$6,hora_ini=$7,hora_fim=$8,responsavel=$9,solicitante=$10,prioridade=$11,descricao=$12,atualizado_em=now()
        where serie=$1 and data>=$2::date and id<>$13 returning id`, [t.serie, t.data, d.titulo, d.tipo, d.setor, d.jornada, d.horaIni, d.horaFim, d.responsavel, d.solicitante, d.prioridade, d.descricao, b.id]);
      outras = r.length;
    }
    return NextResponse.json({ ok: true, alteradas: 1 + outras }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível salvar a tarefa."); }
}

/** Exclusão (?id=, &serie=1 apaga esta e as próximas da série). */
export async function DELETE(req: Request) {
  try {
    await exigirAdmin();
    const u = new URL(req.url);
    const id = u.searchParams.get("id") || "";
    const [t] = await q("select id,serie,to_char(data,'YYYY-MM-DD') data from gp_tarefas where id=$1", [id]);
    if (!t) return NextResponse.json({ ok: true, excluidas: 0 }, { headers: H });
    const r = u.searchParams.get("serie") === "1" && t.serie
      ? await q("delete from gp_tarefas where serie=$1 and data>=$2::date returning id", [t.serie, t.data])
      : await q("delete from gp_tarefas where id=$1 returning id", [id]);
    return NextResponse.json({ ok: true, excluidas: r.length }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível excluir."); }
}
