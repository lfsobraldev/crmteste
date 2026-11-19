/** Telas de acesso (login, primeiro acesso, recuperação e criação de senha) na identidade visual da Gestão de Processos. */
export type ModoAcesso = "login" | "primeiro-acesso" | "recuperar" | "definir-senha";

const olho = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const campoSenha = (id: string, rotulo: string, auto: string, extra = "") => `<div class="fld"><label for="${id}">${rotulo}</label><div class="pw"><input class="inp" id="${id}" type="password" autocomplete="${auto}" maxlength="200" required${extra}><button type="button" class="pw-v" data-ver="${id}" aria-label="Mostrar senha" aria-pressed="false" title="Mostrar senha">${olho}</button></div></div>`;
const campoEmail = (auto = "username") => `<div class="fld"><label for="em">E-mail corporativo</label><input class="inp" id="em" type="email" inputmode="email" autocomplete="${auto}" autocapitalize="none" spellcheck="false" maxlength="160" placeholder="nome@famossul.com.br" required autofocus></div>`;

const FORMS: Record<ModoAcesso, string> = {
  login: `<form class="lg-card" id="f-login" novalidate>
   <div><div class="eyebrow">Acesso corporativo</div><h2>Entrar</h2></div>
   ${campoEmail()}
   ${campoSenha("sn", "Senha", "current-password")}
   <div class="err" id="e" role="alert" hidden></div>
   <button class="btn pri" id="b" type="submit">Entrar</button>
   <div class="lg-links"><a href="/recuperar">Esqueci minha senha</a><a href="/primeiro-acesso">Primeiro acesso</a></div>
   <div class="lg-foot">Acesso exclusivo para colaboradores com e-mail @famossul.com.br.</div>
  </form>`,
  "primeiro-acesso": `<form class="lg-card" id="f-pedido" data-api="/api/auth/primeiro-acesso" novalidate>
   <div><div class="eyebrow">Primeiro acesso</div><h2>Ativar meu acesso</h2></div>
   <p class="lg-p">Informe o seu e-mail corporativo. Se ele foi autorizado pelo administrador, enviaremos um link para você criar a sua senha.</p>
   ${campoEmail("email")}
   <div class="err" id="e" role="alert" hidden></div><div class="note ok" id="ok" role="status" hidden></div>
   <button class="btn pri" id="b" type="submit">Enviar link de ativação</button>
   <div class="lg-links"><a href="/login">Voltar ao login</a></div>
  </form>`,
  recuperar: `<form class="lg-card" id="f-pedido" data-api="/api/auth/recuperar" novalidate>
   <div><div class="eyebrow">Recuperação de senha</div><h2>Esqueci minha senha</h2></div>
   <p class="lg-p">Informe o seu e-mail corporativo. Enviaremos um link para você criar uma nova senha.</p>
   ${campoEmail("email")}
   <div class="err" id="e" role="alert" hidden></div><div class="note ok" id="ok" role="status" hidden></div>
   <button class="btn pri" id="b" type="submit">Enviar link de recuperação</button>
   <div class="lg-links"><a href="/login">Voltar ao login</a></div>
  </form>`,
  "definir-senha": `<form class="lg-card" id="f-senha" novalidate>
   <div><div class="eyebrow" id="ds-eye">Criar senha</div><h2 id="ds-tit">Conferindo o link…</h2></div>
   <p class="lg-p" id="ds-p"></p>
   <div id="ds-campos" hidden>
    ${campoSenha("s1", "Nova senha", "new-password")}
    ${campoSenha("s2", "Repita a nova senha", "new-password")}
    <ul class="req" id="req"><li data-r="len">Pelo menos 8 caracteres</li><li data-r="mix">Letras e números</li><li data-r="eq">As duas senhas iguais</li></ul>
   </div>
   <div class="err" id="e" role="alert" hidden></div>
   <button class="btn pri" id="b" type="submit" hidden>Salvar senha e entrar</button>
   <div class="lg-links" id="ds-links" hidden><a href="/primeiro-acesso">Primeiro acesso</a><a href="/recuperar">Esqueci minha senha</a><a href="/login">Login</a></div>
  </form>`,
};
const TITULO: Record<ModoAcesso, string> = { login: "Entrar", "primeiro-acesso": "Primeiro acesso", recuperar: "Recuperar senha", "definir-senha": "Criar senha" };

export function paginaAcesso(modo: ModoAcesso, v: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex">
<title>${TITULO[modo]} · Gestão de Processos Famossul</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700;6..12,800;6..12,900&display=swap">
<link rel="stylesheet" href="/gp.css?v=${v}">
<style>
body{margin:0}
.lg{min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)}
.lg-a{background:var(--char);color:var(--on-char);padding:48px max(32px,env(safe-area-inset-left,0px));display:flex;flex-direction:column;justify-content:space-between;gap:32px;position:relative;overflow:hidden}
.lg-a::after{content:"";position:absolute;right:-90px;bottom:-60px;width:420px;height:420px;opacity:.06;background:var(--on-char);-webkit-mask:var(--logo) no-repeat 0 50%/auto 100%;mask:var(--logo) no-repeat 0 50%/auto 100%;pointer-events:none}
.lg-a .logo{width:190px}
.lg-a h1{font-size:34px;font-weight:900;letter-spacing:-.02em;line-height:1.1;margin:0 0 10px;max-width:16ch}
.lg-a p{color:var(--on-char-muted);margin:0;max-width:44ch;font-size:15px}
.lg-a ul{list-style:none;margin:22px 0 0;padding:0;display:flex;flex-direction:column;gap:10px;color:var(--on-char-muted);font-weight:700;font-size:14px}
.lg-a li{display:flex;gap:10px;align-items:center}.lg-a li::before{content:"";width:18px;height:3px;border-radius:2px;background:var(--green)}
.lg-b{display:grid;place-items:center;padding:32px 16px;background:var(--bg)}
.lg-card{width:100%;max-width:410px;background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:28px;display:flex;flex-direction:column;gap:16px}
.lg-card h2{margin:0;font-size:22px;font-weight:900}
.lg-card .fld .inp{padding:11px 12px;font-size:15px;width:100%}
.lg-card .btn.pri{justify-content:center;padding:12px 14px;font-size:15px}
.lg-card .btn.pri:disabled{opacity:.6;cursor:default}
.lg-p{margin:0;color:var(--muted);font-size:14px}
.lg-links{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13.5px;font-weight:800}
.lg-links a{color:var(--green-ink);text-decoration:none}.lg-links a:hover{text-decoration:underline}
.lg-foot{font-size:12px;color:var(--faint)}
.pw{position:relative}.pw .inp{padding-right:44px!important}
.pw-v{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:none;color:var(--muted);width:34px;height:34px;border-radius:8px;display:grid;place-items:center}
.pw-v:hover{background:var(--surface-2);color:var(--ink)}.pw-v[aria-pressed="true"]{color:var(--green-ink)}
.req{list-style:none;margin:2px 0 0;padding:0;display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--muted);font-weight:700}
.req li::before{content:"○";display:inline-block;width:18px;color:var(--faint)}.req li.ok{color:var(--green-ink)}.req li.ok::before{content:"✓";color:var(--green-ink)}
#ds-campos{display:flex;flex-direction:column;gap:14px}#ds-campos[hidden]{display:none}
@media (max-width:820px){.lg{grid-template-columns:1fr}.lg-a{padding:28px 20px;gap:18px}.lg-a h1{font-size:24px}.lg-a ul{display:none}.lg-a .logo{width:140px}}
</style></head><body>
<div class="lg">
 <section class="lg-a">
  <div><span class="logo" role="img" aria-label="Famossul"></span><div class="side-sub">Gestão de Processos</div></div>
  <div><h1>Central de Chamados e Gestão de Processos</h1><p>Abra e acompanhe solicitações dos sistemas da empresa e organize tarefas, reuniões e o planejamento do setor.</p>
  <ul><li>Erros, melhorias, dúvidas e acessos</li><li>Fila, kanban e histórico de atendimento</li><li>Agenda e planejamento anual</li></ul></div>
  <div class="lg-foot" style="color:var(--on-char-muted)">Famossul · acesso exclusivo para colaboradores</div>
 </section>
 <section class="lg-b">${FORMS[modo]}</section>
</div>
<script src="/acesso.js?v=${v}" defer></script>
</body></html>`;
}
