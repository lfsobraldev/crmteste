# Origem

Este sistema nasceu do protótipo `gestao-processos-famossul.html` (HTML único com `window.claude.use("db")`).
A dependência da plataforma Claude foi removida:

| No protótipo | Neste sistema |
|---|---|
| `claude.use("db")` (coleção `tarefas`, `config/listas`, `onSnapshot`) | API própria (`/api/*`) + PostgreSQL (`gp_tarefas`, `gp_config`), recarga periódica |
| `claude.use("user")` (`id`, `can("data.write")`) | Login próprio (`gp_usuarios`) com perfis Administrador/Atendente e Solicitante |
| `claude.use("downloads")` | Download comum do navegador (Blob) |
| Modo local (`localStorage`) | Removido; o `localStorage` guarda só preferências de tela (período e modo do calendário) |

`dados-tarefas.json` é a exportação das 13 tarefas do banco do protótipo, para importar em Cadastros.
