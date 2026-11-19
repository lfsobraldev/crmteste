/** Consultas compartilhadas pelas rotas. */
import { LISTAS_PADRAO, normalizarListas, type Listas } from "./regras";
import { q, type Row } from "./db";

export async function lerListas(): Promise<Listas> {
  const rows = await q("select chave,valor from gp_config where chave in ('setores','tipos','jornadas','pessoas','sistemas')");
  const l: Record<string, unknown> = { ...LISTAS_PADRAO };
  for (const r of rows) l[r.chave] = r.valor;
  return normalizarListas(l);
}

/** Quem pode ser responsável: administradores e atendentes ativos e com acesso ativado. */
export async function listarAtendentes(): Promise<{ usuario: string; nome: string }[]> {
  return (await q("select usuario,nome from gp_usuarios where papel in('admin','atendente') and ativo and senha_hash is not null order by nome")) as { usuario: string; nome: string }[];
}

export const COLUNAS_CHAMADO = `c.id,c.numero::int numero,c.titulo,c.sistema,c.tipo,c.prioridade,c.status,c.solicitante_usuario,c.solicitante_nome,
 c.responsavel_usuario,c.responsavel_nome,to_char(c.prazo,'YYYY-MM-DD') prazo,c.versao,c.criado_em,c.atualizado_em,c.concluido_em`;

export async function lerChamado(id: string) {
  const [c] = await q(`select ${COLUNAS_CHAMADO},c.descricao from gp_chamados c where c.id=$1`, [id]);
  return c as Row | undefined;
}
