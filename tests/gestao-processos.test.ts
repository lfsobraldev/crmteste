import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  alterarChamadoSchema, chamadoAtrasado, datasRecorrencia, diferencasChamado, normalizarListas, normalizarTitulo,
  novoChamadoSchema, podeVerChamado, conferirMudancaAdmin, novoUsuarioSchema, emailCorporativo, problemaSenha, loginSchema, ehEquipe, tarefaImportada, tarefaSchema, tipoAnexo, nomeArquivoSeguro, SISTEMAS_PADRAO,
} from "../lib/regras";
import { conferirSenha, criarToken, hashSenha, lerToken } from "../lib/auth";

const CHAVE = "7d2b8f0e-3c1a-4e5b-9a6d-1f2e3d4c5b6a";

test("abertura de chamado: campos obrigatórios, tipos e prioridades da Central", () => {
  const ok = novoChamadoSchema.parse({ chave: CHAVE, titulo: "  Erro ao salvar apontamento ", sistema: "Porta Certa", tipo: "Erro", prioridade: "Crítica", descricao: "Ao clicar em salvar aparece erro 500." });
  assert.equal(ok.titulo, "Erro ao salvar apontamento");
  assert.throws(() => novoChamadoSchema.parse({ ...ok, titulo: "abc" }), /5 caracteres/);
  assert.throws(() => novoChamadoSchema.parse({ ...ok, descricao: "curta" }), /10 caracteres/);
  assert.throws(() => novoChamadoSchema.parse({ ...ok, tipo: "Bug" }), /tipo/);
  assert.throws(() => novoChamadoSchema.parse({ ...ok, prioridade: "Urgente" }), /prioridade/);
  assert.throws(() => novoChamadoSchema.parse({ ...ok, chave: "x" }), /Identificador/);
  assert.deepEqual(SISTEMAS_PADRAO, ["Famossul | Gestão de Produção", "Tetto Revest", "Inventário", "Porta Certa", "Outros"]);
});

test("permissões e usuários: solicitante só os próprios chamados; sempre há um administrador", () => {
  assert.equal(podeVerChamado("solicitante", "caio", { solicitante_usuario: "caio" }), true);
  assert.equal(podeVerChamado("solicitante", "caio", { solicitante_usuario: "ana" }), false);
  assert.equal(podeVerChamado("admin", "bia", { solicitante_usuario: "ana" }), true);
  assert.match(conferirMudancaAdmin({ eu: true, eraAdminAtivo: true, seraAdminAtivo: false, outrosAdminsAtivos: 3 }) || "", /próprio/);
  assert.match(conferirMudancaAdmin({ eu: false, eraAdminAtivo: true, seraAdminAtivo: false, outrosAdminsAtivos: 0 }) || "", /pelo menos um/);
  assert.equal(conferirMudancaAdmin({ eu: false, eraAdminAtivo: true, seraAdminAtivo: false, outrosAdminsAtivos: 1 }), null);
  assert.equal(podeVerChamado("atendente", "bia", { solicitante_usuario: "ana" }), true);
  assert.equal(ehEquipe("solicitante"), false);
  const u = novoUsuarioSchema.parse({ email: " Joao.Silva@FAMOSSUL.com.br ", nome: "João", papel: "atendente" });
  assert.equal(u.email, "joao.silva@famossul.com.br");
  assert.equal(u.enviarConvite, true);
  assert.throws(() => novoUsuarioSchema.parse({ ...u, papel: "dono" }), /perfil/);
  assert.throws(() => novoUsuarioSchema.parse({ ...u, email: "joao@gmail.com" }), /corporativo/);
});

test("acesso corporativo: só o domínio exato @famossul.com.br, no navegador e no servidor", async () => {
  for (const ok of ["ana@famossul.com.br", " Ana.Souza@Famossul.com.br ", "ti+teste@famossul.com.br"]) assert.equal(emailCorporativo(ok), true, ok);
  for (const ruim of ["ana@gmail.com", "ana@famossul.com", "ana@sub.famossul.com.br", "ana@famossul.com.br.evil.com", "ana@xfamossul.com.br", "anafamossul.com.br", "@famossul.com.br", "ana @famossul.com.br"]) assert.equal(emailCorporativo(ruim), false, ruim);
  assert.throws(() => loginSchema.parse({ email: "fulano@hotmail.com", senha: "x" }), /corporativo/);
  const js = await readFile("public/acesso.js", "utf8");
  assert.match(js, /famossul\\\.com\\\.br\$/);
  assert.equal(problemaSenha("curta1"), "A senha precisa ter pelo menos 8 caracteres.");
  assert.match(problemaSenha("somenteletras") || "", /letras e números/);
  assert.match(problemaSenha("joaosilva123", "joaosilva@famossul.com.br") || "", /e-mail/);
  assert.equal(problemaSenha("Processo2026", "ana@famossul.com.br"), null);
});

test("login: senha com scrypt e token assinado com validade", () => {
  process.env.AUTH_SECRET = "segredo-de-teste-0123456789abcdef";
  const h = hashSenha("Senha-Forte-1");
  assert.equal(conferirSenha("Senha-Forte-1", h), true);
  assert.equal(conferirSenha("outra", h), false);
  const agora = Date.now();
  const t = criarToken("ana", agora);
  assert.deepEqual(lerToken(t, agora + 1000), { usuario: "ana", emitidoEm: agora });
  assert.equal(lerToken(t, agora + 13 * 3600_000), null, "expira em 12 h");
  assert.equal(lerToken(t.slice(0, -2) + "xx", agora), null, "assinatura adulterada");
  assert.equal(lerToken(Buffer.from("admin|" + agora).toString("base64url") + "." + t.split(".")[1], agora), null);
});

test("alterações: só o que mudou entra no histórico; atraso calculado pelo prazo", () => {
  const atual = { status: "novo", prioridade: "Média", tipo: "Erro", sistema: "Inventário", responsavel_usuario: null, prazo: null };
  assert.deepEqual(diferencasChamado(atual, { status: "novo", prioridade: "Média", responsavel_usuario: "", prazo: "" }), {});
  assert.deepEqual(diferencasChamado(atual, { status: "triagem", responsavel_usuario: "bia", prazo: "2026-12-01" }), { status: "triagem", responsavel_usuario: "bia", prazo: "2026-12-01" });
  assert.deepEqual(diferencasChamado({ ...atual, prazo: "2026-12-01", responsavel_usuario: "bia" }, { prazo: "", responsavel_usuario: "" }), { prazo: "", responsavel_usuario: "" });
  assert.throws(() => alterarChamadoSchema.parse({ id: CHAVE, versao: 1, status: "fechado" }));
  assert.equal(chamadoAtrasado({ status: "andamento", prazo: "2026-11-18" }, "2026-11-19"), true);
  assert.equal(chamadoAtrasado({ status: "concluido", prazo: "2026-11-18" }, "2026-11-19"), false);
  assert.equal(chamadoAtrasado({ status: "novo", prazo: null }, "2026-11-19"), false);
  assert.equal(normalizarTitulo("Erro  no INVENTÁRIO!"), normalizarTitulo("erro no inventario"));
});

test("tarefas: validação, recorrência do protótipo e importação do JSON exportado", async () => {
  assert.throws(() => tarefaSchema.parse({ titulo: "Reunião", data: "2026-11-19", horaIni: "10:00", horaFim: "09:00" }), /fim/);
  assert.throws(() => tarefaSchema.parse({ titulo: "", data: "2026-11-19" }), /título/);
  assert.throws(() => tarefaSchema.parse({ titulo: "x", data: "2026-02-30" }), /Data/);
  assert.deepEqual(datasRecorrencia("2026-11-20", "diaria", "2026-11-25"), ["2026-11-20", "2026-11-23", "2026-11-24", "2026-11-25"]);
  assert.deepEqual(datasRecorrencia("2026-01-31", "mensal", "2026-04-30"), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.equal(datasRecorrencia("2026-01-01", "diaria", "2028-01-01").length > 370, true);
  const json = JSON.parse(await readFile("docs/dados-tarefas.json", "utf8")) as { tarefas: Record<string, unknown>[] };
  const t = json.tarefas.map(tarefaImportada);
  assert.equal(t.length, 13);
  assert.ok(t.every((x) => x.id && x.titulo && /^\d{4}-\d{2}-\d{2}$/.test(x.data)));
  assert.throws(() => tarefaImportada({ id: "../x", titulo: "a", data: "2026-01-01" }));
  const l = normalizarListas({ setores: [" PCP ", "PCP", ""], sistemas: ["Inventário"] });
  assert.deepEqual(l.setores, ["PCP"]);
  assert.deepEqual(l.sistemas, ["Inventário"]);
  assert.ok(l.jornadas.includes("Manhã"));
});

test("anexos: tipo real pelo conteúdo, não pela extensão", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal(tipoAnexo(png, "print.png"), "image/png");
  assert.equal(tipoAnexo(new TextEncoder().encode("%PDF-1.7 ..."), "doc.pdf"), "application/pdf");
  assert.equal(tipoAnexo(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2]), "planilha.xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(tipoAnexo(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2]), "virus.exe"), null);
  assert.equal(tipoAnexo(new TextEncoder().encode("coluna;valor\n1;2"), "dados.csv"), "text/csv; charset=utf-8");
  assert.equal(tipoAnexo(new Uint8Array([0x4d, 0x5a, 0, 1]), "log.txt"), null);
  assert.equal(tipoAnexo(new TextEncoder().encode("<script>"), "pagina.html"), null);
  assert.equal(nomeArquivoSeguro("../../etc/passwd"), ".._.._etc_passwd");
});

test("banco: abertura sem duplicar, histórico automático, versão e conclusão", async () => {
  const schema = await readFile("db/schema.sql", "utf8");
  const db = new PGlite();
  try {
    await db.exec(schema);
    await db.exec(schema); // idempotente
    await assert.rejects(db.query("insert into gp_usuarios(usuario,email,nome) values('x@gmail.com','x@gmail.com','X')"), /check/);
    await assert.rejects(db.query("insert into gp_usuarios(usuario,email,nome,papel) values('y@famossul.com.br','y@famossul.com.br','Y','dono')"), /check/);
    await db.query("insert into gp_usuarios(usuario,email,nome) values('ana@famossul.com.br','ana@famossul.com.br','Ana')");
    await assert.rejects(db.query("insert into gp_usuarios(usuario,email,nome) values('ANA2','ana@famossul.com.br','Ana 2')"), /duplicate|unique/, "e-mail único");
    const abrir = `with novo as (insert into gp_chamados(chave,titulo,sistema,tipo,descricao,prioridade,solicitante_usuario,solicitante_nome)
      values($1,'Erro no inventário','Inventário','Erro','Tela de contagem não salva.','Alta','caio','Caio') on conflict(chave) do nothing returning id,numero)
      , ev as (insert into gp_chamado_eventos(chamado_id,tipo,texto,autor_usuario,autor_nome) select id,'abertura','Chamado aberto','caio','Caio' from novo)
      select id,numero from novo`;
    const r1 = (await db.query<{ id: string; numero: number }>(abrir, [CHAVE])).rows;
    const r2 = (await db.query(abrir, [CHAVE])).rows;
    assert.equal(r1.length, 1);
    assert.equal(r2.length, 0, "a mesma chave não cria outro chamado");
    const id = r1[0].id;
    const upd = (versao: number, dados: object) => db.query<{ c: Record<string, unknown> }>("select gp_atualizar_chamado($1,$2,$3::jsonb,'bia','Bia') c", [id, versao, JSON.stringify(dados)]);
    const a = (await upd(1, { status: "triagem", responsavel_usuario: "bia", responsavel_nome: "Bia", prazo: "2026-11-30", prioridade: "Crítica" })).rows[0].c;
    assert.equal(a.versao, 2);
    assert.equal(a.responsavel_nome, "Bia");
    await assert.rejects(upd(1, { status: "andamento" }), /GP_VERSAO_DESATUALIZADA/);
    const b = (await upd(2, { status: "concluido", comentario: "Corrigido." })).rows[0].c;
    assert.ok(b.concluido_em);
    const c = (await upd(3, { status: "andamento", responsavel_usuario: "", prazo: "" })).rows[0].c;
    assert.equal(c.concluido_em, null);
    assert.equal(c.responsavel_usuario, null);
    assert.equal(c.prazo, null);
    const ev = (await db.query<{ tipo: string; de: string; para: string; texto: string }>("select tipo,de,para,texto from gp_chamado_eventos where chamado_id=$1 order by id", [id])).rows;
    assert.deepEqual(ev.map((e) => e.tipo), ["abertura", "status", "prioridade", "responsavel", "prazo", "status", "comentario", "status", "responsavel", "prazo"]);
    assert.deepEqual(ev[1], { tipo: "status", de: "novo", para: "triagem", texto: "" });
    assert.equal(ev[8].de, "Bia");
    await assert.rejects(db.query("insert into gp_chamados(chave,titulo,sistema,tipo,descricao,solicitante_usuario) values(gen_random_uuid(),'Título ok','X','Erro','Descrição suficiente','u') returning id").then(() => db.query("insert into gp_chamado_eventos(chamado_id,tipo,autor_usuario) values($1,'apagar','u')", [id])), /check/);
    await assert.rejects(db.query("insert into gp_tarefas(id,titulo,data,hora_ini,hora_fim) values('t1','Reunião','2026-11-19','10:00','09:00')"), /check/);
  } finally { await db.close(); }
});

test("banco: atualiza a instalação anterior (login por usuário) sem perder contas", async () => {
  const schema = await readFile("db/schema.sql", "utf8");
  const db = new PGlite();
  try {
    await db.exec(`create table gp_usuarios(id uuid primary key default gen_random_uuid(),usuario varchar(60) not null unique check(usuario ~ '^[a-z0-9._-]{3,60}$'),
      nome varchar(160) not null,email varchar(160) not null default '',setor varchar(80) not null default '',papel varchar(12) not null default 'solicitante' check(papel in('admin','solicitante')),
      senha_hash text not null,ativo boolean not null default true,falhas_login integer not null default 0,bloqueado_ate timestamptz,sessao_desde timestamptz not null default now(),
      criado_por varchar(60) not null default '',criado_em timestamptz not null default now(),atualizado_em timestamptz not null default now());
      insert into gp_usuarios(usuario,nome,papel,senha_hash) values('admin','Administrador','admin','scrypt$x$y');`);
    await db.exec(schema);
    const r = (await db.query<{ usuario: string; ativado: boolean }>("select usuario,ativado_em is not null ativado from gp_usuarios")).rows;
    assert.deepEqual(r, [{ usuario: "admin", ativado: true }]);
    await db.query("insert into gp_usuarios(usuario,email,nome,papel) values('bia@famossul.com.br','bia@famossul.com.br','Bia','atendente')");
    const [{ id }] = (await db.query<{ id: string }>("select id from gp_usuarios where usuario='bia@famossul.com.br'")).rows;
    await db.query("insert into gp_tokens(usuario_id,tipo,token_hash,expira_em) values($1,'ativacao',$2,now()+interval '30 minutes')", [id, "a".repeat(64)]);
    const uso = "update gp_tokens set usado_em=now() where token_hash=$1 and usado_em is null and expira_em>now() returning id";
    assert.equal((await db.query(uso, ["a".repeat(64)])).rows.length, 1);
    assert.equal((await db.query(uso, ["a".repeat(64)])).rows.length, 0, "uso único");
    await db.query("insert into gp_tokens(usuario_id,tipo,token_hash,expira_em) values($1,'recuperacao',$2,now()-interval '1 minute')", [id, "b".repeat(64)]);
    assert.equal((await db.query(uso, ["b".repeat(64)])).rows.length, 0, "expirado");
  } finally { await db.close(); }
});
