import { NextResponse } from "next/server";
import { hojeBR } from "@/lib/datas";
import { COLUNAS_CHAMADO, lerChamado, lerListas, listarAtendentes } from "@/lib/consultas";
import { alterarChamadoSchema, diferencasChamado, isUuid, normalizarTitulo, novoChamadoSchema, podeVerChamado } from "@/lib/regras";
import { contextoGP, erroGP, exigirAdmin, H, q, regra } from "@/lib/servidor";

export const runtime = "nodejs";

/** Lista (atendente: todos; solicitante: só os próprios) ou, com ?id=, o detalhe com histórico e anexos. */
export async function GET(req: Request) {
  try {
    const c = await contextoGP();
    const id = new URL(req.url).searchParams.get("id") || "";
    if (id) {
      if (!isUuid(id)) throw regra("Chamado inválido.");
      const ch = await lerChamado(id);
      if (!ch || !podeVerChamado(c.papel, c.usuario, ch)) return NextResponse.json({ error: "Chamado não encontrado." }, { status: 404, headers: H });
      const [eventos, anexos] = await Promise.all([
        q("select id::int id,tipo,texto,de,para,autor_usuario,autor_nome,criado_em from gp_chamado_eventos where chamado_id=$1 order by id", [id]),
        q("select id,nome,mime,tamanho,enviado_por,enviado_nome,criado_em from gp_chamado_anexos where chamado_id=$1 order by criado_em", [id]),
      ]);
      return NextResponse.json({ chamado: ch, eventos, anexos, hoje: hojeBR() }, { headers: H });
    }
    const filtro = c.papel === "admin" ? "" : "where c.solicitante_usuario=$1";
    const chamados = await q(`select ${COLUNAS_CHAMADO},
      (select count(*)::int from gp_chamado_eventos e where e.chamado_id=c.id and e.tipo='comentario') comentarios,
      (select count(*)::int from gp_chamado_anexos a where a.chamado_id=c.id) anexos
      from gp_chamados c ${filtro} order by c.numero desc limit 5000`, c.papel === "admin" ? [] : [c.usuario]);
    return NextResponse.json({ chamados, hoje: hojeBR() }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível carregar os chamados."); }
}

/** Abertura: qualquer colaborador com login. Solicitante e data vêm da sessão/servidor. Reenvio da mesma chave não duplica. */
export async function POST(req: Request) {
  try {
    const c = await contextoGP();
    const b = novoChamadoSchema.parse(await req.json());
    const [existente] = await q("select id,numero::int numero from gp_chamados where chave=$1", [b.chave]);
    if (existente) return NextResponse.json({ ok: true, id: existente.id, numero: existente.numero, repetido: true }, { headers: H });
    const listas = await lerListas();
    if (!listas.sistemas.includes(b.sistema)) throw regra("Sistema não cadastrado. Escolha um da lista.");
    const abertos = await q("select numero::int numero,titulo from gp_chamados where solicitante_usuario=$1 and sistema=$2 and status<>'concluido'", [c.usuario, b.sistema]);
    const igual = abertos.find((x) => normalizarTitulo(x.titulo) === normalizarTitulo(b.titulo));
    if (igual) return NextResponse.json({ error: `Você já tem o chamado #${igual.numero} aberto com este título para ${b.sistema}. Acompanhe ou comente nele.`, numero: igual.numero, codigo: "DUPLICADO" }, { status: 409, headers: H });
    const [r] = await q(`with novo as (
        insert into gp_chamados(chave,titulo,sistema,tipo,descricao,prioridade,solicitante_usuario,solicitante_nome)
        values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(chave) do nothing returning id,numero)
      , ev as (insert into gp_chamado_eventos(chamado_id,tipo,texto,autor_usuario,autor_nome) select id,'abertura','Chamado aberto',$7,$8 from novo)
      select id,numero::int numero from novo`, [b.chave, b.titulo, b.sistema, b.tipo, b.descricao, b.prioridade, c.usuario, c.nome]);
    if (!r) { const [x] = await q("select id,numero::int numero from gp_chamados where chave=$1", [b.chave]); return NextResponse.json({ ok: true, id: x.id, numero: x.numero, repetido: true }, { headers: H }); }
    return NextResponse.json({ ok: true, id: r.id, numero: r.numero }, { status: 201, headers: H });
  } catch (e) { return erroGP(e, "Não foi possível abrir o chamado."); }
}

/** Classificação e andamento (somente Administrador/Atendente). Cada mudança vira histórico; versão evita sobrescrever. */
export async function PATCH(req: Request) {
  try {
    const c = await exigirAdmin();
    const b = alterarChamadoSchema.parse(await req.json());
    const atual = await lerChamado(b.id);
    if (!atual) throw new Error("GP_CHAMADO_NAO_ENCONTRADO");
    if (atual.versao !== b.versao) throw new Error("GP_VERSAO_DESATUALIZADA");
    const { id, versao, ...pedido } = b;
    const d: Record<string, string> = diferencasChamado(atual as never, pedido);
    if (!Object.keys(d).length) return NextResponse.json({ ok: true, chamado: atual, semAlteracao: true }, { headers: H });
    if (d.sistema && !(await lerListas()).sistemas.includes(d.sistema)) throw regra("Sistema não cadastrado.");
    if (d.responsavel_usuario !== undefined && d.responsavel_usuario) {
      const at = (await listarAtendentes()).find((a) => a.usuario === d.responsavel_usuario);
      if (!at) throw regra("O responsável precisa ser um atendente cadastrado.");
      d.responsavel_nome = at.nome;
    }
    const [r] = await q("select gp_atualizar_chamado($1,$2,$3::jsonb,$4,$5) chamado", [id, versao, JSON.stringify(d), c.usuario, c.nome]);
    return NextResponse.json({ ok: true, chamado: r.chamado }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível atualizar o chamado."); }
}
