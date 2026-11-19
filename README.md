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

- Antes de rodar, preencha `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_USUARIO` e `ADMIN_SENHA_INICIAL` no `.env.local`.
- `npm run db:migrar` cria as tabelas. É idempotente.
- Para desenvolvimento, use `npm run dev`.
- Na **Vercel**: importe o repositório, cadastre as mesmas variáveis em Settings → Environment Variables e rode `npm run db:migrar` uma vez apontando para o banco de produção. Também dá para colar `db/schema.sql` no editor SQL do Neon.

### Variáveis

| Variável | Obrigatória | Uso |
|---|---|---|
| `DATABASE_URL` | sim | String de conexão do PostgreSQL. Com Neon, use a string *pooled*. |
| `AUTH_SECRET` | sim | Segredo do cookie de sessão. Use 32 caracteres aleatórios ou mais (`openssl rand -hex 32`). |
| `ADMIN_USUARIO`, `ADMIN_SENHA_INICIAL` | no 1º acesso | Criam o primeiro administrador no primeiro login, e só se ainda não houver nenhum administrador. Depois, troque a senha em **Minha senha**. |
| `SESSAO_HORAS` | não | Validade da sessão, de 1 a 24 h. O padrão é 12. |
| `FUSO_HORARIO` | não | Fuso usado para "hoje" e para o cálculo de atraso. O padrão é `America/Sao_Paulo`. |
| `DB_POOL_MAX` | não | Número de conexões por instância. O padrão é 5. |

Nenhuma credencial vem preenchida. Banco, hospedagem e domínio são definidos pela TI.

## Perfis e permissões (conferidos no servidor)

| Perfil | Pode |
|---|---|
| **Administrador / Atendente** | Ver todos os chamados; classificar e priorizar; definir responsável e prazo; mudar o status; comentar; gerenciar cadastros e usuários; usar tarefas, agenda e planejamento. |
| **Solicitante** | Abrir chamados; ver só os próprios; acompanhar o andamento; comentar e anexar informações; consultar a conclusão. |

- Os usuários são criados pelo administrador em **Cadastros → Gerenciar usuários**. Não há cadastro aberto.
- Trocar a senha, o perfil ou desativar uma conta encerra as sessões abertas dessa pessoa.
- O sistema não deixa ficar sem administrador ativo.
- Depois de 8 senhas erradas, a conta fica bloqueada por 15 minutos.

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
| `app/route.ts`, `app/login/route.ts` | Páginas (sem login, `/` redireciona para `/login`) |
| `app/api/*` | `auth/login`, `auth/logout`, `auth/senha`, `sessao`, `usuarios`, `chamados` (+ `comentarios`, `anexos`), `tarefas` (+ `importar`), `listas` |
| `lib/regras.ts` | Validações, permissões, recorrência e tipos de anexo (puro, testado) |
| `lib/auth.ts`, `lib/db.ts`, `lib/servidor.ts`, `lib/consultas.ts` | Login, banco, sessão e erros |
| `lib/pagina.ts`, `lib/login-pagina.ts`, `public/gp.css`, `public/gp.js` | Interface (HTML/CSS/JS do protótipo, adaptado) |
| `db/schema.sql`, `scripts/migrar.mjs` | Estrutura do banco e aplicação |
| `tests/` | `npm test`: regras, login e banco (PGlite, sem servidor externo) |

## Fora do escopo (a definir pela TI)

- **Notificações por e-mail ou WhatsApp:** exigem um serviço de envio e credenciais, que não foram criados.
- **Login corporativo (Microsoft/Google/AD):** hoje o login é próprio (usuário e senha).
- **Recuperação de senha por e-mail:** hoje o administrador redefine a senha em Cadastros.
- **Exclusão de chamados ou anexos:** o histórico é preservado de propósito.
