# Gestão de Processos Famossul + Central de Chamados

Sistema independente. Tem login próprio, banco PostgreSQL próprio e não depende do ERP nem da plataforma Claude.
Ele junta duas coisas:

- a **Gestão de Processos** que já existia no protótipo: dashboard, agenda, kanban, lista com CSV, planejamento anual e cadastros;
- a **Central de Chamados e Solicitações de Sistemas**: abertura com anexos, fila de atendimento, kanban de chamados, detalhe com comunicação e histórico, e indicadores.

O layout, o logotipo Famossul, as cores (grafite `#2B3332`, verde `#14CD64`, azul `#21759B`), a fonte Nunito Sans e o tema claro/escuro são os do protótipo original.

## Como rodar

Requisitos: Node 20+ e um PostgreSQL 13+ (Neon, Supabase, RDS ou servidor próprio).

```bash
cp .env.example .env.local
npm install
npm run db:migrar
npm run build
npm start
```

- Antes de rodar, preencha no `.env.local` as variáveis da tabela abaixo (banco, segredo, endereço, SMTP e primeiro administrador).
- `npm run db:migrar` cria as tabelas. É idempotente.
- Para desenvolvimento, use `npm run dev`.
- Na **Vercel**: importe o repositório, cadastre as mesmas variáveis em Settings → Environment Variables e rode `npm run db:migrar` uma vez apontando para o banco de produção. Também dá para colar `db/schema.sql` no editor SQL do Neon.

### Variáveis

| Variável | Obrigatória | Uso |
|---|---|---|
| `DATABASE_URL` | sim | String de conexão do PostgreSQL. Com Neon, use a string *pooled*. |
| `AUTH_SECRET` | sim | Segredo do cookie de sessão: 32+ caracteres aleatórios (`openssl rand -hex 32`). |
| `APP_URL` | sim* | Endereço público usado nos links dos e-mails. *Na Vercel, se ficar vazio, usa o domínio de produção. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_TLS_OBRIGATORIO`, `EMAIL_REMETENTE` | sim | Envio dos links de ativação e de recuperação. Funciona com Microsoft 365, Google Workspace ou o servidor de e-mail da empresa. |
| `ADMIN_EMAIL`, `ADMIN_SENHA_INICIAL` | no 1º acesso | Primeiro administrador: e-mail `@famossul.com.br` e senha com 8+ caracteres. Só funcionam enquanto não existir administrador com e-mail. Depois de entrar, troque a senha em **Minha senha**. |
| `SESSAO_HORAS`, `FUSO_HORARIO`, `DB_POOL_MAX` | não | Validade da sessão (padrão 12 h), fuso (padrão `America/Sao_Paulo`) e conexões (padrão 5). |

Nenhuma credencial vem preenchida. O SMTP precisa de uma caixa remetente da empresa: a TI cria a caixa e informa os dados.

### Atualizar uma instalação que já está no ar

1. Rode `npm run db:migrar` de novo, ou cole `db/schema.sql` no Neon. O script é idempotente: cria `gp_tokens` e `gp_limites` e converte `gp_usuarios` para login por e-mail, sem apagar contas nem chamados.
2. Troque `ADMIN_USUARIO` por `ADMIN_EMAIL` e cadastre `APP_URL` e as variáveis de SMTP.
3. Faça o redeploy.
4. As contas da versão anterior, que entravam por nome de usuário, não têm e-mail e por isso não entram mais. Elas aparecem em **Usuários** como "sem e-mail (conta antiga)". Autorize essas pessoas pelo e-mail corporativo e bloqueie as contas antigas.

## Acesso corporativo

- **Somente `@famossul.com.br`**, com o domínio exato. São recusados subdomínios, e-mails pessoais e outros domínios. A checagem é feita no navegador, de novo no servidor e também no banco (constraint em `gp_usuarios.email`).
- **Primeiro acesso:**
  1. O administrador autoriza o e-mail em **Usuários → Autorizar novo usuário**, informando nome, setor e perfil. Ele pode enviar o convite na hora.
  2. Se o convite não foi enviado, a pessoa abre **Primeiro acesso**, informa o e-mail e recebe o link.
  3. A pessoa cria a própria senha. A conta fica ativa e ela já entra.
  4. O administrador nunca vê nem define senhas.
- **Links de ativação e de recuperação:**
  - O token tem 256 bits aleatórios, e o banco guarda só o SHA-256.
  - Valem **30 minutos** e só podem ser usados **uma vez**.
  - Pedir um link novo invalida o anterior. Bloquear a conta invalida os links pendentes.
  - O token é retirado da barra de endereço assim que a página abre.
- **Login:**
  - E-mail e senha, com botão para mostrar a senha.
  - Mensagens claras para conta não ativada, conta bloqueada, senha incorreta e acesso travado.
  - **5 senhas erradas** travam a conta por 15 minutos.
  - Limite por rede: 30 tentativas de login a cada 15 minutos.
  - Limite de pedidos de link: 3 por e-mail e 10 por rede a cada 15 minutos.
  - "Primeiro acesso" e "Esqueci minha senha" dão sempre a mesma resposta, para não revelar quais e-mails estão cadastrados.
- **Senhas:**
  - Guardadas só como hash scrypt com salt por usuário, nunca em texto.
  - Regras: 8+ caracteres, com letras e números, e sem conter o próprio e-mail.
  - Redefinir a senha encerra as sessões abertas em outros aparelhos.
- **Sessão:**
  - Cookie `HttpOnly`, `SameSite=Lax`, `Secure` em HTTPS, assinado com HMAC, válido por 12 h.
  - A cada requisição o servidor confere se a conta continua ativa. Bloquear a conta ou mudar o perfil corta o acesso na hora.

## Perfis e permissões (conferidos no servidor)

| Perfil | Pode |
|---|---|
| **Administrador** | Tudo, inclusive **Usuários**: autorizar e-mails, ativar e bloquear contas, definir perfis, consultar o último acesso e enviar links. |
| **Atendente** | Ver todos os chamados; classificar e priorizar; definir responsável, prazo e status; comentar. Também usa tarefas, agenda, planejamento e cadastros (sistemas, setores…). Não administra usuários. |
| **Solicitante** | Abrir chamados, ver só os próprios, acompanhar, comentar e anexar, e consultar a conclusão. |

Ninguém altera o próprio nível de acesso nem bloqueia a própria conta, e o sistema não deixa ficar sem administrador ativo. Todas as rotas `/api/*` exigem sessão válida e conferem o perfil.

## Funcionamento

### Abrir chamado

O formulário tem título, sistema, tipo, descrição, prioridade e anexos. O solicitante e a data vêm da sessão.

- **Tipos:** Erro, Melhoria, Dúvida, Acesso e Nova funcionalidade.
- **Prioridades:** Baixa, Média, Alta e Crítica.
- **Sistemas iniciais:** Famossul | Gestão de Produção, Tetto Revest, Inventário, Porta Certa e Outros. A lista é editável em Cadastros.

### Anexos

- Ficam no banco (`bytea`): até 3 MB por arquivo e 20 por chamado.
- O tipo é conferido pelo conteúdo do arquivo. Aceita imagens, PDF, DOCX/XLSX/PPTX, ZIP, TXT e CSV.

### Fila e Kanban

- Cada chamado tem um **número único** (`#0001`).
- A fila tem busca, filtros (em aberto, atrasados, comigo, sem responsável, por sistema, tipo, status e prioridade), ordenação por coluna e CSV.
- O Kanban tem as colunas Novos, Em triagem, Em andamento, Aguardando retorno e Concluídos. Arrastar o cartão muda o status.

### Detalhe do chamado

- Mostra a descrição, os arquivos e a comunicação entre solicitante e atendimento.
- O **histórico é automático**: abertura, status, prioridade, responsável, prazo, sistema, tipo, comentários e anexos.

### Dashboard

Mostra os chamados novos, em andamento, aguardando retorno, atrasados e concluídos, mais as demandas em aberto por sistema e por prioridade. Logo abaixo vêm os indicadores de tarefas do protótipo.

### Regras

- **Atrasado:** chamado não concluído com prazo vencido. O valor é calculado, não gravado.
- **Sem duplicados:**
  - cada formulário envia uma chave única, então dois cliques no mesmo envio não criam dois chamados;
  - o mesmo título, para o mesmo sistema, com um chamado do mesmo solicitante ainda aberto, é recusado e a mensagem informa o número existente.
- **Concorrência:** o chamado tem versão. Se duas pessoas alterarem ao mesmo tempo, a segunda recebe um aviso e nada é sobrescrito.
- **Atualização:** a tela recarrega a cada 30 s, quando a aba volta a ficar visível e depois de cada ação. Se a sessão expirar, a tela leva ao login.

### Migração do protótipo

Em **Cadastros → Importar tarefas**, escolha `docs/dados-tarefas.json`, que traz as 13 tarefas exportadas. Importar de novo não duplica, porque o id original é mantido.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `app/route.ts`, `app/login`, `app/primeiro-acesso`, `app/recuperar`, `app/definir-senha` | Páginas (sem login, `/` redireciona para `/login`) |
| `app/api/*` | `auth/login`, `auth/logout`, `auth/senha`, `auth/primeiro-acesso`, `auth/recuperar`, `auth/token`, `auth/definir-senha`, `sessao`, `usuarios` (+ `convite`), `chamados` (+ `comentarios`, `anexos`), `tarefas` (+ `importar`), `listas` |
| `lib/regras.ts` | Validações, permissões, recorrência e tipos de anexo (puro, testado) |
| `lib/auth.ts`, `lib/tokens.ts`, `lib/limites.ts`, `lib/email.ts`, `lib/links.ts` | Sessão, links de uso único, limite de tentativas e envio por SMTP |
| `lib/db.ts`, `lib/servidor.ts`, `lib/consultas.ts` | Banco, permissões e erros |
| `lib/pagina.ts`, `lib/login-pagina.ts`, `public/gp.css`, `public/gp.js`, `public/acesso.js` | Interface (HTML/CSS/JS do protótipo, adaptado) |
| `db/schema.sql`, `scripts/migrar.mjs` | Estrutura do banco e aplicação |
| `tests/` | `npm test`: regras, login e banco (PGlite, sem servidor externo) |

## Fora do escopo (a definir pela TI)

- **Notificações por e-mail ou WhatsApp:** exigem um serviço de envio e credenciais, que não foram criados.
- **Login único (SSO) com Microsoft 365 ou Google:** hoje o login é por e-mail corporativo e senha própria do sistema.
- **Exclusão de chamados ou anexos:** o histórico é preservado de propósito.
