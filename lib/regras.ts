/**
 * Gestão de Processos + Central de Chamados — regras puras (sem banco), usadas pelas rotas e pelos testes.
 * A tela (public/gestao-processos/app.js) repete só os rótulos; validação e permissão valem no servidor.
 */
import { z } from "zod";

export const STATUS_CHAMADO = [
  { id: "novo", n: "Novos" },
  { id: "triagem", n: "Em triagem" },
  { id: "andamento", n: "Em andamento" },
  { id: "aguardando", n: "Aguardando retorno" },
  { id: "concluido", n: "Concluídos" },
] as const;
export type StatusChamado = (typeof STATUS_CHAMADO)[number]["id"];
export const STATUS_CHAMADO_IDS = STATUS_CHAMADO.map((s) => s.id) as [StatusChamado, ...StatusChamado[]];
export const PRIORIDADES_CHAMADO = ["Baixa", "Média", "Alta", "Crítica"] as const;
export const TIPOS_CHAMADO = ["Erro", "Melhoria", "Dúvida", "Acesso", "Nova funcionalidade"] as const;
export const SISTEMAS_PADRAO = ["Famossul | Gestão de Produção", "Tetto Revest", "Inventário", "Porta Certa", "Outros"];

export const STATUS_TAREFA = ["afazer", "andamento", "aguardando", "concluido", "cancelado"] as const;
export const PRIORIDADES_TAREFA = ["Baixa", "Média", "Alta", "Urgente"] as const;
export const RECORRENCIAS = ["diaria", "semanal", "quinzenal", "mensal", "trimestral", "anual"] as const;

/** Listas padrão do protótipo (DEF_LISTS) + sistemas atendidos pela Central de Chamados. */
export const LISTAS_PADRAO = {
  setores: ["Comercial", "Inteligência de Mercado", "Financeiro", "Produção", "PCP", "Logística", "Compras", "Marketing", "RH", "Diretoria"],
  tipos: ["Reunião", "Tarefa", "Relatório / Indicadores", "Desenvolvimento de sistema", "Melhoria de processo", "Atendimento a representante", "Prospecção", "Visita"],
  jornadas: ["Manhã", "Tarde", "Dia inteiro"],
  pessoas: [] as string[],
  sistemas: SISTEMAS_PADRAO,
};
export type Listas = typeof LISTAS_PADRAO;
export const CHAVES_LISTAS = ["setores", "tipos", "jornadas", "pessoas", "sistemas"] as const;

/** Limite por arquivo (o mesmo dos demais anexos do ERP) e por chamado. */
export const ANEXO_MAX_BYTES = 3 * 1024 * 1024;
export const ANEXOS_POR_CHAMADO = 20;

const texto = (max: number, msg?: string) => z.string({ invalid_type_error: msg }).transform((s) => s.trim()).pipe(z.string().max(max, msg));
const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").refine((s) => !Number.isNaN(Date.parse(s + "T12:00:00Z")) && new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s, "Data inválida.");
const hora = z.string().trim().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuid = z.string().regex(UUID, "Identificador inválido.");
export const isUuid = (v: unknown) => typeof v === "string" && UUID.test(v);

export const novoChamadoSchema = z.object({
  chave: uuid,
  titulo: texto(140, "O título pode ter até 140 caracteres.").pipe(z.string().min(5, "Informe um título com pelo menos 5 caracteres.")),
  sistema: texto(80).pipe(z.string().min(1, "Selecione o sistema relacionado.")),
  tipo: z.enum(TIPOS_CHAMADO, { errorMap: () => ({ message: "Selecione o tipo de solicitação." }) }),
  prioridade: z.enum(PRIORIDADES_CHAMADO, { errorMap: () => ({ message: "Selecione a prioridade." }) }),
  descricao: texto(8000, "A descrição pode ter até 8.000 caracteres.").pipe(z.string().min(10, "Descreva a solicitação com pelo menos 10 caracteres.")),
});
export type NovoChamado = z.infer<typeof novoChamadoSchema>;

export const alterarChamadoSchema = z.object({
  id: uuid,
  versao: z.number().int().min(1),
  status: z.enum(STATUS_CHAMADO_IDS).optional(),
  prioridade: z.enum(PRIORIDADES_CHAMADO).optional(),
  tipo: z.enum(TIPOS_CHAMADO).optional(),
  sistema: texto(80).pipe(z.string().min(1, "Selecione o sistema.")).optional(),
  responsavel_usuario: texto(160).optional(),
  prazo: z.union([z.literal(""), dataISO]).optional(),
  comentario: texto(8000, "O comentário pode ter até 8.000 caracteres.").optional(),
});
export type AlterarChamado = z.infer<typeof alterarChamadoSchema>;

export const comentarioSchema = z.object({
  id: uuid,
  texto: texto(8000, "O comentário pode ter até 8.000 caracteres.").pipe(z.string().min(1, "Escreva o comentário.")),
});

export type ChamadoAtual = { status: string; prioridade: string; tipo: string; sistema: string; responsavel_usuario: string | null; prazo: string | null };
/** Só os campos que realmente mudaram (evita histórico com alteração vazia). */
export function diferencasChamado(atual: ChamadoAtual, pedido: Omit<AlterarChamado, "id" | "versao">) {
  const d: Record<string, string> = {};
  for (const k of ["status", "prioridade", "tipo", "sistema"] as const) if (pedido[k] !== undefined && pedido[k] !== atual[k]) d[k] = pedido[k] as string;
  if (pedido.responsavel_usuario !== undefined && (pedido.responsavel_usuario || null) !== (atual.responsavel_usuario || null)) d.responsavel_usuario = pedido.responsavel_usuario;
  if (pedido.prazo !== undefined && (pedido.prazo || null) !== (atual.prazo ? String(atual.prazo).slice(0, 10) : null)) d.prazo = pedido.prazo;
  if (pedido.comentario) d.comentario = pedido.comentario;
  return d;
}

/** Atrasado = tem prazo, o prazo já passou e o chamado não foi concluído (calculado, não gravado). */
export const chamadoAtrasado = (c: { status: string; prazo?: string | null }, hoje: string) => c.status !== "concluido" && !!c.prazo && String(c.prazo).slice(0, 10) < hoje;

/** Título comparável para barrar o mesmo chamado aberto duas vezes. */
export const normalizarTitulo = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export type PapelGP = "admin" | "solicitante";
export const PAPEIS = ["admin", "solicitante"] as const;

/* ---------- Usuários (login próprio) ---------- */
export const SENHA_MIN = 8;
export const loginUsuario = (v: string) => String(v || "").trim().toLowerCase();
const senha = z.string().min(SENHA_MIN, `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`).max(200, "Senha longa demais.");
const login = z.string().transform(loginUsuario).pipe(z.string().regex(/^[a-z0-9._-]{3,60}$/, "Login: 3 a 60 caracteres, só letras minúsculas, números, ponto, hífen ou sublinhado."));
export const novoUsuarioSchema = z.object({
  usuario: login,
  nome: texto(160).pipe(z.string().min(2, "Informe o nome.")),
  email: texto(160).pipe(z.union([z.literal(""), z.string().email("E-mail inválido.")])).default(""),
  setor: texto(80).default(""),
  papel: z.enum(PAPEIS, { errorMap: () => ({ message: "Escolha o perfil." }) }),
  senha,
});
export const editarUsuarioSchema = z.object({
  id: uuid,
  nome: texto(160).pipe(z.string().min(2, "Informe o nome.")),
  email: texto(160).pipe(z.union([z.literal(""), z.string().email("E-mail inválido.")])).default(""),
  setor: texto(80).default(""),
  papel: z.enum(PAPEIS),
  ativo: z.boolean(),
  senha: z.union([z.literal(""), senha]).default(""),
});
export const trocarSenhaSchema = z.object({ atual: z.string().min(1, "Informe a senha atual."), nova: senha });
/** Nunca deixar o sistema sem administrador ativo, nem o próprio administrador se rebaixar/desativar. */
export function conferirMudancaAdmin(p: { eu: boolean; eraAdminAtivo: boolean; seraAdminAtivo: boolean; outrosAdminsAtivos: number }) {
  if (p.eu && !p.seraAdminAtivo) return "Você não pode tirar o seu próprio acesso de administrador nem desativar a sua conta.";
  if (p.eraAdminAtivo && !p.seraAdminAtivo && p.outrosAdminsAtivos === 0) return "É preciso manter pelo menos um administrador ativo.";
  return null;
}
/** Quem pode ver/comentar um chamado: atendentes veem todos; o solicitante só os próprios. */
export const podeVerChamado = (papel: PapelGP, usuario: string, c: Record<string, unknown>) => papel === "admin" || c.solicitante_usuario === usuario;

/* ---------- Tarefas ---------- */
export const tarefaSchema = z.object({
  titulo: texto(140, "O título pode ter até 140 caracteres.").pipe(z.string().min(1, "Preencha o título e a data.")),
  tipo: texto(80).default(""),
  setor: texto(80).default(""),
  jornada: texto(80).default(""),
  data: dataISO,
  horaIni: hora.default(""),
  horaFim: hora.default(""),
  responsavel: texto(80).default(""),
  solicitante: texto(80).default(""),
  prioridade: z.enum(PRIORIDADES_TAREFA).default("Média"),
  status: z.enum(STATUS_TAREFA).default("afazer"),
  descricao: texto(4000).default(""),
}).refine((t) => !t.horaIni || !t.horaFim || t.horaFim > t.horaIni, { message: "O horário de fim precisa ser depois do início.", path: ["horaFim"] });
export type Tarefa = z.infer<typeof tarefaSchema>;

export const novaTarefaSchema = z.object({
  chave: uuid,
  dados: tarefaSchema,
  recorrencia: z.enum(["nao", "diaria", "semanal", "quinzenal", "mensal", "trimestral", "anual"]).default("nao"),
  ate: z.union([z.literal(""), dataISO]).default(""),
});

const somaDias = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const somaMeses = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0, 12)).getUTCDate();
  alvo.setUTCDate(Math.min(dd, ultimo));
  return alvo.toISOString().slice(0, 10);
};
const diaSemana = (d: string) => new Date(d + "T12:00:00Z").getUTCDay();
/** Mesmas regras do protótipo: diária pula sábado e domingo; máximo de 370 ocorrências (o chamador valida). */
export function datasRecorrencia(inicio: string, rec: string, ate: string): string[] {
  const out = [inicio];
  if (rec === "nao") return out;
  const fim = !ate || ate < inicio ? inicio : ate;
  let d = inicio;
  for (let i = 1; out.length < 1000; i++) {
    let n: string;
    if (rec === "diaria") { d = somaDias(d, 1); while ([0, 6].includes(diaSemana(d))) d = somaDias(d, 1); n = d; }
    else if (rec === "semanal") n = somaDias(inicio, 7 * i);
    else if (rec === "quinzenal") n = somaDias(inicio, 14 * i);
    else if (rec === "mensal") n = somaMeses(inicio, i);
    else if (rec === "trimestral") n = somaMeses(inicio, 3 * i);
    else if (rec === "anual") n = somaMeses(inicio, 12 * i);
    else break;
    if (n > fim) break;
    out.push(n);
  }
  return out;
}

/** Remove vazios/duplicados e limita o tamanho de cada item. */
export function normalizarListas(l: Partial<Record<string, unknown>>): Listas {
  const out = {} as Listas;
  for (const k of CHAVES_LISTAS) {
    const v = Array.isArray(l[k]) ? (l[k] as unknown[]) : LISTAS_PADRAO[k];
    out[k] = [...new Set(v.map((x) => String(x ?? "").trim().slice(0, 80)).filter(Boolean))].slice(0, 300);
  }
  return out;
}

/** Converte uma tarefa exportada do protótipo (dados-tarefas.json) para o formato validado. */
export function tarefaImportada(x: Record<string, unknown>) {
  const id = String(x.id ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error("Tarefa sem identificador válido.");
  const t = tarefaSchema.parse({
    titulo: x.titulo ?? "", tipo: x.tipo ?? "", setor: x.setor ?? "", jornada: x.jornada ?? "", data: x.data ?? "",
    horaIni: x.horaIni ?? "", horaFim: x.horaFim ?? "", responsavel: x.responsavel ?? "", solicitante: x.solicitante ?? "",
    prioridade: x.prioridade || "Média", status: x.status || "afazer", descricao: x.descricao ?? "",
  });
  const serie = x.serie ? String(x.serie).slice(0, 64) : null;
  const recorrencia = (RECORRENCIAS as readonly string[]).includes(String(x.recorrencia)) ? String(x.recorrencia) : null;
  const quando = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);
  return { id, ...t, serie, recorrencia, criadoEm: quando(x.criadoEm), atualizadoEm: quando(x.atualizadoEm), criadoPor: String(x.criadoPor ?? "").slice(0, 160) };
}

/* ---------- Anexos ---------- */
const EXT_TEXTO: Record<string, string> = { txt: "text/plain", csv: "text/csv", log: "text/plain" };
const EXT_ZIP: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};
/** Tipo real pelo conteúdo (não confia no Content-Type enviado). Aceita prints, PDF, Office, ZIP e texto. */
export function tipoAnexo(b: Uint8Array, nome: string): string | null {
  const ext = (nome.split(".").pop() || "").toLowerCase();
  const ini = (bytes: number[]) => bytes.every((v, i) => b[i] === v);
  const asc = (de: number, ate: number) => String.fromCharCode(...b.subarray(de, ate));
  if (b.length > 4 && ini([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (b.length > 8 && ini([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (b.length > 12 && asc(0, 4) === "RIFF" && asc(8, 12) === "WEBP") return "image/webp";
  if (b.length > 6 && (asc(0, 6) === "GIF87a" || asc(0, 6) === "GIF89a")) return "image/gif";
  if (b.length > 5 && asc(0, 5) === "%PDF-") return "application/pdf";
  if (b.length > 4 && ini([0x50, 0x4b, 0x03, 0x04])) return EXT_ZIP[ext] || null;
  if (EXT_TEXTO[ext] && !b.includes(0)) {
    try { new TextDecoder("utf-8", { fatal: true }).decode(b); return EXT_TEXTO[ext] + "; charset=utf-8"; }
    catch { try { new TextDecoder("windows-1252").decode(b); return EXT_TEXTO[ext]; } catch { return null; } }
  }
  return null;
}
export const nomeArquivoSeguro = (n: string) => (n.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").replace(/\s+/g, " ").trim().slice(-160) || "anexo");
/** Imagens e PDF abrem no navegador; o resto baixa. */
export const abreNoNavegador = (mime: string) => /^image\/(jpeg|png|webp|gif)$/.test(mime) || mime === "application/pdf";
