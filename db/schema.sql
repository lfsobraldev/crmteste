-- Gestão de Processos Famossul + Central de Chamados — estrutura completa do banco (PostgreSQL 13+).
-- Idempotente: pode rodar mais de uma vez (npm run db:migrar). Só cria objetos; não apaga dados.

-- Usuários (acesso corporativo: e-mail @famossul.com.br + senha). papel: admin | atendente | solicitante.
-- senha_hash nulo = conta autorizada pelo administrador e ainda não ativada (primeiro acesso por link no e-mail).
create table if not exists gp_usuarios(
 id uuid primary key default gen_random_uuid(),
 usuario varchar(160) not null unique,
 nome varchar(160) not null check(length(trim(nome))>0),
 email varchar(160) not null default '',
 setor varchar(80) not null default '',
 papel varchar(12) not null default 'solicitante',
 senha_hash text,
 ativo boolean not null default true,
 falhas_login integer not null default 0,
 bloqueado_ate timestamptz,
 sessao_desde timestamptz not null default now(),
 ultimo_acesso timestamptz,
 ativado_em timestamptz,
 criado_por varchar(160) not null default '',
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now()
);
-- Atualização de instalações anteriores (login por nome de usuário, perfis admin/solicitante).
alter table gp_usuarios drop constraint if exists gp_usuarios_usuario_check;
alter table gp_usuarios alter column usuario type varchar(160);
alter table gp_usuarios alter column criado_por type varchar(160);
alter table gp_usuarios alter column senha_hash drop not null;
alter table gp_usuarios add column if not exists ultimo_acesso timestamptz;
alter table gp_usuarios add column if not exists ativado_em timestamptz;
update gp_usuarios set ativado_em=criado_em where ativado_em is null and senha_hash is not null;
alter table gp_usuarios drop constraint if exists gp_usuarios_papel_check;
alter table gp_usuarios add constraint gp_usuarios_papel_check check(papel in('admin','atendente','solicitante'));
alter table gp_usuarios drop constraint if exists gp_usuarios_email_check;
alter table gp_usuarios add constraint gp_usuarios_email_check check(email='' or email ~ '^[a-z0-9._%+-]+@famossul\.com\.br$') not valid;
create unique index if not exists ux_gp_usuarios_email on gp_usuarios(lower(email)) where email<>'';

-- Links de ativação (primeiro acesso) e de recuperação de senha. Guarda só o SHA-256 do token; uso único e validade curta.
create table if not exists gp_tokens(
 id uuid primary key default gen_random_uuid(),
 usuario_id uuid not null references gp_usuarios(id) on delete cascade,
 tipo varchar(12) not null check(tipo in('ativacao','recuperacao')),
 token_hash char(64) not null unique,
 expira_em timestamptz not null,
 usado_em timestamptz,
 criado_em timestamptz not null default now(),
 criado_ip varchar(64) not null default ''
);
create index if not exists ix_gp_tokens_usuario on gp_tokens(usuario_id,tipo) where usado_em is null;

-- Limite de tentativas (login e pedidos de e-mail) por chave: ip:<ip>, email:<email>.
create table if not exists gp_limites(
 id bigint generated always as identity primary key,
 chave varchar(220) not null,
 criado_em timestamptz not null default now()
);
create index if not exists ix_gp_limites on gp_limites(chave,criado_em);

-- Tarefas e reuniões (uma linha por ocorrência, como no protótipo). O id é texto para aceitar os ids exportados.
create table if not exists gp_tarefas(
 id varchar(64) primary key,
 titulo varchar(140) not null check(length(trim(titulo))>0),
 tipo varchar(80) not null default '',
 setor varchar(80) not null default '',
 jornada varchar(80) not null default '',
 data date not null,
 hora_ini varchar(5) not null default '' check(hora_ini='' or hora_ini ~ '^[0-2][0-9]:[0-5][0-9]$'),
 hora_fim varchar(5) not null default '' check(hora_fim='' or hora_fim ~ '^[0-2][0-9]:[0-5][0-9]$'),
 responsavel varchar(80) not null default '',
 solicitante varchar(80) not null default '',
 prioridade varchar(10) not null default 'Média' check(prioridade in('Baixa','Média','Alta','Urgente')),
 status varchar(12) not null default 'afazer' check(status in('afazer','andamento','aguardando','concluido','cancelado')),
 descricao varchar(4000) not null default '',
 serie varchar(64),
 recorrencia varchar(12) check(recorrencia is null or recorrencia in('diaria','semanal','quinzenal','mensal','trimestral','anual')),
 criado_por varchar(160) not null default '',
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 check(hora_ini='' or hora_fim='' or hora_fim>hora_ini)
);
create index if not exists ix_gp_tarefas_data on gp_tarefas(data);
create index if not exists ix_gp_tarefas_serie on gp_tarefas(serie,data) where serie is not null;

-- Cadastros (setores, tipos, jornadas, pessoas e sistemas atendidos). Uma linha por lista.
create table if not exists gp_config(
 chave varchar(40) primary key,
 valor jsonb not null,
 atualizado_por varchar(160) not null default '',
 atualizado_em timestamptz not null default now()
);

create table if not exists gp_chamados(
 id uuid primary key default gen_random_uuid(),
 numero bigint generated always as identity unique,
 chave uuid not null unique,
 titulo varchar(140) not null check(length(trim(titulo))>=5),
 sistema varchar(80) not null check(length(trim(sistema))>0),
 tipo varchar(24) not null check(tipo in('Erro','Melhoria','Dúvida','Acesso','Nova funcionalidade')),
 descricao varchar(8000) not null check(length(trim(descricao))>=10),
 prioridade varchar(10) not null default 'Média' check(prioridade in('Baixa','Média','Alta','Crítica')),
 status varchar(12) not null default 'novo' check(status in('novo','triagem','andamento','aguardando','concluido')),
 solicitante_usuario varchar(160) not null,
 solicitante_nome varchar(160) not null default '',
 responsavel_usuario varchar(160),
 responsavel_nome varchar(160) not null default '',
 prazo date,
 versao integer not null default 1,
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 concluido_em timestamptz
);
create index if not exists ix_gp_chamados_status on gp_chamados(status,criado_em desc);
create index if not exists ix_gp_chamados_solicitante on gp_chamados(solicitante_usuario,criado_em desc);
create index if not exists ix_gp_chamados_responsavel on gp_chamados(responsavel_usuario) where responsavel_usuario is not null;

-- Comentários e alterações (histórico imutável do chamado).
create table if not exists gp_chamado_eventos(
 id bigint generated always as identity primary key,
 chamado_id uuid not null references gp_chamados(id) on delete cascade,
 tipo varchar(16) not null check(tipo in('abertura','comentario','status','prioridade','responsavel','prazo','sistema','tipo','anexo')),
 texto varchar(8000) not null default '',
 de varchar(160) not null default '',
 para varchar(160) not null default '',
 autor_usuario varchar(160) not null,
 autor_nome varchar(160) not null default '',
 criado_em timestamptz not null default now()
);
create index if not exists ix_gp_chamado_eventos on gp_chamado_eventos(chamado_id,id);

create table if not exists gp_chamado_anexos(
 id uuid primary key default gen_random_uuid(),
 chamado_id uuid not null references gp_chamados(id) on delete cascade,
 nome varchar(180) not null,
 mime varchar(120) not null,
 tamanho integer not null check(tamanho>0 and tamanho<=3145728),
 conteudo bytea not null,
 enviado_por varchar(160) not null,
 enviado_nome varchar(160) not null default '',
 criado_em timestamptz not null default now()
);
create index if not exists ix_gp_chamado_anexos on gp_chamado_anexos(chamado_id,criado_em);

-- Atualiza classificação/andamento de um chamado com controle de versão e registra cada mudança no histórico.
-- p_dados: status, prioridade, sistema, tipo, responsavel_usuario + responsavel_nome, prazo ('' limpa) e comentario.
create or replace function gp_atualizar_chamado(p_id uuid,p_versao integer,p_dados jsonb,p_autor varchar,p_autor_nome varchar)
returns jsonb language plpgsql as $$
declare a gp_chamados%rowtype; n gp_chamados%rowtype;
begin
 select * into a from gp_chamados where id=p_id for update;
 if not found then raise exception 'GP_CHAMADO_NAO_ENCONTRADO'; end if;
 if a.versao<>p_versao then raise exception 'GP_VERSAO_DESATUALIZADA'; end if;
 update gp_chamados set
  status=coalesce(nullif(p_dados->>'status',''),status),
  prioridade=coalesce(nullif(p_dados->>'prioridade',''),prioridade),
  sistema=coalesce(nullif(p_dados->>'sistema',''),sistema),
  tipo=coalesce(nullif(p_dados->>'tipo',''),tipo),
  responsavel_usuario=case when p_dados ? 'responsavel_usuario' then nullif(p_dados->>'responsavel_usuario','') else responsavel_usuario end,
  responsavel_nome=case when p_dados ? 'responsavel_usuario' then case when coalesce(p_dados->>'responsavel_usuario','')='' then '' else coalesce(p_dados->>'responsavel_nome','') end else responsavel_nome end,
  prazo=case when p_dados ? 'prazo' then nullif(p_dados->>'prazo','')::date else prazo end,
  versao=versao+1,
  atualizado_em=now()
 where id=p_id returning * into n;
 update gp_chamados set concluido_em=case when n.status='concluido' then coalesce(a.concluido_em,now()) else null end where id=p_id returning * into n;
 if n.status is distinct from a.status then
  insert into gp_chamado_eventos(chamado_id,tipo,de,para,autor_usuario,autor_nome) values(p_id,'status',a.status,n.status,p_autor,p_autor_nome);
 end if;
 if n.prioridade is distinct from a.prioridade then
  insert into gp_chamado_eventos(chamado_id,tipo,de,para,autor_usuario,autor_nome) values(p_id,'prioridade',a.prioridade,n.prioridade,p_autor,p_autor_nome);
 end if;
 if n.responsavel_usuario is distinct from a.responsavel_usuario then
  insert into gp_chamado_eventos(chamado_id,tipo,de,para,autor_usuario,autor_nome) values(p_id,'responsavel',coalesce(nullif(a.responsavel_nome,''),coalesce(a.responsavel_usuario,'')),coalesce(nullif(n.responsavel_nome,''),coalesce(n.responsavel_usuario,'')),p_autor,p_autor_nome);
 end if;
 if n.prazo is distinct from a.prazo then
  insert into gp_chamado_eventos(chamado_id,tipo,de,para,autor_usuario,autor_nome) values(p_id,'prazo',coalesce(to_char(a.prazo,'YYYY-MM-DD'),''),coalesce(to_char(n.prazo,'YYYY-MM-DD'),''),p_autor,p_autor_nome);
 end if;
 if n.sistema is distinct from a.sistema then
  insert into gp_chamado_eventos(chamado_id,tipo,de,para,autor_usuario,autor_nome) values(p_id,'sistema',a.sistema,n.sistema,p_autor,p_autor_nome);
 end if;
 if n.tipo is distinct from a.tipo then
  insert into gp_chamado_eventos(chamado_id,tipo,de,para,autor_usuario,autor_nome) values(p_id,'tipo',a.tipo,n.tipo,p_autor,p_autor_nome);
 end if;
 if length(trim(coalesce(p_dados->>'comentario','')))>0 then
  insert into gp_chamado_eventos(chamado_id,tipo,texto,autor_usuario,autor_nome) values(p_id,'comentario',left(trim(p_dados->>'comentario'),8000),p_autor,p_autor_nome);
 end if;
 return to_jsonb(n)-'chave';
end $$;
